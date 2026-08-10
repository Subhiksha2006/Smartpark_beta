import { createFileRoute } from "@tanstack/react-router";
import { LayoutDashboard, CalendarClock, History, User } from "lucide-react";
import { RoleGuard } from "@/components/RoleGuard";
import { PortalShell } from "@/components/PortalShell";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "@/lib/use-role";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/driver/profile")({
  component: () => (
    <RoleGuard allow="driver">
      <DriverProfile />
    </RoleGuard>
  ),
});

const NAV = [
  { to: "/driver/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/driver/bookings", label: "My Bookings", icon: CalendarClock },
  { to: "/driver/history", label: "History", icon: History },
  { to: "/driver/profile", label: "Profile", icon: User },
];

function DriverProfile() {
  const { userId } = useCurrentUser();
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [vehicle, setVehicle] = useState("");
  const [password, setPassword] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!userId) return;
    supabase
      .from("profiles")
      .select("full_name, phone, vehicle_number")
      .eq("id", userId)
      .maybeSingle()
      .then(({ data }) => {
        if (!data) return;
        const d = data as { full_name: string; phone: string | null; vehicle_number: string | null };
        setFullName(d.full_name);
        setPhone(d.phone ?? "");
        setVehicle(d.vehicle_number ?? "");
      });
  }, [userId]);

  async function save() {
    if (!userId) return;
    setSaving(true);
    const { error } = await supabase
      .from("profiles")
      .update({ full_name: fullName, phone, vehicle_number: vehicle })
      .eq("id", userId);
    if (error) toast.error(error.message);
    else toast.success("Profile updated");
    if (password) {
      const { error: pwErr } = await supabase.auth.updateUser({ password });
      if (pwErr) toast.error(pwErr.message);
      else toast.success("Password updated");
      setPassword("");
    }
    setSaving(false);
  }

  return (
    <PortalShell title="Driver Portal" nav={NAV}>
      <h2 className="mb-4 text-2xl font-bold">Profile</h2>
      <div className="max-w-xl space-y-4 rounded-2xl border border-border bg-card p-6 shadow-sm">
        <Field label="Full Name" value={fullName} onChange={setFullName} />
        <Field label="Phone" value={phone} onChange={setPhone} />
        <Field label="Vehicle Number" value={vehicle} onChange={setVehicle} />
        <Field label="New Password (optional)" type="password" value={password} onChange={setPassword} />
        <button
          onClick={save}
          disabled={saving}
          className="rounded-lg bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50"
        >
          {saving ? "Saving..." : "Save Changes"}
        </button>
      </div>
    </PortalShell>
  );
}

function Field({
  label,
  value,
  onChange,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
}) {
  return (
    <div>
      <label className="mb-1 block text-xs text-muted-foreground">{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
      />
    </div>
  );
}
