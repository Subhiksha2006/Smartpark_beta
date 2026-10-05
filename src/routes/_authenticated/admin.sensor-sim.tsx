import { createFileRoute } from "@tanstack/react-router";
import { RoleGuard } from "@/components/RoleGuard";
import { PortalShell } from "@/components/PortalShell";
import { PrototypeBadge } from "@/components/PrototypeBadge";
import { ADMIN_NAV } from "./admin.dashboard";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { usePrototypeMode } from "@/lib/prototype-mode";
import { useDemoState, setDemoSensorState } from "@/lib/demo-state-store";
import { getDemoRole } from "@/lib/demo-auth";
import { Radio, Cpu, RefreshCw, CheckCircle2 } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin/sensor-sim")({
  component: () => (
    <RoleGuard allow="admin">
      <SensorSim />
    </RoleGuard>
  ),
});

function SensorSim() {
  const { slots: demoSlots } = useDemoState();
  const [slots, setSlots] = useState<any[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [prototype] = usePrototypeMode();

  async function load() {
    if (getDemoRole() || true) {
      setSlots(demoSlots);
      return;
    }
    const { data } = await supabase.from("parking_slots").select("*").order("code");
    setSlots(data ?? []);
  }

  useEffect(() => {
    load();
  }, [demoSlots]);

  async function push(slot: any, occupied: boolean) {
    setBusy(slot.id);
    if (getDemoRole() || true) {
      setDemoSensorState(slot.code as "A1" | "A2", occupied);
      toast.success(`Sensor ${slot.code}: ${occupied ? "OCCUPIED" : "VACANT"} (Simulated Telemetry)`);
      setBusy(null);
      return;
    }

    try {
      await supabase
        .from("parking_slots")
        .update({ status: occupied ? "occupied" : "available" })
        .eq("id", slot.id);
      toast.success(`Sensor ${slot.code} → ${occupied ? "OCCUPIED" : "VACANT"}`);
    } catch (e: any) {
      toast.error(e.message ?? "Sensor update failed");
    } finally {
      setBusy(null);
    }
  }

  return (
    <PortalShell title="Admin Portal" nav={ADMIN_NAV}>
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-2xl font-bold">Hardware Sensor Simulator</h2>
            <p className="text-xs text-muted-foreground">
              Simulate HC-SR04 ultrasonic distance sensor telemetry for testing real-time bay occupancy.
            </p>
          </div>
          <PrototypeBadge />
        </div>

        <div className="overflow-x-auto rounded-2xl border border-border bg-card shadow-sm">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-xs uppercase text-muted-foreground">
              <tr>
                <th className="p-3 text-left">Parking Slot</th>
                <th className="p-3 text-left">Sensor Identifier</th>
                <th className="p-3 text-left">Hardware Pinout</th>
                <th className="p-3 text-left">Current Occupancy</th>
                <th className="p-3 text-right">Simulate Trigger</th>
              </tr>
            </thead>
            <tbody>
              {slots.map((s) => (
                <tr key={s.id} className="border-t border-border hover:bg-muted/20 transition">
                  <td className="p-3 font-bold text-base">{s.code}</td>
                  <td className="p-3 font-mono text-xs text-muted-foreground">{s.sensor_id ?? `sensor_${s.code.toLowerCase()}`}</td>
                  <td className="p-3 text-xs text-muted-foreground">
                    {s.code === "A1" ? "TRIG D2 · ECHO D3" : s.code === "A2" ? "TRIG D4 · ECHO D5" : "Virtual Slot"}
                  </td>
                  <td className="p-3">
                    <span
                      className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold uppercase ${
                        s.status === "available"
                          ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400"
                          : s.status === "occupied"
                          ? "bg-red-500/15 text-red-700 dark:text-red-400"
                          : "bg-amber-500/15 text-amber-700 dark:text-amber-500"
                      }`}
                    >
                      {s.status}
                    </span>
                  </td>
                  <td className="p-3 text-right">
                    <div className="flex justify-end gap-2">
                      <button
                        disabled={busy === s.id || s.status === "occupied"}
                        onClick={() => push(s, true)}
                        className="rounded-lg bg-red-600 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-red-700 disabled:opacity-40"
                      >
                        Vehicle Present (Occupied)
                      </button>
                      <button
                        disabled={busy === s.id || s.status === "available"}
                        onClick={() => push(s, false)}
                        className="rounded-lg bg-emerald-600 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-40"
                      >
                        Bay Empty (Vacant)
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </PortalShell>
  );
}
