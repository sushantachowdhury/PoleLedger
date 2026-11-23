import { Timestamp } from 'firebase/firestore';

export const FAULT_TYPES = [
  'Bulb / Lamp Failure',
  'Ballast / Driver Fault',
  'Wiring / Short Circuit',
  'Photocell / Timer Fault',
  'Fuse / MCB Tripped',
  'Pole Structural Damage',
  'Other',
] as const;

export type FaultType = (typeof FAULT_TYPES)[number];

export const INSPECTION_STATUSES = [
  'Resolved',
  'Pending Follow-up',
  'Escalated',
] as const;

export type InspectionStatus = (typeof INSPECTION_STATUSES)[number];

export type UserRole = 'technician' | 'admin';
export type PortalMode = 'technician' | 'admin';

// Synchronized verbatim with firebase-blueprint.json & firestore.rules
export const VALIDATION_LIMITS = {
  POLE_NO_MIN: 2,
  POLE_NO_MAX: 40,
  POLE_NO_REGEX: /^[a-zA-Z0-9_\-/.# ]+$/,
  DATE_REGEX: /^[0-9]{4}-[0-9]{2}-[0-9]{2}$/,
  LOCATION_MAX: 120,
  PART_MIN: 1,
  PART_MAX: 100,
  REMARKS_MIN: 1,
  REMARKS_MAX: 1000,
  ADMIN_NOTES_MAX: 500,
  NAME_MIN: 2,
  NAME_MAX: 80,
  BADGE_MIN: 2,
  BADGE_MAX: 32,
  BADGE_REGEX: /^[a-zA-Z0-9_-]+$/,
} as const;

export interface UserProfile {
  uid: string;
  displayName: string;
  email: string;
  employeeId: string;
  role: UserRole;
  createdAt?: Timestamp | null;
  updatedAt?: Timestamp | null;
}

export interface PoleInspection {
  id: string;
  poleNo: string;
  inspectionDate: string;
  location: string;
  faultType: FaultType;
  partReplaced: string;
  remarks: string;
  status: InspectionStatus;
  technicianId: string;
  technicianName: string;
  technicianBadge: string;
  adminNotes: string;
  lastEditedByUid: string;
  lastEditedByName: string;
  createdAt?: Timestamp | null;
  updatedAt?: Timestamp | null;
}

export interface InspectionFormValues {
  poleNo: string;
  inspectionDate: string;
  location: string;
  faultType: FaultType;
  partReplaced: string;
  remarks: string;
  status: InspectionStatus;
}

export function getTodayDateString(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function formatReadableDate(dateStr: string): string {
  if (!VALIDATION_LIMITS.DATE_REGEX.test(dateStr)) return dateStr;
  const [year, month, day] = dateStr.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  return date.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export function formatTimestamp(ts?: Timestamp | null): string {
  if (!ts || typeof ts.toDate !== 'function') return 'Just now';
  return ts.toDate().toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function validateInspectionValues(
  values: InspectionFormValues,
  adminNotes = ''
): string | null {
  const poleNo = values.poleNo.trim();
  const location = values.location.trim();
  const partReplaced = values.partReplaced.trim();
  const remarks = values.remarks.trim();
  const notes = adminNotes.trim();

  if (poleNo.length < VALIDATION_LIMITS.POLE_NO_MIN || poleNo.length > VALIDATION_LIMITS.POLE_NO_MAX) {
    return `Pole number must be between ${VALIDATION_LIMITS.POLE_NO_MIN} and ${VALIDATION_LIMITS.POLE_NO_MAX} characters.`;
  }
  if (!VALIDATION_LIMITS.POLE_NO_REGEX.test(poleNo)) {
    return 'Pole number may only contain letters, numbers, spaces, hyphens, slashes, dots, and #.';
  }
  if (!VALIDATION_LIMITS.DATE_REGEX.test(values.inspectionDate)) {
    return 'Please select a valid inspection date (YYYY-MM-DD).';
  }
  if (location.length > VALIDATION_LIMITS.LOCATION_MAX) {
    return `Location must be ${VALIDATION_LIMITS.LOCATION_MAX} characters or fewer.`;
  }
  if (!FAULT_TYPES.includes(values.faultType)) {
    return 'Please select a valid fault type.';
  }
  if (partReplaced.length < VALIDATION_LIMITS.PART_MIN || partReplaced.length > VALIDATION_LIMITS.PART_MAX) {
    return `Part replaced must be between ${VALIDATION_LIMITS.PART_MIN} and ${VALIDATION_LIMITS.PART_MAX} characters.`;
  }
  if (remarks.length < VALIDATION_LIMITS.REMARKS_MIN || remarks.length > VALIDATION_LIMITS.REMARKS_MAX) {
    return `Description / remark must be between ${VALIDATION_LIMITS.REMARKS_MIN} and ${VALIDATION_LIMITS.REMARKS_MAX} characters.`;
  }
  if (!INSPECTION_STATUSES.includes(values.status)) {
    return 'Please select a valid repair status.';
  }
  if (notes.length > VALIDATION_LIMITS.ADMIN_NOTES_MAX) {
    return `Admin notes must be ${VALIDATION_LIMITS.ADMIN_NOTES_MAX} characters or fewer.`;
  }
  return null;
}

export function deriveDefaultBadge(uid: string, email: string): string {
  const prefix = email.split('@')[0]?.replace(/[^a-zA-Z0-9]/g, '').slice(0, 6).toUpperCase() || 'TECH';
  const suffix = uid.replace(/[^a-zA-Z0-9]/g, '').slice(0, 4).toUpperCase() || '01';
  return `${prefix}-${suffix}`.slice(0, VALIDATION_LIMITS.BADGE_MAX);
}
