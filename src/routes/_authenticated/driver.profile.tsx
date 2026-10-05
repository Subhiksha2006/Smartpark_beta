import { createFileRoute } from "@tanstack/react-router";
import { LayoutDashboard, CalendarClock, History, User } from "lucide-react";
import { RoleGuard } from "@/components/RoleGuard";
import { PortalShell } from "@/components/PortalShell";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "@/lib/use-role";
import { toast } from "sonner";
import { getDemoRole } from "@/lib/demo-auth";
import { useDemoState, updateDemoProfile } from "@/lib/demo-state-store";

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
  const { driverProfile } = useDemoState();
  const [fullName, setFullName] = useState(driverProfile.full_name);
  const [email, setEmail] = useState(driverProfile.email);
  const [phone, setPhone] = useState(driverProfile.phone);
  const [vehicle, setVehicle] = useState(driverProfile.vehicle_number);
  const [password, setPassword] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!userId) return;
    if (getDemoRole()) {
      setFullName(driverProfile.full_name);
      setEmail(driverProfile.email);
      setPhone(driverProfile.phone);
      setVehicle(driverProfile.vehicle_number);
      return;
    }
    supabase
      .from("profiles")
      .select("full_name, phone, vehicle_number, email")
      .eq("id", userId)
      .maybeSingle()
      .then(({ data, error }) => {
        if (data && !error) {
          const d = data as { full_name: string; phone: string | null; vehicle_number: string | null; email: string };
          setFullName(d.full_name);
          setEmail(d.email);
          setPhone(d.phone ?? "");
          setVehicle(d.vehicle_number ?? "");
        }
      });
  }, [userId, driverProfile]);

  async function save() {
    setSaving(true);
    if (getDemoRole()) {
      updateDemoProfile({
        full_name: fullName,
        email,
        phone,
        vehicle_number: vehicle,
      });
      setTimeout(() => {
        setSaving(false);
        setPassword("");
        toast.success("Profile updated in Demo System");
      }, 300);
      return;
    }
    if (!userId) {
      setSaving(false);
      return;
    }
    try {
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
    } catch (err: any) {
      toast.error(err?.message || "Failed to save profile.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <PortalShell title="Driver Portal" nav={NAV}>
      <h2 className="mb-4 text-2xl font-bold">Profile</h2>
      <div className="max-w-xl space-y-4 rounded-2xl border border-border bg-card p-6 shadow-sm">
        <Field label="Full Name" value={fullName} onChange={setFullName} />
        <Field label="Email Address" value={email} onChange={setEmail} type="email" />
        <Field label="Phone Number" value={phone} onChange={setPhone} />
        <Field label="Default Vehicle Number" value={vehicle} onChange={setVehicle} />
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
