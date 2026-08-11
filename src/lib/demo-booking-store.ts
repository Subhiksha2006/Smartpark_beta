import { useEffect, useState } from "react";

export interface DemoBooking {
  id: string;
  booking_code: string;
  slot_id: string;
  slot_code: string;
  vehicle_number: string;
  driver_name: string;
  status: "reserved" | "active" | "completed";
  entry_time: string | null;
  exit_time: string | null;
  duration_minutes: number | null;
  amount: number | null;
  payment_status: "unpaid" | "Paid" | "Completed";
  created_at: string;
}

const DEMO_BOOKINGS_KEY = "smartpark_demo_bookings_store";
const DEMO_BOOKINGS_EVT = "smartpark:demo-bookings-update";

const DEFAULT_DEMO_BOOKING: DemoBooking = {
  id: "demo-b1",
  booking_code: "PK2026-598878",
  slot_id: "slot-a1",
  slot_code: "A1",
  vehicle_number: "TN01S1234",
  driver_name: "Demo Driver",
  status: "reserved",
  entry_time: null,
  exit_time: null,
  duration_minutes: null,
  amount: null,
  payment_status: "unpaid",
  created_at: new Date().toISOString(),
};

export function getDemoBookings(): DemoBooking[] {
  if (typeof window === "undefined") return [DEFAULT_DEMO_BOOKING];
  const stored = window.localStorage.getItem(DEMO_BOOKINGS_KEY);
  if (!stored) {
    window.localStorage.setItem(DEMO_BOOKINGS_KEY, JSON.stringify([DEFAULT_DEMO_BOOKING]));
    return [DEFAULT_DEMO_BOOKING];
  }
  try {
    const parsed = JSON.parse(stored);
    if (Array.isArray(parsed) && parsed.length > 0) return parsed;
  } catch {}
  return [DEFAULT_DEMO_BOOKING];
}

export function saveDemoBookings(list: DemoBooking[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(DEMO_BOOKINGS_KEY, JSON.stringify(list));
  window.dispatchEvent(new CustomEvent(DEMO_BOOKINGS_EVT, { detail: list }));
}

export function findDemoBooking(codeOrId: string): DemoBooking | null {
  const list = getDemoBookings();
  const clean = codeOrId.trim().toUpperCase();
  return (
    list.find(
      (b) =>
        b.booking_code.toUpperCase() === clean ||
        b.id.toUpperCase() === clean ||
        clean.includes(b.booking_code.toUpperCase())
    ) || null
  );
}

export function updateDemoBooking(
  booking_code: string,
  updates: Partial<DemoBooking>
): DemoBooking {
  const list = getDemoBookings();
  const clean = booking_code.trim().toUpperCase();
  let updatedItem: DemoBooking | null = null;

  const nextList = list.map((b) => {
    if (b.booking_code.toUpperCase() === clean || b.id.toUpperCase() === clean) {
      updatedItem = { ...b, ...updates };
      return updatedItem;
    }
    return b;
  });

  if (!updatedItem) {
    updatedItem = {
      id: `demo-${Date.now()}`,
      booking_code: booking_code.trim(),
      slot_id: "slot-a1",
      slot_code: "A1",
      vehicle_number: "TN01S1234",
      driver_name: "Demo Driver",
      status: "reserved",
      entry_time: null,
      exit_time: null,
      duration_minutes: null,
      amount: null,
      payment_status: "unpaid",
      created_at: new Date().toISOString(),
      ...updates,
    };
    nextList.unshift(updatedItem);
  }

  saveDemoBookings(nextList);

  // Sync slot status (A1) dynamically in demo state
  if (updates.status === "active") {
    window.dispatchEvent(
      new CustomEvent("smartpark:slot-sensor", {
        detail: { slotCode: updatedItem.slot_code, status: "occupied" },
      })
    );
  } else if (updates.status === "completed") {
    window.dispatchEvent(
      new CustomEvent("smartpark:slot-sensor", {
        detail: { slotCode: updatedItem.slot_code, status: "available" },
      })
    );
  }

  return updatedItem;
}

export function useDemoBookings(): DemoBooking[] {
  const [list, setList] = useState<DemoBooking[]>(getDemoBookings());

  useEffect(() => {
    function refresh() {
      setList(getDemoBookings());
    }
    if (typeof window !== "undefined") {
      window.addEventListener(DEMO_BOOKINGS_EVT, refresh);
      window.addEventListener("storage", refresh);
    }
    return () => {
      if (typeof window !== "undefined") {
        window.removeEventListener(DEMO_BOOKINGS_EVT, refresh);
        window.removeEventListener("storage", refresh);
      }
    };
  }, []);

  return list;
}
