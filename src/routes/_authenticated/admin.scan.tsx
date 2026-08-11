import { createFileRoute } from "@tanstack/react-router";
import { RoleGuard } from "@/components/RoleGuard";
import { PortalShell } from "@/components/PortalShell";
import { PrototypeBadge } from "@/components/PrototypeBadge";
import { ADMIN_NAV } from "./admin.dashboard";
import { useEffect, useRef, useState } from "react";
import { Html5Qrcode } from "html5-qrcode";
import jsQR from "jsqr";
import { supabase } from "@/integrations/supabase/client";
import { calcAmount } from "@/lib/pricing";
import { toast } from "sonner";
import { triggerGate, getPrototypeMode } from "@/lib/prototype-mode";
import { getDemoRole } from "@/lib/demo-auth";
import { findDemoBooking, updateDemoBooking } from "@/lib/demo-booking-store";
import { downloadInvoice } from "@/lib/invoice";
import { hardwareLogger } from "@/lib/hardware/HardwareLogger";
import { QrCode, DoorOpen, LogIn, LogOut, CheckCircle2, KeyRound, ShieldCheck, FileUp, Upload, Image as ImageIcon, RefreshCw, Sparkles, X } from "lucide-react";

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
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [scanning, setScanning] = useState(false);
  const [scannedQr, setScannedQr] = useState<string | null>(null);
  const [manualToken, setManualToken] = useState("");
  const [result, setResult] = useState<ScanResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const processingRef = useRef(false);

  // Client-Side Image Importer State
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreviewUrl, setImagePreviewUrl] = useState<string | null>(null);
  const [imageDecoding, setImageDecoding] = useState(false);
  const [imageError, setImageError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  useEffect(() => {
    return () => {
      scannerRef.current?.stop().catch(() => {});
    };
  }, []);

  // Cleanup Object URLs on unmount/change
  useEffect(() => {
    return () => {
      if (imagePreviewUrl) {
        URL.revokeObjectURL(imagePreviewUrl);
      }
    };
  }, [imagePreviewUrl]);

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
          await handleAutoScan(decodedText);
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
  // PURE CLIENT-SIDE MULTI-PASS CANVAS QR DECODER (JSQR)
  // =========================================================
  async function decodeQRFromImageFile(file: File): Promise<string | null> {
    return new Promise((resolve) => {
      const img = document.createElement("img");
      const objectUrl = URL.createObjectURL(file);
      img.src = objectUrl;

      img.onload = () => {
        URL.revokeObjectURL(objectUrl);
        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d", { willReadFrequently: true });
        if (!ctx) {
          resolve(null);
          return;
        }

        // 1. Pass 1: Multiple scaling factors (1x, 0.75x, 0.5x, 1.25x, 1.5x)
        const scales = [1, 0.75, 0.5, 1.25, 1.5];
        for (const scale of scales) {
          const width = Math.round(img.width * scale);
          const height = Math.round(img.height * scale);

          if (width <= 0 || height <= 0 || width > 2500 || height > 2500) continue;

          canvas.width = width;
          canvas.height = height;
          ctx.drawImage(img, 0, 0, width, height);

          const imageData = ctx.getImageData(0, 0, width, height);

          // Standard pass
          const code = jsQR(imageData.data, imageData.width, imageData.height, {
            inversionAttempts: "dontInvert",
          });
          if (code && code.data && code.data.trim()) {
            resolve(code.data.trim());
            return;
          }

          // Inverted pass for dark/styled QR borders
          const codeInverted = jsQR(imageData.data, imageData.width, imageData.height, {
            inversionAttempts: "invertFirst",
          });
          if (codeInverted && codeInverted.data && codeInverted.data.trim()) {
            resolve(codeInverted.data.trim());
            return;
          }
        }

        // 2. Pass 2: Center region crop scanning for screenshots containing padding & browser frames
        const cropRatios = [
          { x: 0.1, y: 0.1, w: 0.8, h: 0.8 },
          { x: 0.2, y: 0.2, w: 0.6, h: 0.6 },
          { x: 0.25, y: 0.25, w: 0.5, h: 0.5 },
        ];

        for (const crop of cropRatios) {
          const cropX = Math.round(img.width * crop.x);
          const cropY = Math.round(img.height * crop.y);
          const cropW = Math.round(img.width * crop.w);
          const cropH = Math.round(img.height * crop.h);

          if (cropW <= 0 || cropH <= 0) continue;

          canvas.width = cropW;
          canvas.height = cropH;
          ctx.drawImage(img, cropX, cropY, cropW, cropH, 0, 0, cropW, cropH);

          const imageData = ctx.getImageData(0, 0, cropW, cropH);
          const code = jsQR(imageData.data, imageData.width, imageData.height, {
            inversionAttempts: "attemptBoth",
          });
          if (code && code.data && code.data.trim()) {
            resolve(code.data.trim());
            return;
          }
        }

        resolve(null);
      };

      img.onerror = () => {
        URL.revokeObjectURL(objectUrl);
        resolve(null);
      };
    });
  }

  // =========================================================
  // CLIENT-SIDE LOCAL QR IMAGE DECODING PIPELINE
  // =========================================================
  async function processSelectedImage(file: File) {
    if (!file) return;

    const validTypes = ["image/png", "image/jpeg", "image/jpg", "image/webp"];
    if (!validTypes.includes(file.type.toLowerCase())) {
      const typeError = "Please select a valid image file (PNG, JPG, JPEG, or WEBP).";
      setImageError(typeError);
      toast.error(typeError);
      return;
    }

    if (imagePreviewUrl) {
      URL.revokeObjectURL(imagePreviewUrl);
    }

    const previewUrl = URL.createObjectURL(file);
    setImageFile(file);
    setImagePreviewUrl(previewUrl);
    setImageError(null);
    setImageDecoding(true);

    try {
      let decodedText: string | null = null;

      // Attempt 1: Html5Qrcode scanFile
      try {
        const readerId = "qr-file-reader-region";
        let readerEl = document.getElementById(readerId);
        if (!readerEl) {
          readerEl = document.createElement("div");
          readerEl.id = readerId;
          readerEl.style.display = "none";
          document.body.appendChild(readerEl);
        }
        const html5QrCode = new Html5Qrcode(readerId);
        decodedText = await html5QrCode.scanFile(file, false);
        html5QrCode.clear();
      } catch (hErr) {
        console.warn("Html5Qrcode scanFile fallback to jsQR canvas decoder:", hErr);
      }

      // Attempt 2: High-accuracy jsQR Canvas Decoder (Handles all screenshots & scaled images)
      if (!decodedText || !decodedText.trim()) {
        decodedText = await decodeQRFromImageFile(file);
      }

      if (decodedText && decodedText.trim()) {
        toast.success("QR Code Image Decoded Successfully!");
        // Pass directly into the EXACT SAME processing pipeline as camera scans
        await handleAutoScan(decodedText.trim());
      } else {
        throw new Error("Could not detect a valid QR code in this image.");
      }
    } catch (err: any) {
      console.warn("QR Image Decoder Error:", err);
      const errorMsg = "Could not detect a valid SmartPark QR code in this image.";
      setImageError(errorMsg);
      toast.error(errorMsg);
      setResult({
        booking_code: "—",
        vehicle_number: "—",
        payment_status: "Error",
        entry_time: null,
        exit_time: null,
        duration_minutes: null,
        amount: null,
        message: errorMsg,
      });
    } finally {
      setImageDecoding(false);
    }
  }

  function clearImage() {
    if (imagePreviewUrl) {
      URL.revokeObjectURL(imagePreviewUrl);
    }
    setImageFile(null);
    setImagePreviewUrl(null);
    setImageError(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }

  function handleDragOver(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }

  function handleDragLeave(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const file = e.dataTransfer.files[0];
      processSelectedImage(file);
    }
  }

  // =========================================================
  // AUTOMATIC QR ENTRY / EXIT CLASSIFICATION & PROCESSING
  // =========================================================
  async function handleAutoScan(rawInput: string) {
    const trimmed = rawInput.trim();
    console.log("[QR IMPORT] decoded text:", trimmed);

    let parsedPayload: any = null;
    try {
      parsedPayload = JSON.parse(trimmed);
      console.log("[QR IMPORT] parsed payload:", parsedPayload);
    } catch {
      // Raw string or non-JSON
    }

    const token = extractToken(rawInput);
    console.log("[QR IMPORT] extracted booking ID:", token);

    // Case A: Empty / unparseable payload
    if (!token) {
      toast.error("Invalid SmartPark QR payload.");
      setResult({
        booking_code: "—",
        vehicle_number: "—",
        payment_status: "Error",
        entry_time: null,
        exit_time: null,
        duration_minutes: null,
        amount: null,
        message: "Invalid SmartPark QR payload.",
      });
      return;
    }

    // Verify payload is a valid SmartPark QR structure or valid booking ID string
    const isJsonObject = parsedPayload && typeof parsedPayload === "object";
    const hasSmartParkFields = isJsonObject && (parsedPayload.bookingId || parsedPayload.type || parsedPayload.vehicle || parsedPayload.slot);
    const isBookingFormat = token.length >= 2;

    if (!hasSmartParkFields && !isBookingFormat) {
      toast.info("QR scanned successfully, but this QR is not a Smart Park booking.");
      setResult({
        booking_code: "—",
        vehicle_number: "—",
        payment_status: "Notice",
        entry_time: null,
        exit_time: null,
        duration_minutes: null,
        amount: null,
        message: "QR scanned successfully, but this QR is not a Smart Park booking.",
      });
      return;
    }

    setScannedQr(token);

    // Check explicit type inside JSON payload ("ENTRY" | "EXIT")
    const explicitType = parsedPayload?.type ? String(parsedPayload.type).toUpperCase() : null;

    if (explicitType === "ENTRY") {
      toast.success("Entry QR Detected Automatically");
      await verifyEntryToken(token);
    } else if (explicitType === "EXIT") {
      toast.success("Exit QR Detected Automatically");
      await verifyExitToken(token);
    } else {
      // Auto-detect based on current Supabase booking status
      setBusy(true);
      try {
        const { data: booking } = await supabase
          .from("bookings")
          .select("*, parking_slots(id, code), profiles!bookings_user_id_fkey(full_name)")
          .ilike("booking_code", token)
          .maybeSingle();

        if (!booking) {
          if (getDemoRole() || getPrototypeMode()) {
            await verifyEntryToken(token);
            return;
          }
          const notFoundMsg = `Booking ${token} was not found.`;
          toast.error(notFoundMsg);
          setResult({
            booking_code: token,
            vehicle_number: "—",
            payment_status: "Error",
            entry_time: null,
            exit_time: null,
            duration_minutes: null,
            amount: null,
            message: notFoundMsg,
          });
          return;
        }

        const b = booking as any;
        if (b.status === "active") {
          toast.info("Active Booking Scanned — Auto Processing Exit");
          await verifyExitToken(token);
        } else if (b.status === "completed") {
          toast.info("Exit already completed for this booking.");
          setResult({
            booking_code: b.booking_code,
            vehicle_number: b.vehicle_number || "—",
            driver_name: b.profiles?.full_name || "Driver",
            slot: b.parking_slots?.code || "—",
            entry_time: b.entry_time,
            exit_time: b.exit_time,
            duration_minutes: b.duration_minutes,
            amount: b.amount,
            payment_status: "Completed",
            message: "Exit already completed for this booking.",
          });
        } else {
          toast.info("Reserved Booking Scanned — Auto Processing Entry");
          await verifyEntryToken(token);
        }
      } catch (err) {
        console.error("Auto scan detection error:", err);
        await verifyEntryToken(token);
      } finally {
        setBusy(false);
      }
    }
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
      console.log("[QR ENTRY] database lookup for booking_code:", token);

      // 1. Search existing booking by Entry Token (booking_code)
      const { data: booking, error: dbErr } = await supabase
        .from("bookings")
        .select("*, parking_slots(id, code), profiles!bookings_user_id_fkey(full_name)")
        .ilike("booking_code", token)
        .maybeSingle();

      if (dbErr) {
        console.warn("[QR ENTRY] DB query warning:", dbErr);
      }

      if (!booking) {
        // Fallback demo mode handling using centralized Demo Store
        const isDemo = getDemoRole() || getPrototypeMode() || findDemoBooking(token);
        if (isDemo) {
          const existingDemo = findDemoBooking(token);

          // Duplicate Entry Protection
          if (existingDemo && existingDemo.status === "active") {
            toast.info("Entry already approved for this booking.");
            setResult({
              booking_code: existingDemo.booking_code,
              vehicle_number: existingDemo.vehicle_number,
              driver_name: existingDemo.driver_name,
              slot: existingDemo.slot_code,
              entry_time: existingDemo.entry_time,
              exit_time: null,
              duration_minutes: null,
              amount: null,
              payment_status: "Active",
              message: "Entry already approved for this booking.",
            });
            setBusy(false);
            return;
          }

          if (existingDemo && existingDemo.status === "completed") {
            toast.info("Exit already completed for this booking.");
            setResult({
              booking_code: existingDemo.booking_code,
              vehicle_number: existingDemo.vehicle_number,
              driver_name: existingDemo.driver_name,
              slot: existingDemo.slot_code,
              entry_time: existingDemo.entry_time,
              exit_time: existingDemo.exit_time,
              duration_minutes: existingDemo.duration_minutes,
              amount: existingDemo.amount,
              payment_status: "Completed",
              message: "Exit already completed for this booking.",
            });
            setBusy(false);
            return;
          }

          const nowStr = new Date().toISOString();
          const updatedDemo = updateDemoBooking(token, {
            status: "active",
            entry_time: nowStr,
            vehicle_number: existingDemo?.vehicle_number || "TN01S1234",
            driver_name: existingDemo?.driver_name || "Demo Driver",
            slot_code: existingDemo?.slot_code || "A1",
          });

          triggerGate(updatedDemo.booking_code, "ENTRY").catch(() => {});
          hardwareLogger.log("Gate Opened", `Entry Verified (Demo): ${updatedDemo.booking_code}`);

          setResult({
            booking_code: updatedDemo.booking_code,
            vehicle_number: updatedDemo.vehicle_number,
            driver_name: updatedDemo.driver_name,
            slot: updatedDemo.slot_code,
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

        const notFoundMsg = `Booking ${token} was not found.`;
        toast.error(notFoundMsg);
        setResult({
          booking_code: token,
          vehicle_number: "—",
          payment_status: "Error",
          entry_time: null,
          exit_time: null,
          duration_minutes: null,
          amount: null,
          message: notFoundMsg,
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
        toast.info("Entry already approved for this booking.");
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
          message: "Entry already approved for this booking.",
        });
        setBusy(false);
        return;
      }

      if (b.status === "completed") {
        toast.info("Exit already completed for this booking.");
        setResult({
          booking_code: b.booking_code,
          vehicle_number: vehicleNum,
          driver_name: driverName,
          slot: slotCode,
          entry_time: b.entry_time,
          exit_time: b.exit_time,
          duration_minutes: b.duration_minutes,
          amount: b.amount,
          payment_status: "Completed",
          message: "Exit already completed for this booking.",
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

      // 4. Trigger Hardware Gate (Sends OPEN_GATE over USB Serial to Arduino - Fire & Forget)
      triggerGate(b.booking_code, "ENTRY").catch(() => {});
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
      console.log("[QR EXIT] database lookup for booking_code:", token);

      // Search existing booking by Exit Token
      const { data: booking, error: dbErr } = await supabase
        .from("bookings")
        .select("*, parking_slots(id, code), profiles!bookings_user_id_fkey(full_name)")
        .ilike("booking_code", token)
        .maybeSingle();

      if (dbErr) {
        console.warn("[QR EXIT] DB query warning:", dbErr);
      }

      if (!booking) {
        const isDemo = getDemoRole() || getPrototypeMode() || findDemoBooking(token);
        if (isDemo) {
          const existingDemo = findDemoBooking(token);

          // Check if exit was already completed
          if (existingDemo && existingDemo.status === "completed") {
            toast.info("Exit already completed for this booking.");
            setResult({
              booking_code: existingDemo.booking_code,
              vehicle_number: existingDemo.vehicle_number,
              driver_name: existingDemo.driver_name,
              slot: existingDemo.slot_code,
              entry_time: existingDemo.entry_time,
              exit_time: existingDemo.exit_time,
              duration_minutes: existingDemo.duration_minutes,
              amount: existingDemo.amount,
              payment_status: "Completed",
              message: "Exit already completed for this booking.",
            });
            setBusy(false);
            return;
          }

          const exitDate = new Date();
          const exitStr = exitDate.toISOString();
          const entryDate = existingDemo?.entry_time
            ? new Date(existingDemo.entry_time)
            : new Date(Date.now() - 45 * 60000);
          const durationMinutes = Math.max(1, Math.round((exitDate.getTime() - entryDate.getTime()) / 60000));
          const pricing = calcAmount(durationMinutes);

          const updatedDemo = updateDemoBooking(token, {
            status: "completed",
            exit_time: exitStr,
            duration_minutes: durationMinutes,
            amount: pricing.total,
            payment_status: "Paid",
          });

          triggerGate(updatedDemo.booking_code, "EXIT").catch(() => {});
          hardwareLogger.log("Gate Opened", `Exit Verified (Demo): ${updatedDemo.booking_code}`);

          try {
            downloadInvoice({
              booking_code: updatedDemo.booking_code,
              vehicle_number: updatedDemo.vehicle_number,
              entry_time: entryDate.toISOString(),
              exit_time: exitStr,
              duration_minutes: durationMinutes,
              amount: pricing.total,
              payment_status: "Paid",
              slot: updatedDemo.slot_code,
              driver_name: updatedDemo.driver_name,
            });
          } catch (invErr) {
            console.error("Invoice download exception:", invErr);
          }

          setResult({
            booking_code: updatedDemo.booking_code,
            vehicle_number: updatedDemo.vehicle_number,
            driver_name: updatedDemo.driver_name,
            slot: updatedDemo.slot_code,
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

        const notFoundMsg = `Booking ${token} was not found.`;
        toast.error(notFoundMsg);
        setResult({
          booking_code: token,
          vehicle_number: "—",
          payment_status: "Error",
          entry_time: null,
          exit_time: null,
          duration_minutes: null,
          amount: null,
          message: notFoundMsg,
        });
        setBusy(false);
        return;
      }

      const b = booking as any;
      const vehicleNum = b.vehicle_number || "—";
      const driverName = b.profiles?.full_name || "Driver";
      const slotCode = b.parking_slots?.code || "—";

      // 2. Prevent Duplicate Exit Processing
      if (b.status === "completed") {
        toast.info("Exit already completed for this booking.");
        setResult({
          booking_code: b.booking_code,
          vehicle_number: vehicleNum,
          driver_name: driverName,
          slot: slotCode,
          entry_time: b.entry_time,
          exit_time: b.exit_time,
          duration_minutes: b.duration_minutes,
          amount: b.amount,
          payment_status: "Completed",
          message: "Exit already completed for this booking.",
        });
        setBusy(false);
        return;
      }

      const exitDate = new Date();
      const exitStr = exitDate.toISOString();
      const entryDate = b.entry_time ? new Date(b.entry_time) : (b.created_at ? new Date(b.created_at) : exitDate);
      const durationMinutes = Math.max(1, Math.round((exitDate.getTime() - entryDate.getTime()) / 60000));
      const pricing = calcAmount(durationMinutes);

      // Mark session completed
      try {
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
      } catch (e) {
        console.warn("DB exit update skipped/failed:", e);
      }

      // Trigger Hardware Gate (Fire & Forget, DO NOT await 5-second servo cycle)
      triggerGate(b.booking_code, "EXIT").catch(() => {});
      hardwareLogger.log("Gate Opened", `Exit Verified: ${b.booking_code}`);

      // Auto-generate invoice
      try {
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
      } catch (invErr) {
        console.error("Invoice download exception:", invErr);
      }

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

  // Pay Bill Simulated Action
  async function handlePayBill() {
    if (!result || !result.booking_code) return;
    try {
      await supabase
        .from("bookings")
        .update({ payment_status: "paid" })
        .eq("booking_code", result.booking_code);
    } catch (e) {
      console.warn("Payment update error:", e);
    }
    toast.success(`Payment of ₹${result.amount} confirmed successfully!`);
    setResult((prev) => (prev ? { ...prev, payment_status: "Paid — Confirmed" } : null));
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

          {/* Import QR Image Card */}
          <div className="rounded-2xl border border-border bg-card p-5 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold flex items-center gap-2 text-base">
                <FileUp className="h-5 w-5 text-primary" /> Import QR Image
              </h3>
              {imagePreviewUrl && (
                <span className="rounded-full bg-primary/15 px-3 py-1 text-xs font-semibold text-primary">
                  Image Loaded
                </span>
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              Upload or drag & drop a Driver Entry or Exit QR screenshot/image file from your computer.
            </p>

            {/* Accessible Hidden File Input */}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/png, image/jpeg, image/jpg, image/webp"
              onChange={(e) => {
                if (e.target.files && e.target.files.length > 0) {
                  processSelectedImage(e.target.files[0]);
                }
              }}
              className="hidden"
              id="qr-image-upload-input"
            />

            {/* Drag & Drop Zone / Preview Container */}
            {!imagePreviewUrl ? (
              <div
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                tabIndex={0}
                role="button"
                aria-label="Upload Driver QR Image"
                onKeyDown={(e) => e.key === "Enter" && fileInputRef.current?.click()}
                className={`group cursor-pointer rounded-xl border-2 border-dashed p-6 text-center transition-all ${
                  isDragging
                    ? "border-primary bg-primary/10 scale-[0.99]"
                    : "border-border hover:border-primary/50 hover:bg-muted/40"
                }`}
              >
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary group-hover:scale-110 transition-transform">
                  <Upload className="h-6 w-6" />
                </div>
                <p className="mt-3 text-sm font-semibold">
                  Drag & Drop QR Image Here
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  or click to choose a file (PNG, JPG, WEBP)
                </p>
                <button
                  type="button"
                  className="mt-4 inline-flex items-center gap-2 rounded-lg bg-primary/10 px-4 py-2 text-xs font-bold text-primary hover:bg-primary/20 transition-all"
                >
                  <ImageIcon className="h-4 w-4" /> Choose QR Image
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                {/* Selected Image Preview Box */}
                <div className="relative overflow-hidden rounded-xl border border-border bg-muted/30 p-3 flex flex-col items-center justify-center min-h-[160px]">
                  <img
                    src={imagePreviewUrl}
                    alt="Selected Driver QR Code Preview"
                    className="max-h-48 rounded-lg object-contain border border-border shadow-xs"
                  />

                  {imageDecoding && (
                    <div className="absolute inset-0 bg-background/80 backdrop-blur-xs flex flex-col items-center justify-center gap-2">
                      <RefreshCw className="h-6 w-6 text-primary animate-spin" />
                      <span className="text-xs font-bold text-primary">Decoding QR Code...</span>
                    </div>
                  )}
                </div>

                {imageError && (
                  <div className="rounded-lg bg-destructive/10 p-3 text-xs text-destructive flex items-center justify-between">
                    <span>{imageError}</span>
                  </div>
                )}

                {/* Control Buttons */}
                <div className="flex gap-2">
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    disabled={imageDecoding || busy}
                    className="flex-1 rounded-xl border border-input bg-background py-2 text-xs font-semibold hover:bg-muted transition-all disabled:opacity-50"
                  >
                    Change Image
                  </button>
                  {imageFile && (
                    <button
                      onClick={() => processSelectedImage(imageFile)}
                      disabled={imageDecoding || busy}
                      className="flex-1 rounded-xl bg-primary py-2 text-xs font-bold text-primary-foreground hover:bg-primary/90 transition-all disabled:opacity-50 flex items-center justify-center gap-1.5"
                    >
                      <Sparkles className="h-3.5 w-3.5" /> Re-Decode QR
                    </button>
                  )}
                  <button
                    onClick={clearImage}
                    disabled={imageDecoding || busy}
                    className="rounded-xl border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs font-semibold text-destructive hover:bg-destructive/20 transition-all disabled:opacity-50"
                    title="Remove Image"
                  >
                    <X className="h-4 w-4" />
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

              {result.amount != null && result.amount > 0 && !result.payment_status.includes("Confirmed") && (
                <div className="pt-3">
                  <button
                    onClick={handlePayBill}
                    className="w-full rounded-xl bg-emerald-600 py-3 text-sm font-bold text-white shadow-md hover:bg-emerald-700 active:scale-95 transition-all"
                  >
                    PAY BILL — CONFIRM PAYMENT (₹{result.amount.toFixed(2)})
                  </button>
                </div>
              )}
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


