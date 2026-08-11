import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { getDemoRole } from "@/lib/demo-auth";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    const demoRole = getDemoRole();
    if (demoRole) {
      return { user: { id: `demo-${demoRole}-id`, email: `demo_${demoRole}@smartpark.com` } };
    }

    try {
      const { data, error } = await supabase.auth.getUser();
      if (error || !data?.user) {
        throw redirect({ to: "/auth" });
      }
      return { user: data.user };
    } catch (err: any) {
      if (err?.to === "/auth") throw err;
      throw redirect({ to: "/auth" });
    }
  },
  component: () => <Outlet />,
});
