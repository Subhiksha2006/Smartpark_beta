import { useEffect, useState } from "react";
import { serialService, ConnectionStatus } from "./SerialService";
import { parseArduinoLine } from "./ArduinoParser";
import { handleSlotSensorUpdate } from "./SensorListener";
import { executeTriggerGate } from "./GateController";
import { hardwareLogger, HardwareLogEntry } from "./HardwareLogger";

class HardwareManager {
  private initialized = false;

  public init() {
    if (this.initialized || typeof window === "undefined") return;
    this.initialized = true;

    // Register parser listener on serial line input
    serialService.subscribeLine((line) => {
      const parsed = parseArduinoLine(line);
      if (parsed.type === "SLOT_CHANGE") {
        handleSlotSensorUpdate(parsed.slot, parsed.status);
      } else if (parsed.type === "GATE_EVENT") {
        if (parsed.gateState === "OPENED") {
          hardwareLogger.log("Gate Opened");
        } else if (parsed.gateState === "CLOSED") {
          hardwareLogger.log("Gate Closed");
        }
      }
    });

    // Try auto-reconnect on startup
    serialService.autoReconnect();
  }

  public async connectHardware(): Promise<boolean> {
    return await serialService.connectHardware();
  }

  public async disconnectHardware(): Promise<void> {
    await serialService.disconnectHardware();
  }

  public async sendSerialCommand(cmd: string): Promise<boolean> {
    return await serialService.sendSerialCommand(cmd);
  }

  public async triggerGate(
    bookingId?: string,
    type: "ENTRY" | "EXIT" = "ENTRY"
  ): Promise<{ hardware: boolean; ok: boolean }> {
    return await executeTriggerGate(bookingId, type);
  }

  public listenSensors(callback: (slot: "A1" | "A2", status: "occupied" | "available") => void): () => void {
    return serialService.subscribeLine((line) => {
      const parsed = parseArduinoLine(line);
      if (parsed.type === "SLOT_CHANGE") {
        callback(parsed.slot, parsed.status);
      }
    });
  }

  public async updateSlotStatus(
    slotCode: "A1" | "A2",
    status: "occupied" | "available"
  ): Promise<void> {
    await handleSlotSensorUpdate(slotCode, status);
  }

  public getStatus(): ConnectionStatus {
    return serialService.getStatus();
  }

  public subscribeStatus(listener: (status: ConnectionStatus) => void): () => void {
    return serialService.subscribeStatus(listener);
  }

  public subscribeLogs(listener: (logs: HardwareLogEntry[]) => void): () => void {
    return hardwareLogger.subscribe(listener);
  }
}

export const hardwareManager = new HardwareManager();

// Initialize service singleton
if (typeof window !== "undefined") {
  hardwareManager.init();
}

// React hook to use HardwareManager in UI components
export function useHardwareManager() {
  const [status, setStatus] = useState<ConnectionStatus>(hardwareManager.getStatus());
  const [logs, setLogs] = useState<HardwareLogEntry[]>([]);

  useEffect(() => {
    const unsubStatus = hardwareManager.subscribeStatus(setStatus);
    const unsubLogs = hardwareManager.subscribeLogs(setLogs);
    return () => {
      unsubStatus();
      unsubLogs();
    };
  }, []);

  return {
    status,
    logs,
    connect: () => hardwareManager.connectHardware(),
    disconnect: () => hardwareManager.disconnectHardware(),
    triggerGate: (bookingId?: string, type?: "ENTRY" | "EXIT") => hardwareManager.triggerGate(bookingId, type),
    sendSerialCommand: (cmd: string) => hardwareManager.sendSerialCommand(cmd),
  };
}
