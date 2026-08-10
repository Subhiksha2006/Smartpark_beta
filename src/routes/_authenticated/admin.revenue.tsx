import { createFileRoute } from "@tanstack/react-router";
import { RoleGuard } from "@/components/RoleGuard";
import { PortalShell } from "@/components/PortalShell";
import { ADMIN_NAV } from "./admin.dashboard";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { BarChart, Bar, PieChart, Pie, Cell, ResponsiveContainer, XAxis, YAxis, Tooltip } from "recharts";

export const Route = createFileRoute("/_authenticated/admin/revenue")({
  component: () => (
    <RoleGuard allow="admin">
      <Revenue />
    </RoleGuard>
  ),
});

const COLORS = ["#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899"];

function Revenue() {
  const [today, setToday] = useState(0);
  const [week, setWeek] = useState(0);
  const [month, setMonth] = useState(0);
  const [avgDuration, setAvgDuration] = useState(0);
  const [mostUsed, setMostUsed] = useState<string>("—");
  const [barData, setBarData] = useState<any[]>([]);
  const [pieData, setPieData] = useState<any[]>([]);

  useEffect(() => {
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

      // Most used slot
      const slotCounts: Record<string, number> = {};
      rows.forEach((r) => {
        const code = r.parking_slots?.code ?? "?";
        slotCounts[code] = (slotCounts[code] ?? 0) + 1;
      });
      const top = Object.entries(slotCounts).sort((a, b) => b[1] - a[1])[0];
      setMostUsed(top?.[0] ?? "—");

      // Last 7 days bar
      const bars: any[] = [];
      for (let i = 6; i >= 0; i--) {
        const d = new Date(now.getTime() - i * 86400000);
        d.setHours(0, 0, 0, 0);
        const next = new Date(d.getTime() + 86400000);
        const total = sum(
          rows.filter((r) => {
            const t = new Date(r.updated_at);
            return t >= d && t < next;
          }),
        );
        bars.push({ day: d.toLocaleDateString(undefined, { weekday: "short" }), revenue: total });
      }
      setBarData(bars);

      setPieData(Object.entries(slotCounts).map(([name, value]) => ({ name, value })));
    })();
  }, []);

  return (
    <PortalShell title="Admin Portal" nav={ADMIN_NAV}>
      <div className="space-y-6">
        <h2 className="text-2xl font-bold">Revenue Dashboard</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          <Card label="Today" value={`₹${today.toFixed(0)}`} />
          <Card label="Weekly" value={`₹${week.toFixed(0)}`} />
          <Card label="Monthly" value={`₹${month.toFixed(0)}`} />
          <Card label="Avg Duration" value={`${avgDuration} min`} />
          <Card label="Top Slot" value={mostUsed} />
        </div>
        <div className="grid gap-6 lg:grid-cols-2">
          <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
            <h3 className="mb-3 font-semibold">Last 7 Days Revenue</h3>
            <div className="h-64">
              <ResponsiveContainer>
                <BarChart data={barData}>
                  <XAxis dataKey="day" />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="revenue" fill="#3b82f6" radius={[8, 8, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
          <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
            <h3 className="mb-3 font-semibold">Slot Usage</h3>
            <div className="h-64">
              <ResponsiveContainer>
                <PieChart>
                  <Pie data={pieData} dataKey="value" nameKey="name" outerRadius={80} label>
                    {pieData.map((_, i) => (
                      <Cell key={i} fill={COLORS[i % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
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
      <div className="mt-2 text-2xl font-bold">{value}</div>
    </div>
  );
}
