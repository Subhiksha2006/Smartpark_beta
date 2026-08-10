export const HOURLY_RATE = 50; // INR/hour
export const GST_RATE = 0.18;

export function calcAmount(minutes: number, hourlyRate = HOURLY_RATE) {
  const hours = Math.max(1, Math.ceil(minutes / 60));
  const base = hours * hourlyRate;
  const gst = base * GST_RATE;
  const total = base + gst;
  return { hours, base, gst, total: Math.round(total * 100) / 100 };
}
