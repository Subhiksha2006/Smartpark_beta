import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export type AppRole = "driver" | "admin";

export function useCurrentUser() {
  const [userId, setUserId] = useState<string | null>(null);
  const [email, setEmail] = useState<string | null>(null);
  const [role, setRole] = useState<AppRole | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    (async () => {
      const { data } = await supabase.auth.getUser();
      if (!mounted) return;
      if (!data.user) {
        setLoading(false);
        return;
      }
      setUserId(data.user.id);
      setEmail(data.user.email ?? null);
      const { data: roles } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", data.user.id)
        .limit(1);
      if (mounted) {
        setRole(((roles?.[0] as { role: AppRole } | undefined)?.role) ?? null);
        setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  return { userId, email, role, loading };
}
