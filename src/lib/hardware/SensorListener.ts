import { supabase } from "@/integrations/supabase/client";
import { hardwareLogger } from "./HardwareLogger";

export async function handleSlotSensorUpdate(
  slotCode: "A1" | "A2",
  status: "occupied" | "available"
) {
  // 1. Log event
  if (slotCode === "A1") {
    hardwareLogger.log(status === "occupied" ? "Slot A1 Occupied" : "Slot A1 Free");
  } else if (slotCode === "A2") {
    hardwareLogger.log(status === "occupied" ? "Slot A2 Occupied" : "Slot A2 Free");
  }

  // 2. Query slot in database matching code "A1" or "A-1" (or "A2" / "A-2")
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
    console.error(`Failed to update slot ${slotCode} status in database:`, err);
  }
}
