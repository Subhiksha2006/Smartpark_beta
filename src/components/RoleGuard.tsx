import { useNavigate } from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";
import { useCurrentUser, type AppRole } from "@/lib/use-role";

export function RoleGuard({ allow, children }: { allow: AppRole; children: ReactNode }) {
  const { role, loading } = useCurrentUser();
  const navigate = useNavigate();

  useEffect(() => {
    if (loading) return;
    if (role && role !== allow) {
      navigate({ to: "/access-denied" });
    }
  }, [loading, role, allow, navigate]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }
  if (!role || role !== allow) return null;
  return <>{children}</>;
}
