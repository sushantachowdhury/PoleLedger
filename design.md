# Design Document — PoleLedger

## 1. System Overview

PoleLedger is a role-separated field operations platform designed around two distinct operational workflows:

1. **Field Technician Workflow**: Fast mobile- and desktop-friendly logging of utility pole maintenance (e.g., bulb replacements, driver swaps, fuse resets, structural flags) paired with a strictly scoped, read-only history of the technician's own submissions.
2. **Operations Administrator Workflow**: Centralized, date-wise auditing of all technician submissions with live filtering, inline record editing and status updates, team role administration, browser printing, and offline PDF/CSV exports.

---

## 2. Architecture & Data Flow

```text
┌─────────────────────────────────────────────────────────────────────┐
│                          Firebase Auth                              │
│          (Google Sign-In / Email+Password + Email Verified)         │
└───────────────────────────────┬─────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────────┐
│                     src/App.tsx (Auth Router)                       │
│   ensureUserProfile() -> checks /admins/{uid} & /users/{uid}        │
└──────────────┬───────────────────────────────────────┬──────────────┘
               │ role: technician                      │ role: admin
               ▼                                       ▼
┌──────────────────────────────┐       ┌──────────────────────────────┐
│      TechnicianPortal        │       │         AdminPortal          │
│ - Inspection Submission Form │       │ - Date-Wise Grouped Ledger   │
│ - Scoped My Reports Table    │       │ - View / Edit / Delete Drawer│
│ - Read-Only Detail Drawer    │       │ - Team & Access Management   │
│ - Demo Seed / Print / PDF    │       │ - Demo Seed / Print / PDF/CSV│
└──────────────┬───────────────┘       └──────────────┬───────────────┘
               │                                      │
               └──────────────────┬───────────────────┘
                                  ▼
┌─────────────────────────────────────────────────────────────────────┐
│               Cloud Firestore (Named Database)                      │
│   /users/{userId}   |   /admins/{userId}   |   /inspections/{id}    │
│           Enforced by hardened rules in firestore.rules             │
└─────────────────────────────────────────────────────────────────────┘
```

### Query Index Strategy
To avoid runtime failures from unprovisioned composite indexes in Firestore:
- **Technician queries** filter with a single equality predicate (`where('technicianId', '==', uid)`) and sort chronologically (`inspectionDate` descending, `createdAt` descending) in memory.
- **Admin queries** order by a single field (`orderBy('inspectionDate', 'desc')`) and apply secondary sorting and multi-attribute filtering client-side.

---

## 3. Data Model (`firebase-blueprint.json`)

### `/users/{userId}` (`UserProfile`)
Stores user identity, employee badge, and role. Isolated as PII (readable only by the owner or an admin).
- `uid` (`string`, `<= 128`, `^[a-zA-Z0-9_\-]+$`)
- `displayName` (`string`, `2..80`)
- `email` (`string`, `3..160`)
- `employeeId` (`string`, `2..32`, `^[a-zA-Z0-9_\-]+$`)
- `role` (`'technician' | 'admin'`)
- `createdAt`, `updatedAt` (`timestamp`, validated against `request.time`)

### `/admins/{userId}` (`AdminGrant`)
Trusted lookup table for admin privileges evaluated in security rules via `exists()`.
- `uid` (`string`, matches document ID)
- `grantedBy` (`string`, UID of granting admin)
- `createdAt` (`timestamp`)

### `/inspections/{inspectionId}` (`PoleInspection`)
- `poleNo` (`string`, `2..40`, `^[a-zA-Z0-9_\-/.# ]+$`)
- `inspectionDate` (`string`, `YYYY-MM-DD`)
- `location` (`string`, `0..120`)
- `faultType` (`enum` of 7 standardized electrical/structural fault categories)
- `partReplaced` (`string`, `1..100`)
- `remarks` (`string`, `1..1000`)
- `status` (`'Resolved' | 'Pending Follow-up' | 'Escalated'`)
- `technicianId`, `technicianName`, `technicianBadge` (immutable creator attribution)
- `adminNotes` (`string`, `0..500`, must be `''` on creation; writable only by admins)
- `lastEditedByUid`, `lastEditedByName` (audit attribution updated on admin edits)
- `createdAt`, `updatedAt` (`timestamp`)

---

## 4. Security Architecture (`firestore.rules`)

1. **Default-Deny Safety Net**: All unmatched paths are explicitly denied (`allow read, write: if false`).
2. **Verified Identity Gate**: Every read and write requires `request.auth != null && request.auth.token.email_verified == true`.
3. **No Self-Assigned Admin Privileges**: Non-admin user profile creation is restricted to `role == 'technician'`. Only existing admins or the bootstrapped verified admin email can write `/admins/{uid}` or promote users.
4. **Scoped Technician Access**:
   - `get` and `list` on `/inspections` require `resource.data.technicianId == request.auth.uid` (unless `isAdmin()`).
   - `create` validates all required/allowed keys (`hasAll` + `hasOnly`), string length bounds, regex patterns, server timestamps, and empty `adminNotes` / `lastEditedBy*`.
   - `update` and `delete` on `/inspections` are restricted exclusively to `isAdmin()`.
5. **PII Isolation**: `/users/{userId}` prohibits blanket signed-in reads/lists; only the profile owner or an admin can read user documents.
6. **Denial-of-Wallet Evaluation Order**: Authentication and static schema validation (`isValidId`, `isValidInspection`) execute before relational `exists()` lookups.

---

## 5. Visual & UI Design System

### Color & Surface Discipline (60-30-10)
- **Primary Canvas (60%)**: Cool slate off-white (`#F1F5F9` / `bg-slate-100/70`) providing clean separation for elevated surfaces.
- **Structural Surfaces (30%)**: Flat white cards (`#FFFFFF`) with hairline borders (`border-slate-200/90`), single-level subtle shadow (`shadow-[0_1px_2px_rgba(15,23,42,0.04)]`), and dark Slate-950 (`#020617`) navigation sidebars.
- **Accent & Semantic States (10%)**:
  - Primary interactive actions in crisp Slate-900 (`#0F172A`) and Utility Sky (`#0284C7`).
  - Repair states always pair color with an explicit icon and text label (`Resolved` in Emerald, `Pending Follow-up` in Amber, `Escalated` in Red).

### Typography (2+1 System)
- **Display & Headings**: `Plus Jakarta Sans` (500, 600, 700) with `text-wrap: balance`.
- **Body & Forms**: `DM Sans` (400, 500, 600).
- **Tabular Data & IDs**: `JetBrains Mono` with `font-variant-numeric: tabular-nums` for pole numbers, dates, badge IDs, and KPI counters.

### Anti-Clutter Rules
- **Zero-Pill Metadata**: Dates, technician badges, and fault classifications render as clean unboxed text separated by typographic middle dots (`·`) rather than rounded pill badges.
- **Zero Card Nesting**: Content sections separate via whitespace and 1px hairline dividers without nested bordered cards or thick left accent stripes.

---

## 6. Print & Offline Export Design

- **Browser Printing (`PrintableReportSheet.tsx` + `src/index.css`)**:
  - `@media print` configures A4 landscape pages (`margin: 12mm`), hides navigation sidebars/toolbars (`.no-print`), and reveals a print-only masthead and full-width date-grouped tables (`.print-only`) showing unclipped Remarks and Admin Notes.
- **PDF Export (`src/utils/exportReports.ts`)**:
  - Multi-page landscape PDFs via `jsPDF` + `jspdf-autotable` with a Slate-900 header banner, summary counts, date-section subheaders, status color coding, and page footers.
  - Individual portrait **Pole Service Sheet** PDFs available from `InspectionDetailDrawer`.
- **CSV Export (`src/utils/exportReports.ts`)**:
  - Prepends UTF-8 BOM (`\uFEFF`) for Excel compatibility and neutralizes leading formula characters (`=`, `+`, `-`, `@`, `\t`, `\r`) to prevent spreadsheet formula injection.
