import { calcAmount } from "./pricing";

export function downloadInvoice(b: {
  booking_code: string;
  vehicle_number: string;
  entry_time?: string | null;
  exit_time?: string | null;
  duration_minutes?: number | null;
  amount?: number | null;
  payment_status?: string;
  slot?: string;
  driver_name?: string;
}) {
  const minutes = b.duration_minutes ?? 0;
  const inv = minutes > 0 ? calcAmount(minutes) : { hours: 0, base: 0, gst: 0, total: b.amount ?? 0 };
  const html = `<!doctype html><html><head><meta charset="utf-8"><title>Invoice ${b.booking_code}</title>
<style>body{font-family:system-ui,sans-serif;max-width:640px;margin:40px auto;padding:24px;color:#111}
h1{margin:0 0 4px}.muted{color:#666;font-size:12px}
table{width:100%;border-collapse:collapse;margin-top:24px}
td,th{padding:8px;border-bottom:1px solid #eee;text-align:left;font-size:14px}
tfoot td{font-weight:700}</style></head><body>
<h1>SmartPark Invoice</h1>
<div class="muted">Booking ${b.booking_code} · Generated ${new Date().toLocaleString()}</div>
<table>
<tr><th>Driver</th><td>${b.driver_name ?? "—"}</td></tr>
<tr><th>Vehicle</th><td>${b.vehicle_number}</td></tr>
<tr><th>Slot</th><td>${b.slot ?? "—"}</td></tr>
<tr><th>Entry</th><td>${b.entry_time ? new Date(b.entry_time).toLocaleString() : "—"}</td></tr>
<tr><th>Exit</th><td>${b.exit_time ? new Date(b.exit_time).toLocaleString() : "—"}</td></tr>
<tr><th>Duration</th><td>${minutes} min (${inv.hours} h billed)</td></tr>
<tr><th>Base</th><td>₹${inv.base.toFixed(2)}</td></tr>
<tr><th>GST (18%)</th><td>₹${inv.gst.toFixed(2)}</td></tr>
<tr><th>Payment</th><td>${b.payment_status ?? "—"}</td></tr>
</table>
<table><tfoot><tr><td>Total</td><td style="text-align:right">₹${inv.total.toFixed(2)}</td></tr></tfoot></table>
</body></html>`;
  const blob = new Blob([html], { type: "text/html" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `invoice-${b.booking_code}.html`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
