/*
  =============================================================================
  Smart Parking Management System - Production Arduino UNO Hardware Firmware
  =============================================================================
  Hardware Configuration:
    - Arduino UNO
    - HC-SR04 Sensor 1 (Slot A1): TRIG -> D2, ECHO -> D3
    - HC-SR04 Sensor 2 (Slot A2): TRIG -> D4, ECHO -> D5
    - SG90 Servo Motor (Gate)   : Signal -> D9
    - Serial Communication      : 9600 Baud via USB

  Serial Protocol (9600 Baud):
    - Sent to Web Application:
        "A1_OCCUPIED"  - Vehicle detected in Slot A1 (distance <= 10cm)
        "A1_FREE"      - Slot A1 is empty (distance > 10cm)
        "A2_OCCUPIED"  - Vehicle detected in Slot A2 (distance <= 10cm)
        "A2_FREE"      - Slot A2 is empty (distance > 10cm)
        "GATE_OPENED"  - Gate servo rotated 0° -> 90°
        "GATE_CLOSED"  - Gate servo returned 90° -> 0°
    - Received from Web Application:
        "OPEN_GATE"    - Command to open gate servo for 5 seconds
  =============================================================================
*/

#include <Servo.h>

// -----------------------------------------------------------------------------
// Pin Configurations
// -----------------------------------------------------------------------------
const int TRIG_A1 = 2;
const int ECHO_A1 = 3;

const int TRIG_A2 = 4;
const int ECHO_A2 = 5;

const int SERVO_PIN = 9;

// -----------------------------------------------------------------------------
// Operating Parameters
// -----------------------------------------------------------------------------
const int OCCUPIED_THRESHOLD_CM = 10;
const int SERVO_CLOSED_ANGLE = 0;
const int SERVO_OPEN_ANGLE = 90;
const unsigned long GATE_OPEN_DURATION_MS = 5000; // 5 seconds
const unsigned long SENSOR_POLL_INTERVAL_MS = 200; // Poll sensors every 200ms

// -----------------------------------------------------------------------------
// Global Objects & State Variables
// -----------------------------------------------------------------------------
Servo gateServo;

// Gate State Machine
bool isGateOpen = false;
unsigned long gateOpenedTimestamp = 0;

// Occupancy State Tracking
bool isA1Occupied = false;
bool isA2Occupied = false;

// Debouncing / Filtering Counters
int a1DebounceCount = 0;
int a2DebounceCount = 0;
const int DEBOUNCE_THRESHOLD = 2; // Require 2 consecutive matching reads

// Non-blocking timer for sensor sampling
unsigned long lastSensorPollTime = 0;

// Buffer for incoming serial stream
String inputBuffer = "";

// -----------------------------------------------------------------------------
// Helper: Ultrasonic Distance Measurement with Safe Timeout
// -----------------------------------------------------------------------------
long measureDistanceCM(int trigPin, int echoPin) {
  digitalWrite(trigPin, LOW);
  delayMicroseconds(2);
  digitalWrite(trigPin, HIGH);
  delayMicroseconds(10);
  digitalWrite(trigPin, LOW);

  // pulseIn with 25,000 microseconds timeout (~4.3m max distance)
  long duration = pulseIn(echoPin, HIGH, 25000);
  if (duration == 0) {
    return 999; // Return large distance on timeout/no echo
  }
  return duration * 0.0343 / 2;
}

// -----------------------------------------------------------------------------
// Helper: Gate Control Functions
// -----------------------------------------------------------------------------
void triggerOpenGate() {
  gateServo.write(SERVO_OPEN_ANGLE);
  isGateOpen = true;
  gateOpenedTimestamp = millis();
  Serial.println("GATE_OPENED");
}

void updateGateStateMachine() {
  if (isGateOpen) {
    if (millis() - gateOpenedTimestamp >= GATE_OPEN_DURATION_MS) {
      gateServo.write(SERVO_CLOSED_ANGLE);
      isGateOpen = false;
      Serial.println("GATE_CLOSED");
    }
  }
}

// -----------------------------------------------------------------------------
// Helper: Process Incoming Command from Serial
// -----------------------------------------------------------------------------
void processCommand(String cmd) {
  cmd.trim();
  cmd.toUpperCase();
  if (cmd == "OPEN_GATE") {
    triggerOpenGate();
  }
}

// -----------------------------------------------------------------------------
// Setup Phase
// -----------------------------------------------------------------------------
void setup() {
  Serial.begin(9600);

  // Configure HC-SR04 Sensor Pins
  pinMode(TRIG_A1, OUTPUT);
  pinMode(ECHO_A1, INPUT);
  pinMode(TRIG_A2, OUTPUT);
  pinMode(ECHO_A2, INPUT);

  // Configure Servo Pin and Set Initial Position to 0 degrees
  gateServo.attach(SERVO_PIN);
  gateServo.write(SERVO_CLOSED_ANGLE);

  // Allow sensors to stabilize
  delay(100);

  // Initial read for Slot A1
  long distA1 = measureDistanceCM(TRIG_A1, ECHO_A1);
  isA1Occupied = (distA1 <= OCCUPIED_THRESHOLD_CM);

  delay(30); // Prevent acoustic cross-talk

  // Initial read for Slot A2
  long distA2 = measureDistanceCM(TRIG_A2, ECHO_A2);
  isA2Occupied = (distA2 <= OCCUPIED_THRESHOLD_CM);

  // Send initial slot telemetry on startup
  Serial.println(isA1Occupied ? "A1_OCCUPIED" : "A1_FREE");
  Serial.println(isA2Occupied ? "A2_OCCUPIED" : "A2_FREE");

  inputBuffer.reserve(32);
}

// -----------------------------------------------------------------------------
// Main Non-blocking Loop
// -----------------------------------------------------------------------------
void loop() {
  // 1. Process Web Serial commands from browser
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

  // 2. Maintain Gate State Machine (handles automatic closing after 5 seconds)
  updateGateStateMachine();

  // 3. Periodically sample ultrasonic sensors
  unsigned long currentMillis = millis();
  if (currentMillis - lastSensorPollTime >= SENSOR_POLL_INTERVAL_MS) {
    lastSensorPollTime = currentMillis;

    // --- Sample Slot A1 ---
    long distA1 = measureDistanceCM(TRIG_A1, ECHO_A1);
    bool currentA1Raw = (distA1 <= OCCUPIED_THRESHOLD_CM);
    if (currentA1Raw != isA1Occupied) {
      a1DebounceCount++;
      if (a1DebounceCount >= DEBOUNCE_THRESHOLD) {
        isA1Occupied = currentA1Raw;
        a1DebounceCount = 0;
        Serial.println(isA1Occupied ? "A1_OCCUPIED" : "A1_FREE");
      }
    } else {
      a1DebounceCount = 0;
    }

    // Acoustic cross-talk protection gap
    delay(30);

    // --- Sample Slot A2 ---
    long distA2 = measureDistanceCM(TRIG_A2, ECHO_A2);
    bool currentA2Raw = (distA2 <= OCCUPIED_THRESHOLD_CM);
    if (currentA2Raw != isA2Occupied) {
      a2DebounceCount++;
      if (a2DebounceCount >= DEBOUNCE_THRESHOLD) {
        isA2Occupied = currentA2Raw;
        a2DebounceCount = 0;
        Serial.println(isA2Occupied ? "A2_OCCUPIED" : "A2_FREE");
      }
    } else {
      a2DebounceCount = 0;
    }
  }
}
