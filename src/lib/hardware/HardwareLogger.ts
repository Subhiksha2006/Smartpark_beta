export type HardwareLogType =
  | "Hardware Connected"
  | "Hardware Disconnected"
  | "Gate Opened"
  | "Gate Closed"
  | "Slot A1 Occupied"
  | "Slot A1 Free"
  | "Slot A2 Occupied"
  | "Slot A2 Free"
  | "Manual Entry Approved"
  | "Manual Exit Approved"
  | "Invoice Generated";

export interface HardwareLogEntry {
  id: string;
  timestamp: string;
  type: HardwareLogType;
  details?: string;
}

type LogListener = (logs: HardwareLogEntry[]) => void;

class HardwareLogger {
  private logs: HardwareLogEntry[] = [];
  private listeners: Set<LogListener> = new Set();
  private maxLogs = 100;

  public log(type: HardwareLogType, details?: string) {
    const entry: HardwareLogEntry = {
      id: `${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      timestamp: new Date().toLocaleTimeString(),
      type,
      details,
    };
    this.logs = [entry, ...this.logs.slice(0, this.maxLogs - 1)];
    this.notify();
  }

  public getLogs(): HardwareLogEntry[] {
    return [...this.logs];
  }

  public subscribe(listener: LogListener): () => void {
    this.listeners.add(listener);
    listener(this.getLogs());
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify() {
    const current = this.getLogs();
    this.listeners.forEach((l) => l(current));
  }
}

export const hardwareLogger = new HardwareLogger();
