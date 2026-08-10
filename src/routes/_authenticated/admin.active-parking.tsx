import { createFileRoute, Link } from "@tanstack/react-router";
import { RoleGuard } from "@/components/RoleGuard";
import { PortalShell } from "@/components/PortalShell";
import { PrototypeBadge } from "@/components/PrototypeBadge";
import { ADMIN_NAV } from "./admin.dashboard";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { calcAmount } from "@/lib/pricing";
import { CheckCircle2, Eye } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin/active-parking")({
  component: () => (
    <RoleGuard allow="admin">
      <ActiveParking />
    </RoleGuard>
  ),
});

function ActiveParking() {
  const [rows, setRows] = useState<any[]>([]);
  const [now, setNow] = useState(Date.now());
  const [detail, setDetail] = useState<any | null>(null);

  async function load() {
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
    const t = setInterval(() => setNow(Date.now()), 30000);
    const ch = supabase
      .channel("active_parking")
      .on("postgres_changes", { event: "*", schema: "public", table: "bookings" }, load)
      .subscribe();
    return () => {
      clearInterval(t);
      supabase.removeChannel(ch);
    };
  }, []);

  return (
    <PortalShell title="Admin Portal" nav={ADMIN_NAV}>
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-2xl font-bold">Active Parking</h2>
          <PrototypeBadge />
        </div>
        <p className="text-sm text-muted-foreground">
          All vehicles currently parked. Use QR Scanner for exit, or Approve Exit for manual approval.
        </p>

        <div className="grid gap-4">
          {rows.map((b) => {
            const minutes = b.entry_time
              ? Math.max(1, Math.round((now - new Date(b.entry_time).getTime()) / 60000))
              : 0;
            const fee = minutes ? calcAmount(minutes) : null;
            return (
              <div key={b.id} className="rounded-2xl border border-border bg-card p-5 shadow-sm">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="text-xs text-muted-foreground">Booking</div>
                    <div className="text-lg font-bold">{b.booking_code}</div>
                  </div>
                  <span className="rounded-full bg-emerald-500/15 px-3 py-1 text-xs font-semibold uppercase text-emerald-700 dark:text-emerald-400">
                    Parking Active
                  </span>
                </div>
                <div className="mt-4 grid gap-2 text-sm sm:grid-cols-2 md:grid-cols-3">
                  <Info label="Driver" value={b.profiles?.full_name ?? "—"} />
                  <Info label="Vehicle" value={b.vehicle_number} />
                  <Info label="Slot" value={b.parking_slots?.code ?? "—"} />
                  <Info label="Entry Time" value={b.entry_time ? new Date(b.entry_time).toLocaleString() : "—"} />
                  <Info label="Current Duration" value={`${minutes} min`} />
                  <Info label="Estimated Fee" value={fee ? `₹${fee.total.toFixed(2)}` : "—"} />
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  <button
                    onClick={() => setDetail(b)}
                    className="inline-flex items-center gap-2 rounded-lg border border-input px-4 py-2 text-xs font-semibold"
                  >
                    <Eye className="h-4 w-4" /> View Details
                  </button>
                  <Link
                    to="/admin/manual-verify"
                    search={{ mode: "exit", q: b.booking_code }}
                    className="inline-flex items-center gap-2 rounded-lg bg-amber-600 px-5 py-2 text-xs font-semibold text-white hover:bg-amber-700"
                  >
                    <CheckCircle2 className="h-4 w-4" /> Approve Exit
                  </Link>
                </div>
              </div>
            );
          })}
          {rows.length === 0 && (
            <div className="rounded-2xl border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
              No vehicles are currently parked.
            </div>
          )}
        </div>
      </div>

      {detail && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
          onClick={() => setDetail(null)}
        >
          <div className="w-full max-w-md rounded-2xl bg-card p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-bold">Booking {detail.booking_code}</h3>
            <div className="mt-3 space-y-1 text-sm">
              <Row label="Driver" v={detail.profiles?.full_name ?? "—"} />
              <Row label="Phone" v={detail.profiles?.phone ?? "—"} />
              <Row label="Vehicle" v={detail.vehicle_number} />
              <Row label="Slot" v={detail.parking_slots?.code ?? "—"} />
              <Row label="Entry" v={detail.entry_time ? new Date(detail.entry_time).toLocaleString() : "—"} />
              <Row label="Est. Duration" v={`${detail.estimated_duration_hours} h`} />
              <Row label="Payment" v={detail.payment_status} />
            </div>
            <div className="mt-5 flex justify-end">
              <button onClick={() => setDetail(null)} className="rounded-lg border border-input px-4 py-2 text-sm font-semibold">
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
      <div className="font-medium">{value}</div>
    </div>
  );
}

function Row({ label, v }: { label: string; v: string }) {
  return (
    <div className="flex justify-between border-b border-border py-1">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium">{v}</span>
    </div>
  );
}
