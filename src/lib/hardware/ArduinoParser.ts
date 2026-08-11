export type ParsedHardwareEvent =
  | { type: "SLOT_CHANGE"; slot: "A1" | "A2"; status: "occupied" | "available" }
  | { type: "GATE_EVENT"; gateState: "OPENED" | "CLOSED" }
  | { type: "UNKNOWN"; raw: string };

export function parseArduinoLine(line: string): ParsedHardwareEvent {
  const clean = line.trim().toUpperCase().replace(/[^A-Z0-9_:]/g, "");

  if (clean.includes("A1") && (clean.includes("OCCUPIED") || clean.includes("BUSY") || clean.includes("FULL"))) {
    return { type: "SLOT_CHANGE", slot: "A1", status: "occupied" };
  }
  if (clean.includes("A1") && (clean.includes("FREE") || clean.includes("AVAILABLE") || clean.includes("EMPTY"))) {
    return { type: "SLOT_CHANGE", slot: "A1", status: "available" };
  }

  if (clean.includes("A2") && (clean.includes("OCCUPIED") || clean.includes("BUSY") || clean.includes("FULL"))) {
    return { type: "SLOT_CHANGE", slot: "A2", status: "occupied" };
  }
  if (clean.includes("A2") && (clean.includes("FREE") || clean.includes("AVAILABLE") || clean.includes("EMPTY"))) {
    return { type: "SLOT_CHANGE", slot: "A2", status: "available" };
  }

  if (clean.includes("GATE_OPENED") || clean.includes("GATE_OPEN") || clean.includes("GATE:OPENED")) {
    return { type: "GATE_EVENT", gateState: "OPENED" };
  }
  if (clean.includes("GATE_CLOSED") || clean.includes("GATE_CLOSE") || clean.includes("GATE:CLOSED")) {
    return { type: "GATE_EVENT", gateState: "CLOSED" };
  }

  return { type: "UNKNOWN", raw: line };
}
