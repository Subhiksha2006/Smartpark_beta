import { useEffect, useState } from "react";
import { calcAmount } from "./pricing";
import { downloadInvoice } from "./invoice";
import { triggerGate } from "./prototype-mode";
import { hardwareLogger } from "./hardware/HardwareLogger";

export type SlotStatusCode = "available" | "occupied" | "reserved";
export type BookingStatusCode = "reserved" | "active" | "completed" | "cancelled";
export type PaymentStatusCode = "unpaid" | "paid";

export interface DemoSlot {
  id: string;
  code: "A1" | "A2";
  sensor_id: string;
  status: SlotStatusCode;
  hourly_rate: number;
  currentBookingId?: string | null;
  driver_name?: string | null;
  vehicle_number?: string | null;
  booking_time?: string | null;
  lastUpdated: string;
}

export interface DemoBooking {
  id: string;
  booking_code: string;
  user_id: string;
  driver_name: string;
  driver_phone?: string;
  driver_email?: string;
  vehicle_number: string;
  slot_id: string;
  slot_code: "A1" | "A2";
  estimated_duration_hours: number;
  status: BookingStatusCode;
  entry_time: string | null;
  exit_time: string | null;
  duration_minutes: number | null;
  base_amount: number | null;
  gst_amount: number | null;
  amount: number | null;
  payment_status: PaymentStatusCode;
  payment_method?: "Cash" | "UPI" | "Card" | null;
  exit_requested: boolean;
  created_at: string;
  updated_at: string;
}

export interface DemoActivityLog {
  id: string;
  event: string;
  user: string;
  slot: string;
  details: string;
  status?: string;
  timestamp: string;
}

export interface DemoNotification {
  id: string;
  title: string;
  message: string;
  type: "info" | "success" | "warning" | "error";
  read: boolean;
  createdAt: string;
}

export interface DemoDriverProfile {
  id: string;
  full_name: string;
  email: string;
  phone: string;
  vehicle_number: string;
}

export interface DemoState {
  slots: DemoSlot[];
  bookings: DemoBooking[];
  activityLogs: DemoActivityLog[];
  notifications: DemoNotification[];
  driverProfile: DemoDriverProfile;
}

const DEMO_STATE_KEY = "smartpark_shared_demo_state_v3";
const DEMO_STATE_EVT = "smartpark:demo-state-update";

const INITIAL_SLOTS: DemoSlot[] = [
  {
    id: "slot-a1",
    code: "A1",
    sensor_id: "sensor_a1",
    status: "available",
    hourly_rate: 50,
    currentBookingId: null,
    driver_name: null,
    vehicle_number: null,
    booking_time: null,
    lastUpdated: new Date().toISOString(),
  },
  {
    id: "slot-a2",
    code: "A2",
    sensor_id: "sensor_a2",
    status: "available",
    hourly_rate: 50,
    currentBookingId: null,
    driver_name: null,
    vehicle_number: null,
    booking_time: null,
    lastUpdated: new Date().toISOString(),
  },
];

const INITIAL_PROFILE: DemoDriverProfile = {
  id: "demo-driver-id",
  full_name: "Demo Driver",
  email: "demo_driver@smartpark.com",
  phone: "+91 98765 43210",
  vehicle_number: "TN01S1234",
};

const INITIAL_LOGS: DemoActivityLog[] = [
  {
    id: "log-init",
    event: "System Initialized",
    user: "System",
    slot: "A1 / A2",
    details: "Demo mode active with slots A1 and A2 ready.",
    status: "Ready",
    timestamp: new Date().toISOString(),
  },
];

const INITIAL_NOTIFICATIONS: DemoNotification[] = [
  {
    id: "notif-init",
    title: "SmartPark Demo Ready",
    message: "Demo Driver and Admin portals connected with live synchronization.",
    type: "info",
    read: false,
    createdAt: new Date().toISOString(),
  },
];

const INITIAL_STATE: DemoState = {
  slots: INITIAL_SLOTS,
  bookings: [],
  activityLogs: INITIAL_LOGS,
  notifications: INITIAL_NOTIFICATIONS,
  driverProfile: INITIAL_PROFILE,
};

export function getDemoState(): DemoState {
  if (typeof window === "undefined") return INITIAL_STATE;
  const stored = window.localStorage.getItem(DEMO_STATE_KEY);
  if (!stored) {
    window.localStorage.setItem(DEMO_STATE_KEY, JSON.stringify(INITIAL_STATE));
    return INITIAL_STATE;
  }
  try {
    const parsed = JSON.parse(stored);
    if (parsed && Array.isArray(parsed.slots) && Array.isArray(parsed.bookings)) {
      // Ensure slots always have A1 and A2
      if (parsed.slots.length < 2) {
        parsed.slots = INITIAL_SLOTS;
      }
      return parsed as DemoState;
    }
  } catch {}
  return INITIAL_STATE;
}

export function saveDemoState(state: DemoState) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(DEMO_STATE_KEY, JSON.stringify(state));
  window.dispatchEvent(new CustomEvent(DEMO_STATE_EVT, { detail: state }));
}

function addLog(
  state: DemoState,
  event: string,
  user: string,
  slot: string,
  details: string,
  status: string = "Success"
): DemoState {
  const log: DemoActivityLog = {
    id: `log-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    event,
    user,
    slot,
    details,
    status,
    timestamp: new Date().toISOString(),
  };
  return {
    ...state,
    activityLogs: [log, ...state.activityLogs.slice(0, 99)],
  };
}

function addNotif(
  state: DemoState,
  title: string,
  message: string,
  type: "info" | "success" | "warning" | "error" = "info"
): DemoState {
  const notif: DemoNotification = {
    id: `notif-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    title,
    message,
    type,
    read: false,
    createdAt: new Date().toISOString(),
  };
  return {
    ...state,
    notifications: [notif, ...state.notifications.slice(0, 49)],
  };
}

// -------------------------------------------------------------
// CORE DEMO ACTION METHODS
// -------------------------------------------------------------

export function createDemoBooking(payload: {
  slotCode: "A1" | "A2";
  vehicleNumber: string;
  durationHours?: number;
  driverName?: string;
  driverPhone?: string;
  driverEmail?: string;
}): DemoBooking {
  const state = getDemoState();
  const slot = state.slots.find((s) => s.code === payload.slotCode);

  if (!slot) {
    throw new Error(`Slot ${payload.slotCode} not found.`);
  }
  if (slot.status !== "available") {
    throw new Error(`Slot ${payload.slotCode} is currently ${slot.status}. Please select an available slot.`);
  }

  const durationHours = payload.durationHours ?? 1;
  const driverName = payload.driverName || state.driverProfile.full_name || "Demo Driver";
  const vehicleNumber = payload.vehicleNumber || state.driverProfile.vehicle_number || "TN01S1234";
  const codeNumber = Math.floor(100000 + Math.random() * 900000);
  const bookingCode = `PK${new Date().getFullYear()}-${codeNumber}`;
  const bookingId = `demo-bk-${Date.now()}`;

  const newBooking: DemoBooking = {
    id: bookingId,
    booking_code: bookingCode,
    user_id: state.driverProfile.id,
    driver_name: driverName,
    driver_phone: payload.driverPhone || state.driverProfile.phone,
    driver_email: payload.driverEmail || state.driverProfile.email,
    vehicle_number: vehicleNumber,
    slot_id: slot.id,
    slot_code: slot.code,
    estimated_duration_hours: durationHours,
    status: "reserved",
    entry_time: null,
    exit_time: null,
    duration_minutes: null,
    base_amount: null,
    gst_amount: null,
    amount: null,
    payment_status: "unpaid",
    payment_method: null,
    exit_requested: false,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  const updatedSlots = state.slots.map((s) =>
    s.code === payload.slotCode
      ? {
          ...s,
          status: "reserved" as SlotStatusCode,
          currentBookingId: bookingId,
          driver_name: driverName,
          vehicle_number: vehicleNumber,
          booking_time: new Date().toISOString(),
          lastUpdated: new Date().toISOString(),
        }
      : s
  );

  let nextState: DemoState = {
    ...state,
    slots: updatedSlots,
    bookings: [newBooking, ...state.bookings],
  };

  nextState = addLog(
    nextState,
    "Slot Reserved",
    driverName,
    slot.code,
    `Booking ${bookingCode} created for vehicle ${vehicleNumber}`
  );

  nextState = addNotif(
    nextState,
    "New Reservation Created",
    `Slot ${slot.code} reserved for vehicle ${vehicleNumber}`,
    "success"
  );

  saveDemoState(nextState);

  // Broadcast slot sensor event for real-time UI synchronization
  if (typeof window !== "undefined") {
    window.dispatchEvent(
      new CustomEvent("smartpark:slot-sensor", {
        detail: { slotCode: slot.code, status: "reserved" },
      })
    );
  }

  return newBooking;
}

export async function approveDemoEntry(
  bookingIdOrCode: string,
  initiatedBy: string = "Admin / Driver"
): Promise<{ ok: boolean; booking: DemoBooking }> {
  const state = getDemoState();
  const clean = bookingIdOrCode.trim().toUpperCase();

  const bookingIndex = state.bookings.findIndex(
    (b) => b.id.toUpperCase() === clean || b.booking_code.toUpperCase() === clean
  );

  if (bookingIndex === -1) {
    throw new Error(`Booking ${bookingIdOrCode} not found in demo records.`);
  }

  const booking = state.bookings[bookingIndex];
  if (booking.status !== "reserved") {
    throw new Error(`Booking ${booking.booking_code} is currently '${booking.status}', cannot approve entry.`);
  }

  const nowIso = new Date().toISOString();

  const updatedBooking: DemoBooking = {
    ...booking,
    status: "active",
    entry_time: nowIso,
    exit_requested: true,
    updated_at: nowIso,
  };

  const updatedBookings = [...state.bookings];
  updatedBookings[bookingIndex] = updatedBooking;

  const updatedSlots = state.slots.map((s) =>
    s.code === booking.slot_code
      ? {
          ...s,
          status: "occupied" as SlotStatusCode,
          currentBookingId: booking.id,
          driver_name: booking.driver_name,
          vehicle_number: booking.vehicle_number,
          lastUpdated: nowIso,
        }
      : s
  );

  let nextState: DemoState = {
    ...state,
    slots: updatedSlots,
    bookings: updatedBookings,
  };

  nextState = addLog(
    nextState,
    "Vehicle Entered",
    initiatedBy,
    booking.slot_code,
    `Vehicle ${booking.vehicle_number} entered via gate. Session Active.`
  );

  nextState = addNotif(
    nextState,
    "Parking Active",
    `Vehicle ${booking.vehicle_number} has entered slot ${booking.slot_code}`,
    "info"
  );

  saveDemoState(nextState);

  // Broadcast slot sensor update
  if (typeof window !== "undefined") {
    window.dispatchEvent(
      new CustomEvent("smartpark:slot-sensor", {
        detail: { slotCode: booking.slot_code, status: "occupied" },
      })
    );
  }

  // Actuate gate (Physical Web Serial or simulated)
  try {
    await triggerGate(booking.booking_code, "ENTRY");
  } catch (err) {
    console.warn("Gate trigger fallback:", err);
  }

  return { ok: true, booking: updatedBooking };
}

export async function approveDemoExit(
  bookingIdOrCode: string,
  paymentMethod: "Cash" | "UPI" | "Card" = "UPI",
  initiatedBy: string = "Admin / Driver"
): Promise<{ ok: boolean; booking: DemoBooking; fee: ReturnType<typeof calcAmount> }> {
  const state = getDemoState();
  const clean = bookingIdOrCode.trim().toUpperCase();

  const bookingIndex = state.bookings.findIndex(
    (b) => b.id.toUpperCase() === clean || b.booking_code.toUpperCase() === clean
  );

  if (bookingIndex === -1) {
    throw new Error(`Booking ${bookingIdOrCode} not found in demo records.`);
  }

  const booking = state.bookings[bookingIndex];
  if (booking.status !== "active") {
    throw new Error(`Booking ${booking.booking_code} is currently '${booking.status}', cannot approve exit.`);
  }

  const exitIso = new Date().toISOString();
  const entryMillis = booking.entry_time ? new Date(booking.entry_time).getTime() : Date.now() - 60000;
  const durationMinutes = Math.max(1, Math.round((Date.now() - entryMillis) / 60000));
  const fee = calcAmount(durationMinutes);

  const updatedBooking: DemoBooking = {
    ...booking,
    status: "completed",
    exit_time: exitIso,
    duration_minutes: durationMinutes,
    base_amount: fee.base,
    gst_amount: fee.gst,
    amount: fee.total,
    payment_status: "paid",
    payment_method: paymentMethod,
    exit_requested: false,
    updated_at: exitIso,
  };

  const updatedBookings = [...state.bookings];
  updatedBookings[bookingIndex] = updatedBooking;

  const updatedSlots = state.slots.map((s) =>
    s.code === booking.slot_code
      ? {
          ...s,
          status: "available" as SlotStatusCode,
          currentBookingId: null,
          driver_name: null,
          vehicle_number: null,
          booking_time: null,
          lastUpdated: exitIso,
        }
      : s
  );

  let nextState: DemoState = {
    ...state,
    slots: updatedSlots,
    bookings: updatedBookings,
  };

  nextState = addLog(
    nextState,
    "Vehicle Exited & Paid",
    initiatedBy,
    booking.slot_code,
    `Booking ${booking.booking_code} completed. Paid ₹${fee.total} via ${paymentMethod}`
  );

  nextState = addNotif(
    nextState,
    "Payment Completed",
    `Booking ${booking.booking_code} exited. Collected ₹${fee.total}`,
    "success"
  );

  saveDemoState(nextState);

  // Broadcast slot sensor update
  if (typeof window !== "undefined") {
    window.dispatchEvent(
      new CustomEvent("smartpark:slot-sensor", {
        detail: { slotCode: booking.slot_code, status: "available" },
      })
    );
  }

  // Actuate gate (Physical Web Serial or simulated)
  try {
    await triggerGate(booking.booking_code, "EXIT");
  } catch (err) {
    console.warn("Gate trigger fallback:", err);
  }

  // Automatically trigger HTML invoice download
  try {
    downloadInvoice({
      booking_code: updatedBooking.booking_code,
      vehicle_number: updatedBooking.vehicle_number,
      entry_time: updatedBooking.entry_time,
      exit_time: updatedBooking.exit_time,
      duration_minutes: updatedBooking.duration_minutes,
      amount: updatedBooking.amount,
      payment_status: updatedBooking.payment_status,
      slot: updatedBooking.slot_code,
      driver_name: updatedBooking.driver_name,
    });
  } catch (err) {
    console.warn("Auto-invoice download failed:", err);
  }

  return { ok: true, booking: updatedBooking, fee };
}

export function cancelDemoBooking(
  bookingIdOrCode: string,
  initiatedBy: string = "Driver / Admin"
): DemoBooking {
  const state = getDemoState();
  const clean = bookingIdOrCode.trim().toUpperCase();

  const bookingIndex = state.bookings.findIndex(
    (b) => b.id.toUpperCase() === clean || b.booking_code.toUpperCase() === clean
  );

  if (bookingIndex === -1) {
    throw new Error(`Booking ${bookingIdOrCode} not found in demo records.`);
  }

  const booking = state.bookings[bookingIndex];
  if (booking.status === "completed" || booking.status === "cancelled") {
    throw new Error(`Booking ${booking.booking_code} is already ${booking.status}.`);
  }

  const nowIso = new Date().toISOString();

  const updatedBooking: DemoBooking = {
    ...booking,
    status: "cancelled",
    exit_requested: false,
    updated_at: nowIso,
  };

  const updatedBookings = [...state.bookings];
  updatedBookings[bookingIndex] = updatedBooking;

  const updatedSlots = state.slots.map((s) =>
    s.code === booking.slot_code
      ? {
          ...s,
          status: "available" as SlotStatusCode,
          currentBookingId: null,
          driver_name: null,
          vehicle_number: null,
          booking_time: null,
          lastUpdated: nowIso,
        }
      : s
  );

  let nextState: DemoState = {
    ...state,
    slots: updatedSlots,
    bookings: updatedBookings,
  };

  nextState = addLog(
    nextState,
    "Booking Cancelled",
    initiatedBy,
    booking.slot_code,
    `Reservation ${booking.booking_code} for ${booking.slot_code} was cancelled`
  );

  nextState = addNotif(
    nextState,
    "Booking Cancelled",
    `Reservation for slot ${booking.slot_code} cancelled`,
    "warning"
  );

  saveDemoState(nextState);

  // Broadcast slot sensor update
  if (typeof window !== "undefined") {
    window.dispatchEvent(
      new CustomEvent("smartpark:slot-sensor", {
        detail: { slotCode: booking.slot_code, status: "available" },
      })
    );
  }

  return updatedBooking;
}

export function setDemoSlotStatus(
  slotCode: "A1" | "A2",
  status: SlotStatusCode,
  initiatedBy: string = "Admin Override"
) {
  const state = getDemoState();
  const nowIso = new Date().toISOString();

  const updatedSlots = state.slots.map((s) =>
    s.code === slotCode
      ? {
          ...s,
          status,
          currentBookingId: status === "available" ? null : s.currentBookingId,
          driver_name: status === "available" ? null : s.driver_name,
          vehicle_number: status === "available" ? null : s.vehicle_number,
          lastUpdated: nowIso,
        }
      : s
  );

  let nextState: DemoState = {
    ...state,
    slots: updatedSlots,
  };

  nextState = addLog(
    nextState,
    "Slot Status Override",
    initiatedBy,
    slotCode,
    `Slot ${slotCode} manually updated to ${status.toUpperCase()}`
  );

  saveDemoState(nextState);

  if (typeof window !== "undefined") {
    window.dispatchEvent(
      new CustomEvent("smartpark:slot-sensor", {
        detail: { slotCode, status },
      })
    );
  }
}

export function setDemoSensorState(
  slotCode: "A1" | "A2",
  occupied: boolean
) {
  const status: SlotStatusCode = occupied ? "occupied" : "available";
  const state = getDemoState();
  const nowIso = new Date().toISOString();

  const updatedSlots = state.slots.map((s) =>
    s.code === slotCode
      ? {
          ...s,
          status,
          lastUpdated: nowIso,
        }
      : s
  );

  let nextState: DemoState = {
    ...state,
    slots: updatedSlots,
  };

  nextState = addLog(
    nextState,
    "Sensor Telemetry",
    "Hardware Sensor",
    slotCode,
    occupied ? `Ultrasonic detection (distance <= 10cm) -> Occupied` : `Ultrasonic clear -> Vacant`
  );

  saveDemoState(nextState);

  if (typeof window !== "undefined") {
    window.dispatchEvent(
      new CustomEvent("smartpark:slot-sensor", {
        detail: { slotCode, status },
      })
    );
  }
}

export function resetDemoState(): DemoState {
  saveDemoState(INITIAL_STATE);
  hardwareLogger.log("Demo State Reset", "All slots A1 & A2 reset to Available");

  if (typeof window !== "undefined") {
    window.dispatchEvent(
      new CustomEvent("smartpark:slot-sensor", {
        detail: { slotCode: "A1", status: "available" },
      })
    );
    window.dispatchEvent(
      new CustomEvent("smartpark:slot-sensor", {
        detail: { slotCode: "A2", status: "available" },
      })
    );
  }

  return INITIAL_STATE;
}

export function updateDemoProfile(profile: Partial<DemoDriverProfile>): DemoDriverProfile {
  const state = getDemoState();
  const nextProfile = {
    ...state.driverProfile,
    ...profile,
  };
  const nextState: DemoState = {
    ...state,
    driverProfile: nextProfile,
  };
  saveDemoState(nextState);
  return nextProfile;
}

export function findDemoBooking(codeOrId: string): DemoBooking | null {
  const state = getDemoState();
  const clean = codeOrId.trim().toUpperCase();
  return (
    state.bookings.find(
      (b) =>
        b.booking_code.toUpperCase() === clean ||
        b.id.toUpperCase() === clean ||
        clean.includes(b.booking_code.toUpperCase())
    ) || null
  );
}

// -------------------------------------------------------------
// REACT HOOK FOR REACTIVE STATE CONSUMPTION
// -------------------------------------------------------------

export function useDemoState() {
  const [state, setState] = useState<DemoState>(getDemoState());

  useEffect(() => {
    function refresh() {
      setState(getDemoState());
    }

    if (typeof window !== "undefined") {
      window.addEventListener(DEMO_STATE_EVT, refresh);
      window.addEventListener("storage", refresh);
      window.addEventListener("smartpark:slot-sensor", refresh);
    }
    return () => {
      if (typeof window !== "undefined") {
        window.removeEventListener(DEMO_STATE_EVT, refresh);
        window.removeEventListener("storage", refresh);
        window.removeEventListener("smartpark:slot-sensor", refresh);
      }
    };
  }, []);

  const totalSlots = state.slots.length;
  const availableSlots = state.slots.filter((s) => s.status === "available").length;
  const reservedSlots = state.slots.filter((s) => s.status === "reserved").length;
  const occupiedSlots = state.slots.filter((s) => s.status === "occupied").length;

  const activeParking = state.bookings.filter((b) => b.status === "active");
  const pendingEntry = state.bookings.filter((b) => b.status === "reserved");
  const pendingExit = state.bookings.filter((b) => b.status === "active" && b.exit_requested);
  const completedBookings = state.bookings.filter((b) => b.status === "completed");

  const todayRevenue = completedBookings.reduce((sum, b) => sum + (b.amount ?? 0), 0);
  const todayBookingsCount = state.bookings.length;

  return {
    state,
    slots: state.slots,
    bookings: state.bookings,
    activityLogs: state.activityLogs,
    notifications: state.notifications,
    driverProfile: state.driverProfile,
    activeParking,
    pendingEntry,
    pendingExit,
    completedBookings,
    stats: {
      totalSlots,
      availableSlots,
      reservedSlots,
      occupiedSlots,
      activeParkingCount: activeParking.length,
      pendingEntryCount: pendingEntry.length,
      pendingExitCount: pendingExit.length,
      completedTodayCount: completedBookings.length,
      todayRevenue,
      todayBookingsCount,
    },
    createBooking: createDemoBooking,
    approveEntry: approveDemoEntry,
    approveExit: approveDemoExit,
    cancelBooking: cancelDemoBooking,
    setSlotStatus: setDemoSlotStatus,
    setSensorState: setDemoSensorState,
    resetDemo: resetDemoState,
    updateProfile: updateDemoProfile,
  };
}
