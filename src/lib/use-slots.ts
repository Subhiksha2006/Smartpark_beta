import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Slot } from "@/components/SlotGrid";
import { getDemoRole } from "@/lib/demo-auth";
import { getDemoState } from "@/lib/demo-state-store";

export function useSlots() {
  const isDemo = typeof window !== "undefined" ? (getDemoRole() !== null || true) : true;
  const [slots, setSlots] = useState<Slot[]>(() => {
    const demoState = getDemoState();
    return demoState.slots.map((s) => ({
      id: s.id,
      code: s.code,
      status: s.status,
    }));
  });
  const [loading, setLoading] = useState(false);

  // Synchronize slot status on demo state changes and hardware sensor events
  useEffect(() => {
    function handleSync() {
      const demoState = getDemoState();
      setSlots(
        demoState.slots.map((s) => ({
          id: s.id,
          code: s.code,
          status: s.status,
        }))
      );
    }

    function handleHardwareEvent(e: Event) {
      const detail = (e as CustomEvent).detail as { slotCode: string; status: "occupied" | "available" | "reserved" };
      if (!detail?.slotCode) return;
      setSlots((prev) =>
        prev.map((s) =>
          s.code.toUpperCase().replace(/[^A-Z0-9]/g, "") === detail.slotCode.toUpperCase().replace(/[^A-Z0-9]/g, "")
            ? { ...s, status: detail.status }
            : s
        )
      );
    }

    if (typeof window !== "undefined") {
      window.addEventListener("smartpark:slot-sensor", handleHardwareEvent);
      window.addEventListener("smartpark:demo-state-update", handleSync);
      window.addEventListener("storage", handleSync);
    }
    return () => {
      if (typeof window !== "undefined") {
        window.removeEventListener("smartpark:slot-sensor", handleHardwareEvent);
        window.removeEventListener("smartpark:demo-state-update", handleSync);
        window.removeEventListener("storage", handleSync);
      }
    };
  }, []);

  useEffect(() => {
    let mounted = true;
    if (getDemoRole()) {
      const demoState = getDemoState();
      setSlots(
        demoState.slots.map((s) => ({
          id: s.id,
          code: s.code,
          status: s.status,
        }))
      );
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
        () => load()
      )
      .subscribe();
    return () => {
      mounted = false;
      supabase.removeChannel(channel);
    };
  }, []);

  return { slots, loading };
}
