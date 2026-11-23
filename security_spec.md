# Security Specification — PoleLedger Firestore Rules

## 1. Data Invariants
1. **Strict Identity Ownership**: A technician can only create `/inspections/{inspectionId}` documents where `technicianId == request.auth.uid`, and can only read/list documents where `resource.data.technicianId == request.auth.uid`.
2. **Technician Read-Only Post-Submission**: Technicians cannot edit or delete `/inspections/{inspectionId}` after submission; only verified administrators (`isAdmin()`) can edit, update, or delete inspection reports.
3. **No Self-Assigned Admin Privileges**: A non-admin user creating `/users/{userId}` can only set `role: "technician"`, and cannot modify `role` on update or write to `/admins/{userId}`.
4. **PII Isolation**: `/users/{userId}` contains `email` (PII) and is strictly readable only by `isOwner(userId)` or `isAdmin()`. No blanket `isSignedIn()` read/list is permitted.
5. **Email Verification Mandate**: All reads and writes require `request.auth != null && request.auth.token.email_verified == true`.
6. **Temporal Integrity & Immutability**: `createdAt` and `updatedAt` must equal `request.time`; `technicianId` and `createdAt` are immutable once created.

## 2. The "Dirty Dozen" Adversarial Payloads
1. **Unauthenticated Inspection Create**: `auth = null`, `POST /inspections/insp-01` -> `PERMISSION_DENIED`.
2. **Unverified Email Admin Spoof**: `auth = { uid: "atk1", token: { email: "sushanta.careerjob@gmail.com", email_verified: false } }`, `GET /inspections` -> `PERMISSION_DENIED`.
3. **Technician Impersonation on Create**: `auth = { uid: "techA", email_verified: true }`, `CREATE /inspections/insp-02` with `technicianId: "techB"` -> `PERMISSION_DENIED`.
4. **Cross-Technician Report Snooping (Get)**: `auth = { uid: "techA", email_verified: true }`, `GET /inspections/techB_report` -> `PERMISSION_DENIED`.
5. **Blanket List Scraping by Technician**: `auth = { uid: "techA", email_verified: true }`, `LIST /inspections` without `technicianId == "techA"` constraint -> `PERMISSION_DENIED`.
6. **Technician Post-Submit Tampering**: `auth = { uid: "techA", email_verified: true }`, `UPDATE /inspections/techA_report` -> `PERMISSION_DENIED`.
7. **Self-Assigned Admin Escalation in Profile**: `auth = { uid: "techA", email_verified: true }`, `CREATE /users/techA` with `role: "admin"` -> `PERMISSION_DENIED`.
8. **Shadow/Ghost Field Injection**: `auth = { uid: "techA", email_verified: true }`, `CREATE /inspections/insp-03` with valid fields + `isApprovedOverride: true` -> `PERMISSION_DENIED`.
9. **1MB String Resource Poisoning**: `auth = { uid: "techA", email_verified: true }`, `CREATE /inspections/insp-04` with `remarks` of 5,000 chars or `inspectionId` of 500 chars -> `PERMISSION_DENIED`.
10. **Client Timestamp Forgery**: `auth = { uid: "techA", email_verified: true }`, `CREATE /inspections/insp-05` with `createdAt` != `request.time` -> `PERMISSION_DENIED`.
11. **PII Profile Leak**: `auth = { uid: "techA", email_verified: true }`, `GET /users/techB` -> `PERMISSION_DENIED`.
12. **Technician Writing Admin Notes on Create**: `auth = { uid: "techA", email_verified: true }`, `CREATE /inspections/insp-06` with `adminNotes: "Pre-approved"` -> `PERMISSION_DENIED`.
