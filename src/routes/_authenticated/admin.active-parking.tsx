import { createFileRoute, Link } from "@tanstack/react-router";
import { RoleGuard } from "@/components/RoleGuard";
import { PortalShell } from "@/components/PortalShell";
import { PrototypeBadge } from "@/components/PrototypeBadge";
import { ADMIN_NAV } from "./admin.dashboard";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { calcAmount } from "@/lib/pricing";
import { CheckCircle2, Eye, LogOut, Clock, Car, User } from "lucide-react";
import { useDemoState, approveDemoExit } from "@/lib/demo-state-store";
import { getDemoRole } from "@/lib/demo-auth";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/admin/active-parking")({
  component: () => (
    <RoleGuard allow="admin">
      <ActiveParking />
    </RoleGuard>
  ),
});

function ActiveParking() {
  const { activeParking: demoActiveList } = useDemoState();
  const [rows, setRows] = useState<any[]>([]);
  const [now, setNow] = useState(Date.now());
  const [detail, setDetail] = useState<any | null>(null);
  const [busy, setBusy] = useState(false);

  // Live timer tick for active duration calculation
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  async function load() {
    if (getDemoRole() || true) {
      setRows(
        demoActiveList.map((b) => ({
          id: b.id,
          booking_code: b.booking_code,
          slot_id: b.slot_id,
          slot_code: b.slot_code,
          parking_slots: { code: b.slot_code },
          driver_name: b.driver_name,
          profiles: { full_name: b.driver_name, phone: b.driver_phone ?? "+91 98765 43210" },
          vehicle_number: b.vehicle_number,
          status: b.status,
          entry_time: b.entry_time,
          exit_time: b.exit_time,
          duration_minutes: b.duration_minutes,
          amount: b.amount,
          payment_status: b.payment_status,
          created_at: b.created_at,
        }))
      );
      return;
    }

    const { data } = await supabase
      .from("bookings")
      .select("*, parking_slots(code), profiles!bookings_user_id_fkey(full_name, phone)")
      .eq("status", "active")
      .order("entry_time", { ascending: false })
      .limit(100);
    setRows(data ?? []);
  }

  useEffect(() => {
    load();
  }, [demoActiveList]);

  async function handleApproveExit(b: any) {
    if (!confirm(`Approve exit for vehicle ${b.vehicle_number} (${b.booking_code})?`)) return;
    setBusy(true);
    try {
      if (getDemoRole() || true) {
        const res = await approveDemoExit(b.booking_code, "UPI", "Admin Portal");
        toast.success(`Exit approved for ${b.booking_code}. Total: ₹${res.fee.total.toFixed(2)}. Gate opened!`);
        setBusy(false);
        return;
      }
      toast.info("Navigating to manual verification...");
    } catch (err: any) {
      toast.error(err?.message || "Failed to approve exit.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <PortalShell title="Admin Portal" nav={ADMIN_NAV}>
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-2xl font-bold">Active Parking Sessions</h2>
            <p className="text-xs text-muted-foreground">
              Vehicles currently parked on premises with live duration tickers and direct exit approval.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <PrototypeBadge />
            <span className="rounded-full bg-emerald-500/15 px-3 py-1 text-xs font-semibold text-emerald-700 dark:text-emerald-400">
              {rows.length} Active {rows.length === 1 ? "Vehicle" : "Vehicles"}
            </span>
          </div>
        </div>

        <div className="grid gap-4">
          {rows.map((b) => {
            const minutes = b.entry_time
              ? Math.max(1, Math.round((now - new Date(b.entry_time).getTime()) / 60000))
              : 0;
            const fee = minutes ? calcAmount(minutes) : null;

            // Formatted running duration
            const diffSec = b.entry_time ? Math.max(0, Math.floor((now - new Date(b.entry_time).getTime()) / 1000)) : 0;
            const hours = Math.floor(diffSec / 3600);
            const mins = Math.floor((diffSec % 3600) / 60);
            const secs = diffSec % 60;
            const formattedTime = hours > 0 ? `${hours}h ${mins}m ${secs}s` : `${mins}m ${secs}s`;

            return (
              <div key={b.id} className="rounded-2xl border border-border bg-card p-5 shadow-sm">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="text-xs text-muted-foreground">Booking ID</div>
                    <div className="text-lg font-bold">{b.booking_code}</div>
                  </div>
                  <span className="rounded-full bg-emerald-500/15 px-3 py-1 text-xs font-semibold uppercase text-emerald-700 dark:text-emerald-400 flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                    Parking Active
                  </span>
                </div>

                <div className="mt-4 grid gap-3 text-sm sm:grid-cols-2 md:grid-cols-3">
                  <Info label="Driver" value={b.driver_name ?? b.profiles?.full_name ?? "Demo Driver"} />
                  <Info label="Vehicle Number" value={b.vehicle_number} />
                  <Info label="Parking Slot" value={b.slot_code ?? b.parking_slots?.code ?? "—"} />
                  <Info
                    label="Entry Time"
                    value={b.entry_time ? new Date(b.entry_time).toLocaleTimeString() : "—"}
                  />
                  <Info label="Current Duration" value={formattedTime} />
                  <Info label="Estimated Bill" value={fee ? `₹${fee.total.toFixed(2)} (${fee.hours}h billed)` : "—"} />
                </div>

                <div className="mt-4 flex flex-wrap gap-2">
                  <button
                    onClick={() => setDetail(b)}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-input px-3.5 py-2 text-xs font-semibold hover:bg-muted"
                  >
                    <Eye className="h-3.5 w-3.5" /> View Details
                  </button>
                  <button
                    onClick={() => handleApproveExit(b)}
                    disabled={busy}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-amber-600 px-4 py-2 text-xs font-semibold text-white hover:bg-amber-700 disabled:opacity-50"
                  >
                    <LogOut className="h-3.5 w-3.5" /> Approve Exit & Generate Bill
                  </button>
                </div>
              </div>
            );
          })}

          {rows.length === 0 && (
            <div className="rounded-2xl border border-dashed border-border p-12 text-center text-sm text-muted-foreground">
              No vehicles are currently parked. When a driver confirms entry on a booking, their active session will appear here in real-time.
            </div>
          )}
        </div>
      </div>

      {detail && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
          onClick={() => setDetail(null)}
        >
          <div className="w-full max-w-md rounded-2xl bg-card p-6 shadow-2xl space-y-4" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-bold">Active Session: {detail.booking_code}</h3>
            <div className="space-y-2 text-xs">
              <Row label="Driver" v={detail.driver_name ?? detail.profiles?.full_name ?? "Demo Driver"} />
              <Row label="Phone" v={detail.profiles?.phone ?? "+91 98765 43210"} />
              <Row label="Vehicle" v={detail.vehicle_number} />
              <Row label="Slot" v={detail.slot_code ?? detail.parking_slots?.code ?? "—"} />
              <Row label="Entry Time" v={detail.entry_time ? new Date(detail.entry_time).toLocaleString() : "—"} />
              <Row label="Rate" v="₹50.00 / hour (+18% GST)" />
              <Row label="Status" v="ACTIVE (Parked inside)" />
            </div>
            <div className="flex justify-end pt-2">
              <button onClick={() => setDetail(null)} className="rounded-lg border border-input px-4 py-2 text-xs font-semibold hover:bg-muted">
                Close
              </button>
            </div>
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
      <div className="font-medium text-foreground">{value}</div>
    </div>
  );
}

function Row({ label, v }: { label: string; v: string }) {
  return (
    <div className="flex justify-between border-b border-border/50 py-1.5">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-semibold text-foreground">{v}</span>
    </div>
  );
}
