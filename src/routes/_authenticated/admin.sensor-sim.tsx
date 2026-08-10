import { createFileRoute } from "@tanstack/react-router";
import { RoleGuard } from "@/components/RoleGuard";
import { PortalShell } from "@/components/PortalShell";
import { PrototypeBadge } from "@/components/PrototypeBadge";
import { ADMIN_NAV } from "./admin.dashboard";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { usePrototypeMode } from "@/lib/prototype-mode";

export const Route = createFileRoute("/_authenticated/admin/sensor-sim")({
  component: () => (
    <RoleGuard allow="admin">
      <SensorSim />
    </RoleGuard>
  ),
});

function SensorSim() {
  const [slots, setSlots] = useState<any[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [prototype] = usePrototypeMode();

  async function load() {
    const { data } = await supabase.from("parking_slots").select("*").order("code");
    setSlots(data ?? []);
  }
  useEffect(() => {
    load();
    const ch = supabase
      .channel("sensor_sim")
      .on("postgres_changes", { event: "*", schema: "public", table: "parking_slots" }, load)
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, []);

  async function push(slot: any, occupied: boolean) {
    setBusy(slot.id);
    if (prototype || !slot.sensor_id) {
      // simulate locally
      await supabase
        .from("parking_slots")
        .update({ status: occupied ? "occupied" : "available" })
        .eq("id", slot.id);
      toast.success(`Sensor ${slot.code}: ${occupied ? "OCCUPIED" : "VACANT"} (simulated)`);
    } else {
      try {
        const r = await fetch("/api/public/sensor/update", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ sensor_id: slot.sensor_id, occupied }),
        });
        const j = await r.json();
        if (!j.success) throw new Error(j.error);
        toast.success(`Sensor ${slot.code} → ${occupied ? "OCCUPIED" : "VACANT"}`);
      } catch (e: any) {
        toast.error(e.message ?? "Sensor update failed");
      }
    }
    setBusy(null);
  }

  return (
    <PortalShell title="Admin Portal" nav={ADMIN_NAV}>
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-2xl font-bold">Sensor Simulator</h2>
          <PrototypeBadge />
        </div>
        <p className="text-sm text-muted-foreground">
          Trigger the same logic as ESP32 sensor callbacks. Useful for testing occupancy flows without hardware.
        </p>
        <div className="overflow-x-auto rounded-2xl border border-border bg-card shadow-sm">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-xs uppercase text-muted-foreground">
              <tr>
                <th className="p-3 text-left">Slot</th>
                <th className="p-3 text-left">Sensor</th>
                <th className="p-3 text-left">Status</th>
                <th className="p-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody>
              {slots.map((s) => (
                <tr key={s.id} className="border-t border-border">
                  <td className="p-3 font-semibold">{s.code}</td>
                  <td className="p-3 font-mono text-xs">{s.sensor_id ?? "—"}</td>
                  <td className="p-3 capitalize">{s.status}</td>
                  <td className="p-3">
                    <div className="flex justify-end gap-2">
                      <button
                        disabled={busy === s.id}
                        onClick={() => push(s, true)}
                        className="rounded-md bg-red-600 px-3 py-1 text-xs font-semibold text-white disabled:opacity-50"
                      >
                        Occupied
                      </button>
                      <button
                        disabled={busy === s.id}
                        onClick={() => push(s, false)}
                        className="rounded-md bg-emerald-600 px-3 py-1 text-xs font-semibold text-white disabled:opacity-50"
                      >
                        Vacant
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
