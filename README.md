# Smart Park Hub

Smart Parking Management System (Two Separate Portals)

Develop a production-ready, mobile-first Smart Parking Management System using React + TypeScript + Tailwind CSS + Supabase (Lovable Cloud).

This application MUST have two completely separate portals:

Driver/User Portal

Admin Portal

These portals must have different dashboards, different navigation menus, different permissions, and different features.

Users must never see Admin pages.

Admins must never see the User dashboard.

Implement strict Role-Based Access Control (RBAC).

Authentication

Create:

 Login

 Register

 Forgot Password

 Reset Password

 Logout

During registration ask:

 Full Name

 Email

 Password

 Confirm Password

 Vehicle Number (Driver only)

 Role

Role options:

 Driver

 Admin

Store role in database.

Login Flow

If role = Driver

Redirect automatically to

/driver/dashboard

If role = Admin

Redirect automatically to

/admin/dashboard

Never redirect both users to the same page.

DRIVER PORTAL

Routes

/driver/dashboard
/driver/bookings
/driver/history
/driver/profile

Only Drivers can access these pages.

Driver Dashboard

Display

 Welcome Driver

 Available Slots

 Occupied Slots

 Reserved Slots

Display parking slots visually.

Green

Available

Red

Occupied

Yellow

Reserved

Realtime updates.

Book Slot

Driver selects

Available Slot

Vehicle Number

Estimated Duration

Confirm Booking

Generate

Booking ID

My Bookings

Display

Booking ID

Slot

Vehicle Number

Booking Time

Booking Status

Entry Time

Exit Time

Duration

Amount

Payment Status

Entry QR

Button

Generate Entry QR

Generate QR containing

Booking ID

User ID

Slot

Vehicle Number

Timestamp

ENTRY

Display QR.

Exit QR

Button

Generate Exit QR

Generate QR containing

Booking ID

Timestamp

EXIT

Display QR.

Invoice

Automatically calculate

Entry Time

Exit Time

Duration

Hourly Rate

GST

Total Amount

Display invoice.

Button

Pay Now

Driver Profile

Update

Name

Phone

Vehicle Number

Password

ADMIN PORTAL

Routes

/admin/dashboard
/admin/live-monitor
/admin/scan
/admin/bookings
/admin/users
/admin/revenue
/admin/settings

Only Admins can access these pages.

Drivers must receive

Access Denied.

Admin Dashboard

Display cards

Total Slots

Available

Occupied

Reserved

Today's Revenue

Today's Bookings

Current Active Parking

Recent Activity

Sidebar

Dashboard

Live Monitor

QR Scanner

Bookings

Users

Revenue

Settings

Logout

Live Parking Monitor

Display every parking slot.

Example

A1

A2

A3

B1

B2

B3

Green

Available

Red

Occupied

Yellow

Reserved

Realtime updates.

Whenever ESP32 updates sensor status

Immediately update slot color.

QR Scanner

Route

/admin/scan

Open device camera.

Scan Driver Entry QR.

If QR Type = ENTRY

Validate booking.

Store Entry Time.

Change booking status

Parking Active

Send Gate Open signal.

If QR Type = EXIT

Store Exit Time.

Calculate parking duration.

Calculate amount.

Generate invoice.

Update payment.

Mark booking completed.

Send Gate Open signal.

Display

Booking ID

Driver Name

Vehicle Number

Slot

Entry Time

Exit Time

Duration

Amount

Payment Status

Booking Management

Search Booking

Approve

Cancel

View Details

Booking History

Filters

User Management

Display

Driver Name

Email

Vehicle Number

Booking History

Current Parking Status

Revenue Dashboard

Display

Today's Revenue

Weekly Revenue

Monthly Revenue

Average Parking Duration

Most Used Slot

Bar Charts

Pie Charts

ESP32 Integration

Create REST API

POST

/api/sensor/update

Body

{
  "sensor_id":"sensor_a1",
  "occupied":true
}

When occupied=true

Update slot

Occupied

Realtime dashboard updates.

Create another endpoint

POST /api/gate/open

Body

{
  "bookingId":"BK001",
  "type":"ENTRY"
}

Return

{
  "success":true
}

ESP32 opens servo.

Database

Tables

Users

Admins

ParkingSlots

Bookings

ParkingSessions

Payments

Notifications

SensorEvents

GateStatus

Route Protection

Drivers cannot access

/admin/*

Admins cannot access

/driver/*

If unauthorized

Show

403 Access Denied

UI

Modern commercial design

Material UI

Blue

White

Dark Gray

Rounded Cards

Glassmorphism

Dark Mode

Smooth Animations

Responsive

Professional Icons

Loading Skeletons

Toast Notifications

Final Verification (Mandatory)

Before finishing, verify ALL of the following:

✅ Driver Portal exists

✅ Admin Portal exists

✅ Driver Dashboard exists

✅ Admin Dashboard exists

✅ Driver Sidebar/Menu only contains Driver features

✅ Admin Sidebar only contains Admin features

✅ Driver cannot access Admin pages

✅ Admin cannot access Driver pages

✅ QR Generation works

✅ QR Scanner works

✅ Entry QR updates Entry Time

✅ Exit QR calculates bill

✅ ESP32 sensor API updates slot color

✅ Servo API exists

✅ Realtime slot monitoring works

Do not merge Driver and Admin dashboards into one interface. They must be two completely separate role-based portals with independent navigation, pages, and permissions.

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://spot-nav-pro.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/a7dbbd8e-2fb6-4501-a955-e925f3e8f469).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
