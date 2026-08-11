export type DemoRole = "driver" | "admin";

const DEMO_KEY = "smartpark_demo_role";

export function getDemoRole(): DemoRole | null {
  if (typeof window === "undefined") return null;
  return (window.localStorage.getItem(DEMO_KEY) as DemoRole | null) || null;
}

export function setDemoRole(role: DemoRole | null) {
  if (typeof window === "undefined") return;
  if (role) {
    window.localStorage.setItem(DEMO_KEY, role);
  } else {
    window.localStorage.removeItem(DEMO_KEY);
  }
}
