import { createFileRoute } from "@tanstack/react-router";
import { RoleGuard } from "@/components/RoleGuard";
import { PortalShell } from "@/components/PortalShell";
import { PrototypeBadge } from "@/components/PrototypeBadge";
import { ADMIN_NAV } from "./admin.dashboard";
import { useEffect, useRef, useState } from "react";
import { Html5Qrcode } from "html5-qrcode";
import { supabase } from "@/integrations/supabase/client";
import { calcAmount } from "@/lib/pricing";
import { toast } from "sonner";
import { triggerGate, getPrototypeMode } from "@/lib/prototype-mode";
import { downloadInvoice } from "@/lib/invoice";
import { hardwareLogger } from "@/lib/hardware/HardwareLogger";
import { QrCode, DoorOpen, LogIn, LogOut, CheckCircle2, KeyRound, ShieldCheck } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin/scan")({
  component: () => (
    <RoleGuard allow="admin">
      <ScanPage />
    </RoleGuard>
  ),
});

type ScanResult = {
  booking_code: string;
  vehicle_number: string;
  driver_name?: string;
  slot?: string;
  entry_time: string | null;
  exit_time: string | null;
  duration_minutes: number | null;
  amount: number | null;
  base_amount?: number | null;
  gst_amount?: number | null;
  payment_status: string;
  message: string;
};

// Extract token identifier string (handles both raw token string and JSON payload format)
function extractToken(rawInput: string): string {
  const trimmed = rawInput.trim();
  try {
    const parsed = JSON.parse(trimmed);
    if (parsed && typeof parsed === "object" && parsed.bookingId) {
      return String(parsed.bookingId).trim();
    }
  } catch {
    // Plain string token
  }
  return trimmed;
}

function ScanPage() {
  const containerRef = useRef<HTMLDivElement>(null);
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const [scanning, setScanning] = useState(false);
  const [scannedQr, setScannedQr] = useState<string | null>(null);
  const [manualToken, setManualToken] = useState("");
  const [result, setResult] = useState<ScanResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const processingRef = useRef(false);

  useEffect(() => {
    return () => {
      scannerRef.current?.stop().catch(() => {});
    };
  }, []);

  async function startCamera() {
    if (!containerRef.current) return;
    setCameraError(null);
    const id = "qr-reader-region";
    containerRef.current.innerHTML = `<div id="${id}" class="w-full"></div>`;
    const scanner = new Html5Qrcode(id);
    scannerRef.current = scanner;
    setScanning(true);
    try {
      await scanner.start(
        { facingMode: "environment" },
        { fps: 10, qrbox: { width: 250, height: 250 } },
        async (decodedText) => {
          if (processingRef.current) return;
          processingRef.current = true;
          await scanner.stop().catch(() => {});
          setScanning(false);
          // Extract token payload or string
          const token = extractToken(decodedText);
          setScannedQr(token);
          toast.success("QR Scanned Successfully");
          processingRef.current = false;
        },
        () => {}
      );
    } catch (e: any) {
      setCameraError(e?.message ?? "Unable to access camera.");
      setScanning(false);
    }
  }

  async function stopCamera() {
    await scannerRef.current?.stop().catch(() => {});
    setScanning(false);
  }

  // =========================================================
  // ENTRY TOKEN VERIFICATION LOGIC
  // =========================================================
  async function verifyEntryToken(rawInput: string) {
    const token = extractToken(rawInput);
    if (!token) {
      toast.error("Please enter or scan an Entry Token");
      return;
    }
    setBusy(true);

    try {
      // 1. Search existing booking by Entry Token (booking_code)
      const { data: booking } = await supabase
        .from("bookings")
        .select("*, parking_slots(id, code), profiles!bookings_user_id_fkey(full_name)")
        .ilike("booking_code", token)
        .maybeSingle();

      if (!booking) {
        // Fallback demo mode if prototype mode is enabled
        if (getPrototypeMode()) {
          const nowStr = new Date().toISOString();
          await triggerGate(token, "ENTRY");
          hardwareLogger.log("Gate Opened", `Entry Verified (Demo): ${token}`);
          setResult({
            booking_code: token,
            vehicle_number: "DEMO-VEHICLE",
            driver_name: "Demo Driver",
            slot: "A1",
            entry_time: nowStr,
            exit_time: null,
            duration_minutes: null,
            amount: null,
            payment_status: "Active",
            message: "Entry Verified Successfully",
          });
          toast.success("Entry Verified Successfully");
          setBusy(false);
          return;
        }

        toast.error("Invalid Entry Token");
        setResult({
          booking_code: token,
          vehicle_number: "—",
          payment_status: "Error",
          entry_time: null,
          exit_time: null,
          duration_minutes: null,
          amount: null,
          message: "Invalid Entry Token — No booking found for this token",
        });
        setBusy(false);
        return;
      }

      const b = booking as any;
      const vehicleNum = b.vehicle_number || "—";
      const driverName = b.profiles?.full_name || "Driver";
      const slotCode = b.parking_slots?.code || "—";

      // 2. Check if entry was already processed
      if (b.status === "active") {
        toast.info("Entry Already Verified");
        setResult({
          booking_code: b.booking_code,
          vehicle_number: vehicleNum,
          driver_name: driverName,
          slot: slotCode,
          entry_time: b.entry_time,
          exit_time: null,
          duration_minutes: null,
          amount: null,
          payment_status: "Active",
          message: "Entry Already Verified — Vehicle is inside parking",
        });
        setBusy(false);
        return;
      }

      const nowStr = new Date().toISOString();

      // 3. Update entry timestamp and status to active
      await supabase.from("bookings").update({ status: "active", entry_time: nowStr }).eq("id", b.id);
      if (b.slot_id) {
        await supabase.from("parking_slots").update({ status: "occupied" }).eq("id", b.slot_id);
      }

      // 4. Trigger Hardware Gate (Sends OPEN_GATE over USB Serial to Arduino)
      await triggerGate(b.booking_code, "ENTRY");
      hardwareLogger.log("Gate Opened", `Entry Verified: ${b.booking_code}`);

      setResult({
        booking_code: b.booking_code,
        vehicle_number: vehicleNum,
        driver_name: driverName,
        slot: slotCode,
        entry_time: nowStr,
        exit_time: null,
        duration_minutes: null,
        amount: null,
        payment_status: "Active",
        message: "Entry Verified Successfully",
      });

      toast.success("Entry Verified Successfully");
    } catch (err: any) {
      toast.error("Verification error: " + (err?.message || "Failed"));
    } finally {
      setBusy(false);
    }
  }

  // =========================================================
  // EXIT TOKEN VERIFICATION LOGIC
  // =========================================================
  async function verifyExitToken(rawInput: string) {
    const token = extractToken(rawInput);
    if (!token) {
      toast.error("Please enter or scan an Exit Token");
      return;
    }
    setBusy(true);

    try {
      // Search existing booking by Exit Token
      const { data: booking } = await supabase
        .from("bookings")
        .select("*, parking_slots(id, code), profiles!bookings_user_id_fkey(full_name)")
        .ilike("booking_code", token)
        .maybeSingle();

      if (!booking) {
        if (getPrototypeMode()) {
          const exitDate = new Date();
          const exitStr = exitDate.toISOString();
          const entryDate = new Date(Date.now() - 45 * 60000);
          const durationMinutes = 45;
          const pricing = calcAmount(durationMinutes);

          await triggerGate(token, "EXIT");
          hardwareLogger.log("Gate Opened", `Exit Verified (Demo): ${token}`);

          downloadInvoice({
            booking_code: token,
            vehicle_number: "DEMO-VEHICLE",
            entry_time: entryDate.toISOString(),
            exit_time: exitStr,
            duration_minutes: durationMinutes,
            amount: pricing.total,
            payment_status: "Paid",
            slot: "A1",
            driver_name: "Demo Driver",
          });

          setResult({
            booking_code: token,
            vehicle_number: "DEMO-VEHICLE",
            driver_name: "Demo Driver",
            slot: "A1",
            entry_time: entryDate.toISOString(),
            exit_time: exitStr,
            duration_minutes: durationMinutes,
            base_amount: pricing.base,
            gst_amount: pricing.gst,
            amount: pricing.total,
            payment_status: "Completed",
            message: `Exit Verified Successfully — Total ₹${pricing.total}`,
          });
          toast.success("Exit Verified Successfully");
          setBusy(false);
          return;
        }

        toast.error("Invalid Exit Token");
        setResult({
          booking_code: token,
          vehicle_number: "—",
          payment_status: "Error",
          entry_time: null,
          exit_time: null,
          duration_minutes: null,
          amount: null,
          message: "Invalid Exit Token — No booking found for this token",
        });
        setBusy(false);
        return;
      }

      const b = booking as any;
      const exitDate = new Date();
      const exitStr = exitDate.toISOString();
      const entryDate = b.entry_time ? new Date(b.entry_time) : new Date(Date.now() - 30 * 60000);
      const durationMinutes = Math.max(1, Math.round((exitDate.getTime() - entryDate.getTime()) / 60000));
      const pricing = calcAmount(durationMinutes);
      const vehicleNum = b.vehicle_number || "—";
      const driverName = b.profiles?.full_name || "Driver";
      const slotCode = b.parking_slots?.code || "—";

      // Mark session completed
      await supabase
        .from("bookings")
        .update({
          status: "completed",
          exit_time: exitStr,
          duration_minutes: durationMinutes,
          amount: pricing.total,
        })
        .eq("id", b.id);

      if (b.slot_id) {
        await supabase.from("parking_slots").update({ status: "available" }).eq("id", b.slot_id);
      }

      // Trigger Hardware Gate
      await triggerGate(b.booking_code, "EXIT");
      hardwareLogger.log("Gate Opened", `Exit Verified: ${b.booking_code}`);

      // Auto-generate invoice
      downloadInvoice({
        booking_code: b.booking_code,
        vehicle_number: vehicleNum,
        entry_time: entryDate.toISOString(),
        exit_time: exitStr,
        duration_minutes: durationMinutes,
        amount: pricing.total,
        payment_status: b.payment_status || "Paid",
        slot: slotCode,
        driver_name: driverName,
      });
      hardwareLogger.log("Invoice Generated", `Token: ${b.booking_code}`);

      setResult({
        booking_code: b.booking_code,
        vehicle_number: vehicleNum,
        driver_name: driverName,
        slot: slotCode,
        entry_time: entryDate.toISOString(),
        exit_time: exitStr,
        duration_minutes: durationMinutes,
        base_amount: pricing.base,
        gst_amount: pricing.gst,
        amount: pricing.total,
        payment_status: "Completed",
        message: `Exit Verified Successfully — Total ₹${pricing.total}`,
      });

      toast.success("Exit Verified Successfully");
    } catch (err: any) {
      toast.error("Exit verification error: " + (err?.message || "Failed"));
    } finally {
      setBusy(false);
    }
  }

  // Emergency / Bypass Manual Entry
  async function handleManualBypassEntry() {
    const randomToken = `BK-${Math.floor(1000 + Math.random() * 9000)}`;
    await verifyEntryToken(randomToken);
  }

  // Emergency / Bypass Manual Exit
  async function handleManualBypassExit() {
    const randomToken = `BK-${Math.floor(1000 + Math.random() * 9000)}`;
    await verifyExitToken(randomToken);
  }

  return (
    <PortalShell title="Admin Portal" nav={ADMIN_NAV}>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-2xl font-bold">Entry & Exit Token Verification</h2>
        <PrototypeBadge />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Left Column: Manual Token Verification & Scanner */}
        <div className="space-y-6">

          {/* Manual Entry Token Card */}
          <div className="rounded-2xl border border-border bg-card p-5 shadow-sm space-y-4">
            <h3 className="font-semibold text-base flex items-center gap-2">
              <KeyRound className="h-5 w-5 text-primary" /> Manual Entry Token Verification
            </h3>
            <p className="text-xs text-muted-foreground">
              Enter the Entry Token from the Driver Portal to verify booking and open the gate.
            </p>
            <div className="flex gap-2">
              <input
                type="text"
                value={manualToken}
                onChange={(e) => setManualToken(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && verifyEntryToken(manualToken)}
                placeholder="e.g. BK1234 or paste driver token"
                className="flex-1 rounded-xl border border-input bg-background px-4 py-2.5 text-sm font-mono font-medium focus:outline-none focus:ring-2 focus:ring-primary"
              />
              <button
                onClick={() => verifyEntryToken(manualToken)}
                disabled={busy || !manualToken.trim()}
                className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-bold text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-all"
              >
                <ShieldCheck className="h-4 w-4" /> Verify Entry
              </button>
            </div>
            <div className="flex gap-2 text-xs">
              <button
                onClick={() => verifyExitToken(manualToken)}
                disabled={busy || !manualToken.trim()}
                className="text-amber-600 dark:text-amber-400 hover:underline font-medium"
              >
                Verify as Exit Token instead →
              </button>
            </div>
          </div>

          {/* Camera QR Scanner Card */}
          <div className="rounded-2xl border border-border bg-card p-5 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold flex items-center gap-2">
                <QrCode className="h-5 w-5 text-primary" /> Camera QR Scanner
              </h3>
              {scannedQr && (
                <span className="rounded-full bg-emerald-500/15 px-3 py-1 text-xs font-semibold text-emerald-700 dark:text-emerald-400">
                  Scanned
                </span>
              )}
            </div>

            {/* Camera Viewport */}
            <div ref={containerRef} className="min-h-[200px] overflow-hidden rounded-lg bg-black/5 flex items-center justify-center">
              {!scanning && !scannedQr && (
                <p className="text-sm text-muted-foreground p-6 text-center">
                  Click "Start Camera" to scan driver entry or exit QR codes.
                </p>
              )}
            </div>

            {cameraError && (
              <div className="rounded-lg bg-destructive/10 p-3 text-xs text-destructive">
                {cameraError}
              </div>
            )}

            <div className="flex gap-2">
              {!scanning ? (
                <button
                  onClick={startCamera}
                  disabled={busy}
                  className="rounded-lg bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                >
                  Start Camera
                </button>
              ) : (
                <button
                  onClick={stopCamera}
                  className="rounded-lg bg-destructive px-5 py-2 text-sm font-semibold text-destructive-foreground hover:bg-destructive/90"
                >
                  Stop Camera
                </button>
              )}

              {scannedQr && (
                <button
                  onClick={() => {
                    setScannedQr(null);
                    startCamera();
                  }}
                  className="rounded-lg border border-input bg-background px-4 py-2 text-sm font-semibold hover:bg-muted"
                >
                  Scan Another
                </button>
              )}
            </div>

            {/* Scanned QR Payload Action Card */}
            {scannedQr && (
              <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4 space-y-3">
                <div className="flex items-center gap-2 text-emerald-700 dark:text-emerald-400 font-semibold text-sm">
                  <CheckCircle2 className="h-4 w-4" /> QR Code Decoded
                </div>
                <div className="text-xs">
                  <span className="text-muted-foreground block font-medium">Decoded Token:</span>
                  <code className="mt-1 block font-mono text-sm break-all font-bold bg-background/60 p-2 rounded border border-emerald-500/20">
                    {scannedQr}
                  </code>
                </div>

                <div className="grid grid-cols-2 gap-3 pt-2">
                  <button
                    onClick={() => verifyEntryToken(scannedQr)}
                    disabled={busy}
                    className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-bold text-white shadow hover:bg-emerald-700 active:scale-95 transition-all disabled:opacity-50"
                  >
                    <LogIn className="h-4 w-4" /> VERIFY ENTRY
                  </button>
                  <button
                    onClick={() => verifyExitToken(scannedQr)}
                    disabled={busy}
                    className="inline-flex items-center justify-center gap-2 rounded-xl bg-amber-600 px-4 py-2.5 text-sm font-bold text-white shadow hover:bg-amber-700 active:scale-95 transition-all disabled:opacity-50"
                  >
                    <LogOut className="h-4 w-4" /> VERIFY EXIT
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Emergency Bypass Controls */}
          <div className="rounded-2xl border border-border bg-card p-5 shadow-sm space-y-3">
            <h3 className="font-semibold text-sm flex items-center gap-2 text-muted-foreground">
              <DoorOpen className="h-4 w-4" /> Demo Emergency Controls (Bypass Token Search)
            </h3>
            <div className="grid grid-cols-2 gap-3 pt-1">
              <button
                onClick={handleManualBypassEntry}
                disabled={busy}
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-emerald-600/40 bg-emerald-500/10 px-4 py-2.5 text-xs font-bold text-emerald-700 dark:text-emerald-400 hover:bg-emerald-500/20 transition-all disabled:opacity-50"
              >
                <LogIn className="h-4 w-4" /> DEMO ENTRY
              </button>
              <button
                onClick={handleManualBypassExit}
                disabled={busy}
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-amber-600/40 bg-amber-500/10 px-4 py-2.5 text-xs font-bold text-amber-700 dark:text-amber-400 hover:bg-amber-500/20 transition-all disabled:opacity-50"
              >
                <LogOut className="h-4 w-4" /> DEMO EXIT
              </button>
            </div>
          </div>
        </div>

        {/* Right Column: Transaction & Verification Result Card */}
        <div className="rounded-2xl border border-border bg-card p-5 shadow-sm h-fit space-y-4">
          <h3 className="font-semibold">Verification & Session Result</h3>
          {!result ? (
            <div className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
              Enter an Entry Token or scan a QR code to view booking details and gate verification status.
            </div>
          ) : (
            <div className="space-y-3 text-sm">
              <div
                className={`rounded-lg p-3 font-semibold text-sm ${
                  result.payment_status === "Error"
                    ? "bg-destructive/15 text-destructive"
                    : "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
                }`}
              >
                {result.message}
              </div>
              <Row label="Booking / Entry Token" v={result.booking_code} />
              <Row label="Driver Name" v={result.driver_name ?? "—"} />
              <Row label="Vehicle Number" v={result.vehicle_number} />
              <Row label="Assigned Slot" v={result.slot ?? "—"} />
              <Row label="Entry Time" v={result.entry_time ? new Date(result.entry_time).toLocaleString() : "—"} />
              <Row label="Exit Time" v={result.exit_time ? new Date(result.exit_time).toLocaleString() : "—"} />
              <Row label="Duration" v={result.duration_minutes ? `${result.duration_minutes} min` : "—"} />
              {result.base_amount != null && <Row label="Base Charge" v={`₹${result.base_amount.toFixed(2)}`} />}
              {result.gst_amount != null && <Row label="GST (18%)" v={`₹${result.gst_amount.toFixed(2)}`} />}
              <Row label="Total Amount" v={result.amount != null ? `₹${result.amount.toFixed(2)}` : "—"} />
              <Row label="Session Status" v={result.payment_status} />
            </div>
          )}
        </div>
      </div>
    </PortalShell>
  );
}

function Row({ label, v }: { label: string; v: string }) {
  return (
    <div className="flex justify-between border-b border-border py-1.5">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium">{v}</span>
    </div>
  );
}


