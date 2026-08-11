import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Slot } from "@/components/SlotGrid";
import { getDemoRole } from "@/lib/demo-auth";

const MOCK_SLOTS: Slot[] = [
  { id: "slot-a1", code: "A1", status: "available" },
  { id: "slot-a2", code: "A2", status: "available" },
  { id: "slot-a3", code: "A3", status: "occupied" },
  { id: "slot-a4", code: "A4", status: "reserved" },
  { id: "slot-b1", code: "B1", status: "available" },
  { id: "slot-b2", code: "B2", status: "available" },
  { id: "slot-b3", code: "B3", status: "occupied" },
  { id: "slot-b4", code: "B4", status: "available" },
  { id: "slot-c1", code: "C1", status: "available" },
  { id: "slot-c2", code: "C2", status: "reserved" },
  { id: "slot-c3", code: "C3", status: "available" },
  { id: "slot-c4", code: "C4", status: "available" },
];

export function useSlots() {
  const [slots, setSlots] = useState<Slot[]>(MOCK_SLOTS);
  const [loading, setLoading] = useState(true);

  // Listen for hardware serial ultrasonic sensor updates (A1 & A2)
  useEffect(() => {
    function handleHardwareEvent(e: Event) {
      const detail = (e as CustomEvent).detail as { slotCode: string; status: "occupied" | "available" };
      if (!detail?.slotCode) return;
      setSlots((prev) =>
        prev.map((s) =>
          s.code.toUpperCase().replace(/[^A-Z0-9]/g, "") === detail.slotCode
            ? { ...s, status: detail.status }
            : s
        )
      );
    }

    if (typeof window !== "undefined") {
      window.addEventListener("smartpark:slot-sensor", handleHardwareEvent);
    }
    return () => {
      if (typeof window !== "undefined") {
        window.removeEventListener("smartpark:slot-sensor", handleHardwareEvent);
      }
    };
  }, []);

  useEffect(() => {
    let mounted = true;
    if (getDemoRole()) {
      setLoading(false);
      return;
    }

    async function load() {
      try {
        const { data, error } = await supabase
          .from("parking_slots")
          .select("id, code, status")
          .order("code");
        if (mounted) {
          if (data && data.length > 0) {
            setSlots(data as Slot[]);
          }
        }
      } catch (e) {
        console.error("Error loading slots:", e);
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    }
    load();
    const channel = supabase
      .channel("parking_slots_changes")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "parking_slots" },
        () => load(),
      )
      .subscribe();
    return () => {
      mounted = false;
      supabase.removeChannel(channel);
    };
  }, []);

  return { slots, loading };
}
