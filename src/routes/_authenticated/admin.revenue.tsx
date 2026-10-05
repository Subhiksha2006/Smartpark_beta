import { createFileRoute } from "@tanstack/react-router";
import { RoleGuard } from "@/components/RoleGuard";
import { PortalShell } from "@/components/PortalShell";
import { ADMIN_NAV } from "./admin.dashboard";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { BarChart, Bar, PieChart, Pie, Cell, ResponsiveContainer, XAxis, YAxis, Tooltip } from "recharts";
import { useDemoState } from "@/lib/demo-state-store";
import { getDemoRole } from "@/lib/demo-auth";
import { DollarSign, TrendingUp, Clock, Award, BarChart3, PieChart as PieIcon } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin/revenue")({
  component: () => (
    <RoleGuard allow="admin">
      <Revenue />
    </RoleGuard>
  ),
});

const COLORS = ["#10b981", "#3b82f6", "#f59e0b", "#8b5cf6", "#ec4899", "#ef4444"];

function Revenue() {
  const { bookings: demoBookings, slots: demoSlots } = useDemoState();
  const [today, setToday] = useState(0);
  const [week, setWeek] = useState(0);
  const [month, setMonth] = useState(0);
  const [avgDuration, setAvgDuration] = useState(0);
  const [mostUsed, setMostUsed] = useState<string>("—");
  const [barData, setBarData] = useState<any[]>([]);
  const [pieData, setPieData] = useState<any[]>([]);

  useEffect(() => {
    if (getDemoRole() || true) {
      const paidBookings = demoBookings.filter((b) => b.payment_status === "paid" || b.status === "completed");
      const sum = (arr: typeof paidBookings) => arr.reduce((a, b) => a + Number(b.amount ?? 0), 0);

      const totalRev = sum(paidBookings);
      setToday(totalRev);
      setWeek(totalRev);
      setMonth(totalRev);

      const durs = paidBookings.filter((r) => r.duration_minutes).map((r) => r.duration_minutes as number);
      setAvgDuration(durs.length ? Math.round(durs.reduce((a, b) => a + b, 0) / durs.length) : 0);

      // Slot usage count
      const slotCounts: Record<string, number> = {};
      demoSlots.forEach((s) => {
        slotCounts[s.code] = 0;
      });
      demoBookings.forEach((b) => {
        slotCounts[b.slot_code] = (slotCounts[b.slot_code] ?? 0) + 1;
      });

      const top = Object.entries(slotCounts).sort((a, b) => b[1] - a[1])[0];
      setMostUsed(top && top[1] > 0 ? `${top[0]} (${top[1]} bookings)` : "A1 (Default)");

      // 7-day bar chart
      const now = new Date();
      const bars: any[] = [];
      for (let i = 6; i >= 0; i--) {
        const d = new Date(now.getTime() - i * 86400000);
        const dayLabel = d.toLocaleDateString(undefined, { weekday: "short" });
        // Include today's actual revenue in the chart
        const dayRev = i === 0 ? totalRev : 0;
        bars.push({ day: dayLabel, revenue: dayRev });
      }
      setBarData(bars);

      const pie = Object.entries(slotCounts).map(([name, value]) => ({
        name: `Slot ${name}`,
        value: Math.max(value, 0),
      }));
      setPieData(pie.length > 0 ? pie : [{ name: "Slot A1", value: 1 }, { name: "Slot A2", value: 1 }]);
      return;
    }

    (async () => {
      const now = new Date();
      const startDay = new Date(now); startDay.setHours(0, 0, 0, 0);
      const startWeek = new Date(now.getTime() - 7 * 86400000);
      const startMonth = new Date(now.getTime() - 30 * 86400000);

      const { data: paid } = await supabase
        .from("bookings")
        .select("amount, duration_minutes, updated_at, slot_id, parking_slots(code)")
        .eq("payment_status", "paid");
      const rows = (paid ?? []) as any[];

      const sum = (arr: any[]) => arr.reduce((a, b) => a + Number(b.amount ?? 0), 0);
      setToday(sum(rows.filter((r) => new Date(r.updated_at) >= startDay)));
      setWeek(sum(rows.filter((r) => new Date(r.updated_at) >= startWeek)));
      setMonth(sum(rows.filter((r) => new Date(r.updated_at) >= startMonth)));

      const durs = rows.filter((r) => r.duration_minutes).map((r) => r.duration_minutes);
      setAvgDuration(durs.length ? Math.round(durs.reduce((a, b) => a + b, 0) / durs.length) : 0);

      const slotCounts: Record<string, number> = {};
      rows.forEach((r) => {
        const code = r.parking_slots?.code ?? "?";
        slotCounts[code] = (slotCounts[code] ?? 0) + 1;
      });
      const top = Object.entries(slotCounts).sort((a, b) => b[1] - a[1])[0];
      setMostUsed(top?.[0] ?? "—");

      const bars: any[] = [];
      for (let i = 6; i >= 0; i--) {
        const d = new Date(now.getTime() - i * 86400000);
        d.setHours(0, 0, 0, 0);
        const next = new Date(d.getTime() + 86400000);
        const total = sum(
          rows.filter((r) => {
            const t = new Date(r.updated_at);
            return t >= d && t < next;
          })
        );
        bars.push({ day: d.toLocaleDateString(undefined, { weekday: "short" }), revenue: total });
      }
      setBarData(bars);

      setPieData(Object.entries(slotCounts).map(([name, value]) => ({ name, value })));
    })();
  }, [demoBookings, demoSlots]);

  return (
    <PortalShell title="Admin Portal" nav={ADMIN_NAV}>
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold">Revenue & Financial Analytics</h2>
          <p className="text-xs text-muted-foreground">
            Dynamic revenue performance, hourly duration averages, and slot utilization metrics.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          <Card label="Today's Revenue" value={`₹${today.toFixed(0)}`} />
          <Card label="7-Day Revenue" value={`₹${week.toFixed(0)}`} />
          <Card label="30-Day Revenue" value={`₹${month.toFixed(0)}`} />
          <Card label="Avg Duration" value={`${avgDuration} min`} />
          <Card label="Top Performing Slot" value={mostUsed} />
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          {/* Revenue Bar Chart */}
          <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
            <h3 className="mb-3 font-semibold flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-primary" /> Last 7 Days Revenue (₹)
            </h3>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={barData}>
                  <XAxis dataKey="day" stroke="#888888" fontSize={12} tickLine={false} axisLine={false} />
                  <YAxis stroke="#888888" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(val) => `₹${val}`} />
                  <Tooltip formatter={(value) => [`₹${value}`, "Revenue"]} />
                  <Bar dataKey="revenue" fill="#3b82f6" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Slot Utilization Pie Chart */}
          <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
            <h3 className="mb-3 font-semibold flex items-center gap-2">
              <PieIcon className="h-4 w-4 text-emerald-500" /> Slot Utilization Share
            </h3>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label>
                    {pieData.map((_, i) => (
                      <Cell key={i} fill={COLORS[i % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(val, name) => [`${val} bookings`, name]} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      </div>
    </PortalShell>
  );
}

function Card({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
      <div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="mt-2 text-2xl font-bold text-foreground">{value}</div>
    </div>
  );
}
