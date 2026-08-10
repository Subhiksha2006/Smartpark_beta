import { createFileRoute } from "@tanstack/react-router";
import { RoleGuard } from "@/components/RoleGuard";
import { PortalShell } from "@/components/PortalShell";
import { ADMIN_NAV } from "./admin.dashboard";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/admin/bookings")({
  component: () => (
    <RoleGuard allow="admin">
      <AdminBookings />
    </RoleGuard>
  ),
});

function AdminBookings() {
  const [rows, setRows] = useState<any[]>([]);
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<string>("all");

  async function load() {
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
    const ch = supabase
      .channel("admin_bookings")
      .on("postgres_changes", { event: "*", schema: "public", table: "bookings" }, load)
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter]);

  const filtered = rows.filter((r) => {
    if (!q) return true;
    const s = q.toLowerCase();
    return (
      r.booking_code.toLowerCase().includes(s) ||
      r.vehicle_number.toLowerCase().includes(s) ||
      (r.profiles?.full_name ?? "").toLowerCase().includes(s) ||
      (r.profiles?.phone ?? "").toLowerCase().includes(s)
    );
  });

  async function cancel(id: string) {
    const { error } = await supabase.from("bookings").update({ status: "cancelled" }).eq("id", id);
    if (error) toast.error(error.message);
    else toast.success("Cancelled");
  }
  async function approve(id: string, slotId: string) {
    await supabase.from("bookings").update({ status: "reserved" }).eq("id", id);
    await supabase.from("parking_slots").update({ status: "reserved" }).eq("id", slotId);
    toast.success("Approved");
  }

  return (
    <PortalShell title="Admin Portal" nav={ADMIN_NAV}>
      <div className="space-y-4">
        <h2 className="text-2xl font-bold">Booking Management</h2>
        <div className="flex flex-wrap gap-3">
          <input
            placeholder="Search by booking, vehicle, driver, or phone..."
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="flex-1 min-w-[240px] rounded-lg border border-input bg-background px-3 py-2 text-sm"
          />
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="rounded-lg border border-input bg-background px-3 py-2 text-sm"
          >
            <option value="all">All</option>
            <option value="reserved">Reserved</option>
            <option value="active">Active</option>
            <option value="completed">Completed</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </div>

        <div className="overflow-x-auto rounded-2xl border border-border bg-card shadow-sm">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-xs uppercase text-muted-foreground">
              <tr>
                <th className="p-3 text-left">Booking</th>
                <th className="p-3 text-left">Slot</th>
                <th className="p-3 text-left">Vehicle</th>
                <th className="p-3 text-left">Status</th>
                <th className="p-3 text-left">Entry</th>
                <th className="p-3 text-left">Exit</th>
                <th className="p-3 text-left">Amount</th>
                <th className="p-3 text-left">Payment</th>
                <th className="p-3 text-left">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => (
                <tr key={r.id} className="border-t border-border">
                  <td className="p-3 font-mono text-xs">{r.booking_code}</td>
                  <td className="p-3">{r.parking_slots?.code}</td>
                  <td className="p-3">{r.vehicle_number}</td>
                  <td className="p-3 capitalize">{r.status}</td>
                  <td className="p-3 text-xs">{r.entry_time ? new Date(r.entry_time).toLocaleString() : "—"}</td>
                  <td className="p-3 text-xs">{r.exit_time ? new Date(r.exit_time).toLocaleString() : "—"}</td>
                  <td className="p-3">{r.amount != null ? `₹${r.amount}` : "—"}</td>
                  <td className="p-3 capitalize">{r.payment_status}</td>
                  <td className="p-3">
                    <div className="flex gap-2">
                      {r.status === "reserved" && (
                        <button
                          onClick={() => approve(r.id, r.slot_id)}
                          className="rounded-md bg-primary px-2 py-1 text-xs text-primary-foreground"
                        >
                          Approve
                        </button>
                      )}
                      {r.status !== "cancelled" && r.status !== "completed" && (
                        <button
                          onClick={() => cancel(r.id)}
                          className="rounded-md bg-destructive px-2 py-1 text-xs text-destructive-foreground"
                        >
                          Cancel
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={9} className="p-8 text-center text-muted-foreground">
                    No bookings.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </PortalShell>
  );
}
