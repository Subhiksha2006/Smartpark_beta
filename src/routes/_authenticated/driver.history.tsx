import { createFileRoute } from "@tanstack/react-router";
import { LayoutDashboard, CalendarClock, History, User, Receipt, Download } from "lucide-react";
import { RoleGuard } from "@/components/RoleGuard";
import { PortalShell } from "@/components/PortalShell";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "@/lib/use-role";
import { getDemoRole } from "@/lib/demo-auth";
import { useDemoState } from "@/lib/demo-state-store";
import { downloadInvoice } from "@/lib/invoice";

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

function DriverHistory() {
  const { userId } = useCurrentUser();
  const { bookings } = useDemoState();
  const [rows, setRows] = useState<any[]>([]);

  useEffect(() => {
    if (!userId) return;
    if (getDemoRole()) {
      const historyList = bookings
        .filter((b) => b.status === "completed" || b.status === "cancelled")
        .map((b) => ({
          id: b.id,
          booking_code: b.booking_code,
          slot: b.slot_code,
          parking_slots: { code: b.slot_code },
          vehicle_number: b.vehicle_number,
          duration_minutes: b.duration_minutes,
          amount: b.amount,
          payment_status: b.payment_status,
          status: b.status,
          entry_time: b.entry_time,
          exit_time: b.exit_time,
          driver_name: b.driver_name,
          created_at: b.created_at,
        }));
      setRows(historyList);
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
        else setRows([]);
      });
  }, [userId, bookings]);

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
              <th className="p-3 text-left">Status</th>
              <th className="p-3 text-left">Payment</th>
              <th className="p-3 text-left">Date</th>
              <th className="p-3 text-right">Invoice</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={9} className="p-8 text-center text-muted-foreground">
                  No completed history yet. Completed parking sessions will appear here.
                </td>
              </tr>
            )}
            {rows.map((r) => (
              <tr key={r.id} className="border-t border-border">
                <td className="p-3 font-mono text-xs font-semibold">{r.booking_code}</td>
                <td className="p-3">{r.parking_slots?.code ?? r.slot ?? "—"}</td>
                <td className="p-3">{r.vehicle_number}</td>
                <td className="p-3">{r.duration_minutes ? `${r.duration_minutes} min` : "—"}</td>
                <td className="p-3">{r.amount != null ? `₹${r.amount.toFixed(2)}` : "—"}</td>
                <td className="p-3">
                  <span
                    className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold uppercase ${
                      r.status === "completed"
                        ? "bg-blue-500/15 text-blue-700 dark:text-blue-400"
                        : "bg-destructive/15 text-destructive"
                    }`}
                  >
                    {r.status}
                  </span>
                </td>
                <td className="p-3 capitalize">{r.payment_status}</td>
                <td className="p-3 text-xs text-muted-foreground">
                  {new Date(r.created_at).toLocaleDateString()}
                </td>
                <td className="p-3 text-right">
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
                          slot: r.parking_slots?.code ?? r.slot,
                          driver_name: r.driver_name,
                        })
                      }
                      className="inline-flex items-center gap-1 rounded-md border border-input px-2.5 py-1 text-xs font-semibold hover:bg-muted"
                      title="Download Invoice"
                    >
                      <Download className="h-3.5 w-3.5" /> PDF/HTML
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </PortalShell>
  );
}
