import { createFileRoute } from "@tanstack/react-router";
import { RoleGuard } from "@/components/RoleGuard";
import { PortalShell } from "@/components/PortalShell";
import { ADMIN_NAV } from "./admin.dashboard";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/admin/users")({
  component: () => (
    <RoleGuard allow="admin">
      <AdminUsers />
    </RoleGuard>
  ),
});

function AdminUsers() {
  const [users, setUsers] = useState<any[]>([]);

  useEffect(() => {
    (async () => {
      const { data: profiles } = await supabase.from("profiles").select("*");
      const { data: roles } = await supabase.from("user_roles").select("user_id, role");
      const { data: bookings } = await supabase
        .from("bookings")
        .select("user_id, status");

      const driverIds = new Set(
        (roles ?? []).filter((r: any) => r.role === "driver").map((r: any) => r.user_id),
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
  }, []);

  return (
    <PortalShell title="Admin Portal" nav={ADMIN_NAV}>
      <div className="space-y-4">
        <h2 className="text-2xl font-bold">User Management</h2>
        <div className="overflow-x-auto rounded-2xl border border-border bg-card shadow-sm">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-xs uppercase text-muted-foreground">
              <tr>
                <th className="p-3 text-left">Name</th>
                <th className="p-3 text-left">Email</th>
                <th className="p-3 text-left">Vehicle</th>
                <th className="p-3 text-left">Total Bookings</th>
                <th className="p-3 text-left">Currently Parked</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id} className="border-t border-border">
                  <td className="p-3">{u.full_name}</td>
                  <td className="p-3">{u.email}</td>
                  <td className="p-3">{u.vehicle_number ?? "—"}</td>
                  <td className="p-3">{u.total}</td>
                  <td className="p-3">
                    {u.active > 0 ? (
                      <span className="rounded-full bg-emerald-500/15 px-3 py-1 text-xs font-semibold text-emerald-700 dark:text-emerald-400">
                        Parked
                      </span>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </td>
                </tr>
              ))}
              {users.length === 0 && (
                <tr>
                  <td colSpan={5} className="p-8 text-center text-muted-foreground">
                    No drivers yet.
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
