# SMARTPARK: IOT SMART PARKING MANAGEMENT SYSTEM
## Comprehensive Master Technical & Architectural Report (AI Context Export)

> **Document Version**: 2.0.0  
> **Target Audience**: AI Engineering Assistants, Software Architects, IoT Hardware Engineers  
> **System Status**: Production-Ready, Database Migrated, Hardware Verified  
> **Primary Technology Stack**: React 19, TypeScript 5.8, Vite 8, TanStack Router & Start, Supabase (PostgreSQL + Auth + Realtime), Arduino UNO R3, Web Serial API  

---

## TABLE OF CONTENTS
1. [Executive Summary](#1-executive-summary)
2. [High-Level System Architecture](#2-high-level-system-architecture)
3. [Technology Stack & Dependencies](#3-technology-stack--dependencies)
4. [Hardware Subsystem & Circuit Specification](#4-hardware-subsystem--circuit-specification)
5. [Firmware Architecture & Serial Protocol](#5-firmware-architecture--serial-protocol)
6. [Web Serial API & Client Hardware Bridge](#6-web-serial-api--client-hardware-bridge)
7. [Database Architecture & Data Models (Supabase)](#7-database-architecture--data-models-supabase)
8. [Database Functions, Triggers & Row-Level Security (RLS)](#8-database-functions-triggers--row-level-security-rls)
9. [Authentication & Role-Based Access Control (RBAC)](#9-authentication--role-based-access-control-rbac)
10. [Driver Portal Workflows & Routing](#10-driver-portal-workflows--routing)
11. [Admin Portal Workflows & Routing](#11-admin-portal-workflows--routing)
12. [QR Code Lifecycle, Scanning & Verification Engine](#12-qr-code-lifecycle-scanning--verification-engine)
13. [Billing, Pricing Engine & Automated Invoicing](#13-billing-pricing-engine--automated-invoicing)
14. [Sandbox, Demo & Prototype Modes](#14-sandbox-demo--prototype-modes)
15. [File & Directory Map](#15-file--directory-map)
16. [Environment Variables & Deployment Guide](#16-environment-variables--deployment-guide)
17. [Complete System Verification Checklist](#17-complete-system-verification-checklist)

---

## 1. EXECUTIVE SUMMARY

**SmartPark** is an end-to-end Smart Parking Management System combining a modern web platform with physical IoT hardware. The system provides real-time parking slot monitoring, reservation, automated barrier gate access, touchless QR entry/exit workflows, dynamic billing with GST, and an administrative dashboard for operations and revenue analytics.

### Core Capabilities:
- **Physical Sensor Telemetry**: Ultrasonic distance sensors (HC-SR04) detect vehicle presence in parking bays and broadcast occupancy in real-time.
- **Physical Barrier Actuation**: SG90 Servo motor barrier gate opens automatically on validated entry and exit events with non-blocking timing.
- **Direct Browser-to-Hardware Bridge**: Uses the standard W3C Web Serial API (9600 Baud) allowing standard web browsers (Chrome/Edge/Opera) over HTTPS to communicate directly with USB-connected Arduino microcontrollers without external gateway proxies or local daemons.
- **Real-Time Data Synchronization**: PostgreSQL via Supabase Realtime WebSocket PubSub broadcasts slot status changes across all driver and admin sessions instantly.
- **Automated Billing Engine**: Time-based billing at ₹50/hour with ceiling rounding, 18% GST calculation, and instant client-side HTML/PDF invoice generation.

---

## 2. HIGH-LEVEL SYSTEM ARCHITECTURE

```
┌──────────────────────────────────────────────────────────────────────────┐
│                             BROWSER LAYER                                │
│                                                                          │
│  ┌────────────────────────┐                   ┌───────────────────────┐  │
│  │     Driver Portal      │                   │     Admin Portal      │  │
│  │ - Dashboard & Booking  │                   │ - Live Slot Monitor   │  │
│  │ - Active Booking & QR  │                   │ - QR & Manual Verify  │  │
│  │ - History & Invoices   │                   │ - Revenue & Analytics │  │
│  └───────────┬────────────┘                   └───────────┬───────────┘  │
│              │                                            │              │
│              └──────────────────────┬─────────────────────┘              │
│                                     ▼                                    │
│                 ┌──────────────────────────────────────┐                 │
│                 │   React 19 + TanStack Router (SPA)   │                 │
│                 │   - State Management (useSlots)      │                 │
│                 │   - Auth Guards (RoleGuard, RBAC)    │                 │
│                 │   - Pricing & Invoice Generation     │                 │
│                 └───────┬──────────────────────┬───────┘                 │
└─────────────────────────┼──────────────────────┼─────────────────────────┘
                          │                      │
       HTTPS / WebSocket  │                      │  Web Serial API (USB)
                          ▼                      ▼
┌──────────────────────────────────────┐  ┌────────────────────────────────┐
│         SUPABASE CLOUD / DB          │  │       LOCAL HARDWARE LAYER     │
│                                      │  │                                │
│ ├── Supabase Auth (JWT Sessions)     │  │ ┌────────────────────────────┐ │
│ ├── PostgreSQL Tables:               │  │ │     Arduino UNO (ATmega)   │ │
│ │   ├── parking_slots                │  │ │  (Firmware: 9600 Baud)     │ │
│ │   ├── bookings                     │  │ └──────┬───────────────┬─────┘ │
│ │   ├── profiles                     │  │        │               │       │
│ │   ├── user_roles                   │  │        ▼               ▼       │
│ │   └── sensor_events                │  │  [2x HC-SR04]     [SG90 Servo] │
│ ├── Realtime PubSub Channels         │  │  (Sensors A1/A2)  (Gate D9)    │
│ └── PL/pgSQL Triggers & Functions    │  │                                │
└──────────────────────────────────────┘  └────────────────────────────────┘
```

---

## 3. TECHNOLOGY STACK & DEPENDENCIES

### Core Frameworks & Runtime:
- **Language**: TypeScript 5.8.3
- **Frontend UI Framework**: React 19.2.0, React-DOM 19.2.0
- **Build Tool & Dev Server**: Vite 8.0.16 with `@vitejs/plugin-react` 5.2.0
- **Routing Engine**: `@tanstack/react-router` 1.170.16 with `@tanstack/react-start` 1.168.26 & `@tanstack/router-plugin` 1.168.18
- **Async Data Fetching**: `@tanstack/react-query` 5.101.1

### Styling & UI Primitives:
- **CSS Engine**: TailwindCSS 4.2.1 via `@tailwindcss/vite`
- **Component Primitives**: Radix UI (Dialog, Dropdown, Tabs, Accordion, Avatar, Checkbox, Select, Slider, Switch, Tooltip, Radio Group, Collapsible, Context Menu, Popover, Progress, Separator)
- **Icons**: `lucide-react` 0.575.0
- **Notifications**: `sonner` 2.0.7
- **Class Utilities**: `clsx` 2.1.1, `tailwind-merge` 3.5.0, `class-variance-authority` 0.7.1
- **Charts / Visualizations**: `recharts` 2.15.4

### Backend, Database & Auth:
- **Backend as a Service**: Supabase (`@supabase/supabase-js` 2.110.7)
- **Database**: PostgreSQL 15+ (Hosted on Supabase project `tomudhluyfcqrxlpdfis`)
- **Authentication**: Supabase Auth (JWT, Row Level Security)
- **Forms & Validation**: `react-hook-form` 7.71.2, `@hookform/resolvers` 5.2.2, `zod` 3.24.2

### QR & Scanning Engine:
- **QR Generation**: `qrcode` 1.5.4
- **Camera Scanning**: `html5-qrcode` 2.3.8
- **Canvas Multi-Pass Decoder**: `jsqr` 1.4.0

### Hardware & Firmware:
- **Microcontroller**: Arduino UNO R3 (ATmega328P)
- **Firmware Framework**: Arduino C++ (`Servo.h`)
- **Browser-Hardware Bridge**: W3C Web Serial API (`navigator.serial`)

---

## 4. HARDWARE SUBSYSTEM & CIRCUIT SPECIFICATION

### Pin Mapping Table:

| Component | Function | Arduino Pin | Pin Mode | Wire Color Convention |
| :--- | :--- | :--- | :--- | :--- |
| **HC-SR04 (Sensor A1)** | VCC | 5V Rail | Power | Red |
| | GND | GND Rail | Ground | Black |
| | TRIG | **Pin D2** | `OUTPUT` | Yellow |
| | ECHO | **Pin D3** | `INPUT` | Green |
| **HC-SR04 (Sensor A2)** | VCC | 5V Rail | Power | Red |
| | GND | GND Rail | Ground | Black |
| | TRIG | **Pin D4** | `OUTPUT` | Blue |
| | ECHO | **Pin D5** | `INPUT` | White |
| **SG90 Servo (Gate)** | VCC (Red) | 5V Rail | Power | Red |
| | GND (Brown) | GND Rail | Ground | Brown / Black |
| | PWM Signal (Orange)| **Pin D9** | `PWM OUTPUT` | Orange |

### Physical Sensing Logic & Thresholds:
- **Occupancy Distance Threshold**: $\le 10\text{ cm}$. When an object/vehicle is within 10 cm of the sensor face, the slot is marked `OCCUPIED`. When distance exceeds 10 cm, it is marked `FREE`.
- **Sampling Rate**: Every 200 ms non-blocking timer (`millis()`).
- **Debouncing**: Requires **2 consecutive matching readings** (`DEBOUNCE_THRESHOLD = 2`) before transmitting state transitions to prevent false positives from acoustic reflections.
- **Cross-Talk Prevention**: A 30 ms acoustic settlement delay is enforced between firing Sensor A1 and Sensor A2.

---

## 5. FIRMWARE ARCHITECTURE & SERIAL PROTOCOL

Firmware File: `arduino/smart_parking_hardware/smart_parking_hardware.ino`

### Protocol Specification (9600 Baud, 8-N-1):

#### 1. Inbound Commands (Web App $\rightarrow$ Arduino):
```
OPEN_GATE\n
```
- **Action**: Rotates SG90 Servo on Pin D9 from $0^\circ$ (Closed) to $90^\circ$ (Open).
- **Auto-Close**: Holds the gate open for exactly 5,000 ms (5 seconds) using a non-blocking timestamp comparison (`millis() - gateOpenedTimestamp >= 5000`), then returns to $0^\circ$.

#### 2. Outbound Telemetry (Arduino $\rightarrow$ Web App):
```
A1_OCCUPIED\n   -> Slot A1 changed state to Occupied
A1_FREE\n       -> Slot A1 changed state to Available
A2_OCCUPIED\n   -> Slot A2 changed state to Occupied
A2_FREE\n       -> Slot A2 changed state to Available
GATE_OPENED\n   -> Gate Servo rotated to 90 degrees
GATE_CLOSED\n   -> Gate Servo rotated back to 0 degrees
```

### Complete Firmware Implementation:

```cpp
#include <Servo.h>

const int TRIG_A1 = 2;
const int ECHO_A1 = 3;
const int TRIG_A2 = 4;
const int ECHO_A2 = 5;
const int SERVO_PIN = 9;

const int OCCUPIED_THRESHOLD_CM = 10;
const int SERVO_CLOSED_ANGLE = 0;
const int SERVO_OPEN_ANGLE = 90;
const unsigned long GATE_OPEN_DURATION_MS = 5000;
const unsigned long SENSOR_POLL_INTERVAL_MS = 200;

Servo gateServo;
bool isGateOpen = false;
unsigned long gateOpenedTimestamp = 0;
bool isA1Occupied = false;
bool isA2Occupied = false;
int a1DebounceCount = 0;
int a2DebounceCount = 0;
const int DEBOUNCE_THRESHOLD = 2;
unsigned long lastSensorPollTime = 0;
String inputBuffer = "";

long measureDistanceCM(int trigPin, int echoPin) {
  digitalWrite(trigPin, LOW);
  delayMicroseconds(2);
  digitalWrite(trigPin, HIGH);
  delayMicroseconds(10);
  digitalWrite(trigPin, LOW);
  long duration = pulseIn(echoPin, HIGH, 25000);
  if (duration == 0) return 999;
  return duration * 0.0343 / 2;
}

void triggerOpenGate() {
  gateServo.write(SERVO_OPEN_ANGLE);
  isGateOpen = true;
  gateOpenedTimestamp = millis();
  Serial.println("GATE_OPENED");
}

void updateGateStateMachine() {
  if (isGateOpen && (millis() - gateOpenedTimestamp >= GATE_OPEN_DURATION_MS)) {
    gateServo.write(SERVO_CLOSED_ANGLE);
    isGateOpen = false;
    Serial.println("GATE_CLOSED");
  }
}

void processCommand(String cmd) {
  cmd.trim();
  cmd.toUpperCase();
  if (cmd == "OPEN_GATE") triggerOpenGate();
}

void setup() {
  Serial.begin(9600);
  pinMode(TRIG_A1, OUTPUT);
  pinMode(ECHO_A1, INPUT);
  pinMode(TRIG_A2, OUTPUT);
  pinMode(ECHO_A2, INPUT);
  gateServo.attach(SERVO_PIN);
  gateServo.write(SERVO_CLOSED_ANGLE);
  delay(100);
  isA1Occupied = (measureDistanceCM(TRIG_A1, ECHO_A1) <= OCCUPIED_THRESHOLD_CM);
  delay(30);
  isA2Occupied = (measureDistanceCM(TRIG_A2, ECHO_A2) <= OCCUPIED_THRESHOLD_CM);
  Serial.println(isA1Occupied ? "A1_OCCUPIED" : "A1_FREE");
  Serial.println(isA2Occupied ? "A2_OCCUPIED" : "A2_FREE");
  inputBuffer.reserve(32);
}

void loop() {
  while (Serial.available() > 0) {
    char c = (char)Serial.read();
    if (c == '\n' || c == '\r') {
      if (inputBuffer.length() > 0) {
        processCommand(inputBuffer);
        inputBuffer = "";
      }
    } else {
      inputBuffer += c;
    }
  }
  updateGateStateMachine();
  unsigned long currentMillis = millis();
  if (currentMillis - lastSensorPollTime >= SENSOR_POLL_INTERVAL_MS) {
    lastSensorPollTime = currentMillis;
    long distA1 = measureDistanceCM(TRIG_A1, ECHO_A1);
    bool currentA1 = (distA1 <= OCCUPIED_THRESHOLD_CM);
    if (currentA1 != isA1Occupied) {
      if (++a1DebounceCount >= DEBOUNCE_THRESHOLD) {
        isA1Occupied = currentA1;
        a1DebounceCount = 0;
        Serial.println(isA1Occupied ? "A1_OCCUPIED" : "A1_FREE");
      }
    } else a1DebounceCount = 0;

    delay(30);

    long distA2 = measureDistanceCM(TRIG_A2, ECHO_A2);
    bool currentA2 = (distA2 <= OCCUPIED_THRESHOLD_CM);
    if (currentA2 != isA2Occupied) {
      if (++a2DebounceCount >= DEBOUNCE_THRESHOLD) {
        isA2Occupied = currentA2;
        a2DebounceCount = 0;
        Serial.println(isA2Occupied ? "A2_OCCUPIED" : "A2_FREE");
      }
    } else a2DebounceCount = 0;
  }
}
```

---

## 6. WEB SERIAL API & CLIENT HARDWARE BRIDGE

The browser integrates directly with the Arduino UNO using the W3C Web Serial API located in `src/lib/hardware/`.

### Architecture Components:

```
[ Arduino UNO ] <── USB Serial (9600 Baud) ──> [ SerialService.ts ]
                                                       │
                                     ┌─────────────────┴─────────────────┐
                                     ▼                                   ▼
                            [ ArduinoParser.ts ]                [ TextEncoder Writer ]
                                     │                          (Sequential Promise Queue)
                                     ▼                                   ▲
                           [ SensorListener.ts ]                         │
                                     │                           [ GateController.ts ]
                       ┌─────────────┴─────────────┐                     ▲
                       ▼                           ▼                     │
           [ Window CustomEvent ]       [ Supabase DB Sync ]     [ HardwareManager.ts ]
       ("smartpark:slot-sensor")        (parking_slots table)            │
                       │                                                 ▼
                       ▼                                         [ React UI Hooks ]
              [ useSlots() Hook ]                             (useHardwareManager())
```

### Module Responsibilities:
1. **`SerialService.ts`**:
   - Manages `navigator.serial` connection lifecycle.
   - Decodes stream buffers into lines using `TextDecoderStream`.
   - Queues outbound writes sequentially via an internal `writeQueue` (`Promise.resolve()`) preventing stream locking errors if multiple gate trigger calls occur simultaneously.
   - Automatically attempts reconnection on port hot-plug events (`navigator.serial.addEventListener("connect")`).
2. **`ArduinoParser.ts`**:
   - Regex-cleaned string parsing matching slot events (`A1_OCCUPIED`, `A1_FREE`, `A2_OCCUPIED`, `A2_FREE`) and gate transitions (`GATE_OPENED`, `GATE_CLOSED`).
3. **`GateController.ts`**:
   - Dispatches `"OPEN_GATE\n"` commands.
   - Operates in a non-blocking fire-and-forget manner: if hardware is offline, logs simulated actuation without interrupting UI state or throwing unhandled errors.
4. **`SensorListener.ts`**:
   - Dispatches `smartpark:slot-sensor` CustomEvents to the DOM window so all mounted React components update instantly.
   - Pushes updated status to the Supabase `parking_slots` table asynchronously.
5. **`HardwareManager.ts`**:
   - Central singleton facade exposing `connectHardware()`, `disconnectHardware()`, `triggerGate()`, and `useHardwareManager()` React hook.

---

## 7. DATABASE ARCHITECTURE & DATA MODELS (SUPABASE)

- **Supabase Project Reference**: `tomudhluyfcqrxlpdfis`
- **Database Engine**: PostgreSQL 15+

### Entity Relationship Diagram (ERD):

```
       ┌──────────────────────┐
       │     auth.users       │
       │ (Supabase Built-in)  │
       └──────────┬───────────┘
                  │ 1
                  │
      ┌───────────┴───────────┐
      │ 1                     │ 1
┌─────▼──────────┐     ┌──────▼─────────┐
│ public.profiles│     │public.user_roles│
│ - id (PK, UUID)│     │ - id (PK, UUID) │
│ - full_name    │     │ - user_id (FK)  │
│ - email        │     │ - role (enum)   │
│ - vehicle_no   │     └─────────────────┘
└────────────────┘
      │ 1
      │
      │ 0..*
┌─────▼────────────────────────────────────────┐         ┌───────────────────────┐
│              public.bookings                 │  *   1  │ public.parking_slots  │
│ - id (PK, UUID)                              ├─────────► - id (PK, UUID)       │
│ - booking_code (TEXT, UNIQUE)                │         │ - code (TEXT, UNIQUE) │
│ - user_id (FK -> auth.users)                 │         │ - sensor_id (TEXT)    │
│ - slot_id (FK -> parking_slots)              │         │ - status (enum)       │
│ - vehicle_number (TEXT)                      │         │ - hourly_rate (NUM)   │
│ - estimated_duration_hours (NUMERIC)         │         │ - updated_at (TS)     │
│ - status (reserved|active|completed|cancel)  │         └───────────────────────┘
│ - entry_time (TIMESTAMPTZ)                   │
│ - exit_time (TIMESTAMPTZ)                    │         ┌───────────────────────┐
│ - duration_minutes (INT)                     │         │ public.sensor_events  │
│ - amount (NUMERIC)                           │         │ - id (PK, UUID)       │
│ - payment_status (unpaid|paid)               │         │ - sensor_id (TEXT)    │
│ - exit_requested (BOOLEAN)                   │         │ - occupied (BOOLEAN)  │
│ - created_at / updated_at (TIMESTAMPTZ)      │         │ - created_at (TS)     │
└──────────────────────────────────────────────┘         └───────────────────────┘
```

### Table Definitions:

#### 1. `public.parking_slots`
| Column | Type | Constraints | Default / Notes |
| :--- | :--- | :--- | :--- |
| `id` | UUID | PRIMARY KEY | `gen_random_uuid()` |
| `code` | TEXT | UNIQUE, NOT NULL | e.g. `'A1'`, `'A2'`, `'B1'` |
| `sensor_id` | TEXT | UNIQUE | e.g. `'sensor_a1'` |
| `status` | `public.slot_status` | NOT NULL | `'available'` (`'available'`, `'occupied'`, `'reserved'`) |
| `hourly_rate`| NUMERIC(10,2) | NOT NULL | `50.00` |
| `updated_at` | TIMESTAMPTZ | NOT NULL | `now()` |

#### 2. `public.bookings`
| Column | Type | Constraints | Default / Notes |
| :--- | :--- | :--- | :--- |
| `id` | UUID | PRIMARY KEY | `gen_random_uuid()` |
| `booking_code`| TEXT | UNIQUE, NOT NULL | `'PK' \|\| to_char(now(), 'YYYY') \|\| '-' \|\| lpad(...)` |
| `user_id` | UUID | FK $\rightarrow$ `auth.users(id)` | CASCADE ON DELETE |
| `slot_id` | UUID | FK $\rightarrow$ `parking_slots(id)` | NOT NULL |
| `vehicle_number`| TEXT | NOT NULL | Driver vehicle registration |
| `estimated_duration_hours`| NUMERIC(6,2)| NOT NULL | `1` |
| `status` | `public.booking_status` | NOT NULL | `'reserved'` (`'reserved'`, `'active'`, `'completed'`, `'cancelled'`) |
| `entry_time` | TIMESTAMPTZ | NULLABLE | Timestamp when vehicle enters |
| `exit_time` | TIMESTAMPTZ | NULLABLE | Timestamp when vehicle exits |
| `duration_minutes`| INT | NULLABLE | Calculated parking duration in minutes |
| `amount` | NUMERIC(10,2)| NULLABLE | Total bill amount including GST |
| `payment_status`| `public.payment_status` | NOT NULL | `'unpaid'` (`'unpaid'`, `'paid'`) |
| `exit_requested`| BOOLEAN | NOT NULL | `false` (Driver exit flag) |
| `created_at` | TIMESTAMPTZ | NOT NULL | `now()` |
| `updated_at` | TIMESTAMPTZ | NOT NULL | `now()` |

#### 3. `public.profiles`
| Column | Type | Constraints | Notes |
| :--- | :--- | :--- | :--- |
| `id` | UUID | PRIMARY KEY, FK $\rightarrow$ `auth.users(id)` | User Auth ID |
| `full_name` | TEXT | NOT NULL | User's display name |
| `email` | TEXT | NOT NULL | User's email address |
| `phone` | TEXT | NULLABLE | Phone number |
| `vehicle_number`| TEXT | NULLABLE | Default vehicle number |
| `created_at` | TIMESTAMPTZ | NOT NULL | `now()` |
| `updated_at` | TIMESTAMPTZ | NOT NULL | `now()` |

#### 4. `public.user_roles`
| Column | Type | Constraints | Notes |
| :--- | :--- | :--- | :--- |
| `id` | UUID | PRIMARY KEY | `gen_random_uuid()` |
| `user_id` | UUID | FK $\rightarrow$ `auth.users(id)` | CASCADE ON DELETE |
| `role` | `public.app_role` | NOT NULL | `'driver'` or `'admin'` |

#### 5. `public.sensor_events`
| Column | Type | Constraints | Notes |
| :--- | :--- | :--- | :--- |
| `id` | UUID | PRIMARY KEY | `gen_random_uuid()` |
| `sensor_id` | TEXT | NOT NULL | Hardware sensor identifier |
| `occupied` | BOOLEAN | NOT NULL | Sensor occupancy state |
| `created_at` | TIMESTAMPTZ | NOT NULL | Timestamp of event |

---

## 8. DATABASE FUNCTIONS, TRIGGERS & ROW-LEVEL SECURITY (RLS)

### Database Triggers:

#### 1. Automatic User Profile & Role Creation (`handle_new_user`)
- Fires `AFTER INSERT ON auth.users`.
- Extracts `full_name`, `vehicle_number`, and `role` from Auth metadata (`raw_user_meta_data`).
- Inserts corresponding row into `public.profiles` and `public.user_roles` (defaults role to `'driver'`).

#### 2. Automatic Slot Status Sync (`sync_slot_status`)
- Fires `AFTER INSERT OR UPDATE ON public.bookings`.
- Automatically changes `parking_slots.status`:
  - When `booking.status = 'reserved'` $\rightarrow$ `parking_slots.status = 'reserved'`.
  - When `booking.status = 'active'` $\rightarrow$ `parking_slots.status = 'occupied'`.
  - When `booking.status = 'completed'` or `'cancelled'` $\rightarrow$ `parking_slots.status = 'available'`.

#### 3. Automatic Timestamps (`set_updated_at`)
- Sets `updated_at = now()` before updates on `profiles`, `bookings`, and `parking_slots`.

### Row Level Security (RLS) Policies:
- **`profiles`**:
  - `SELECT`: `id = auth.uid() OR public.has_role(auth.uid(), 'admin')`
  - `INSERT`: `id = auth.uid()`
  - `UPDATE`: `id = auth.uid()`
- **`user_roles`**:
  - `SELECT`: `user_id = auth.uid() OR public.has_role(auth.uid(), 'admin')`
- **`parking_slots`**:
  - `SELECT`: All authenticated users can view slots (`true`).
- **`bookings`**:
  - `SELECT`: `user_id = auth.uid() OR public.has_role(auth.uid(), 'admin')`
  - `INSERT`: `user_id = auth.uid()`
  - `UPDATE`: `user_id = auth.uid() OR public.has_role(auth.uid(), 'admin')`
- **`sensor_events`**:
  - `SELECT`: Admins only (`public.has_role(auth.uid(), 'admin')`).

---

## 9. AUTHENTICATION & ROLE-BASED ACCESS CONTROL (RBAC)

### Auth Implementation:
- Implemented in `src/routes/auth.tsx` using `@supabase/supabase-js`.
- Features: Email/password Sign In, Sign Up with role metadata, Password Reset request (`forgot-password.tsx`), and Password Update (`reset-password.tsx`).
- Access Guard: `src/components/RoleGuard.tsx` wraps protected routes and verifies user permissions via `src/lib/use-role.ts`. If unauthorized, redirects to `/auth` or `/access-denied`.

---

## 10. DRIVER PORTAL WORKFLOWS & ROUTING

All driver routes are located under `src/routes/_authenticated/driver.*`:

```
                           DRIVER JOURNEY
                                 │
                   ┌─────────────▼─────────────┐
                   │  /driver/dashboard        │
                   │  - View live slot status  │
                   │  - Select slot & duration │
                   │  - Confirm reservation   │
                   └─────────────┬─────────────┘
                                 │
                   ┌─────────────▼─────────────┐
                   │  /driver/bookings         │
                   │  - Displays Entry QR      │
                   │  - "Allow Entry" Action   │
                   └─────────────┬─────────────┘
                                 │ (Entry Approved)
                                 ▼
                     ┌───────────────────────┐
                     │ Gate Opens (5s)       │
                     │ Status -> "active"    │
                     │ Live Parking Ticker   │
                     └───────────┬───────────┘
                                 │
                   ┌─────────────▼─────────────┐
                   │  Driver Exits             │
                   │  - Displays Exit QR       │
                   │  - "Allow Exit" Action    │
                   └─────────────┬─────────────┘
                                 │ (Exit Approved)
                                 ▼
                     ┌───────────────────────┐
                     │ Gate Opens (5s)       │
                     │ Status -> "completed" │
                     │ Duration Calculated   │
                     │ Invoice Auto-Download │
                     └───────────┬───────────┘
                                 │
                   ┌─────────────▼─────────────┐
                   │  Payment Modal            │
                   │  - Cash / UPI / Card      │
                   │  - Confirm Payment        │
                   └─────────────┬─────────────┘
                                 │
                   ┌─────────────▼─────────────┐
                   │  /driver/history          │
                   │  - View past sessions     │
                   │  - Re-download invoices   │
                   └───────────────────────────┘
```

### Driver Route Inventory:
1. **`/driver/dashboard`**: Live slot grid, vehicle number selection, estimated duration input, booking confirmation.
2. **`/driver/bookings`**: Active booking monitor, dynamic Entry & Exit QR codes, interactive "Allow Entry" & "Allow Exit" actions, live duration timer, simulated payment dialog.
3. **`/driver/history`**: Table of completed parking sessions with total duration, amount paid, and invoice download buttons.
4. **`/driver/profile`**: View/edit driver profile, full name, email, and vehicle number.

---

## 11. ADMIN PORTAL WORKFLOWS & ROUTING

All admin routes are located under `src/routes/_authenticated/admin.*`:

### Admin Route Inventory:
1. **`/admin/dashboard`**: High-level telemetry, today's revenue, active parked vehicles, pending entries/exits, completed counts, recent activity log, and ESP32/Hardware status.
2. **`/admin/live-monitor`**: Real-time visual slot grid showing all 12 bays with color coding (`Available`, `Occupied`, `Reserved`).
3. **`/admin/scan`**: Comprehensive QR scanning station. Supports live camera scanning via `Html5Qrcode`, manual token entry, and a multi-pass canvas QR image decoder (`jsqr`).
4. **`/admin/manual-verify`**: Search bookings by code or vehicle number to approve entry/exit manually if a driver has camera issues.
5. **`/admin/active-parking`**: Live table of all vehicles currently parked on premises with running duration counters and direct exit approval controls.
6. **`/admin/bookings`**: Master ledger of all reservations across all statuses (`reserved`, `active`, `completed`, `cancelled`).
7. **`/admin/revenue`**: Financial dashboard with revenue totals, average session duration, hourly breakdowns, and historical trends.
8. **`/admin/users`**: List of all registered profiles and user roles.
9. **`/admin/sensor-sim`**: Hardware test bench allowing operators to simulate sensor occupancy flips (`A1`, `A2`) and trigger barrier gate cycles.
10. **`/admin/settings`**: System configurations and parking rates.

---

## 12. QR CODE LIFECYCLE, SCANNING & VERIFICATION ENGINE

### QR Code Generation:
- Generated in `src/routes/_authenticated/driver.bookings.tsx` using `qrcode`.
- Rendered as a Data URL in an interactive modal.
- Payload contains structured JSON metadata:
```json
{
  "bookingId": "PK2026-598878",
  "userId": "user-uuid",
  "slot": "A1",
  "vehicle": "TN01S1234",
  "timestamp": 1723380000000,
  "type": "ENTRY"
}
```

### QR Code Scanning & Decoding (`admin.scan.tsx`):
1. **Camera Scanner**: Integrated `Html5Qrcode` targeting the rear camera (`facingMode: "environment"`).
2. **Multi-Pass Client-Side Image Decoder**:
   - Custom canvas pipeline using `jsqr`.
   - Executes multi-scale passes (1x, 0.75x, 0.5x, 1.25x, 1.5x) with contrast/brightness adjustments to guarantee high-accuracy barcode decoding even from blurry or rotated phone screenshots.
3. **Token Extraction**:
   - Accepts either the full JSON object or raw booking code strings (e.g. `PK2026-598878`).
4. **Verification & Barrier Execution**:
   - **Entry Validation**: Validates `status == 'reserved'` $\rightarrow$ updates `status = 'active'`, `entry_time = now()`, frees or locks slot $\rightarrow$ triggers `triggerGate(code, "ENTRY")` $\rightarrow$ Arduino opens gate for 5 seconds.
   - **Exit Validation**: Validates `status == 'active'` $\rightarrow$ calculates duration & bill $\rightarrow$ updates `status = 'completed'`, `exit_time = now()`, `payment_status = 'paid'` $\rightarrow$ automatically triggers invoice download $\rightarrow$ triggers `triggerGate(code, "EXIT")` $\rightarrow$ Arduino opens gate for 5 seconds.

---

## 13. BILLING, PRICING ENGINE & AUTOMATED INVOICING

### Pricing Logic (`src/lib/pricing.ts`):
```typescript
export const HOURLY_RATE = 50; // ₹50 per hour
export const GST_RATE = 0.18;  // 18% Goods & Services Tax

export function calcAmount(minutes: number, hourlyRate = HOURLY_RATE) {
  const hours = Math.max(1, Math.ceil(minutes / 60)); // Ceil to nearest full hour (minimum 1 hour)
  const base = hours * hourlyRate;
  const gst = base * GST_RATE;
  const total = base + gst;
  return { hours, base, gst, total: Math.round(total * 100) / 100 };
}
```

### Invoice Generator (`src/lib/invoice.ts`):
- Creates a styled standalone HTML invoice blob and triggers automatic browser download: `invoice-PK2026-XXXXXX.html`.
- Includes driver name, vehicle number, slot code, formatted entry & exit timestamps, total duration, base rate breakdown, 18% GST itemization, and payment status.

---

## 14. SANDBOX, DEMO & PROTOTYPE MODES

The codebase features robust fallback mechanisms so full demos and testing can be conducted without physical hardware or live Supabase credentials:

1. **Demo Authentication (`src/lib/demo-auth.ts`)**:
   - Quick "Demo Driver" and "Demo Admin" buttons on `/auth`.
   - Stores role in `localStorage` (`smartpark_demo_role`).
   - Cleared automatically when real Supabase credentials are authenticated.
2. **Demo Booking Store (`src/lib/demo-booking-store.ts`)**:
   - Manages stateful mock bookings in `localStorage` (`smartpark_demo_bookings_store`).
   - Automatically synchronizes virtual sensor events and UI state.
3. **Prototype Mode (`src/lib/prototype-mode.ts`)**:
   - Allows gate operations and QR scans to proceed in pure simulation mode if no Arduino is connected to the USB port.

---

## 15. FILE & DIRECTORY MAP

```
Smartpark/
├── arduino/
│   └── smart_parking_hardware/
│       └── smart_parking_hardware.ino        # Production Arduino UNO C++ firmware
├── public/
│   └── favicon.ico                           # App favicon & public assets
├── src/
│   ├── components/
│   │   ├── HardwareStatusCard.tsx            # Live hardware connection widget & log viewer
│   │   ├── PortalShell.tsx                   # Responsive sidebar & header shell for portals
│   │   ├── PrototypeBadge.tsx                # Visual indicator for prototype simulation mode
│   │   ├── RoleGuard.tsx                     # Route guard enforcing driver/admin access
│   │   ├── SlotGrid.tsx                      # Visual 12-slot parking bay component & legend
│   │   └── ui/                               # Radix UI + Tailwind styled component primitives
│   ├── integrations/
│   │   └── supabase/
│   │       ├── client.ts                     # Supabase JS client configuration
│   │       └── types.ts                      # Generated TypeScript database types
│   ├── lib/
│   │   ├── hardware/
│   │   │   ├── ArduinoParser.ts              # Serial string event parser
│   │   │   ├── GateController.ts             # Non-blocking gate command dispatcher
│   │   │   ├── HardwareLogger.ts             # In-memory hardware event logger
│   │   │   ├── HardwareManager.ts            # Central hardware singleton & React hook
│   │   │   ├── SensorListener.ts             # Ultrasonic sensor event dispatcher & DB updater
│   │   │   └── SerialService.ts              # W3C Web Serial API driver with write queue
│   │   ├── demo-auth.ts                      # Sandbox demo user session manager
│   │   ├── demo-booking-store.ts             # LocalStorage mock booking engine
│   │   ├── invoice.ts                        # HTML/PDF invoice generator
│   │   ├── pricing.ts                        # ₹50/hr + 18% GST billing engine
│   │   ├── prototype-mode.ts                 # Hardware fallback simulation toggle
│   │   ├── use-role.ts                       # Supabase Auth role resolution hook
│   │   ├── use-slots.ts                      # Realtime slot state & sensor sync hook
│   │   └── utils.ts                          # Tailwind class merge helper
│   ├── routes/
│   │   ├── __root.tsx                        # Root application layout & query provider
│   │   ├── _authenticated/                   # Authenticated route tree
│   │   │   ├── admin.active-parking.tsx      # Admin active vehicles monitor
│   │   │   ├── admin.bookings.tsx            # Admin master booking ledger
│   │   │   ├── admin.dashboard.tsx           # Admin analytics dashboard
│   │   │   ├── admin.live-monitor.tsx        # Admin visual slot overview
│   │   │   ├── admin.manual-verify.tsx       # Admin manual token & vehicle verification
│   │   │   ├── admin.revenue.tsx             # Admin revenue analytics
│   │   │   ├── admin.scan.tsx                # Admin camera & canvas QR scanning station
│   │   │   ├── admin.sensor-sim.tsx          # Admin hardware sensor test bench
│   │   │   ├── admin.settings.tsx            # Admin system settings
│   │   │   ├── admin.users.tsx               # Admin user management
│   │   │   ├── driver.bookings.tsx           # Driver active booking, QR & entry/exit flow
│   │   │   ├── driver.dashboard.tsx          # Driver slot reservation dashboard
│   │   │   ├── driver.history.tsx            # Driver completed parking history & invoices
│   │   │   ├── driver.profile.tsx            # Driver profile settings
│   │   │   └── route.tsx                     # Authenticated layout route
│   │   ├── access-denied.tsx                 # 403 unauthorized page
│   │   ├── auth.tsx                          # Login & Sign Up page with demo buttons
│   │   ├── forgot-password.tsx               # Password reset request page
│   │   ├── index.tsx                         # Public landing page
│   │   └── reset-password.tsx                # Password update page
│   ├── routeTree.gen.ts                      # Generated TanStack Route Tree
│   ├── router.tsx                            # Router instance creation
│   └── styles.css                            # Global TailwindCSS styles & design tokens
├── supabase/
│   ├── config.toml                           # Supabase CLI project configuration
│   └── migrations/
│       ├── 20260720144351_...sql             # Initial schema: tables, enums, triggers, RLS
│       ├── 20260720144415_...sql             # Security hardening: function execution grants
│       ├── 20260724042147_...sql             # Booking format update & sync_slot_status trigger
│       └── 20260724042209_...sql             # Sync trigger security permission update
├── package.json                              # Project scripts & dependencies
├── tsconfig.json                             # TypeScript compiler configuration
└── vite.config.ts                            # Vite bundler & plugin configuration
```

---

## 16. ENVIRONMENT VARIABLES & DEPLOYMENT GUIDE

### Required Environment Variables:
Create or verify the `.env` file in the root directory:

```env
VITE_SUPABASE_URL=https://tomudhluyfcqrxlpdfis.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=<your_supabase_anon_publishable_key>
```

### Production Build:
```bash
# Install dependencies
npm install

# TypeScript type verification
npx tsc --noEmit

# Production Vite build
npm run build
```

### Vercel Deployment Settings:
- **Framework Preset**: Vite
- **Build Command**: `npm run build`
- **Output Directory**: `.output/public` or `dist`
- **Environment Variables**: Configure `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` in the Vercel Project Settings.
- **HTTPS Note**: Vercel provides HTTPS out of the box, which is required by modern browsers for Web Serial API access.

---

## 17. COMPLETE SYSTEM VERIFICATION CHECKLIST

| Subsystem | Verification Point | Expected Result | Status |
| :--- | :--- | :--- | :--- |
| **Auth** | Sign up / Sign in via Supabase | JWT created, role loaded from `user_roles` | Verified |
| **Auth** | Demo Driver / Demo Admin buttons | Instant sandbox session in `localStorage` | Verified |
| **Slots** | Realtime slot synchronization | UI reflects Postgres and sensor updates | Verified |
| **Booking** | Slot booking in Driver Portal | Creates row in `bookings`, sets slot `reserved` | Verified |
| **QR Engine** | Entry & Exit QR generation | Valid JSON QR rendered in modal | Verified |
| **QR Scanner**| Live camera scanning (`html5-qrcode`) | Decodes token and triggers entry/exit flow | Verified |
| **QR Scanner**| Multi-pass canvas decoder (`jsqr`) | Decodes uploaded QR images accurately | Verified |
| **Hardware** | Web Serial connection (9600 Baud) | Connects to Arduino UNO over USB COM port | Verified |
| **Telemetry**| Ultrasonic Sensors A1 & A2 | Transmits `A1_OCCUPIED`/`A1_FREE` on $\le 10\text{ cm}$ | Verified |
| **Actuator** | Servo Gate Trigger | Rotates $0^\circ \rightarrow 90^\circ$ for 5s, then returns to $0^\circ$ | Verified |
| **Concurrency**| Repeated Gate commands | Handled safely via `writeQueue` without stream locks | Verified |
| **Billing** | Pricing calculation (`calcAmount`) | ₹50/hr base + 18% GST calculated accurately | Verified |
| **Invoice** | Automatic Invoice Generator | Automatically downloads `invoice-PK...html` | Verified |
| **Type Safety**| TypeScript compilation (`tsc`) | 0 type errors | Verified |
| **Build** | Production bundle (`npm run build`) | Builds without warnings or errors | Verified |

---
*Report compiled and verified for production deployment and AI integration.*
