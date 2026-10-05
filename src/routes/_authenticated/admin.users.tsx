import { createFileRoute } from "@tanstack/react-router";
import { RoleGuard } from "@/components/RoleGuard";
import { PortalShell } from "@/components/PortalShell";
import { ADMIN_NAV } from "./admin.dashboard";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useDemoState } from "@/lib/demo-state-store";
import { getDemoRole } from "@/lib/demo-auth";
import { User, Car, CalendarClock, Phone, Mail, CheckCircle2, History, Eye } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin/users")({
  component: () => (
    <RoleGuard allow="admin">
      <AdminUsers />
    </RoleGuard>
  ),
});

function AdminUsers() {
  const { driverProfile, bookings: demoBookings } = useDemoState();
  const [users, setUsers] = useState<any[]>([]);
  const [selectedUser, setSelectedUser] = useState<any | null>(null);

  useEffect(() => {
    if (getDemoRole() || true) {
      // Driver profile from shared state
      const activeCount = demoBookings.filter((b) => b.status === "active").length;
      const completedCount = demoBookings.filter((b) => b.status === "completed").length;

      const demoDrivers = [
        {
          id: driverProfile.id,
          full_name: driverProfile.full_name,
          email: driverProfile.email,
          phone: driverProfile.phone,
          vehicle_number: driverProfile.vehicle_number,
          total: demoBookings.length,
          active: activeCount,
          completed: completedCount,
          bookings: demoBookings,
        },
      ];
      setUsers(demoDrivers);
      return;
    }

    (async () => {
      const { data: profiles } = await supabase.from("profiles").select("*");
      const { data: roles } = await supabase.from("user_roles").select("user_id, role");
      const { data: bookings } = await supabase.from("bookings").select("user_id, status");

      const driverIds = new Set(
        (roles ?? []).filter((r: any) => r.role === "driver").map((r: any) => r.user_id)
      );
      const rows = (profiles ?? [])
        .filter((p: any) => driverIds.has(p.id))
        .map((p: any) => {
          const userBookings = (bookings ?? []).filter((b: any) => b.user_id === p.id);
          return {
            ...p,
            total: userBookings.length,
            active: userBookings.filter((b: any) => b.status === "active").length,
          };
        });
      setUsers(rows);
    })();
  }, [driverProfile, demoBookings]);

  return (
    <PortalShell title="Admin Portal" nav={ADMIN_NAV}>
      <div className="space-y-4">
        <div>
          <h2 className="text-2xl font-bold">Driver & User Management</h2>
          <p className="text-xs text-muted-foreground">
            Registered driver accounts, vehicle assignments, and lifetime booking history.
          </p>
        </div>

        <div className="overflow-x-auto rounded-2xl border border-border bg-card shadow-sm">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-xs uppercase text-muted-foreground">
              <tr>
                <th className="p-3 text-left">Driver Name</th>
                <th className="p-3 text-left">Email Address</th>
                <th className="p-3 text-left">Phone</th>
                <th className="p-3 text-left">Vehicle Number</th>
                <th className="p-3 text-left">Total Bookings</th>
                <th className="p-3 text-left">Parking Status</th>
                <th className="p-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id} className="border-t border-border hover:bg-muted/20 transition">
                  <td className="p-3 font-semibold flex items-center gap-2">
                    <div className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/10 text-primary font-bold text-xs">
                      {u.full_name.charAt(0)}
                    </div>
                    {u.full_name}
                  </td>
                  <td className="p-3 text-muted-foreground">{u.email}</td>
                  <td className="p-3 text-muted-foreground">{u.phone ?? "+91 98765 43210"}</td>
                  <td className="p-3 font-mono text-xs font-semibold">{u.vehicle_number ?? "—"}</td>
                  <td className="p-3 font-bold">{u.total}</td>
                  <td className="p-3">
                    {u.active > 0 ? (
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/15 px-3 py-1 text-xs font-semibold text-emerald-700 dark:text-emerald-400">
                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                        Currently Parked
                      </span>
                    ) : (
                      <span className="text-muted-foreground text-xs font-medium">Inactive</span>
                    )}
                  </td>
                  <td className="p-3 text-right">
                    <button
                      onClick={() => setSelectedUser(u)}
                      className="inline-flex items-center gap-1 rounded-lg border border-input px-2.5 py-1 text-xs font-semibold hover:bg-muted"
                    >
                      <Eye className="h-3.5 w-3.5" /> View Activity
                    </button>
                  </td>
                </tr>
              ))}
              {users.length === 0 && (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-muted-foreground">
                    No drivers registered yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* User Activity Modal */}
      {selectedUser && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
          onClick={() => setSelectedUser(null)}
        >
          <div
            className="w-full max-w-lg rounded-2xl bg-card p-6 shadow-2xl space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-border pb-3">
              <div>
                <h3 className="text-lg font-bold">{selectedUser.full_name}</h3>
                <p className="text-xs text-muted-foreground">{selectedUser.email} · {selectedUser.phone}</p>
              </div>
              <span className="font-mono text-xs font-semibold rounded bg-muted px-2 py-1">
                {selectedUser.vehicle_number}
              </span>
            </div>

            <div>
              <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">
                Booking History ({demoBookings.length})
              </h4>
              <div className="max-h-60 overflow-y-auto space-y-2">
                {demoBookings.length === 0 && (
                  <p className="text-xs text-muted-foreground py-4 text-center">No bookings for this driver yet.</p>
                )}
                {demoBookings.map((b) => (
                  <div key={b.id} className="flex items-center justify-between rounded-lg border border-border p-2.5 text-xs bg-muted/20">
                    <div>
                      <span className="font-mono font-bold text-foreground">{b.booking_code}</span>
                      <span className="text-muted-foreground ml-2">Slot: <strong>{b.slot_code}</strong></span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold">{b.amount ? `₹${b.amount}` : "—"}</span>
                      <span className="rounded-full bg-muted px-2 py-0.5 uppercase text-[10px]">
                        {b.status}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button
                onClick={() => setSelectedUser(null)}
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
