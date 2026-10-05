import { createFileRoute } from "@tanstack/react-router";
import {
  LayoutDashboard,
  Monitor,
  ScanLine,
  CalendarClock,
  Users,
  DollarSign,
  Settings,
  KeyRound,
  Radio,
  Car,
  RotateCcw,
  Activity,
  CheckCircle2,
  Clock,
  ShieldCheck,
} from "lucide-react";
import { RoleGuard } from "@/components/RoleGuard";
import { PortalShell } from "@/components/PortalShell";
import { PrototypeBadge } from "@/components/PrototypeBadge";
import { usePrototypeMode } from "@/lib/prototype-mode";
import { useSlots } from "@/lib/use-slots";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { HardwareStatusCard } from "@/components/HardwareStatusCard";
import { useDemoState } from "@/lib/demo-state-store";
import { getDemoRole } from "@/lib/demo-auth";
import { toast } from "sonner";

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
  const {
    stats,
    activityLogs,
    resetDemo,
  } = useDemoState();
  const [esp32Online, setEsp32Online] = useState<boolean>(false);

  // Supabase fallback metrics if in production mode
  const [sbRevenue, setSbRevenue] = useState(0);
  const [sbBookings, setSbBookings] = useState(0);
  const [sbActive, setSbActive] = useState(0);
  const [sbPendingEntry, setSbPendingEntry] = useState(0);
  const [sbPendingExit, setSbPendingExit] = useState(0);
  const [sbCompleted, setSbCompleted] = useState(0);
  const [sbRecent, setSbRecent] = useState<any[]>([]);

  useEffect(() => {
    if (getDemoRole()) return;
    const load = async () => {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const iso = today.toISOString();
      const { data: paid } = await supabase
        .from("bookings")
        .select("amount")
        .eq("payment_status", "paid")
        .gte("updated_at", iso);
      setSbRevenue((paid ?? []).reduce((a, b) => a + Number((b as any).amount ?? 0), 0));
      const { count: bookings } = await supabase
        .from("bookings")
        .select("*", { count: "exact", head: true })
        .gte("created_at", iso);
      setSbBookings(bookings ?? 0);
      const { count: active } = await supabase
        .from("bookings")
        .select("*", { count: "exact", head: true })
        .eq("status", "active");
      setSbActive(active ?? 0);
      const { count: pEntry } = await supabase
        .from("bookings")
        .select("*", { count: "exact", head: true })
        .eq("status", "reserved");
      setSbPendingEntry(pEntry ?? 0);
      const { count: pExit } = await supabase
        .from("bookings")
        .select("*", { count: "exact", head: true })
        .eq("status", "active")
        .eq("exit_requested", true);
      setSbPendingExit(pExit ?? 0);
      const { count: doneToday } = await supabase
        .from("bookings")
        .select("*", { count: "exact", head: true })
        .eq("status", "completed")
        .gte("updated_at", iso);
      setSbCompleted(doneToday ?? 0);

      const { data: rec } = await supabase
        .from("bookings")
        .select("booking_code, vehicle_number, status, created_at, parking_slots(code)")
        .order("created_at", { ascending: false })
        .limit(8);
      setSbRecent(rec ?? []);
    };
    load();
    const ch = supabase
      .channel("admin_dash")
      .on("postgres_changes", { event: "*", schema: "public", table: "bookings" }, load)
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, []);

  const isDemo = getDemoRole() !== null || true;

  const counts = {
    total: slots.length,
    available: slots.filter((s) => s.status === "available").length,
    occupied: slots.filter((s) => s.status === "occupied").length,
    reserved: slots.filter((s) => s.status === "reserved").length,
  };

  const displayStats = isDemo
    ? {
        total: stats.totalSlots,
        available: stats.availableSlots,
        occupied: stats.occupiedSlots,
        reserved: stats.reservedSlots,
        pendingEntry: stats.pendingEntryCount,
        activeParking: stats.activeParkingCount,
        pendingExit: stats.pendingExitCount,
        completedToday: stats.completedTodayCount,
        todayRevenue: `₹${stats.todayRevenue.toFixed(0)}`,
        todayBookings: stats.todayBookingsCount,
      }
    : {
        total: counts.total,
        available: counts.available,
        occupied: counts.occupied,
        reserved: counts.reserved,
        pendingEntry: sbPendingEntry,
        activeParking: sbActive,
        pendingExit: sbPendingExit,
        completedToday: sbCompleted,
        todayRevenue: `₹${sbRevenue.toFixed(0)}`,
        todayBookings: sbBookings,
      };

  function handleReset() {
    if (confirm("Reset Demo System? All bookings will be cleared and slots A1 and A2 will return to Available.")) {
      resetDemo();
      toast.success("Demo System reset to initial state: A1 & A2 Available");
    }
  }

  return (
    <PortalShell title="Admin Portal" nav={ADMIN_NAV}>
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-2xl font-bold">Admin Overview</h2>
            <p className="text-xs text-muted-foreground">
              Real-time parking analytics & activity synchronized with Demo Driver
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleReset}
              className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-background px-3 py-1.5 text-xs font-semibold hover:bg-muted"
              title="Reset Demo State"
            >
              <RotateCcw className="h-3.5 w-3.5" /> Reset Demo
            </button>
            <PrototypeBadge />
            <span
              className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold ${
                prototype
                  ? "border-amber-400/60 bg-amber-400/10 text-amber-800 dark:text-amber-300"
                  : "border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
              }`}
            >
              Hardware: {prototype ? "Prototype / Simulated" : "Connected (9600 Baud)"}
            </span>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Card label="Total Slots" value={displayStats.total} />
          <Card label="Available Slots" value={displayStats.available} tone="emerald" />
          <Card label="Occupied Slots" value={displayStats.occupied} tone="red" />
          <Card label="Reserved Slots" value={displayStats.reserved} tone="amber" />
          <Card label="Pending Entry Approvals" value={displayStats.pendingEntry} tone="amber" />
          <Card label="Active Parking Sessions" value={displayStats.activeParking} tone="emerald" />
          <Card label="Pending Exit Approvals" value={displayStats.pendingExit} tone="red" />
          <Card label="Completed Today" value={displayStats.completedToday} tone="blue" />
          <Card label="Today's Revenue" value={displayStats.todayRevenue} tone="blue" />
          <Card label="Total Bookings" value={displayStats.todayBookings} tone="blue" />
          <Card label="System Mode" value="Interactive Demo" tone="emerald" />
          <Card label="Active Slots" value="A1 & A2" tone="blue" />
        </div>

        <HardwareStatusCard />

        {/* Live System Activity Log */}
        <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="font-semibold flex items-center gap-2">
              <Activity className="h-4 w-4 text-primary" /> Recent System Activity
            </h3>
            <span className="text-xs text-muted-foreground">{activityLogs.length} events recorded</span>
          </div>
          <div className="divide-y divide-border">
            {activityLogs.slice(0, 10).map((log) => (
              <div key={log.id} className="flex flex-wrap items-center justify-between py-3 text-sm gap-2">
                <div>
                  <div className="font-medium flex items-center gap-2">
                    <span>{log.event}</span>
                    <span className="text-xs text-muted-foreground font-normal">({log.user})</span>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {log.details} · Slot: <strong>{log.slot}</strong>
                  </div>
                </div>
                <div className="text-right">
                  <span className="rounded-full bg-muted px-2.5 py-0.5 text-[11px] font-mono text-muted-foreground">
                    {new Date(log.timestamp).toLocaleTimeString()}
                  </span>
                </div>
              </div>
            ))}
            {activityLogs.length === 0 && (
              <div className="py-6 text-center text-sm text-muted-foreground">No activity recorded yet.</div>
            )}
          </div>
        </div>
      </div>
    </PortalShell>
  );
}

function Card({ label, value, tone }: { label: string; value: string | number; tone?: string }) {
  const map: Record<string, string> = {
    emerald: "from-emerald-500/20 to-transparent text-foreground",
    red: "from-red-500/20 to-transparent text-foreground",
    amber: "from-amber-500/20 to-transparent text-foreground",
    blue: "from-blue-500/20 to-transparent text-foreground",
  };
  return (
    <div className={`rounded-2xl border border-border bg-gradient-to-br ${map[tone ?? ""] ?? ""} p-5 shadow-sm`}>
      <div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="mt-2 text-3xl font-bold">{value}</div>
    </div>
  );
}
