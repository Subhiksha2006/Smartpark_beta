import { useEffect, useState } from "react";
import { hardwareManager } from "./hardware/HardwareManager";

const KEY = "smartpark_prototype_mode";
const EVT = "smartpark:prototype-mode";

export function getPrototypeMode(): boolean {
  if (typeof window === "undefined") return false;
  return window.localStorage.getItem(KEY) === "1";
}

export function setPrototypeMode(on: boolean) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(KEY, on ? "1" : "0");
  window.dispatchEvent(new CustomEvent(EVT, { detail: on }));
}

export function usePrototypeMode(): [boolean, (v: boolean) => void] {
  const [on, setOn] = useState(false);
  useEffect(() => {
    setOn(getPrototypeMode());
    const h = () => setOn(getPrototypeMode());
    window.addEventListener(EVT, h);
    window.addEventListener("storage", h);
    return () => {
      window.removeEventListener(EVT, h);
      window.removeEventListener("storage", h);
    };
  }, []);
  return [on, (v) => setPrototypeMode(v)];
}

export async function triggerGate(bookingId: string, type: "ENTRY" | "EXIT"): Promise<{ simulated: boolean; ok: boolean }> {
  if (getPrototypeMode()) return { simulated: true, ok: true };
  try {
    const res = await hardwareManager.triggerGate(bookingId, type);
    return { simulated: !res.hardware, ok: res.ok };
  } catch (err) {
    console.warn("triggerGate hardware error fallback:", err);
    return { simulated: true, ok: true };
  }
}

