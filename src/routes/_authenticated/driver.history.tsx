import { createFileRoute } from "@tanstack/react-router";
import { LayoutDashboard, CalendarClock, History, User } from "lucide-react";
import { RoleGuard } from "@/components/RoleGuard";
import { PortalShell } from "@/components/PortalShell";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "@/lib/use-role";
import { getDemoRole } from "@/lib/demo-auth";

export const Route = createFileRoute("/_authenticated/driver/history")({
  component: () => (
    <RoleGuard allow="driver">
      <DriverHistory />
    </RoleGuard>
  ),
});

const NAV = [
  { to: "/driver/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/driver/bookings", label: "My Bookings", icon: CalendarClock },
  { to: "/driver/history", label: "History", icon: History },
  { to: "/driver/profile", label: "Profile", icon: User },
];

const MOCK_HISTORY = [
  {
    id: "hist-1",
    booking_code: "BK-98421",
    parking_slots: { code: "A1" },
    vehicle_number: "TN01S1234",
    duration_minutes: 45,
    amount: 50,
    payment_status: "paid",
    created_at: new Date(Date.now() - 86400000).toISOString(),
  },
  {
    id: "hist-2",
    booking_code: "BK-87123",
    parking_slots: { code: "B3" },
    vehicle_number: "TN01S1234",
    duration_minutes: 120,
    amount: 100,
    payment_status: "paid",
    created_at: new Date(Date.now() - 172800000).toISOString(),
  },
];

function DriverHistory() {
  const { userId } = useCurrentUser();
  const [rows, setRows] = useState<any[]>([]);

  useEffect(() => {
    if (!userId) return;
    if (getDemoRole()) {
      setRows(MOCK_HISTORY);
      return;
    }
    supabase
      .from("bookings")
      .select("*, parking_slots(code)")
      .eq("user_id", userId)
      .in("status", ["completed", "cancelled"])
      .order("created_at", { ascending: false })
      .then(({ data, error }) => {
        if (data && !error) setRows(data);
        else setRows(MOCK_HISTORY);
      });
  }, [userId]);

  return (
    <PortalShell title="Driver Portal" nav={NAV}>
      <h2 className="mb-4 text-2xl font-bold">Booking History</h2>
      <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-xs uppercase text-muted-foreground">
            <tr>
              <th className="p-3 text-left">Booking</th>
              <th className="p-3 text-left">Slot</th>
              <th className="p-3 text-left">Vehicle</th>
              <th className="p-3 text-left">Duration</th>
              <th className="p-3 text-left">Amount</th>
              <th className="p-3 text-left">Payment</th>
              <th className="p-3 text-left">Date</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={7} className="p-8 text-center text-muted-foreground">
                  No history yet.
                </td>
              </tr>
            )}
            {rows.map((r) => (
              <tr key={r.id} className="border-t border-border">
                <td className="p-3 font-mono text-xs">{r.booking_code}</td>
                <td className="p-3">{r.parking_slots?.code ?? "—"}</td>
                <td className="p-3">{r.vehicle_number}</td>
                <td className="p-3">{r.duration_minutes ? `${r.duration_minutes} min` : "—"}</td>
                <td className="p-3">{r.amount != null ? `₹${r.amount}` : "—"}</td>
                <td className="p-3 capitalize">{r.payment_status}</td>
                <td className="p-3 text-xs text-muted-foreground">
                  {new Date(r.created_at).toLocaleDateString()}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </PortalShell>
  );
}
