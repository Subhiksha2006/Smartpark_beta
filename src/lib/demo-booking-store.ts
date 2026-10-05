import {
  DemoBooking,
  getDemoState,
  saveDemoState,
  findDemoBooking as findInState,
  createDemoBooking,
  approveDemoEntry,
  approveDemoExit,
  cancelDemoBooking,
  useDemoState,
} from "./demo-state-store";

export type { DemoBooking };

export function getDemoBookings(): DemoBooking[] {
  return getDemoState().bookings;
}

export function saveDemoBookings(list: DemoBooking[]) {
  const state = getDemoState();
  saveDemoState({ ...state, bookings: list });
}

export function findDemoBooking(codeOrId: string): DemoBooking | null {
  return findInState(codeOrId);
}

export function updateDemoBooking(
  booking_code: string,
  updates: Partial<DemoBooking>
): DemoBooking {
  const state = getDemoState();
  const clean = booking_code.trim().toUpperCase();
  const index = state.bookings.findIndex(
    (b) => b.booking_code.toUpperCase() === clean || b.id.toUpperCase() === clean
  );

  if (index !== -1) {
    const updated = { ...state.bookings[index], ...updates };
    const nextList = [...state.bookings];
    nextList[index] = updated;

    let nextSlots = state.slots;
    if (updates.status === "active") {
      nextSlots = state.slots.map((s) =>
        s.code === updated.slot_code ? { ...s, status: "occupied" as const } : s
      );
    } else if (updates.status === "completed" || updates.status === "cancelled") {
      nextSlots = state.slots.map((s) =>
        s.code === updated.slot_code ? { ...s, status: "available" as const } : s
      );
    }

    saveDemoState({ ...state, bookings: nextList, slots: nextSlots });
    return updated;
  }

  // If not found, create one
  return createDemoBooking({
    slotCode: (updates.slot_code as any) || "A1",
    vehicleNumber: updates.vehicle_number || "TN01S1234",
    durationHours: updates.estimated_duration_hours || 1,
    driverName: updates.driver_name || "Demo Driver",
  });
}

export function useDemoBookings(): DemoBooking[] {
  const { bookings } = useDemoState();
  return bookings;
}
