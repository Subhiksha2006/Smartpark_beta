import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Slot } from "@/components/SlotGrid";

export function useSlots() {
  const [slots, setSlots] = useState<Slot[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    async function load() {
      const { data } = await supabase
        .from("parking_slots")
        .select("id, code, status")
        .order("code");
      if (mounted) {
        setSlots((data ?? []) as Slot[]);
        setLoading(false);
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
