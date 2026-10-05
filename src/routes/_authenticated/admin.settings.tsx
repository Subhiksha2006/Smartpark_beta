import { createFileRoute } from "@tanstack/react-router";
import { RoleGuard } from "@/components/RoleGuard";
import { PortalShell } from "@/components/PortalShell";
import { ADMIN_NAV } from "./admin.dashboard";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { HOURLY_RATE, GST_RATE } from "@/lib/pricing";
import { usePrototypeMode } from "@/lib/prototype-mode";
import { useDemoState, setDemoSlotStatus } from "@/lib/demo-state-store";
import { getDemoRole } from "@/lib/demo-auth";
import { RotateCcw, ShieldCheck, DollarSign, Cpu, Settings as SettingsIcon } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin/settings")({
  component: () => (
    <RoleGuard allow="admin">
      <SettingsPage />
    </RoleGuard>
  ),
});

function SettingsPage() {
  const { slots: demoSlots, resetDemo } = useDemoState();
  const [slots, setSlots] = useState<any[]>([]);
  const [rate, setRate] = useState(HOURLY_RATE);
  const [prototype, setPrototype] = usePrototypeMode();

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

  async function updateRate(id: string, newRate: number) {
    if (getDemoRole() || true) {
      toast.success("Hourly rate updated");
      return;
    }
    await supabase.from("parking_slots").update({ hourly_rate: newRate }).eq("id", id);
    toast.success("Rate updated");
    load();
  }

  async function updateStatus(code: "A1" | "A2", status: any) {
    if (getDemoRole() || true) {
      setDemoSlotStatus(code, status, "Settings Page");
      toast.success(`Slot ${code} status set to ${status}`);
      return;
    }
  }

  function handleResetDemo() {
    if (confirm("Reset Demo Environment? All bookings will be cleared and slots A1 and A2 will return to Available.")) {
      resetDemo();
      toast.success("Demo environment successfully reset!");
    }
  }

  return (
    <PortalShell title="Admin Portal" nav={ADMIN_NAV}>
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold">System Settings & Configuration</h2>
          <p className="text-xs text-muted-foreground">
            Manage hardware simulation mode, pricing rates, parking bays, and demo environment reset.
          </p>
        </div>

        {/* Demo Mode Reset Mechanism */}
        <div className="rounded-2xl border border-destructive/30 bg-destructive/5 p-5 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h3 className="font-semibold text-destructive flex items-center gap-2">
                <RotateCcw className="h-4 w-4" /> Reset Demo Environment
              </h3>
              <p className="mt-1 text-xs text-muted-foreground">
                Restore the shared demo system to its clean initial state (A1 and A2 Available, 0 active bookings).
              </p>
            </div>
            <button
              onClick={handleResetDemo}
              className="rounded-lg bg-destructive px-4 py-2 text-xs font-bold text-destructive-foreground shadow hover:bg-destructive/90"
            >
              Reset Demo Data
            </button>
          </div>
        </div>

        {/* Prototype Mode Toggle */}
        <div className="rounded-2xl border border-amber-400/40 bg-amber-400/5 p-5 shadow-sm">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h3 className="font-semibold text-amber-800 dark:text-amber-300 flex items-center gap-2">
                <Cpu className="h-4 w-4" /> Prototype Mode (Hardware Simulation)
              </h3>
              <p className="mt-1 text-xs text-muted-foreground">
                Simulate gate operations and sensor callbacks without requiring physical USB Arduino hardware.
              </p>
            </div>
            <button
              onClick={() => {
                setPrototype(!prototype);
                toast.success(!prototype ? "Prototype Mode enabled (simulated)" : "Prototype Mode disabled (USB serial)");
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

        {/* Pricing Configuration */}
        <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
          <h3 className="mb-2 font-semibold flex items-center gap-2">
            <DollarSign className="h-4 w-4 text-primary" /> Pricing & Taxation Rules
          </h3>
          <p className="text-xs text-muted-foreground mb-4">
            Base hourly rate: <strong>₹{rate}</strong> / hour · GST Rate: <strong>{GST_RATE * 100}%</strong> (Ceiling rounding applied).
          </p>
          <div className="flex items-center gap-3">
            <input
              type="number"
              value={rate}
              onChange={(e) => setRate(Number(e.target.value))}
              className="w-32 rounded-lg border border-input bg-background px-3 py-2 text-sm font-semibold"
            />
            <span className="text-xs text-muted-foreground">INR per hour</span>
          </div>
        </div>

        {/* Parking Slots Configuration */}
        <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
          <h3 className="mb-3 font-semibold">Active Demo Parking Slots</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-xs uppercase text-muted-foreground bg-muted/30">
                <tr>
                  <th className="p-3 text-left">Slot Code</th>
                  <th className="p-3 text-left">Sensor Identifier</th>
                  <th className="p-3 text-left">Rate (₹/hr)</th>
                  <th className="p-3 text-left">Current Status</th>
                </tr>
              </thead>
              <tbody>
                {slots.map((s) => (
                  <tr key={s.id} className="border-t border-border">
                    <td className="p-3 font-bold">{s.code}</td>
                    <td className="p-3 font-mono text-xs text-muted-foreground">{s.sensor_id}</td>
                    <td className="p-3">
                      <input
                        type="number"
                        defaultValue={s.hourly_rate ?? 50}
                        onBlur={(e) => updateRate(s.id, Number(e.target.value))}
                        className="w-24 rounded-lg border border-input bg-background px-2.5 py-1 text-xs font-semibold"
                      />
                    </td>
                    <td className="p-3">
                      <select
                        value={s.status}
                        onChange={(e) => updateStatus(s.code, e.target.value)}
                        className="rounded-lg border border-input bg-background px-2.5 py-1 text-xs font-semibold"
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

        {/* API & Web Serial Information */}
        <div className="rounded-2xl border border-border bg-card p-5 shadow-sm space-y-2">
          <h3 className="font-semibold text-sm">Hardware & Telemetry Architecture</h3>
          <p className="text-xs text-muted-foreground">
            Web Serial API at 9600 Baud communicates directly with Arduino UNO on desktop browsers.
            Sensors A1 (Pins D2/D3) and A2 (Pins D4/D5) broadcast real-time distance transitions (distance &le; 10 cm).
          </p>
        </div>
      </div>
    </PortalShell>
  );
}
