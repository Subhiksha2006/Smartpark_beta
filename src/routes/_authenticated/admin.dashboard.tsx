import { createFileRoute } from "@tanstack/react-router";
import { LayoutDashboard, Monitor, ScanLine, CalendarClock, Users, DollarSign, Settings, KeyRound, Radio, Car } from "lucide-react";
import { RoleGuard } from "@/components/RoleGuard";
import { PortalShell } from "@/components/PortalShell";
import { PrototypeBadge } from "@/components/PrototypeBadge";
import { usePrototypeMode } from "@/lib/prototype-mode";
import { useSlots } from "@/lib/use-slots";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { HardwareStatusCard } from "@/components/HardwareStatusCard";

export const Route = createFileRoute("/_authenticated/admin/dashboard")({
  component: () => (
    <RoleGuard allow="admin">
      <AdminDashboard />
    </RoleGuard>
  ),
});

export const ADMIN_NAV = [
  { to: "/admin/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/admin/live-monitor", label: "Live Monitor", icon: Monitor },
  { to: "/admin/scan", label: "QR Scanner", icon: ScanLine },
  { to: "/admin/manual-verify", label: "Manual Verify", icon: KeyRound },
  { to: "/admin/active-parking", label: "Active Parking", icon: Car },
  { to: "/admin/sensor-sim", label: "Sensor Simulator", icon: Radio },
  { to: "/admin/bookings", label: "Bookings", icon: CalendarClock },
  { to: "/admin/users", label: "Users", icon: Users },
  { to: "/admin/revenue", label: "Revenue", icon: DollarSign },
  { to: "/admin/settings", label: "Settings", icon: Settings },
];


function AdminDashboard() {
  const { slots } = useSlots();
  const [prototype] = usePrototypeMode();
  const [esp32Online, setEsp32Online] = useState<boolean>(false);
  const [todayRevenue, setTodayRevenue] = useState(0);
  const [todayBookings, setTodayBookings] = useState(0);
  const [activeParking, setActiveParking] = useState(0);
  const [pendingEntry, setPendingEntry] = useState(0);
  const [pendingExit, setPendingExit] = useState(0);
  const [completedToday, setCompletedToday] = useState(0);
  const [recent, setRecent] = useState<any[]>([]);


  useEffect(() => {
    const load = async () => {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const iso = today.toISOString();
      const { data: paid } = await supabase
        .from("bookings")
        .select("amount")
        .eq("payment_status", "paid")
        .gte("updated_at", iso);
      setTodayRevenue((paid ?? []).reduce((a, b) => a + Number((b as any).amount ?? 0), 0));
      const { count: bookings } = await supabase
        .from("bookings")
        .select("*", { count: "exact", head: true })
        .gte("created_at", iso);
      setTodayBookings(bookings ?? 0);
      const { count: active } = await supabase
        .from("bookings")
        .select("*", { count: "exact", head: true })
        .eq("status", "active");
      setActiveParking(active ?? 0);
      const { count: pEntry } = await supabase
        .from("bookings")
        .select("*", { count: "exact", head: true })
        .eq("status", "reserved");
      setPendingEntry(pEntry ?? 0);
      const { count: pExit } = await supabase
        .from("bookings")
        .select("*", { count: "exact", head: true })
        .eq("status", "active")
        .eq("exit_requested", true);
      setPendingExit(pExit ?? 0);
      const { count: doneToday } = await supabase
        .from("bookings")
        .select("*", { count: "exact", head: true })
        .eq("status", "completed")
        .gte("updated_at", iso);
      setCompletedToday(doneToday ?? 0);

      const { data: rec } = await supabase
        .from("bookings")
        .select("booking_code, vehicle_number, status, created_at, parking_slots(code)")
        .order("created_at", { ascending: false })
        .limit(8);
      setRecent(rec ?? []);
    };
    load();
    // ESP32 health probe
    fetch("/api/public/gate/open", { method: "OPTIONS" })
      .then((r) => setEsp32Online(r.ok))
      .catch(() => setEsp32Online(false));
    const ch = supabase
      .channel("admin_dash")
      .on("postgres_changes", { event: "*", schema: "public", table: "bookings" }, load)
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, []);

  const counts = {
    total: slots.length,
    available: slots.filter((s) => s.status === "available").length,
    occupied: slots.filter((s) => s.status === "occupied").length,
    reserved: slots.filter((s) => s.status === "reserved").length,
  };

  return (
    <PortalShell title="Admin Portal" nav={ADMIN_NAV}>
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-2xl font-bold">Overview</h2>
          <div className="flex items-center gap-2">
            <PrototypeBadge />
            <span
              className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold ${
                prototype
                  ? "border-amber-400/60 bg-amber-400/10 text-amber-800 dark:text-amber-300"
                  : esp32Online
                    ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
                    : "border-red-500/40 bg-red-500/10 text-red-700 dark:text-red-400"
              }`}
            >
              ESP32: {prototype ? "Simulated" : esp32Online ? "Online" : "Offline"}
            </span>
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Card label="Total Slots" value={counts.total} />
          <Card label="Available" value={counts.available} tone="emerald" />
          <Card label="Occupied" value={counts.occupied} tone="red" />
          <Card label="Reserved" value={counts.reserved} tone="amber" />
          <Card label="Pending Entry Approvals" value={pendingEntry} tone="amber" />
          <Card label="Active Parking" value={activeParking} tone="emerald" />
          <Card label="Pending Exit Approvals" value={pendingExit} tone="red" />
          <Card label="Completed Today" value={completedToday} tone="blue" />
          <Card label="Today's Revenue" value={`₹${todayRevenue.toFixed(0)}`} tone="blue" />
          <Card label="Today's Bookings" value={todayBookings} tone="blue" />
          <Card label="Prototype Mode" value={prototype ? "ON" : "OFF"} tone={prototype ? "amber" : "emerald"} />
        </div>

        <HardwareStatusCard />

        <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
          <h3 className="mb-3 font-semibold">Recent Activity</h3>
          <div className="divide-y divide-border">
            {recent.map((r, i) => (
              <div key={i} className="flex items-center justify-between py-3 text-sm">
                <div>
                  <div className="font-medium">{r.booking_code} — {r.vehicle_number}</div>
                  <div className="text-xs text-muted-foreground">
                    Slot {r.parking_slots?.code} · {new Date(r.created_at).toLocaleString()}
                  </div>
                </div>
                <span className="rounded-full bg-muted px-3 py-1 text-xs uppercase">{r.status}</span>
              </div>
            ))}
            {recent.length === 0 && (
              <div className="py-6 text-center text-sm text-muted-foreground">No activity yet.</div>
            )}
          </div>
        </div>
      </div>
    </PortalShell>
  );
}

function Card({ label, value, tone }: { label: string; value: string | number; tone?: string }) {
  const map: Record<string, string> = {
    emerald: "from-emerald-500/20 to-transparent",
    red: "from-red-500/20 to-transparent",
    amber: "from-amber-500/20 to-transparent",
    blue: "from-blue-500/20 to-transparent",
  };
  return (
    <div className={`rounded-2xl border border-border bg-gradient-to-br ${map[tone ?? ""] ?? ""} p-5 shadow-sm`}>
      <div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="mt-2 text-3xl font-bold">{value}</div>
    </div>
  );
}
