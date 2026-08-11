import { serialService } from "./SerialService";
import { hardwareLogger } from "./HardwareLogger";

export async function executeTriggerGate(
  bookingId?: string,
  type: "ENTRY" | "EXIT" = "ENTRY"
): Promise<{ hardware: boolean; ok: boolean }> {
  // 1. If hardware serial is connected, send OPEN_GATE command over USB Serial immediately
  if (serialService.getStatus() === "connected") {
    try {
      const success = await serialService.sendSerialCommand("OPEN_GATE");
      if (success) {
        hardwareLogger.log("Gate Opened", `Booking: ${bookingId || "Manual"} (${type})`);
        setTimeout(() => {
          hardwareLogger.log("Gate Closed");
        }, 5000);
        return { hardware: true, ok: true };
      }
    } catch (err) {
      console.warn("Serial command error:", err);
    }
  }

  // 2. Non-blocking fallback/simulation logging (Never block the browser execution flow)
  hardwareLogger.log("Gate Opened", `Simulated: ${bookingId || "Manual"} (${type})`);
  setTimeout(() => {
    hardwareLogger.log("Gate Closed");
  }, 5000);

  // Background ping (fire-and-forget)
  fetch("/api/public/gate/open", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ bookingId: bookingId || "MANUAL", type }),
  }).catch(() => {});

  return { hardware: false, ok: true };
}
