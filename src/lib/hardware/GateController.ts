import { serialService } from "./SerialService";
import { hardwareLogger } from "./HardwareLogger";

export async function executeTriggerGate(
  bookingId?: string,
  type: "ENTRY" | "EXIT" = "ENTRY"
): Promise<{ hardware: boolean; ok: boolean }> {
  // If hardware serial is connected, send OPEN_GATE command over USB Serial
  if (serialService.getStatus() === "connected") {
    const success = await serialService.sendSerialCommand("OPEN_GATE");
    if (success) {
      hardwareLogger.log("Gate Opened", `Booking: ${bookingId || "Manual"} (${type})`);
      // Schedule log for gate closing after 5 seconds to match Arduino servo cycle
      setTimeout(() => {
        hardwareLogger.log("Gate Closed");
      }, 5000);
      return { hardware: true, ok: true };
    }
  }

  // Fallback / simulation mode when hardware serial is not connected
  try {
    const r = await fetch("/api/public/gate/open", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ bookingId: bookingId || "MANUAL", type }),
    });
    hardwareLogger.log("Gate Opened", `Simulated: ${bookingId || "Manual"} (${type})`);
    setTimeout(() => {
      hardwareLogger.log("Gate Closed");
    }, 5000);
    return { hardware: false, ok: r.ok };
  } catch {
    hardwareLogger.log("Gate Opened", `Local Fallback: ${bookingId || "Manual"}`);
    setTimeout(() => {
      hardwareLogger.log("Gate Closed");
    }, 5000);
    return { hardware: false, ok: true };
  }
}
