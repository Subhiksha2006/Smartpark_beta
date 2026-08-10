export type ParsedHardwareEvent =
  | { type: "SLOT_CHANGE"; slot: "A1" | "A2"; status: "occupied" | "available" }
  | { type: "GATE_EVENT"; gateState: "OPENED" | "CLOSED" }
  | { type: "UNKNOWN"; raw: string };

export function parseArduinoLine(line: string): ParsedHardwareEvent {
  const clean = line.trim().toUpperCase();

  if (clean === "A1_OCCUPIED") {
    return { type: "SLOT_CHANGE", slot: "A1", status: "occupied" };
  }
  if (clean === "A1_FREE") {
    return { type: "SLOT_CHANGE", slot: "A1", status: "available" };
  }
  if (clean === "A2_OCCUPIED") {
    return { type: "SLOT_CHANGE", slot: "A2", status: "occupied" };
  }
  if (clean === "A2_FREE") {
    return { type: "SLOT_CHANGE", slot: "A2", status: "available" };
  }
  if (clean === "GATE_OPENED") {
    return { type: "GATE_EVENT", gateState: "OPENED" };
  }
  if (clean === "GATE_CLOSED") {
    return { type: "GATE_EVENT", gateState: "CLOSED" };
  }

  return { type: "UNKNOWN", raw: line };
}
