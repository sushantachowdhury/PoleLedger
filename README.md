# PoleLedger — Utility Pole Inspection & Maintenance App

PoleLedger is a web application for municipal and utility field crews to log streetlight and utility pole repairs, and for operations administrators to review, update, print, and export date-wise inspection reports.

## Key Features

### 1. Authentication & Role Routing (`LoginPage`)
- **Portal Selector**: Dedicated **Technician Login** and **Admin Login** entry tabs.
- **Credential Sign-In & Registration**: Email/password sign-in and new field technician registration (with full name and employee badge ID) plus email verification enforcement.
- **Google Sign-In**: One-click authentication via Firebase Google Sign-In (`signInWithPopup`).

### 2. Technician Field Portal (`TechnicianPortal`)
- **Pole Inspection Submission Form**: Record pole number, inspection date, location/feeder line, fault type (`Bulb / Lamp Failure`, `Ballast / Driver Fault`, `Wiring / Short Circuit`, `Photocell / Timer Fault`, `Fuse / MCB Tripped`, `Pole Structural Damage`, `Other`), part replaced (with quick-fill suggestions), repair status (`Resolved`, `Pending Follow-up`, `Escalated`), and field remarks.
- **Scoped Personal Reports**: Technicians can view **only their own** submitted reports in a searchable, filterable table and open a read-only service sheet drawer.
- **Demo Data, Print & PDF**: Load sample technician reports, print personal reports, or download individual or full PDF logs.

### 3. Admin Operations Console (`AdminPortal`)
- **Date-Wise Technician Reports**: View all technicians' inspection records grouped chronologically by date or in a flat table, with live KPI metrics and filters by date preset (`All Dates`, `Today`, `Last 7 Days`, `Pick Date`), technician, fault type, status, and keyword search.
- **View, Edit, Update & Delete**: Open any inspection record in the detail drawer to edit hardware details, repair status, remarks, or supervisor admin notes, or delete erroneous records with two-step confirmation.
- **Offline Exports & Printing**:
  - **Print All Reports**: Clean A4 landscape print layout (`@media print`).
  - **Download PDF**: Multi-page, date-grouped PDF report (`jsPDF` + `jspdf-autotable`) plus per-date and single-pole PDF exports.
  - **Download CSV**: UTF-8 BOM CSV export with spreadsheet formula-injection sanitization, available for filtered views or individual dates.
- **Team & Access Management**: Promote technicians to administrators or revoke admin privileges in `/users` and `/admins`.
- **Create Demo Reports**: Seed multi-day, multi-technician sample reports into Firestore for immediate testing and demonstration.

## Tech Stack

- **Frontend**: React 19, TypeScript, Vite, Tailwind CSS v4, Lucide Icons
- **Backend & Persistence**: Firebase Authentication, Cloud Firestore (named database configured via `firebase-applet-config.json`)
- **Exports**: `jspdf`, `jspdf-autotable`, browser print stylesheets, UTF-8 CSV generator
- **Security Linting**: ESLint with `@firebase/eslint-plugin-security-rules`

## Project Structure

```text
├── firebase-blueprint.json       # Entity schemas and Firestore collection map
├── firestore.rules               # Hardened Firestore security rules
├── security_spec.md              # Data invariants and adversarial test payloads
├── eslint.config.mjs             # ESLint config for Firestore security rules
├── index.html                    # Entry HTML & Google Fonts (Plus Jakarta Sans, DM Sans, JetBrains Mono)
└── src/
    ├── App.tsx                   # Auth state listener and role-based portal routing
    ├── firebase.ts               # Firebase SDK initialization, testConnection(), handleFirestoreError()
    ├── index.css                 # Tailwind v4 theme tokens & A4 print stylesheet
    ├── types/
    │   └── inspection.ts         # TypeScript interfaces, validation limits, and date helpers
    ├── services/
    │   ├── inspectionService.ts  # Firestore CRUD, scoped subscriptions, and demo report seeder
    │   └── userService.ts        # User profile hydration, admin grant checks, and role updates
    ├── utils/
    │   └── exportReports.ts      # CSV and jsPDF multi-page / single-sheet generators
    └── components/
        ├── BrandMark.tsx         # Geometric utility pole SVG mark
        ├── ErrorBoundary.tsx     # React error boundary for Firestore/runtime errors
        ├── LoginPage.tsx         # Split-screen credential & Google login + verification gate
        ├── TechnicianPortal.tsx  # Field inspection submission form & scoped personal reports
        ├── AdminPortal.tsx       # Date-wise review console, edits, exports & team access
        ├── InspectionDetailDrawer.tsx # Read/edit drawer with single-report PDF export
        ├── PrintableReportSheet.tsx   # A4 landscape print-only report masthead & tables
        └── StatusIndicator.tsx   # Accessible icon + text repair status indicator
```

## Scripts & Commands

```bash
# Start development server on port 3000
npm run dev

# TypeScript check
npm run lint

# Production build
npm run build

# Lint Firestore security rules
npx eslint firestore.rules
```

## Firebase Auth Configuration Notes

- **Google Sign-In** works immediately out of the box.
- **Email/Password Sign-In**: If Email/Password authentication has not yet been enabled in your Firebase project, enable it under **Firebase Console → Authentication → Sign-in method → Email/Password**. New email/password accounts must confirm their verification email before Firestore reads/writes are permitted by `firestore.rules`.
