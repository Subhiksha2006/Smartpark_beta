import { createFileRoute } from "@tanstack/react-router";
import { RoleGuard } from "@/components/RoleGuard";
import { PortalShell } from "@/components/PortalShell";
import { ADMIN_NAV } from "./admin.dashboard";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { HOURLY_RATE, GST_RATE } from "@/lib/pricing";
import { usePrototypeMode } from "@/lib/prototype-mode";

export const Route = createFileRoute("/_authenticated/admin/settings")({
  component: () => (
    <RoleGuard allow="admin">
      <SettingsPage />
    </RoleGuard>
  ),
});

function SettingsPage() {
  const [slots, setSlots] = useState<any[]>([]);
  const [rate, setRate] = useState(HOURLY_RATE);
  const [prototype, setPrototype] = usePrototypeMode();

  async function load() {
    const { data } = await supabase.from("parking_slots").select("*").order("code");
    setSlots(data ?? []);
  }
  useEffect(() => {
    load();
  }, []);

  async function updateRate(id: string, newRate: number) {
    await supabase.from("parking_slots").update({ hourly_rate: newRate }).eq("id", id);
    toast.success("Rate updated");
    load();
  }
  async function updateStatus(id: string, status: string) {
    await supabase.from("parking_slots").update({ status: status as any }).eq("id", id);
    toast.success("Status updated");
  }

  return (
    <PortalShell title="Admin Portal" nav={ADMIN_NAV}>
      <div className="space-y-6">
        <h2 className="text-2xl font-bold">Settings</h2>

        <div className="rounded-2xl border border-amber-400/40 bg-amber-400/5 p-5 shadow-sm">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h3 className="font-semibold">Prototype Mode</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                Simulate ESP32 gate operations, bypass QR blocks, and fake payment confirmation.
                Ideal for demos without hardware attached.
              </p>
            </div>
            <button
              onClick={() => {
                setPrototype(!prototype);
                toast.success(!prototype ? "Prototype Mode enabled" : "Prototype Mode disabled");
              }}
              className={`relative h-7 w-14 shrink-0 rounded-full transition ${
                prototype ? "bg-amber-500" : "bg-muted"
              }`}
              aria-pressed={prototype}
            >
              <span
                className={`absolute top-0.5 h-6 w-6 rounded-full bg-white shadow transition ${
                  prototype ? "left-7" : "left-0.5"
                }`}
              />
            </button>
          </div>
        </div>

        <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
          <h3 className="mb-3 font-semibold">Pricing</h3>
          <p className="text-sm text-muted-foreground">
            Default hourly rate: <strong>₹{rate}</strong> · GST: <strong>{GST_RATE * 100}%</strong>
          </p>
          <input
            type="number"
            value={rate}
            onChange={(e) => setRate(Number(e.target.value))}
            className="mt-3 w-40 rounded-lg border border-input bg-background px-3 py-2 text-sm"
          />
          <p className="mt-1 text-xs text-muted-foreground">
            Change per-slot rate below to override.
          </p>
        </div>

        <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
          <h3 className="mb-3 font-semibold">Parking Slots</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="p-2 text-left">Slot</th>
                  <th className="p-2 text-left">Sensor ID</th>
                  <th className="p-2 text-left">Rate (₹/hr)</th>
                  <th className="p-2 text-left">Status</th>
                </tr>
              </thead>
              <tbody>
                {slots.map((s) => (
                  <tr key={s.id} className="border-t border-border">
                    <td className="p-2 font-semibold">{s.code}</td>
                    <td className="p-2 font-mono text-xs">{s.sensor_id}</td>
                    <td className="p-2">
                      <input
                        type="number"
                        defaultValue={s.hourly_rate}
                        onBlur={(e) => updateRate(s.id, Number(e.target.value))}
                        className="w-24 rounded border border-input bg-background px-2 py-1 text-sm"
                      />
                    </td>
                    <td className="p-2">
                      <select
                        defaultValue={s.status}
                        onChange={(e) => updateStatus(s.id, e.target.value)}
                        className="rounded border border-input bg-background px-2 py-1 text-sm"
                      >
                        <option value="available">Available</option>
                        <option value="occupied">Occupied</option>
                        <option value="reserved">Reserved</option>
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
          <h3 className="mb-3 font-semibold">ESP32 Integration Endpoints</h3>
          <p className="text-sm text-muted-foreground">
            Sensor status update: <code className="rounded bg-muted px-2 py-0.5">POST /api/public/sensor/update</code>
            <br />
            Body: <code className="rounded bg-muted px-2 py-0.5">{`{"sensor_id":"sensor_a1","occupied":true}`}</code>
          </p>
          <p className="mt-2 text-sm text-muted-foreground">
            Gate open signal: <code className="rounded bg-muted px-2 py-0.5">POST /api/public/gate/open</code>
            <br />
            Body: <code className="rounded bg-muted px-2 py-0.5">{`{"bookingId":"BK001","type":"ENTRY"}`}</code>
          </p>
        </div>
      </div>
    </PortalShell>
  );
}
