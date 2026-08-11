import { supabase } from "@/integrations/supabase/client";
import { hardwareLogger } from "./HardwareLogger";
import { toast } from "sonner";

export async function handleSlotSensorUpdate(
  slotCode: "A1" | "A2",
  status: "occupied" | "available"
) {
  // 1. Log event
  hardwareLogger.log(status === "occupied" ? `Slot ${slotCode} Occupied` : `Slot ${slotCode} Free`);

  // 2. Broadcast event to React UI components (useSlots, dashboard cards)
  if (typeof window !== "undefined") {
    window.dispatchEvent(
      new CustomEvent("smartpark:slot-sensor", {
        detail: { slotCode, status },
      })
    );
  }

  // 3. Surface toast message to user
  toast.info(`Ultrasonic Sensor: Slot ${slotCode} is now ${status.toUpperCase()}`);

  // 4. Update database if connected
  try {
    const { data: slots } = await supabase
      .from("parking_slots")
      .select("id, code, status");

    if (!slots || slots.length === 0) return;

    const matched = slots.find((s) => {
      const normalized = s.code.toUpperCase().replace(/[^A-Z0-9]/g, "");
      return normalized === slotCode;
    });

    if (matched && matched.status !== status) {
      await supabase
        .from("parking_slots")
        .update({ status })
        .eq("id", matched.id);
    }
  } catch (err) {
    console.warn(`Database sync for ${slotCode} skipped/failed:`, err);
  }
}
