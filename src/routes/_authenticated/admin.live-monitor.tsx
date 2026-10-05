import { createFileRoute } from "@tanstack/react-router";
import { RoleGuard } from "@/components/RoleGuard";
import { PortalShell } from "@/components/PortalShell";
import { PrototypeBadge } from "@/components/PrototypeBadge";
import { SlotGrid, SlotLegend, type Slot } from "@/components/SlotGrid";
import { useSlots } from "@/lib/use-slots";
import { ADMIN_NAV } from "./admin.dashboard";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { triggerGate, usePrototypeMode } from "@/lib/prototype-mode";
import { DoorOpen, DoorClosed, ShieldAlert, ShieldCheck, Car, User, Clock, CheckCircle2 } from "lucide-react";
import { useDemoState, setDemoSlotStatus } from "@/lib/demo-state-store";
import { getDemoRole } from "@/lib/demo-auth";

export const Route = createFileRoute("/_authenticated/admin/live-monitor")({
  component: () => (
    <RoleGuard allow="admin">
      <LiveMonitor />
    </RoleGuard>
  ),
});

function LiveMonitor() {
  const { slots } = useSlots();
  const { slots: demoSlots, bookings } = useDemoState();
  const [selected, setSelected] = useState<Slot | null>(null);
  const [prototype] = usePrototypeMode();

  const selectedDemoSlot = selected
    ? demoSlots.find((s) => s.code === selected.code || s.id === selected.id)
    : null;

  const currentBooking = selectedDemoSlot?.currentBookingId
    ? bookings.find((b) => b.id === selectedDemoSlot.currentBookingId)
    : bookings.find((b) => b.slot_code === selectedDemoSlot?.code && (b.status === "reserved" || b.status === "active"));

  async function gate(label: string, type: "ENTRY" | "EXIT") {
    const g = await triggerGate("MANUAL", type);
    toast.success(
      g.simulated
        ? `${label} — gate operation simulated successfully.`
        : `${label} — signal sent to gate controller.`
    );
  }

  async function updateStatus(status: "available" | "occupied" | "reserved") {
    if (!selected) return toast.error("Select a slot first");

    setDemoSlotStatus(selected.code as "A1" | "A2", status, "Admin Manual Override");
    toast.success(`Slot ${selected.code} → ${status.toUpperCase()}`);
  }

  function disableSlot() {
    if (!selected) return toast.error("Select a slot first");
    updateStatus("reserved");
    toast.info(`Slot ${selected.code} disabled for maintenance`);
  }

  return (
    <PortalShell title="Admin Portal" nav={ADMIN_NAV}>
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-2xl font-bold">Live Parking Monitor</h2>
            <p className="text-sm text-muted-foreground">
              Real-time bay occupancy telemetry & barrier gate controls.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <PrototypeBadge />
            <SlotLegend />
          </div>
        </div>

        {/* Visual Slot Grid */}
        <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="font-semibold text-sm">Parking Bays (Select a slot to view telemetry)</h3>
            <span className="text-xs text-muted-foreground">
              Selected: <strong className="text-foreground">{selected?.code ?? "None (Click a slot)"}</strong>
            </span>
          </div>
          <SlotGrid
            slots={slots}
            selectable
            selectedId={selected?.id}
            onSelect={(s) => setSelected(s)}
            allowAny
          />
        </div>

        {/* Selected Slot Inspector Details */}
        {selected && (
          <div className="rounded-2xl border border-primary/30 bg-card p-5 shadow-sm space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-bold flex items-center gap-2">
                <Car className="h-4 w-4 text-primary" /> Slot {selected.code} Details
              </h3>
              <span
                className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold uppercase ${
                  selected.status === "available"
                    ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400"
                    : selected.status === "occupied"
                    ? "bg-red-500/15 text-red-700 dark:text-red-400"
                    : "bg-amber-500/15 text-amber-700 dark:text-amber-500"
                }`}
              >
                {selected.status}
              </span>
            </div>

            <div className="grid gap-3 text-xs sm:grid-cols-2 md:grid-cols-4">
              <div className="rounded-lg bg-muted/50 p-3">
                <div className="text-muted-foreground uppercase text-[10px]">Sensor ID</div>
                <div className="font-mono font-semibold text-sm">{selectedDemoSlot?.sensor_id ?? `sensor_${selected.code.toLowerCase()}`}</div>
              </div>
              <div className="rounded-lg bg-muted/50 p-3">
                <div className="text-muted-foreground uppercase text-[10px]">Current Driver</div>
                <div className="font-semibold text-sm">{currentBooking?.driver_name ?? "None (Vacant)"}</div>
              </div>
              <div className="rounded-lg bg-muted/50 p-3">
                <div className="text-muted-foreground uppercase text-[10px]">Vehicle Number</div>
                <div className="font-semibold text-sm">{currentBooking?.vehicle_number ?? "—"}</div>
              </div>
              <div className="rounded-lg bg-muted/50 p-3">
                <div className="text-muted-foreground uppercase text-[10px]">Active Booking ID</div>
                <div className="font-mono font-semibold text-sm">{currentBooking?.booking_code ?? "—"}</div>
              </div>
            </div>
          </div>
        )}

        <div className="grid gap-4 lg:grid-cols-2">
          {/* Slot Override Controls */}
          <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
            <h3 className="mb-2 font-semibold">Slot Status Override</h3>
            <p className="mb-4 text-xs text-muted-foreground">
              Override slot state in the shared demo system. Updates both Admin and Driver views.
            </p>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => updateStatus("occupied")}
                disabled={!selected}
                className="rounded-lg bg-red-600 px-3.5 py-2 text-xs font-semibold text-white hover:bg-red-700 disabled:opacity-50"
              >
                Mark Occupied
              </button>
              <button
                onClick={() => updateStatus("available")}
                disabled={!selected}
                className="rounded-lg bg-emerald-600 px-3.5 py-2 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
              >
                Mark Vacant (Available)
              </button>
              <button
                onClick={() => updateStatus("reserved")}
                disabled={!selected}
                className="rounded-lg bg-amber-500 px-3.5 py-2 text-xs font-semibold text-white hover:bg-amber-600 disabled:opacity-50"
              >
                Reserve Slot
              </button>
              <button
                onClick={disableSlot}
                disabled={!selected}
                className="rounded-lg border border-input px-3.5 py-2 text-xs font-semibold hover:bg-muted disabled:opacity-50"
              >
                Disable (Maintenance)
              </button>
            </div>
          </div>

          {/* Gate Barrier Override Controls */}
          <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
            <h3 className="mb-2 font-semibold">Gate Barrier Override</h3>
            <p className="mb-4 text-xs text-muted-foreground">
              Send manual gate actuation commands over Web Serial (USB) to Arduino SG90 Servo.
            </p>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => gate("Open Gate", "ENTRY")}
                className="inline-flex items-center gap-2 rounded-lg bg-primary px-3.5 py-2 text-xs font-semibold text-primary-foreground hover:bg-primary/90"
              >
                <DoorOpen className="h-4 w-4" /> Open Gate (5s)
              </button>
              <button
                onClick={() => gate("Close Gate", "EXIT")}
                className="inline-flex items-center gap-2 rounded-lg border border-input px-3.5 py-2 text-xs font-semibold hover:bg-muted"
              >
                <DoorClosed className="h-4 w-4" /> Close Gate
              </button>
              <button
                onClick={() => gate("Emergency Open", "ENTRY")}
                className="inline-flex items-center gap-2 rounded-lg bg-red-600 px-3.5 py-2 text-xs font-semibold text-white hover:bg-red-700"
              >
                <ShieldAlert className="h-4 w-4" /> Emergency Open
              </button>
              <button
                onClick={() => gate("Emergency Close", "EXIT")}
                className="inline-flex items-center gap-2 rounded-lg bg-red-800 px-3.5 py-2 text-xs font-semibold text-white hover:bg-red-900"
              >
                <ShieldCheck className="h-4 w-4" /> Emergency Close
              </button>
            </div>
          </div>
        </div>
      </div>
    </PortalShell>
  );
}
