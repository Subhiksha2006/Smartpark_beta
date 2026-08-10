import { useState } from "react";
import { useHardwareManager } from "@/lib/hardware/HardwareManager";
import { Cpu, Wifi, WifiOff, Terminal, RefreshCw } from "lucide-react";
import { toast } from "sonner";

export function HardwareStatusCard() {
  const { status, logs, connect, disconnect } = useHardwareManager();
  const [busy, setBusy] = useState(false);
  const [showLogs, setShowLogs] = useState(false);

  async function handleConnect() {
    setBusy(true);
    try {
      const ok = await connect();
      if (ok) {
        toast.success("Arduino Hardware Connected via USB Serial");
      }
    } catch (e: any) {
      toast.error(e?.message || "Arduino Connection Lost / Failed");
    } finally {
      setBusy(false);
    }
  }

  async function handleDisconnect() {
    setBusy(true);
    try {
      await disconnect();
      toast("Arduino Hardware Disconnected");
    } finally {
      setBusy(false);
    }
  }

  const isConnected = status === "connected";

  return (
    <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div
            className={`flex h-10 w-10 items-center justify-center rounded-xl ${
              isConnected
                ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
                : "bg-red-500/15 text-red-600 dark:text-red-400"
            }`}
          >
            <Cpu className="h-5 w-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-bold">Arduino UNO Hardware</h3>
              <span
                className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                  isConnected
                    ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400"
                    : "bg-red-500/15 text-red-700 dark:text-red-400"
                }`}
              >
                {isConnected ? (
                  <>
                    <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                    Hardware Connected
                  </>
                ) : (
                  <>
                    <span className="h-2 w-2 rounded-full bg-red-500" />
                    Hardware Offline
                  </>
                )}
              </span>
            </div>
            <p className="text-xs text-muted-foreground">
              A1 & A2 Ultrasonic Sensors · SG90 Servo Gate (9600 Baud)
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {!isConnected ? (
            <button
              disabled={busy}
              onClick={handleConnect}
              className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3.5 py-2 text-xs font-semibold text-white shadow-sm hover:bg-emerald-700 disabled:opacity-50"
            >
              {busy ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Wifi className="h-3.5 w-3.5" />}
              Connect Hardware Serial
            </button>
          ) : (
            <button
              disabled={busy}
              onClick={handleDisconnect}
              className="inline-flex items-center gap-1.5 rounded-lg border border-input px-3.5 py-2 text-xs font-semibold text-muted-foreground hover:bg-accent disabled:opacity-50"
            >
              <WifiOff className="h-3.5 w-3.5" /> Disconnect
            </button>
          )}
          <button
            onClick={() => setShowLogs(!showLogs)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-input px-3 py-2 text-xs font-semibold"
            title="Toggle Hardware Event Log"
          >
            <Terminal className="h-3.5 w-3.5" />
            Logs ({logs.length})
          </button>
        </div>
      </div>

      {showLogs && (
        <div className="mt-4 rounded-xl border border-border bg-muted/40 p-3">
          <div className="mb-2 flex items-center justify-between text-xs font-semibold text-muted-foreground">
            <span>Hardware Activity Log</span>
            <span>{logs.length} events</span>
          </div>
          <div className="max-h-40 space-y-1.5 overflow-y-auto font-mono text-[11px]">
            {logs.length === 0 && <div className="text-muted-foreground">No hardware events logged yet.</div>}
            {logs.map((log) => (
              <div key={log.id} className="flex justify-between rounded bg-background px-2.5 py-1 shadow-2xs">
                <span className="font-semibold text-foreground">{log.type}</span>
                <span className="text-muted-foreground">{log.details ? `${log.details} · ` : ""}{log.timestamp}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
