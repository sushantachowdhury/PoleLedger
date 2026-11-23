import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import {
  FaultType,
  InspectionFormValues,
  InspectionStatus,
  PoleInspection,
  UserProfile,
  validateInspectionValues,
  VALIDATION_LIMITS,
} from '../types/inspection';

function getRelativeDateString(daysAgo: number): string {
  const date = new Date();
  date.setDate(date.getDate() - daysAgo);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function sortInspectionsDescending(items: PoleInspection[]): PoleInspection[] {
  return [...items].sort((a, b) => {
    const dateCompare = b.inspectionDate.localeCompare(a.inspectionDate);
    if (dateCompare !== 0) return dateCompare;
    const aMs = a.createdAt && typeof a.createdAt.toMillis === 'function' ? a.createdAt.toMillis() : 0;
    const bMs = b.createdAt && typeof b.createdAt.toMillis === 'function' ? b.createdAt.toMillis() : 0;
    return bMs - aMs;
  });
}

export function subscribeTechnicianInspections(
  technicianId: string,
  onData: (items: PoleInspection[]) => void,
  onError: (error: Error) => void
): () => void {
  const path = 'inspections';
  const q = query(
    collection(db, 'inspections'),
    where('technicianId', '==', technicianId)
  );

  return onSnapshot(
    q,
    (snapshot) => {
      const records = snapshot.docs.map((d) => ({
        id: d.id,
        ...(d.data() as Omit<PoleInspection, 'id'>),
      }));
      onData(sortInspectionsDescending(records));
    },
    (error) => {
      try {
        handleFirestoreError(error, OperationType.LIST, path);
      } catch (wrapped) {
        onError(wrapped as Error);
      }
    }
  );
}

export function subscribeAllInspections(
  onData: (items: PoleInspection[]) => void,
  onError: (error: Error) => void
): () => void {
  const path = 'inspections';
  const q = query(collection(db, 'inspections'), orderBy('inspectionDate', 'desc'));

  return onSnapshot(
    q,
    (snapshot) => {
      const records = snapshot.docs.map((d) => ({
        id: d.id,
        ...(d.data() as Omit<PoleInspection, 'id'>),
      }));
      onData(sortInspectionsDescending(records));
    },
    (error) => {
      try {
        handleFirestoreError(error, OperationType.LIST, path);
      } catch (wrapped) {
        onError(wrapped as Error);
      }
    }
  );
}

export async function createPoleInspection(
  values: InspectionFormValues,
  technician: UserProfile
): Promise<string> {
  const validationError = validateInspectionValues(values);
  if (validationError) {
    throw new Error(validationError);
  }

  const payload = {
    poleNo: values.poleNo.trim().slice(0, VALIDATION_LIMITS.POLE_NO_MAX),
    inspectionDate: values.inspectionDate.trim(),
    location: values.location.trim().slice(0, VALIDATION_LIMITS.LOCATION_MAX),
    faultType: values.faultType,
    partReplaced: values.partReplaced.trim().slice(0, VALIDATION_LIMITS.PART_MAX),
    remarks: values.remarks.trim().slice(0, VALIDATION_LIMITS.REMARKS_MAX),
    status: values.status,
    technicianId: technician.uid,
    technicianName: technician.displayName.slice(0, VALIDATION_LIMITS.NAME_MAX),
    technicianBadge: technician.employeeId.slice(0, VALIDATION_LIMITS.BADGE_MAX),
    adminNotes: '',
    lastEditedByUid: '',
    lastEditedByName: '',
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  try {
    const ref = await addDoc(collection(db, 'inspections'), payload);
    return ref.id;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, 'inspections');
  }
}

export async function updatePoleInspectionByAdmin(
  inspectionId: string,
  values: InspectionFormValues,
  adminNotes: string,
  adminUser: UserProfile
): Promise<void> {
  const validationError = validateInspectionValues(values, adminNotes);
  if (validationError) {
    throw new Error(validationError);
  }

  const path = `inspections/${inspectionId}`;
  try {
    await updateDoc(doc(db, 'inspections', inspectionId), {
      poleNo: values.poleNo.trim().slice(0, VALIDATION_LIMITS.POLE_NO_MAX),
      inspectionDate: values.inspectionDate.trim(),
      location: values.location.trim().slice(0, VALIDATION_LIMITS.LOCATION_MAX),
      faultType: values.faultType,
      partReplaced: values.partReplaced.trim().slice(0, VALIDATION_LIMITS.PART_MAX),
      remarks: values.remarks.trim().slice(0, VALIDATION_LIMITS.REMARKS_MAX),
      status: values.status,
      adminNotes: adminNotes.trim().slice(0, VALIDATION_LIMITS.ADMIN_NOTES_MAX),
      lastEditedByUid: adminUser.uid,
      lastEditedByName: adminUser.displayName.slice(0, VALIDATION_LIMITS.NAME_MAX),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function deletePoleInspectionByAdmin(inspectionId: string): Promise<void> {
  const path = `inspections/${inspectionId}`;
  try {
    await deleteDoc(doc(db, 'inspections', inspectionId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

interface DemoSeedRecord {
  poleNo: string;
  daysAgo: number;
  location: string;
  faultType: FaultType;
  partReplaced: string;
  status: InspectionStatus;
  remarks: string;
  technicianId: string;
  technicianName: string;
  technicianBadge: string;
}

export async function seedDemoInspections(
  currentUser: UserProfile,
  isAdmin: boolean
): Promise<number> {
  const records: DemoSeedRecord[] = isAdmin
    ? [
        {
          poleNo: 'PL-1042',
          daysAgo: 0,
          location: 'Sector 4 Main Road · Feeder B',
          faultType: 'Bulb / Lamp Failure',
          partReplaced: '90W LED Luminaire',
          status: 'Resolved',
          remarks: 'Replaced burnt-out 90W LED luminaire head, cleaned terminal block, and verified 230V supply.',
          technicianId: currentUser.uid,
          technicianName: currentUser.displayName,
          technicianBadge: currentUser.employeeId,
        },
        {
          poleNo: 'PL-1048',
          daysAgo: 0,
          location: 'Station Approach Rd · Pole 14',
          faultType: 'Ballast / Driver Fault',
          partReplaced: 'LED Driver 24V',
          status: 'Resolved',
          remarks: 'Lamp flickering due to moisture ingress inside driver housing. Installed sealed IP67 driver.',
          technicianId: 'demo-tech-arjun',
          technicianName: 'Arjun Roy',
          technicianBadge: 'TECH-104',
        },
        {
          poleNo: 'PL-1055',
          daysAgo: 0,
          location: 'Market Cross · Feeder A',
          faultType: 'Fuse / MCB Tripped',
          partReplaced: 'MCB 16A',
          status: 'Pending Follow-up',
          remarks: 'Replaced faulty 16A MCB at junction box. Underground feeder cable insulation test scheduled.',
          technicianId: 'demo-tech-suman',
          technicianName: 'Suman Ghosh',
          technicianBadge: 'TECH-118',
        },
        {
          poleNo: 'PL-2011',
          daysAgo: 1,
          location: 'Lakeview Avenue · North',
          faultType: 'Photocell / Timer Fault',
          partReplaced: 'Photocell Sensor',
          status: 'Resolved',
          remarks: 'Daylight sensor stuck open causing daytime burn. Installed calibrated twilight photocell relay.',
          technicianId: 'demo-tech-priya',
          technicianName: 'Priya Nair',
          technicianBadge: 'TECH-205',
        },
        {
          poleNo: 'PL-2019',
          daysAgo: 1,
          location: 'Industrial Zone Gate 2',
          faultType: 'Wiring / Short Circuit',
          partReplaced: 'Armature Cable & Fuse',
          status: 'Resolved',
          remarks: 'Spliced and heat-shrunk damaged riser cable inside pole access hatch; replaced 10A HRC fuse.',
          technicianId: 'demo-tech-arjun',
          technicianName: 'Arjun Roy',
          technicianBadge: 'TECH-104',
        },
        {
          poleNo: 'PL-2034',
          daysAgo: 2,
          location: 'Civic Hospital Frontage',
          faultType: 'Pole Structural Damage',
          partReplaced: 'Base Hatch & Anchor Bolt',
          status: 'Escalated',
          remarks: 'Minor vehicle scrape bent inspection door and loosened 1 anchor nut. Requires civil rig inspection.',
          technicianId: 'demo-tech-suman',
          technicianName: 'Suman Ghosh',
          technicianBadge: 'TECH-118',
        },
        {
          poleNo: 'PL-3004',
          daysAgo: 2,
          location: 'Park Street Junction · West',
          faultType: 'Bulb / Lamp Failure',
          partReplaced: '60W LED Bulb',
          status: 'Resolved',
          remarks: 'Routine night patrol check flagged dim luminaire. Replaced 60W LED bulb and tested lux output.',
          technicianId: currentUser.uid,
          technicianName: currentUser.displayName,
          technicianBadge: currentUser.employeeId,
        },
        {
          poleNo: 'PL-3012',
          daysAgo: 3,
          location: 'Ring Road Overpass · Span 6',
          faultType: 'Bulb / Lamp Failure',
          partReplaced: '90W LED Luminaire',
          status: 'Resolved',
          remarks: 'High-mast twin-arm luminaire unit B replaced after surge outage; both arms operational.',
          technicianId: 'demo-tech-priya',
          technicianName: 'Priya Nair',
          technicianBadge: 'TECH-205',
        },
      ]
    : [
        {
          poleNo: 'PL-1042',
          daysAgo: 0,
          location: 'Sector 4 Main Road · Feeder B',
          faultType: 'Bulb / Lamp Failure',
          partReplaced: '90W LED Luminaire',
          status: 'Resolved',
          remarks: 'Replaced burnt-out 90W LED bulb and verified earthing continuity and 230V supply.',
          technicianId: currentUser.uid,
          technicianName: currentUser.displayName,
          technicianBadge: currentUser.employeeId,
        },
        {
          poleNo: 'PL-1061',
          daysAgo: 1,
          location: 'Station Approach Rd · Pole 9',
          faultType: 'Photocell / Timer Fault',
          partReplaced: 'Photocell Sensor',
          status: 'Resolved',
          remarks: 'Replaced malfunctioning dusk-to-dawn photocell unit and checked relay switching.',
          technicianId: currentUser.uid,
          technicianName: currentUser.displayName,
          technicianBadge: currentUser.employeeId,
        },
        {
          poleNo: 'PL-1074',
          daysAgo: 2,
          location: 'Market Cross · Feeder A',
          faultType: 'Fuse / MCB Tripped',
          partReplaced: 'MCB 16A',
          status: 'Pending Follow-up',
          remarks: 'Installed new 16A MCB at base junction box; feeder line load check recommended.',
          technicianId: currentUser.uid,
          technicianName: currentUser.displayName,
          technicianBadge: currentUser.employeeId,
        },
      ];

  const batch = writeBatch(db);
  for (const item of records) {
    const docRef = doc(collection(db, 'inspections'));
    batch.set(docRef, {
      poleNo: item.poleNo,
      inspectionDate: getRelativeDateString(item.daysAgo),
      location: item.location,
      faultType: item.faultType,
      partReplaced: item.partReplaced,
      remarks: item.remarks,
      status: item.status,
      technicianId: item.technicianId,
      technicianName: item.technicianName.slice(0, VALIDATION_LIMITS.NAME_MAX),
      technicianBadge: item.technicianBadge.slice(0, VALIDATION_LIMITS.BADGE_MAX),
      adminNotes: '',
      lastEditedByUid: '',
      lastEditedByName: '',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  }

  try {
    await batch.commit();
    return records.length;
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, 'inspections');
  }
}
