import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { Car, ShieldCheck, Zap, QrCode } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "urbansloy— Smart Parking Management System" },
      { name: "description", content: "Book parking slots, scan QR entry/exit, and manage smart parking in real-time." },
      { property: "og:title", content: "urbansloy— Smart Parking Management System" },
      { property: "og:description", content: "Book parking slots, scan QR entry/exit, and manage smart parking in real-time." },
    ],
  }),
  component: Landing,
});

function Landing() {
  const navigate = useNavigate();

  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getUser();
      if (!data.user) return;
      const { data: roles } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", data.user.id)
        .limit(1);
      const role = (roles?.[0] as { role: string } | undefined)?.role;
      if (role === "admin") navigate({ to: "/admin/dashboard" });
      else if (role === "driver") navigate({ to: "/driver/dashboard" });
    })();
  }, [navigate]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-6">
        <div className="flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <Car className="h-5 w-5" />
          </div>
          <span className="text-lg font-bold">SmartPark</span>
        </div>
        <Link
          to="/auth"
          className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          Sign in
        </Link>
      </header>

      <main className="mx-auto max-w-6xl px-6 pt-12 pb-24">
        <div className="text-center">
          <h1 className="text-4xl font-bold tracking-tight text-foreground sm:text-6xl">
            Smart Parking, <span className="text-primary">Simplified</span>
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg text-muted-foreground">
            Book slots in real-time, scan QR codes for touchless entry & exit, and let the system
            handle billing automatically.
          </p>
          <div className="mt-8 flex justify-center gap-3">
            <Link
              to="/auth"
              className="rounded-lg bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground shadow-lg shadow-primary/25 hover:bg-primary/90"
            >
              Get Started
            </Link>
          </div>
        </div>

        <div className="mt-20 grid gap-6 sm:grid-cols-3">
          {[
            { icon: Zap, title: "Realtime Slots", desc: "See availability live as sensors update." },
            { icon: QrCode, title: "QR Entry & Exit", desc: "Scan-in, scan-out — gates open automatically." },
            { icon: ShieldCheck, title: "Secure & Reliable", desc: "Role-based access for drivers & admins." },
          ].map((f) => (
            <div
              key={f.title}
              className="rounded-2xl border border-border bg-card/60 p-6 backdrop-blur"
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <f.icon className="h-5 w-5" />
              </div>
              <h3 className="mt-4 text-lg font-semibold">{f.title}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{f.desc}</p>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
