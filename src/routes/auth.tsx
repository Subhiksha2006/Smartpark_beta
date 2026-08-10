import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { Car } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/auth")({
  head: () => ({ meta: [{ title: "Sign in — SmartPark" }] }),
  component: AuthPage,
});

function AuthPage() {
  const [mode, setMode] = useState<"login" | "register">("login");
  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-background via-background to-primary/5 px-4 py-10">
      <div className="w-full max-w-md">
        <Link to="/" className="mb-6 flex items-center justify-center gap-2">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <Car className="h-5 w-5" />
          </div>
          <span className="text-xl font-bold">SmartPark</span>
        </Link>
        <div className="rounded-2xl border border-border bg-card p-6 shadow-xl">
          <div className="mb-6 flex rounded-lg bg-muted p-1">
            <button
              onClick={() => setMode("login")}
              className={`flex-1 rounded-md px-4 py-2 text-sm font-medium transition ${
                mode === "login" ? "bg-background text-foreground shadow" : "text-muted-foreground"
              }`}
            >
              Login
            </button>
            <button
              onClick={() => setMode("register")}
              className={`flex-1 rounded-md px-4 py-2 text-sm font-medium transition ${
                mode === "register" ? "bg-background text-foreground shadow" : "text-muted-foreground"
              }`}
            >
              Register
            </button>
          </div>
          {mode === "login" ? <LoginForm /> : <RegisterForm onDone={() => setMode("login")} />}
        </div>
      </div>
    </div>
  );
}

function LoginForm() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      toast.error(error.message);
      setLoading(false);
      return;
    }
    const { data } = await supabase.auth.getUser();
    const { data: roles } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", data.user!.id)
      .limit(1);
    const role = (roles?.[0] as { role: string } | undefined)?.role;
    toast.success("Welcome back!");
    if (role === "admin") navigate({ to: "/admin/dashboard" });
    else navigate({ to: "/driver/dashboard" });
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <Field label="Email" type="email" value={email} onChange={setEmail} required />
      <Field label="Password" type="password" value={password} onChange={setPassword} required />
      <div className="text-right">
        <Link to="/forgot-password" className="text-xs text-primary hover:underline">
          Forgot password?
        </Link>
      </div>
      <button
        disabled={loading}
        className="w-full rounded-lg bg-primary py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
      >
        {loading ? "Signing in..." : "Sign in"}
      </button>
    </form>
  );
}

function RegisterForm({ onDone }: { onDone: () => void }) {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [vehicle, setVehicle] = useState("");
  const [role, setRole] = useState<"driver" | "admin">("driver");
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (password !== confirm) {
      toast.error("Passwords do not match");
      return;
    }
    if (role === "driver" && !vehicle.trim()) {
      toast.error("Vehicle number is required for drivers");
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/`,
        data: {
          full_name: fullName,
          vehicle_number: role === "driver" ? vehicle : null,
          role,
        },
      },
    });
    setLoading(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Account created! You can sign in now.");
    onDone();
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      <Field label="Full Name" value={fullName} onChange={setFullName} required />
      <Field label="Email" type="email" value={email} onChange={setEmail} required />
      <Field label="Password" type="password" value={password} onChange={setPassword} required />
      <Field label="Confirm Password" type="password" value={confirm} onChange={setConfirm} required />
      <div>
        <label className="mb-1 block text-xs font-medium text-muted-foreground">Role</label>
        <select
          value={role}
          onChange={(e) => setRole(e.target.value as "driver" | "admin")}
          className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
        >
          <option value="driver">Driver</option>
          <option value="admin">Admin</option>
        </select>
      </div>
      {role === "driver" && (
        <Field label="Vehicle Number" value={vehicle} onChange={setVehicle} required />
      )}
      <button
        disabled={loading}
        className="w-full rounded-lg bg-primary py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
      >
        {loading ? "Creating..." : "Create account"}
      </button>
    </form>
  );
}

function Field({
  label,
  value,
  onChange,
  type = "text",
  required,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  required?: boolean;
}) {
  return (
    <div>
      <label className="mb-1 block text-xs font-medium text-muted-foreground">{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required={required}
        className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
      />
    </div>
  );
}
