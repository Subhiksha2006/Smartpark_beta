import { createFileRoute } from "@tanstack/react-router";
import { LayoutDashboard, CalendarClock, History, User } from "lucide-react";
import { RoleGuard } from "@/components/RoleGuard";
import { PortalShell } from "@/components/PortalShell";
import { SlotGrid, SlotLegend } from "@/components/SlotGrid";
import { useSlots } from "@/lib/use-slots";
import { useCurrentUser } from "@/lib/use-role";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/driver/dashboard")({
  component: () => (
    <RoleGuard allow="driver">
      <DriverDashboard />
    </RoleGuard>
  ),
});

const NAV = [
  { to: "/driver/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/driver/bookings", label: "My Bookings", icon: CalendarClock },
  { to: "/driver/history", label: "History", icon: History },
  { to: "/driver/profile", label: "Profile", icon: User },
];

function DriverDashboard() {
  const { slots } = useSlots();
  const { userId } = useCurrentUser();
  const [profileName, setProfileName] = useState<string>("");
  const [vehicle, setVehicle] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [duration, setDuration] = useState<number>(1);
  const [booking, setBooking] = useState(false);

  useEffect(() => {
    if (!userId) return;
    supabase
      .from("profiles")
      .select("full_name, vehicle_number")
      .eq("id", userId)
      .maybeSingle()
      .then(({ data }) => {
        if (data) {
          setProfileName((data as { full_name: string }).full_name);
          setVehicle((data as { vehicle_number: string | null }).vehicle_number ?? "");
        }
      });
  }, [userId]);

  const counts = {
    available: slots.filter((s) => s.status === "available").length,
    occupied: slots.filter((s) => s.status === "occupied").length,
    reserved: slots.filter((s) => s.status === "reserved").length,
  };

  async function bookSlot() {
    if (!selectedId || !userId || !vehicle) {
      toast.error("Select a slot and enter vehicle number");
      return;
    }
    setBooking(true);
    const { error } = await supabase.from("bookings").insert({
      user_id: userId,
      slot_id: selectedId,
      vehicle_number: vehicle,
      estimated_duration_hours: duration,
      status: "reserved",
    });
    if (error) {
      toast.error(error.message);
      setBooking(false);
      return;
    }
    await supabase.from("parking_slots").update({ status: "reserved" }).eq("id", selectedId);
    setBooking(false);
    setSelectedId(null);
    toast.success("Booking confirmed!");
  }

  return (
    <PortalShell title="Driver Portal" nav={NAV}>
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold">Welcome{profileName ? `, ${profileName}` : ""}</h2>
          <p className="text-sm text-muted-foreground">Book a parking slot in real-time.</p>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <StatCard label="Available" value={counts.available} tone="emerald" />
          <StatCard label="Occupied" value={counts.occupied} tone="red" />
          <StatCard label="Reserved" value={counts.reserved} tone="amber" />
        </div>

        <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="font-semibold">Parking Slots</h3>
            <SlotLegend />
          </div>
          <SlotGrid slots={slots} selectable onSelect={(s) => setSelectedId(s.id)} selectedId={selectedId} />
        </div>

        <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
          <h3 className="mb-4 font-semibold">Book Selected Slot</h3>
          <div className="grid gap-3 sm:grid-cols-3">
            <div>
              <label className="mb-1 block text-xs text-muted-foreground">Selected Slot</label>
              <input
                readOnly
                value={slots.find((s) => s.id === selectedId)?.code ?? "—"}
                className="w-full rounded-lg border border-input bg-muted px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-muted-foreground">Vehicle Number</label>
              <input
                value={vehicle}
                onChange={(e) => setVehicle(e.target.value)}
                className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-muted-foreground">Duration (hours)</label>
              <input
                type="number"
                min={1}
                value={duration}
                onChange={(e) => setDuration(Number(e.target.value))}
                className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
              />
            </div>
          </div>
          <button
            onClick={bookSlot}
            disabled={!selectedId || booking}
            className="mt-4 rounded-lg bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50"
          >
            {booking ? "Booking..." : "Confirm Booking"}
          </button>
        </div>
      </div>
    </PortalShell>
  );
}

function StatCard({ label, value, tone }: { label: string; value: number; tone: string }) {
  const toneMap: Record<string, string> = {
    emerald: "from-emerald-500/20 to-emerald-500/5 text-emerald-700 dark:text-emerald-400",
    red: "from-red-500/20 to-red-500/5 text-red-700 dark:text-red-400",
    amber: "from-amber-500/20 to-amber-500/5 text-amber-700 dark:text-amber-500",
  };
  return (
    <div className={`rounded-2xl border border-border bg-gradient-to-br p-5 shadow-sm ${toneMap[tone]}`}>
      <div className="text-xs uppercase tracking-wide opacity-80">{label}</div>
      <div className="mt-2 text-3xl font-bold">{value}</div>
    </div>
  );
}
