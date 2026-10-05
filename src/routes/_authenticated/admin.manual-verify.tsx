import { createFileRoute, useSearch } from "@tanstack/react-router";
import { RoleGuard } from "@/components/RoleGuard";
import { PortalShell } from "@/components/PortalShell";
import { PrototypeBadge } from "@/components/PrototypeBadge";
import { ADMIN_NAV } from "./admin.dashboard";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { calcAmount } from "@/lib/pricing";
import { triggerGate, usePrototypeMode, getPrototypeMode } from "@/lib/prototype-mode";
import { getDemoRole } from "@/lib/demo-auth";
import { getDemoBookings, updateDemoBooking } from "@/lib/demo-booking-store";
import { downloadInvoice } from "@/lib/invoice";
import { hardwareLogger } from "@/lib/hardware/HardwareLogger";
import { Search, DoorOpen, CheckCircle2, XCircle, Receipt, CreditCard } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin/manual-verify")({
  validateSearch: (s: Record<string, unknown>) => ({
    mode: (s.mode as "entry" | "exit") ?? "entry",
    q: (s.q as string) ?? "",
  }),
  component: () => (
    <RoleGuard allow="admin">
      <ManualVerify />
    </RoleGuard>
  ),
});

function ManualVerify() {
  const search = useSearch({ from: "/_authenticated/admin/manual-verify" });
  const [mode, setMode] = useState<"entry" | "exit">(search.mode);
  const [q, setQ] = useState(search.q);
  const [results, setResults] = useState<any[]>([]);
  const [busy, setBusy] = useState(false);
  const [prototype] = usePrototypeMode();
  const [payDialog, setPayDialog] = useState<any | null>(null);
  const [payMethod, setPayMethod] = useState<"cash" | "upi" | "card">("cash");

  async function loadDefaults(currentMode: "entry" | "exit") {
    setBusy(true);
    const targetStatus = currentMode === "entry" ? "reserved" : "active";

    if (getDemoRole() || getPrototypeMode()) {
      const demoList = getDemoBookings();
      const filtered = demoList
        .filter((d) => d.status === targetStatus)
        .map((d) => ({
          id: d.id,
          booking_code: d.booking_code,
          slot_id: d.slot_id,
          vehicle_number: d.vehicle_number,
          status: d.status,
          entry_time: d.entry_time,
          exit_time: d.exit_time,
          duration_minutes: d.duration_minutes,
          amount: d.amount,
          payment_status: d.payment_status,
          created_at: d.created_at,
          parking_slots: { code: d.slot_code },
          profiles: { full_name: d.driver_name, phone: "+91 98765 43210" },
        }));
      setResults(filtered);
      setBusy(false);
      return;
    }

    let query = supabase
      .from("bookings")
      .select("*, parking_slots(code), profiles!bookings_user_id_fkey(full_name, phone)")
      .eq("status", targetStatus);
    if (currentMode === "exit") {
      query = query.order("exit_requested", { ascending: false });
    }
    const { data } = await query.order("created_at", { ascending: false }).limit(30);
    setResults(data ?? []);
    setBusy(false);
  }

  useEffect(() => {
    if (!q.trim()) loadDefaults(mode);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode]);

  useEffect(() => {
    if (getDemoRole() || getPrototypeMode()) {
      const h = () => {
        if (!q.trim()) loadDefaults(mode);
      };
      window.addEventListener("smartpark:demo-bookings-update", h);
      window.addEventListener("storage", h);
      return () => {
        window.removeEventListener("smartpark:demo-bookings-update", h);
        window.removeEventListener("storage", h);
      };
    }
    const ch = supabase
      .channel("manual_verify")
      .on("postgres_changes", { event: "*", schema: "public", table: "bookings" }, () => {
        if (!q.trim()) loadDefaults(mode);
      })
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, q]);

  async function runSearch() {
    if (!q.trim()) {
      loadDefaults(mode);
      return;
    }
    setBusy(true);
    const term = q.trim().toUpperCase();

    if (getDemoRole() || getPrototypeMode()) {
      const demoList = getDemoBookings();
      const filtered = demoList
        .filter(
          (d) =>
            d.booking_code.toUpperCase().includes(term) ||
            d.vehicle_number.toUpperCase().includes(term)
        )
        .map((d) => ({
          id: d.id,
          booking_code: d.booking_code,
          slot_id: d.slot_id,
          vehicle_number: d.vehicle_number,
          status: d.status,
          entry_time: d.entry_time,
          exit_time: d.exit_time,
          duration_minutes: d.duration_minutes,
          amount: d.amount,
          payment_status: d.payment_status,
          created_at: d.created_at,
          parking_slots: { code: d.slot_code },
          profiles: { full_name: d.driver_name, phone: "+91 98765 43210" },
        }));
      setResults(filtered);
      setBusy(false);
      if (filtered.length === 0) toast.error("No matching bookings");
      return;
    }

    const { data } = await supabase
      .from("bookings")
      .select("*, parking_slots(code), profiles!bookings_user_id_fkey(full_name, phone)")
      .or(`booking_code.ilike.%${term}%,vehicle_number.ilike.%${term}%`)
      .order("created_at", { ascending: false })
      .limit(20);
    setResults(data ?? []);
    setBusy(false);
    if ((data ?? []).length === 0) toast.error("No matching bookings");
  }

  async function refresh() {
    if (q.trim()) runSearch();
    else loadDefaults(mode);
  }

  async function allowEntry(b: any) {
    const now = new Date().toISOString();
    if (getDemoRole() || getPrototypeMode() || b.id.startsWith("demo-")) {
      updateDemoBooking(b.booking_code, { status: "active", entry_time: now });
      triggerGate(b.booking_code, "ENTRY").catch(() => {});
      hardwareLogger.log("Manual Entry Approved", `Booking: ${b.booking_code}`);
      toast.success("Vehicle Entry Approved Successfully.");
      refresh();
      return;
    }

    try {
      await supabase
        .from("bookings")
        .update({ status: "active", entry_time: now })
        .eq("id", b.id);
      if (b.slot_id) {
        await supabase.from("parking_slots").update({ status: "occupied" }).eq("id", b.slot_id);
      }
    } catch (e) {
      console.warn("DB update skipped/failed:", e);
    }

    triggerGate(b.booking_code, "ENTRY").catch(() => {});
    hardwareLogger.log("Manual Entry Approved", `Booking: ${b.booking_code}`);
    toast.success("Vehicle Entry Approved Successfully.");
    refresh();
  }

  async function processExit(b: any) {
    const entry = b.entry_time ? new Date(b.entry_time) : (b.created_at ? new Date(b.created_at) : new Date());
    const exit = new Date();
    const minutes = Math.max(1, Math.round((exit.getTime() - entry.getTime()) / 60000));
    const { total } = calcAmount(minutes);

    if (getDemoRole() || getPrototypeMode() || b.id.startsWith("demo-")) {
      updateDemoBooking(b.booking_code, {
        status: "completed",
        exit_time: exit.toISOString(),
        duration_minutes: minutes,
        amount: total,
        payment_status: "paid",
      });

      triggerGate(b.booking_code, "EXIT").catch(() => {});
      hardwareLogger.log("Manual Exit Approved", `Booking: ${b.booking_code}`);
      toast.success(`Exit recorded · ₹${total}`);

      try {
        downloadInvoice({
          booking_code: b.booking_code,
          vehicle_number: b.vehicle_number,
          entry_time: entry.toISOString(),
          exit_time: exit.toISOString(),
          duration_minutes: minutes,
          amount: total,
          payment_status: "paid",
          slot: b.parking_slots?.code || "A1",
          driver_name: b.profiles?.full_name || "Demo Driver",
        });
      } catch (invErr) {
        console.error("Invoice download exception:", invErr);
      }
      refresh();
      return;
    }

    try {
      await supabase
        .from("bookings")
        .update({
          status: "completed",
          exit_time: exit.toISOString(),
          duration_minutes: minutes,
          amount: total,
        })
        .eq("id", b.id);
      if (b.slot_id) {
        await supabase.from("parking_slots").update({ status: "available" }).eq("id", b.slot_id);
      }
    } catch (e) {
      console.warn("DB update skipped/failed:", e);
    }

    // Fire-and-forget hardware gate call
    triggerGate(b.booking_code, "EXIT").catch(() => {});
    hardwareLogger.log("Manual Exit Approved", `Booking: ${b.booking_code}`);
    toast.success(`Exit recorded · ₹${total}`);

    // Auto-generate invoice safely
    try {
      downloadInvoice({
        booking_code: b.booking_code,
        vehicle_number: b.vehicle_number,
        entry_time: entry.toISOString(),
        exit_time: exit.toISOString(),
        duration_minutes: minutes,
        amount: total,
        payment_status: b.payment_status,
        slot: b.parking_slots?.code,
        driver_name: b.profiles?.full_name,
      });
      hardwareLogger.log("Invoice Generated", `Booking: ${b.booking_code}`);
    } catch (invErr) {
      console.error("Invoice download exception:", invErr);
    }

    // Open payment simulator
    const fresh = { ...b, exit_time: exit.toISOString(), duration_minutes: minutes, amount: total, status: "completed" };
    setPayMethod("cash");
    setPayDialog(fresh);
    refresh();
  }

  async function simulatePayment() {
    if (!payDialog) return;
    const { error } = await supabase.from("bookings").update({ payment_status: "paid" }).eq("id", payDialog.id);
    if (error) return toast.error(error.message);
    toast.success(`Payment Successful (${payMethod.toUpperCase()})`);
    const inv = payDialog.duration_minutes ? calcAmount(payDialog.duration_minutes) : null;
    if (inv) {
      downloadInvoice({
        booking_code: payDialog.booking_code,
        vehicle_number: payDialog.vehicle_number,
        entry_time: payDialog.entry_time,
        exit_time: payDialog.exit_time,
        duration_minutes: payDialog.duration_minutes,
        amount: payDialog.amount,
        payment_status: "paid",
        slot: payDialog.parking_slots?.code,
        driver_name: payDialog.profiles?.full_name,
      });
    }
    setPayDialog(null);
    refresh();
  }

  async function confirmPayment(b: any) {
    setPayMethod("cash");
    setPayDialog(b);
  }

  async function openGate(b: any, type: "ENTRY" | "EXIT") {
    const gate = await triggerGate(b.booking_code, type);
    toast.success(gate.simulated ? "Gate operation simulated" : "Gate signal sent");
  }

  return (
    <PortalShell title="Admin Portal" nav={ADMIN_NAV}>
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-2xl font-bold">Manual Verification</h2>
          <PrototypeBadge />
        </div>
        <p className="text-sm text-muted-foreground">
          Fallback for QR scan failures. {mode === "entry" ? "Pending bookings" : "Active parking"} shown below by default — or search by Booking ID / Vehicle Number.
        </p>

        <div className="flex flex-wrap gap-2">
          {(["entry", "exit"] as const).map((m) => (
            <button
              key={m}
              onClick={() => {
                setMode(m);
                setQ("");
              }}
              className={`rounded-lg px-4 py-2 text-sm font-semibold capitalize ${
                mode === m
                  ? "bg-primary text-primary-foreground"
                  : "border border-input bg-background text-muted-foreground"
              }`}
            >
              {m} Verification
            </button>
          ))}
        </div>

        <div className="flex gap-2 rounded-2xl border border-border bg-card p-3 shadow-sm">
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && runSearch()}
            placeholder="Booking ID or Vehicle Number (leave empty to list pending)"
            className="flex-1 rounded-lg border border-input bg-background px-3 py-2 text-sm"
          />
          <button
            onClick={runSearch}
            disabled={busy}
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50"
          >
            <Search className="h-4 w-4" /> Search
          </button>
        </div>

        <div className="grid gap-4">
          {results.map((b) => {
            const invoice = b.duration_minutes ? calcAmount(b.duration_minutes) : null;
            const liveMinutes =
              mode === "exit" && b.entry_time && b.status === "active"
                ? Math.max(1, Math.round((Date.now() - new Date(b.entry_time).getTime()) / 60000))
                : null;
            const liveFee = liveMinutes ? calcAmount(liveMinutes) : null;
            return (
              <div key={b.id} className="rounded-2xl border border-border bg-card p-5 shadow-sm">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="text-xs text-muted-foreground">Booking</div>
                    <div className="text-lg font-bold">{b.booking_code}</div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    {b.exit_requested && mode === "exit" && (
                      <span className="rounded-full bg-amber-500/15 px-3 py-1 text-xs font-semibold uppercase text-amber-700 dark:text-amber-400">
                        Exit Requested
                      </span>
                    )}
                    <span className="rounded-full bg-muted px-3 py-1 text-xs font-semibold uppercase">{b.status}</span>
                  </div>
                </div>
                <div className="mt-4 grid gap-2 text-sm sm:grid-cols-2 md:grid-cols-3">
                  <Info label="Driver" value={b.profiles?.full_name ?? "—"} />
                  <Info label="Vehicle" value={b.vehicle_number} />
                  <Info label="Slot" value={b.parking_slots?.code ?? "—"} />
                  <Info label="Booked" value={new Date(b.created_at).toLocaleString()} />
                  <Info label="Duration (est)" value={`${b.estimated_duration_hours} h`} />
                  <Info label="Entry" value={b.entry_time ? new Date(b.entry_time).toLocaleString() : "—"} />
                  <Info label="Exit" value={b.exit_time ? new Date(b.exit_time).toLocaleString() : "—"} />
                  {liveFee && (
                    <>
                      <Info label="Parked (live)" value={`${liveMinutes} min`} />
                      <Info label="Estimated Bill" value={`₹${liveFee.total.toFixed(2)}`} />
                    </>
                  )}
                  {invoice && (
                    <>
                      <Info label="Parked" value={`${b.duration_minutes} min`} />
                      <Info label="Base" value={`₹${invoice.base.toFixed(2)}`} />
                      <Info label="GST" value={`₹${invoice.gst.toFixed(2)}`} />
                      <Info label="Total" value={`₹${invoice.total.toFixed(2)}`} />
                    </>
                  )}
                  <Info label="Payment" value={b.payment_status} />
                </div>

                <div className="mt-4 flex flex-wrap gap-2">
                  {mode === "entry" && b.status === "reserved" && (
                    <>
                      <button
                        onClick={() => allowEntry(b)}
                        className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-emerald-700"
                      >
                        <CheckCircle2 className="h-4 w-4" /> APPROVE ENTRY
                      </button>
                      <button
                        onClick={() => toast("Entry cancelled")}
                        className="inline-flex items-center gap-2 rounded-lg border border-input px-4 py-2 text-xs font-semibold"
                      >
                        <XCircle className="h-4 w-4" /> Cancel
                      </button>
                    </>
                  )}
                  {mode === "exit" && b.status === "active" && (
                    <button
                      onClick={() => processExit(b)}
                      className="inline-flex items-center gap-2 rounded-lg bg-amber-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-amber-700"
                    >
                      <CheckCircle2 className="h-4 w-4" /> APPROVE EXIT
                    </button>
                  )}
                  {b.payment_status === "unpaid" && b.amount != null && b.status === "completed" && (
                    <button
                      onClick={() => confirmPayment(b)}
                      className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground"
                    >
                      <CreditCard className="h-4 w-4" /> Simulate Payment
                    </button>
                  )}
                  <button
                    onClick={() => openGate(b, mode === "entry" ? "ENTRY" : "EXIT")}
                    className="inline-flex items-center gap-2 rounded-lg border border-input px-4 py-2 text-xs font-semibold"
                  >
                    <DoorOpen className="h-4 w-4" /> Open Gate
                  </button>
                  {invoice && (
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
                          driver_name: b.profiles?.full_name,
                        })
                      }
                      className="inline-flex items-center gap-2 rounded-lg border border-input px-4 py-2 text-xs font-semibold"
                    >
                      <Receipt className="h-4 w-4" /> Generate Invoice
                    </button>
                  )}
                </div>
              </div>
            );
          })}
          {results.length === 0 && !busy && (
            <div className="rounded-2xl border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
              {mode === "entry" ? "No pending entry approvals." : "No active parking sessions."}
            </div>
          )}
        </div>
      </div>

      {payDialog && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
          onClick={() => setPayDialog(null)}
        >
          <div
            className="w-full max-w-md rounded-2xl bg-card p-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-bold">Payment Simulator</h3>
            <p className="mt-1 text-xs text-muted-foreground">
              Booking {payDialog.booking_code} · {payDialog.vehicle_number}
            </p>
            {payDialog.duration_minutes && (() => {
              const inv = calcAmount(payDialog.duration_minutes);
              return (
                <div className="mt-4 space-y-1 rounded-lg bg-muted p-3 text-sm">
                  <div className="flex justify-between">
                    <span>Parking Charges</span>
                    <span>₹{inv.base.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>GST (18%)</span>
                    <span>₹{inv.gst.toFixed(2)}</span>
                  </div>
                  <div className="mt-1 flex justify-between border-t border-border pt-1 font-bold">
                    <span>Total Amount</span>
                    <span>₹{inv.total.toFixed(2)}</span>
                  </div>
                </div>
              );
            })()}
            <div className="mt-4">
              <div className="mb-2 text-xs font-semibold uppercase text-muted-foreground">Payment Method</div>
              <div className="grid grid-cols-3 gap-2">
                {(["cash", "upi", "card"] as const).map((m) => (
                  <button
                    key={m}
                    onClick={() => setPayMethod(m)}
                    className={`rounded-lg border px-3 py-2 text-sm font-semibold capitalize ${
                      payMethod === m
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-input bg-background text-muted-foreground"
                    }`}
                  >
                    {m}
                  </button>
                ))}
              </div>
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button
                onClick={() => setPayDialog(null)}
                className="rounded-lg border border-input px-4 py-2 text-sm font-semibold"
              >
                Cancel
              </button>
              <button
                onClick={simulatePayment}
                className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700"
              >
                SIMULATE PAYMENT
              </button>
            </div>
            {prototype && (
              <p className="mt-3 text-[10px] text-amber-700 dark:text-amber-400">
                Prototype Mode — no real payment gateway is called.
              </p>
            )}
          </div>
        </div>
      )}
    </PortalShell>
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
