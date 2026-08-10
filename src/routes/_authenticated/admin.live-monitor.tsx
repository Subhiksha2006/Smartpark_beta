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
import { DoorOpen, DoorClosed, ShieldAlert, ShieldCheck } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin/live-monitor")({
  component: () => (
    <RoleGuard allow="admin">
      <LiveMonitor />
    </RoleGuard>
  ),
});

function LiveMonitor() {
  const { slots } = useSlots();
  const [selected, setSelected] = useState<Slot | null>(null);
  const [prototype] = usePrototypeMode();

  async function gate(label: string, type: "ENTRY" | "EXIT") {
    const g = await triggerGate("MANUAL", type);
    toast.success(
      g.simulated
        ? `${label} — gate operation simulated successfully.`
        : `${label} — signal sent to gate controller.`,
    );
  }

  async function setSlotStatus(status: "available" | "occupied" | "reserved") {
    if (!selected) return toast.error("Select a slot first");
    const { error } = await supabase.from("parking_slots").update({ status }).eq("id", selected.id);
    if (error) return toast.error(error.message);
    toast.success(`Slot ${selected.code} → ${status}`);
  }
  function disableSlot() {
    if (!selected) return toast.error("Select a slot first");
    // Schema-safe: mark reserved to prevent booking and notify.
    supabase
      .from("parking_slots")
      .update({ status: "reserved" })
      .eq("id", selected.id)
      .then(() => toast.success(`Slot ${selected.code} disabled (reserved for maintenance)`));
  }

  return (
    <PortalShell title="Admin Portal" nav={ADMIN_NAV}>
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-2xl font-bold">Live Parking Monitor</h2>
          <div className="flex items-center gap-2">
            <PrototypeBadge />
            <SlotLegend />
          </div>
        </div>
        <p className="text-sm text-muted-foreground">
          Updates in real-time. Tap a slot to override its status manually.
        </p>

        <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
          <SlotGrid
            slots={slots}
            selectable
            selectedId={selected?.id}
            onSelect={(s) => setSelected(s)}
            allowAny
          />
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
            <h3 className="mb-3 font-semibold">Slot Override</h3>
            <p className="mb-3 text-xs text-muted-foreground">
              Selected: <strong>{selected?.code ?? "None"}</strong>
            </p>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => setSlotStatus("occupied")}
                className="rounded-lg bg-red-600 px-3 py-2 text-xs font-semibold text-white"
              >
                Mark Occupied
              </button>
              <button
                onClick={() => setSlotStatus("available")}
                className="rounded-lg bg-emerald-600 px-3 py-2 text-xs font-semibold text-white"
              >
                Mark Vacant
              </button>
              <button
                onClick={() => setSlotStatus("reserved")}
                className="rounded-lg bg-amber-500 px-3 py-2 text-xs font-semibold text-white"
              >
                Reserve Slot
              </button>
              <button
                onClick={disableSlot}
                className="rounded-lg border border-input px-3 py-2 text-xs font-semibold"
              >
                Disable Slot
              </button>
            </div>
          </div>

          <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
            <h3 className="mb-3 font-semibold">Gate Override</h3>
            <p className="mb-3 text-xs text-muted-foreground">
              {prototype
                ? "Prototype Mode: hardware calls are simulated."
                : "Sends control signal to the ESP32 gate controller."}
            </p>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => gate("Open Gate", "ENTRY")}
                className="inline-flex items-center gap-2 rounded-lg bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground"
              >
                <DoorOpen className="h-4 w-4" /> Open Gate
              </button>
              <button
                onClick={() => gate("Close Gate", "EXIT")}
                className="inline-flex items-center gap-2 rounded-lg border border-input px-3 py-2 text-xs font-semibold"
              >
                <DoorClosed className="h-4 w-4" /> Close Gate
              </button>
              <button
                onClick={() => gate("Emergency Open", "ENTRY")}
                className="inline-flex items-center gap-2 rounded-lg bg-red-600 px-3 py-2 text-xs font-semibold text-white"
              >
                <ShieldAlert className="h-4 w-4" /> Emergency Open
              </button>
              <button
                onClick={() => gate("Emergency Close", "EXIT")}
                className="inline-flex items-center gap-2 rounded-lg bg-red-800 px-3 py-2 text-xs font-semibold text-white"
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
