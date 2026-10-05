import { createFileRoute } from "@tanstack/react-router";
import { RoleGuard } from "@/components/RoleGuard";
import { PortalShell } from "@/components/PortalShell";
import { ADMIN_NAV } from "./admin.dashboard";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useDemoState, approveDemoEntry, cancelDemoBooking } from "@/lib/demo-state-store";
import { getDemoRole } from "@/lib/demo-auth";
import { downloadInvoice } from "@/lib/invoice";
import { Search, Eye, Download, ShieldCheck, XCircle, FileText, CheckCircle2 } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin/bookings")({
  component: () => (
    <RoleGuard allow="admin">
      <AdminBookings />
    </RoleGuard>
  ),
});

function AdminBookings() {
  const { bookings: demoBookings } = useDemoState();
  const [rows, setRows] = useState<any[]>([]);
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<string>("all");
  const [detailModal, setDetailModal] = useState<any | null>(null);
  const [busy, setBusy] = useState(false);

  async function load() {
    if (getDemoRole() || true) {
      let list = demoBookings.map((b) => ({
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
        payment_method: b.payment_method,
        created_at: b.created_at,
      }));

      if (filter !== "all") {
        list = list.filter((b) => b.status === filter);
      }
      setRows(list);
      return;
    }

    let query = supabase
      .from("bookings")
      .select("*, parking_slots(code), profiles!bookings_user_id_fkey(full_name, phone)")
      .order("created_at", { ascending: false })
      .limit(200);
    if (filter !== "all") query = query.eq("status", filter as any);
    const { data } = await query;
    setRows(data ?? []);
  }

  useEffect(() => {
    load();
  }, [filter, demoBookings]);

  const filtered = rows.filter((r) => {
    if (!q.trim()) return true;
    const s = q.toLowerCase();
    return (
      r.booking_code.toLowerCase().includes(s) ||
      r.vehicle_number.toLowerCase().includes(s) ||
      (r.driver_name ?? r.profiles?.full_name ?? "").toLowerCase().includes(s) ||
      (r.profiles?.phone ?? "").toLowerCase().includes(s) ||
      (r.slot_code ?? r.parking_slots?.code ?? "").toLowerCase().includes(s)
    );
  });

  async function handleApproveEntry(b: any) {
    setBusy(true);
    try {
      if (getDemoRole() || true) {
        await approveDemoEntry(b.booking_code, "Admin Portal");
        toast.success(`Entry approved for booking ${b.booking_code}. Gate opened!`);
        setBusy(false);
        return;
      }
      await supabase.from("bookings").update({ status: "active", entry_time: new Date().toISOString() }).eq("id", b.id);
      if (b.slot_id) {
        await supabase.from("parking_slots").update({ status: "occupied" }).eq("id", b.slot_id);
      }
      toast.success("Entry Approved");
    } catch (err: any) {
      toast.error(err?.message || "Failed to approve entry.");
    } finally {
      setBusy(false);
    }
  }

  async function handleCancel(b: any) {
    if (!confirm(`Cancel reservation ${b.booking_code}?`)) return;
    setBusy(true);
    try {
      if (getDemoRole() || true) {
        cancelDemoBooking(b.booking_code, "Admin Portal");
        toast.success(`Booking ${b.booking_code} cancelled. Slot released to Available.`);
        setBusy(false);
        return;
      }
      const { error } = await supabase.from("bookings").update({ status: "cancelled" }).eq("id", b.id);
      if (b.slot_id) {
        await supabase.from("parking_slots").update({ status: "available" }).eq("id", b.slot_id);
      }
      if (error) toast.error((error as any)?.message || "Cancellation failed");
      else toast.success("Cancelled");
    } catch (err: any) {
      toast.error(err?.message || "Failed to cancel.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <PortalShell title="Admin Portal" nav={ADMIN_NAV}>
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-2xl font-bold">Booking Management</h2>
            <p className="text-xs text-muted-foreground">
              Master ledger of all driver reservations, active parking sessions, and past history.
            </p>
          </div>
          <span className="text-xs text-muted-foreground font-semibold">
            {filtered.length} Bookings Shown
          </span>
        </div>

        {/* Search and Filters */}
        <div className="flex flex-wrap gap-3">
          <div className="relative flex-1 min-w-[240px]">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
            <input
              placeholder="Search by booking ID, vehicle, driver, or slot..."
              value={q}
              onChange={(e) => setQ(e.target.value)}
              className="w-full rounded-lg border border-input bg-background pl-9 pr-3 py-2 text-sm"
            />
          </div>
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="rounded-lg border border-input bg-background px-3 py-2 text-sm font-semibold"
          >
            <option value="all">All Statuses</option>
            <option value="reserved">Reserved (Awaiting Entry)</option>
            <option value="active">Active (Currently Parked)</option>
            <option value="completed">Completed & Paid</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </div>

        {/* Master Table */}
        <div className="overflow-x-auto rounded-2xl border border-border bg-card shadow-sm">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-xs uppercase text-muted-foreground">
              <tr>
                <th className="p-3 text-left">Booking ID</th>
                <th className="p-3 text-left">Driver</th>
                <th className="p-3 text-left">Slot</th>
                <th className="p-3 text-left">Vehicle</th>
                <th className="p-3 text-left">Status</th>
                <th className="p-3 text-left">Entry</th>
                <th className="p-3 text-left">Exit</th>
                <th className="p-3 text-left">Amount</th>
                <th className="p-3 text-left">Payment</th>
                <th className="p-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => (
                <tr key={r.id} className="border-t border-border hover:bg-muted/20 transition">
                  <td className="p-3 font-mono text-xs font-bold text-foreground">{r.booking_code}</td>
                  <td className="p-3 font-medium">{r.driver_name ?? r.profiles?.full_name ?? "Demo Driver"}</td>
                  <td className="p-3 font-bold">{r.slot_code ?? r.parking_slots?.code ?? "—"}</td>
                  <td className="p-3 font-mono text-xs">{r.vehicle_number}</td>
                  <td className="p-3">
                    <span
                      className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold uppercase ${
                        r.status === "reserved"
                          ? "bg-amber-500/15 text-amber-700 dark:text-amber-500"
                          : r.status === "active"
                          ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400"
                          : r.status === "completed"
                          ? "bg-blue-500/15 text-blue-700 dark:text-blue-400"
                          : "bg-destructive/15 text-destructive"
                      }`}
                    >
                      {r.status}
                    </span>
                  </td>
                  <td className="p-3 text-xs text-muted-foreground">
                    {r.entry_time ? new Date(r.entry_time).toLocaleTimeString() : "—"}
                  </td>
                  <td className="p-3 text-xs text-muted-foreground">
                    {r.exit_time ? new Date(r.exit_time).toLocaleTimeString() : "—"}
                  </td>
                  <td className="p-3 font-semibold">{r.amount != null ? `₹${r.amount.toFixed(2)}` : "—"}</td>
                  <td className="p-3 capitalize">
                    <span className={r.payment_status === "paid" ? "text-emerald-600 font-semibold" : "text-muted-foreground"}>
                      {r.payment_status}
                    </span>
                  </td>
                  <td className="p-3 text-right">
                    <div className="flex justify-end gap-1.5">
                      <button
                        onClick={() => setDetailModal(r)}
                        className="rounded-md border border-input p-1.5 text-muted-foreground hover:bg-muted"
                        title="View Details"
                      >
                        <Eye className="h-3.5 w-3.5" />
                      </button>

                      {r.status === "reserved" && (
                        <button
                          onClick={() => handleApproveEntry(r)}
                          disabled={busy}
                          className="rounded-md bg-emerald-600 px-2.5 py-1 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
                          title="Approve Entry"
                        >
                          Approve Entry
                        </button>
                      )}

                      {r.status !== "cancelled" && r.status !== "completed" && (
                        <button
                          onClick={() => handleCancel(r)}
                          disabled={busy}
                          className="rounded-md bg-destructive/15 text-destructive hover:bg-destructive/25 px-2.5 py-1 text-xs font-semibold disabled:opacity-50"
                          title="Cancel Booking"
                        >
                          Cancel
                        </button>
                      )}

                      {r.status === "completed" && (
                        <button
                          onClick={() =>
                            downloadInvoice({
                              booking_code: r.booking_code,
                              vehicle_number: r.vehicle_number,
                              entry_time: r.entry_time,
                              exit_time: r.exit_time,
                              duration_minutes: r.duration_minutes,
                              amount: r.amount,
                              payment_status: r.payment_status,
                              slot: r.slot_code ?? r.parking_slots?.code,
                              driver_name: r.driver_name,
                            })
                          }
                          className="rounded-md border border-input p-1.5 hover:bg-muted"
                          title="Download Invoice"
                        >
                          <Download className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={10} className="p-10 text-center text-muted-foreground">
                    No bookings found matching your search. Create a booking in the Driver Portal to see it appear here!
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Booking Details Modal */}
      {detailModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
          onClick={() => setDetailModal(null)}
        >
          <div
            className="w-full max-w-md rounded-2xl bg-card p-6 shadow-2xl space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-border pb-3">
              <h3 className="text-lg font-bold">Booking Details</h3>
              <span className="font-mono text-xs font-bold text-primary">{detailModal.booking_code}</span>
            </div>
            <div className="space-y-2 text-sm">
              <DetailRow label="Driver" value={detailModal.driver_name ?? detailModal.profiles?.full_name ?? "Demo Driver"} />
              <DetailRow label="Phone" value={detailModal.profiles?.phone ?? "+91 98765 43210"} />
              <DetailRow label="Vehicle" value={detailModal.vehicle_number} />
              <DetailRow label="Slot" value={detailModal.slot_code ?? detailModal.parking_slots?.code ?? "—"} />
              <DetailRow label="Status" value={detailModal.status.toUpperCase()} />
              <DetailRow
                label="Entry Time"
                value={detailModal.entry_time ? new Date(detailModal.entry_time).toLocaleString() : "Awaiting Entry"}
              />
              <DetailRow
                label="Exit Time"
                value={detailModal.exit_time ? new Date(detailModal.exit_time).toLocaleString() : "—"}
              />
              <DetailRow
                label="Duration"
                value={detailModal.duration_minutes ? `${detailModal.duration_minutes} min` : "—"}
              />
              <DetailRow
                label="Amount"
                value={detailModal.amount != null ? `₹${detailModal.amount.toFixed(2)}` : "—"}
              />
              <DetailRow label="Payment Status" value={detailModal.payment_status} />
              <DetailRow label="Created At" value={new Date(detailModal.created_at).toLocaleString()} />
            </div>
            <div className="flex justify-end pt-2">
              <button
                onClick={() => setDetailModal(null)}
                className="rounded-lg border border-input px-4 py-2 text-xs font-semibold hover:bg-muted"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </PortalShell>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between border-b border-border/50 py-1.5 text-xs">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium text-foreground">{value}</span>
    </div>
  );
}
