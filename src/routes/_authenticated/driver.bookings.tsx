import { createFileRoute } from "@tanstack/react-router";
import {
  LayoutDashboard,
  CalendarClock,
  History,
  User,
  QrCode as QrIcon,
  Receipt,
  CreditCard,
  KeyRound,
  LogOut,
  Copy,
  Check,
  CheckCircle2,
  Clock,
  ShieldCheck,
  XCircle,
} from "lucide-react";
import { RoleGuard } from "@/components/RoleGuard";
import { PortalShell } from "@/components/PortalShell";
import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "@/lib/use-role";
import { calcAmount } from "@/lib/pricing";
import { toast } from "sonner";
import { downloadInvoice } from "@/lib/invoice";
import { triggerGate } from "@/lib/prototype-mode";
import { getDemoRole } from "@/lib/demo-auth";
import {
  useDemoState,
  approveDemoEntry,
  approveDemoExit,
  cancelDemoBooking,
} from "@/lib/demo-state-store";
import { HardwareStatusCard } from "@/components/HardwareStatusCard";

export const Route = createFileRoute("/_authenticated/driver/bookings")({
  component: () => (
    <RoleGuard allow="driver">
      <DriverBookings />
    </RoleGuard>
  ),
});

const NAV = [
  { to: "/driver/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/driver/bookings", label: "My Bookings", icon: CalendarClock },
  { to: "/driver/history", label: "History", icon: History },
  { to: "/driver/profile", label: "Profile", icon: User },
];

type Booking = {
  id: string;
  booking_code: string;
  vehicle_number: string;
  status: "reserved" | "active" | "completed" | "cancelled";
  entry_time: string | null;
  exit_time: string | null;
  duration_minutes: number | null;
  amount: number | null;
  payment_status: "unpaid" | "paid";
  created_at: string;
  slot_id: string;
  exit_requested: boolean;
  parking_slots: { code: string } | null;
};

function DriverBookings() {
  const { userId } = useCurrentUser();
  const { bookings: demoBookingsList } = useDemoState();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [qrModal, setQrModal] = useState<{
    type: "ENTRY" | "EXIT";
    data: string;
    url: string;
    booking: Booking;
  } | null>(null);
  const [payDialog, setPayDialog] = useState<Booking | null>(null);
  const [payMethod, setPayMethod] = useState<"Cash" | "UPI" | "Card">("UPI");
  const [copied, setCopied] = useState(false);
  const [now, setNow] = useState(Date.now());
  const [busy, setBusy] = useState(false);

  // Real-time ticker for active parking duration counters
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  async function load() {
    if (!userId) return;
    if (getDemoRole()) {
      setBookings(
        demoBookingsList.map((d) => ({
          id: d.id,
          booking_code: d.booking_code,
          slot_id: d.slot_id,
          vehicle_number: d.vehicle_number,
          status: d.status,
          entry_time: d.entry_time,
          exit_time: d.exit_time,
          duration_minutes: d.duration_minutes,
          amount: d.amount,
          exit_requested: d.status === "active",
          payment_status: d.payment_status,
          created_at: d.created_at,
          parking_slots: { code: d.slot_code },
        })) as unknown as Booking[]
      );
      return;
    }
    try {
      const { data } = await supabase
        .from("bookings")
        .select("*, parking_slots(code)")
        .eq("user_id", userId)
        .in("status", ["reserved", "active", "completed"])
        .order("created_at", { ascending: false })
        .limit(10);
      setBookings((data ?? []) as unknown as Booking[]);
    } catch (e) {
      console.error(e);
    }
  }

  useEffect(() => {
    load();
    if (getDemoRole()) {
      const h = () => load();
      window.addEventListener("smartpark:demo-state-update", h);
      window.addEventListener("storage", h);
      return () => {
        window.removeEventListener("smartpark:demo-state-update", h);
        window.removeEventListener("storage", h);
      };
    }
    const ch = supabase
      .channel("driver_bookings")
      .on("postgres_changes", { event: "*", schema: "public", table: "bookings" }, () => load())
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, demoBookingsList]);

  async function makeQR(b: Booking, type: "ENTRY" | "EXIT") {
    const payload = JSON.stringify({
      bookingId: b.booking_code,
      userId: userId || "demo-driver-id",
      slot: b.parking_slots?.code,
      vehicle: b.vehicle_number,
      timestamp: new Date().toISOString(),
      type,
    });
    const url = await QRCode.toDataURL(payload, { width: 300, margin: 2 });
    setQrModal({ type, data: payload, url, booking: b });
  }

  // =========================================================
  // ALLOW ENTRY (Real timestamp, Active Status & Servo Gate)
  // =========================================================
  async function allowEntry(b: Booking) {
    if (busy) return;
    if (b.entry_time || b.status === "active" || b.status === "completed") {
      toast.info("Entry already allowed");
      return;
    }
    setBusy(true);

    try {
      if (getDemoRole()) {
        await approveDemoEntry(b.booking_code, "Demo Driver");
        setQrModal(null);
        toast.success("Entry Allowed — Servo Gate Command Sent!");
        setBusy(false);
        return;
      }

      const nowStr = new Date().toISOString();
      await supabase.from("bookings").update({ status: "active", entry_time: nowStr }).eq("id", b.id);
      if (b.slot_id) {
        await supabase.from("parking_slots").update({ status: "occupied" }).eq("id", b.slot_id);
      }

      if (typeof window !== "undefined" && b.parking_slots?.code) {
        const slotCode = b.parking_slots.code.toUpperCase().replace(/[^A-Z0-9]/g, "");
        window.dispatchEvent(
          new CustomEvent("smartpark:slot-sensor", {
            detail: { slotCode, status: "occupied" },
          })
        );
      }

      setQrModal(null);
      setBookings((prev) =>
        prev.map((item) => (item.id === b.id ? { ...item, status: "active", entry_time: nowStr } : item))
      );

      triggerGate(b.booking_code, "ENTRY").catch(() => {});
      toast.success("Entry Allowed — Servo Gate Command Sent!");
    } catch (err: any) {
      toast.error("Entry error: " + (err?.message || "Failed"));
    } finally {
      setBusy(false);
    }
  }

  // =========================================================
  // ALLOW EXIT (Real timestamp, Duration, Bill & Servo Gate)
  // =========================================================
  async function allowExit(b: Booking) {
    if (busy) return;
    if (b.exit_time || b.status === "completed") {
      toast.info("Exit already allowed");
      return;
    }
    setBusy(true);

    try {
      if (getDemoRole()) {
        const res = await approveDemoExit(b.booking_code, payMethod, "Demo Driver");
        setQrModal(null);
        setPayDialog({
          ...b,
          status: "completed",
          duration_minutes: res.booking.duration_minutes,
          amount: res.booking.amount,
          payment_status: "paid",
        });
        toast.success(`Exit Allowed — Bill Generated (₹${res.fee.total.toFixed(2)}) & Servo Command Sent!`);
        setBusy(false);
        return;
      }

      const exitDate = new Date();
      const exitStr = exitDate.toISOString();
      const entryDate = b.entry_time ? new Date(b.entry_time) : (b.created_at ? new Date(b.created_at) : exitDate);
      const durationMinutes = Math.max(1, Math.round((exitDate.getTime() - entryDate.getTime()) / 60000));
      const pricing = calcAmount(durationMinutes);

      await supabase
        .from("bookings")
        .update({
          status: "completed",
          exit_time: exitStr,
          duration_minutes: durationMinutes,
          amount: pricing.total,
        })
        .eq("id", b.id);
      if (b.slot_id) {
        await supabase.from("parking_slots").update({ status: "available" }).eq("id", b.slot_id);
      }

      if (typeof window !== "undefined" && b.parking_slots?.code) {
        const slotCode = b.parking_slots.code.toUpperCase().replace(/[^A-Z0-9]/g, "");
        window.dispatchEvent(
          new CustomEvent("smartpark:slot-sensor", {
            detail: { slotCode, status: "available" },
          })
        );
      }

      try {
        downloadInvoice({
          booking_code: b.booking_code,
          vehicle_number: b.vehicle_number,
          entry_time: entryDate.toISOString(),
          exit_time: exitStr,
          duration_minutes: durationMinutes,
          amount: pricing.total,
          payment_status: b.payment_status,
          slot: b.parking_slots?.code,
        });
      } catch {}

      const completedBooking: Booking = {
        ...b,
        status: "completed",
        exit_time: exitStr,
        duration_minutes: durationMinutes,
        amount: pricing.total,
      };

      setQrModal(null);
      setBookings((prev) =>
        prev.map((item) => (item.id === b.id ? completedBooking : item))
      );
      setPayDialog(completedBooking);

      triggerGate(b.booking_code, "EXIT").catch(() => {});
      toast.success(`Exit Allowed — Bill Generated (₹${pricing.total.toFixed(2)}) & Servo Command Sent!`);
    } catch (err: any) {
      toast.error("Exit error: " + (err?.message || "Failed"));
    } finally {
      setBusy(false);
    }
  }

  async function cancelReservation(b: Booking) {
    if (!confirm(`Cancel reservation for ${b.booking_code}?`)) return;
    setBusy(true);
    try {
      if (getDemoRole()) {
        cancelDemoBooking(b.booking_code, "Demo Driver");
        toast.success("Reservation cancelled. Slot is now available.");
        setBusy(false);
        return;
      }
      await supabase.from("bookings").update({ status: "cancelled" }).eq("id", b.id);
      if (b.slot_id) {
        await supabase.from("parking_slots").update({ status: "available" }).eq("id", b.slot_id);
      }
      toast.success("Reservation cancelled.");
    } catch (err: any) {
      toast.error(err?.message || "Failed to cancel.");
    } finally {
      setBusy(false);
    }
  }

  async function payNow(b: Booking) {
    setBusy(true);
    if (getDemoRole()) {
      toast.success(`Payment Completed via ${payMethod}`);
      setPayDialog(null);
      setBusy(false);
      return;
    }
    try {
      await supabase.from("bookings").update({ payment_status: "paid" }).eq("id", b.id);
    } catch {}
    setBookings((prev) =>
      prev.map((item) => (item.id === b.id ? { ...item, payment_status: "paid" } : item))
    );
    toast.success(`Payment Completed via ${payMethod}`);
    setPayDialog(null);
    setBusy(false);
  }

  async function copyId(code: string) {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      toast.success("Booking ID copied");
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error("Copy failed");
    }
  }

  return (
    <PortalShell title="Driver Portal" nav={NAV}>
      <div className="space-y-4">
        <HardwareStatusCard />
        <h2 className="text-2xl font-bold">My Bookings</h2>
        {bookings.length === 0 && (
          <div className="rounded-2xl border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
            No active bookings. Book a slot from the dashboard.
          </div>
        )}
        <div className="grid gap-4">
          {bookings.map((b) => {
            const invoice =
              b.duration_minutes != null ? calcAmount(b.duration_minutes) : null;

            // Live active parking duration counter
            let liveDurationText = "—";
            if (b.status === "active" && b.entry_time) {
              const start = new Date(b.entry_time).getTime();
              const diffSec = Math.max(0, Math.floor((now - start) / 1000));
              const hours = Math.floor(diffSec / 3600);
              const mins = Math.floor((diffSec % 3600) / 60);
              const secs = diffSec % 60;
              liveDurationText = hours > 0 ? `${hours}h ${mins}m ${secs}s` : `${mins}m ${secs}s`;
            } else if (b.duration_minutes != null) {
              const hours = Math.floor(b.duration_minutes / 60);
              const mins = b.duration_minutes % 60;
              liveDurationText = hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;
            }

            return (
              <div key={b.id} className="rounded-2xl border border-border bg-card p-5 shadow-sm">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="text-xs text-muted-foreground">Booking ID</div>
                    <div className="text-lg font-bold flex items-center gap-2">
                      {b.booking_code}
                      <button
                        onClick={() => copyId(b.booking_code)}
                        className="text-xs font-normal text-muted-foreground hover:text-foreground"
                      >
                        {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                      </button>
                    </div>
                  </div>
                  <StatusBadge status={b.status} />
                </div>

                <div className="mt-4 grid gap-3 text-sm sm:grid-cols-2 md:grid-cols-4">
                  <Info label="Slot" value={b.parking_slots?.code ?? "—"} />
                  <Info label="Vehicle" value={b.vehicle_number} />
                  <Info
                    label="Entry Time"
                    value={b.entry_time ? new Date(b.entry_time).toLocaleString() : "Awaiting Entry"}
                  />
                  <Info
                    label="Exit Time"
                    value={b.exit_time ? new Date(b.exit_time).toLocaleString() : b.status === "active" ? "Parking Active" : "—"}
                  />
                  <Info
                    label="Duration"
                    value={b.status === "active" ? liveDurationText : b.duration_minutes ? `${b.duration_minutes} min` : "—"}
                  />
                  <Info label="Amount" value={b.amount != null ? `₹${b.amount.toFixed(2)}` : "—"} />
                  <Info label="Payment Status" value={b.payment_status === "paid" ? "Paid" : "Unpaid"} />
                </div>

                <Timeline b={b} />

                {/* Completed Bill Breakdown */}
                {b.status === "completed" && invoice && (
                  <div className="mt-4 rounded-xl border border-border bg-muted/40 p-4 text-sm space-y-2">
                    <div className="font-bold flex items-center justify-between">
                      <span>Parking Completed — Bill Breakdown</span>
                      <span className="text-xs font-normal text-muted-foreground">
                        {b.payment_status === "paid" ? "Payment Completed" : "Payment Pending"}
                      </span>
                    </div>
                    <div className="grid grid-cols-2 gap-1 text-xs text-muted-foreground">
                      <span>Entry Time:</span>
                      <span className="text-right text-foreground font-medium">
                        {b.entry_time ? new Date(b.entry_time).toLocaleString() : "—"}
                      </span>
                      <span>Exit Time:</span>
                      <span className="text-right text-foreground font-medium">
                        {b.exit_time ? new Date(b.exit_time).toLocaleString() : "—"}
                      </span>
                      <span>Parking Duration:</span>
                      <span className="text-right text-foreground font-medium">
                        {b.duration_minutes} min ({invoice.hours} h billed)
                      </span>
                      <span>Hourly Rate:</span>
                      <span className="text-right text-foreground font-medium">₹50.00 / h</span>
                      <span>Parking Charge:</span>
                      <span className="text-right text-foreground font-medium">₹{invoice.base.toFixed(2)}</span>
                      <span>GST (18%):</span>
                      <span className="text-right text-foreground font-medium">₹{invoice.gst.toFixed(2)}</span>
                      <span className="font-bold text-foreground">Final Amount:</span>
                      <span className="text-right font-bold text-foreground text-sm">
                        ₹{invoice.total.toFixed(2)}
                      </span>
                    </div>
                  </div>
                )}

                <div className="mt-4 flex flex-wrap gap-2">
                  {/* Before Entry: Show Entry QR & Allow Entry */}
                  {b.status === "reserved" && (
                    <>
                      <button
                        onClick={() => makeQR(b, "ENTRY")}
                        className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground hover:bg-primary/90"
                      >
                        <QrIcon className="h-4 w-4" /> Show Entry QR
                      </button>

                      <button
                        onClick={() => allowEntry(b)}
                        disabled={busy}
                        className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
                      >
                        <ShieldCheck className="h-4 w-4" /> ALLOW ENTRY
                      </button>

                      <button
                        onClick={() => cancelReservation(b)}
                        disabled={busy}
                        className="inline-flex items-center gap-2 rounded-lg border border-destructive/40 text-destructive px-3 py-2 text-xs font-semibold hover:bg-destructive/10"
                      >
                        <XCircle className="h-4 w-4" /> Cancel Booking
                      </button>
                    </>
                  )}

                  {/* Active Parking: Show Exit QR & Allow Exit */}
                  {b.status === "active" && (
                    <>
                      <button
                        onClick={() => makeQR(b, "EXIT")}
                        className="inline-flex items-center gap-2 rounded-lg bg-amber-600 px-4 py-2 text-xs font-semibold text-white hover:bg-amber-700"
                      >
                        <QrIcon className="h-4 w-4" /> Show Exit QR
                      </button>

                      <button
                        onClick={() => allowExit(b)}
                        disabled={busy}
                        className="inline-flex items-center gap-2 rounded-lg bg-amber-600 px-4 py-2 text-xs font-semibold text-white hover:bg-amber-700 disabled:opacity-50"
                      >
                        <LogOut className="h-4 w-4" /> ALLOW EXIT
                      </button>
                    </>
                  )}

                  {/* Payment Button */}
                  {b.status === "completed" && b.payment_status === "unpaid" && (
                    <button
                      onClick={() => setPayDialog(b)}
                      className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-5 py-2.5 text-xs font-bold text-white shadow hover:bg-emerald-700"
                    >
                      <CreditCard className="h-4 w-4" /> PAY BILL
                    </button>
                  )}

                  {/* Invoice Download Button */}
                  {invoice && b.status === "completed" && (
                    <button
                      onClick={() =>
                        downloadInvoice({
                          booking_code: b.booking_code,
                          vehicle_number: b.vehicle_number,
                          entry_time: b.entry_time,
                          exit_time: b.exit_time,
                          duration_minutes: b.duration_minutes,
                          amount: b.amount,
                          payment_status: b.payment_status,
                          slot: b.parking_slots?.code,
                        })
                      }
                      className="inline-flex items-center gap-2 rounded-lg border border-input px-4 py-2 text-xs font-semibold hover:bg-muted"
                    >
                      <Receipt className="h-4 w-4" /> Download Invoice
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* QR MODAL WITH ALLOW ENTRY / ALLOW EXIT BUTTONS */}
      {qrModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
          onClick={() => setQrModal(null)}
        >
          <div
            className="w-full max-w-sm rounded-2xl bg-card p-6 text-center shadow-2xl space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-bold">{qrModal.type} QR CODE</h3>
            <p className="text-xs text-muted-foreground">
              Show this QR at the gate scanner or press below to approve entry/exit.
            </p>
            <img src={qrModal.url} alt="QR" className="mx-auto rounded-lg border border-border p-2 bg-white" />

            <div className="pt-2">
              {qrModal.type === "ENTRY" && (
                <button
                  onClick={() => allowEntry(qrModal.booking)}
                  disabled={busy || qrModal.booking.status === "active" || qrModal.booking.status === "completed"}
                  className="w-full rounded-xl bg-emerald-600 py-3 text-sm font-bold text-white shadow hover:bg-emerald-700 active:scale-95 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  <ShieldCheck className="h-4 w-4" /> ALLOW ENTRY
                </button>
              )}

              {qrModal.type === "EXIT" && (
                <button
                  onClick={() => allowExit(qrModal.booking)}
                  disabled={busy || qrModal.booking.status === "completed"}
                  className="w-full rounded-xl bg-amber-600 py-3 text-sm font-bold text-white shadow hover:bg-amber-700 active:scale-95 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  <LogOut className="h-4 w-4" /> ALLOW EXIT
                </button>
              )}
            </div>

            <button
              onClick={() => setQrModal(null)}
              className="w-full rounded-lg border border-input py-2 text-xs font-semibold text-muted-foreground hover:bg-muted"
            >
              Close Modal
            </button>
          </div>
        </div>
      )}

      {/* Payment Dialog */}
      {payDialog && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
          onClick={() => setPayDialog(null)}
        >
          <div
            className="w-full max-w-sm rounded-2xl bg-card p-6 shadow-2xl space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-bold">Pay Parking Bill</h3>
            <p className="text-xs text-muted-foreground">
              Booking {payDialog.booking_code} · Total: ₹{payDialog.amount?.toFixed(2)}
            </p>
            <div className="grid grid-cols-3 gap-2">
              {(["Cash", "UPI", "Card"] as const).map((m) => (
                <button
                  key={m}
                  onClick={() => setPayMethod(m)}
                  className={`rounded-lg border px-3 py-2 text-sm font-semibold ${
                    payMethod === m
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-input"
                  }`}
                >
                  {m}
                </button>
              ))}
            </div>
            <button
              onClick={() => payNow(payDialog)}
              disabled={busy}
              className="w-full rounded-xl bg-emerald-600 py-3 text-sm font-bold text-white shadow hover:bg-emerald-700"
            >
              Confirm ₹{payDialog.amount?.toFixed(2)} Paid
            </button>
          </div>
        </div>
      )}
    </PortalShell>
  );
}

function StatusBadge({ status }: { status: Booking["status"] }) {
  const map: Record<Booking["status"], { label: string; tone: string }> = {
    reserved: { label: "Reserved", tone: "bg-amber-500/15 text-amber-700 dark:text-amber-500" },
    active: { label: "Parking Active", tone: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400" },
    completed: { label: "Completed", tone: "bg-blue-500/15 text-blue-700 dark:text-blue-400" },
    cancelled: { label: "Cancelled", tone: "bg-destructive/15 text-destructive" },
  };
  const b = map[status] ?? { label: status, tone: "bg-muted text-muted-foreground" };
  return (
    <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold uppercase ${b.tone}`}>
      {b.label}
    </span>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[10px] uppercase text-muted-foreground">{label}</div>
      <div className="font-medium">{value}</div>
    </div>
  );
}

function Timeline({ b }: { b: Booking }) {
  const steps = [
    { label: "Booked", done: true },
    { label: "Entered", done: !!b.entry_time || b.status === "active" || b.status === "completed" },
    { label: "Exited", done: !!b.exit_time || b.status === "completed" },
    { label: "Paid", done: b.payment_status === "paid" },
  ];
  return (
    <div className="mt-4 flex items-center justify-between border-t border-border pt-4">
      {steps.map((s, i) => (
        <div key={s.label} className="flex items-center gap-2">
          <div
            className={`flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-bold ${
              s.done ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
            }`}
          >
            {s.done ? "✓" : i + 1}
          </div>
          <span className={`text-xs ${s.done ? "font-semibold text-foreground" : "text-muted-foreground"}`}>
            {s.label}
          </span>
        </div>
      ))}
    </div>
  );
}
