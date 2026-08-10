/*
  =============================================================================
  Smart Parking Management System - Arduino UNO Hardware Firmware
  =============================================================================
  Hardware:
    - Arduino UNO
    - Ultrasonic Sensor A1: Trig -> D2, Echo -> D3 (Parking Slot A1)
    - Ultrasonic Sensor A2: Trig -> D4, Echo -> D5 (Parking Slot A2)
    - SG90 Servo Motor: Signal -> D9 (Entry/Exit Gate)

  Serial Protocol (9600 Baud):
    - Sent to Browser:
        "A1_OCCUPIED"  - Vehicle detected in Slot A1 (distance <= 10cm)
        "A1_FREE"      - Slot A1 is empty (distance > 10cm)
        "A2_OCCUPIED"  - Vehicle detected in Slot A2 (distance <= 10cm)
        "A2_FREE"      - Slot A2 is empty (distance > 10cm)
        "GATE_OPENED"  - Gate servo rotated 0 deg -> 90 deg
        "GATE_CLOSED"  - Gate servo returned 90 deg -> 0 deg
    - Received from Browser:
        "OPEN_GATE"    - Command to open servo for 5 seconds and close
  =============================================================================
*/

#include <Servo.h>

// Pin Definitions
const int TRIG_A1 = 2;
const int ECHO_A1 = 3;

const int TRIG_A2 = 4;
const int ECHO_A2 = 5;

const int SERVO_PIN = 9;

// Distance Threshold (in centimeters)
const int OCCUPIED_THRESHOLD_CM = 10;

// Servo Angles
const int SERVO_CLOSED_ANGLE = 0;
const int SERVO_OPEN_ANGLE = 90;

// Servo object
Servo gateServo;

// Occupancy State Tracking to avoid unnecessary repetitive serial spam
bool isA1Occupied = false;
bool isA2Occupied = false;

// Non-blocking timing for sensor readings
unsigned long lastSensorReadTime = 0;
const unsigned long SENSOR_INTERVAL = 300; // Check every 300ms

// Buffer for incoming serial commands
String inputBuffer = "";

// Helper function to measure distance in CM from an HC-SR04 sensor
long measureDistanceCM(int trigPin, int echoPin) {
  digitalWrite(trigPin, LOW);
  delayMicroseconds(2);
  digitalWrite(trigPin, HIGH);
  delayMicroseconds(10);
  digitalWrite(trigPin, LOW);

  long duration = pulseIn(echoPin, HIGH, 30000); // 30ms timeout (~5 meters max)
  if (duration == 0) {
    return 999; // Return large distance on timeout
  }
  return duration * 0.0343 / 2;
}

void setup() {
  // Initialize Serial at 9600 Baud
  Serial.begin(9600);

  // Configure Sensor Pins
  pinMode(TRIG_A1, OUTPUT);
  pinMode(ECHO_A1, INPUT);
  pinMode(TRIG_A2, OUTPUT);
  pinMode(ECHO_A2, INPUT);

  // Configure Servo
  gateServo.attach(SERVO_PIN);
  gateServo.write(SERVO_CLOSED_ANGLE);

  // Initial read to establish starting state
  delay(100);
  long distA1 = measureDistanceCM(TRIG_A1, ECHO_A1);
  long distA2 = measureDistanceCM(TRIG_A2, ECHO_A2);

  isA1Occupied = (distA1 <= OCCUPIED_THRESHOLD_CM);
  isA2Occupied = (distA2 <= OCCUPIED_THRESHOLD_CM);

  // Send initial telemetry status
  Serial.println(isA1Occupied ? "A1_OCCUPIED" : "A1_FREE");
  Serial.println(isA2Occupied ? "A2_OCCUPIED" : "A2_FREE");
}

void loop() {
  // 1. Process incoming Serial commands from Web Application
  while (Serial.available() > 0) {
    char c = (char)Serial.read();
    if (c == '\n' || c == '\r') {
      inputBuffer.trim();
      if (inputBuffer.length() > 0) {
        processCommand(inputBuffer);
        inputBuffer = "";
      }
    } else {
      inputBuffer += c;
    }
  }

  // 2. Periodically check ultrasonic sensors (non-blocking)
  unsigned long currentMillis = millis();
  if (currentMillis - lastSensorReadTime >= SENSOR_INTERVAL) {
    lastSensorReadTime = currentMillis;

    // Check Sensor A1
    long distA1 = measureDistanceCM(TRIG_A1, ECHO_A1);
    bool currentA1Occupied = (distA1 <= OCCUPIED_THRESHOLD_CM);
    if (currentA1Occupied != isA1Occupied) {
      isA1Occupied = currentA1Occupied;
      Serial.println(isA1Occupied ? "A1_OCCUPIED" : "A1_FREE");
    }

    delay(20); // Brief delay between adjacent sensor triggers to prevent acoustic echo cross-talk

    // Check Sensor A2
    long distA2 = measureDistanceCM(TRIG_A2, ECHO_A2);
    bool currentA2Occupied = (distA2 <= OCCUPIED_THRESHOLD_CM);
    if (currentA2Occupied != isA2Occupied) {
      isA2Occupied = currentA2Occupied;
      Serial.println(isA2Occupied ? "A2_OCCUPIED" : "A2_FREE");
    }
  }
}

// Process command received from browser serial service
void processCommand(String cmd) {
  cmd.toUpperCase();
  if (cmd == "OPEN_GATE") {
    // Open Servo
    gateServo.write(SERVO_OPEN_ANGLE);
    Serial.println("GATE_OPENED");

    // Hold open for 5 seconds
    delay(5000);

    // Close Servo
    gateServo.write(SERVO_CLOSED_ANGLE);
    Serial.println("GATE_CLOSED");
  }
}
