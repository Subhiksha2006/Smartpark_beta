import { hardwareLogger } from "./HardwareLogger";

export type ConnectionStatus = "connected" | "offline" | "connecting";

type StatusListener = (status: ConnectionStatus) => void;
type LineListener = (line: string) => void;

class SerialService {
  private port: any | null = null;
  private reader: any | null = null;
  private writer: any | null = null;
  private status: ConnectionStatus = "offline";
  private statusListeners: Set<StatusListener> = new Set();
  private lineListeners: Set<LineListener> = new Set();
  private keepReading = false;
  private baudRate = 9600;

  constructor() {
    if (typeof window !== "undefined" && "serial" in navigator) {
      (navigator as any).serial.addEventListener("connect", () => {
        this.autoReconnect();
      });
      (navigator as any).serial.addEventListener("disconnect", () => {
        this.handleDisconnect();
      });
    }
  }

  public getStatus(): ConnectionStatus {
    return this.status;
  }

  public subscribeStatus(listener: StatusListener): () => void {
    this.statusListeners.add(listener);
    listener(this.status);
    return () => {
      this.statusListeners.delete(listener);
    };
  }

  public subscribeLine(listener: LineListener): () => void {
    this.lineListeners.add(listener);
    return () => {
      this.lineListeners.delete(listener);
    };
  }

  private setStatus(newStatus: ConnectionStatus) {
    if (this.status !== newStatus) {
      this.status = newStatus;
      if (newStatus === "connected") {
        hardwareLogger.log("Hardware Connected");
      } else if (newStatus === "offline") {
        hardwareLogger.log("Hardware Disconnected");
      }
      this.statusListeners.forEach((l) => l(newStatus));
    }
  }

  public async autoReconnect(): Promise<boolean> {
    if (typeof window === "undefined" || !("serial" in navigator)) {
      return false;
    }
    try {
      const ports = await (navigator as any).serial.getPorts();
      if (ports.length > 0) {
        return await this.openPort(ports[0]);
      }
    } catch {
      // Auto-reconnect failed silently, fallback to offline status
    }
    return false;
  }

  public async connectHardware(): Promise<boolean> {
    if (typeof window === "undefined" || !("serial" in navigator)) {
      throw new Error("Web Serial API is not supported in this browser. Please use Chrome, Edge, or Opera.");
    }
    try {
      this.setStatus("connecting");
      const port = await (navigator as any).serial.requestPort();
      return await this.openPort(port);
    } catch (e: any) {
      this.setStatus("offline");
      throw new Error(e?.message || "Failed to connect serial port");
    }
  }

  private async openPort(port: any): Promise<boolean> {
    try {
      this.port = port;
      await this.port.open({ baudRate: this.baudRate });
      this.setStatus("connected");
      this.startReading();
      return true;
    } catch (e: any) {
      this.setStatus("offline");
      console.error("Error opening serial port:", e);
      return false;
    }
  }

  private async startReading() {
    if (!this.port || !this.port.readable) return;
    this.keepReading = true;
    const textDecoder = new TextDecoderStream();
    const readableStreamClosed = this.port.readable.pipeTo(textDecoder.writable);
    const reader = textDecoder.readable.getReader();
    this.reader = reader;

    let buffer = "";
    try {
      while (this.keepReading) {
        const { value, done } = await reader.read();
        if (done) {
          break;
        }
        if (value) {
          buffer += value;
          const lines = buffer.split(/\r?\n/);
          buffer = lines.pop() || "";
          for (const line of lines) {
            const trimmed = line.trim();
            if (trimmed) {
              this.lineListeners.forEach((l) => l(trimmed));
            }
          }
        }
      }
    } catch (err) {
      console.warn("Serial read error:", err);
      this.handleDisconnect();
    } finally {
      reader.releaseLock();
    }
  }

  public async sendSerialCommand(command: string): Promise<boolean> {
    if (!this.port || !this.port.writable || this.status !== "connected") {
      return false;
    }
    try {
      const textEncoder = new TextEncoderStream();
      const writableStreamClosed = textEncoder.readable.pipeTo(this.port.writable);
      const writer = textEncoder.writable.getWriter();
      await writer.write(command.endsWith("\n") ? command : command + "\n");
      writer.releaseLock();
      return true;
    } catch (e) {
      console.error("Error sending command to serial port:", e);
      return false;
    }
  }

  public async disconnectHardware(): Promise<void> {
    this.keepReading = false;
    if (this.reader) {
      try {
        await this.reader.cancel();
      } catch {}
      this.reader = null;
    }
    if (this.port) {
      try {
        await this.port.close();
      } catch {}
      this.port = null;
    }
    this.setStatus("offline");
  }

  private handleDisconnect() {
    this.disconnectHardware();
  }
}

export const serialService = new SerialService();
