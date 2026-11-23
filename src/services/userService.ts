import { User } from 'firebase/auth';
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  writeBatch,
} from 'firebase/firestore';
import {
  BOOTSTRAPPED_ADMIN_EMAIL,
  db,
  handleFirestoreError,
  OperationType,
} from '../firebase';
import {
  deriveDefaultBadge,
  UserProfile,
  UserRole,
  VALIDATION_LIMITS,
} from '../types/inspection';

function sanitizeDisplayName(raw: string | null | undefined, email: string): string {
  const base = (raw || email.split('@')[0] || 'Field Technician').trim();
  const safe = base.slice(0, VALIDATION_LIMITS.NAME_MAX);
  return safe.length >= VALIDATION_LIMITS.NAME_MIN ? safe : 'Technician';
}

function sanitizeBadge(raw: string | undefined, uid: string, email: string): string {
  const cleaned = (raw || '').trim().replace(/[^a-zA-Z0-9_-]/g, '');
  if (
    cleaned.length >= VALIDATION_LIMITS.BADGE_MIN &&
    cleaned.length <= VALIDATION_LIMITS.BADGE_MAX
  ) {
    return cleaned.toUpperCase();
  }
  return deriveDefaultBadge(uid, email);
}

export async function ensureUserProfile(
  user: User,
  overrides?: { displayName?: string; employeeId?: string }
): Promise<{ profile: UserProfile; isAdmin: boolean }> {
  const userPath = `users/${user.uid}`;
  const adminPath = `admins/${user.uid}`;
  const email = (user.email || '').trim().toLowerCase();
  const isBootstrappedAdmin =
    user.emailVerified && email === BOOTSTRAPPED_ADMIN_EMAIL.toLowerCase();

  let hasAdminDoc = false;
  try {
    const adminSnap = await getDoc(doc(db, 'admins', user.uid));
    hasAdminDoc = adminSnap.exists();
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, adminPath);
  }

  if (isBootstrappedAdmin && !hasAdminDoc) {
    try {
      await setDoc(doc(db, 'admins', user.uid), {
        uid: user.uid,
        grantedBy: user.uid,
        createdAt: serverTimestamp(),
      });
      hasAdminDoc = true;
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, adminPath);
    }
  }

  let existingSnap;
  try {
    existingSnap = await getDoc(doc(db, 'users', user.uid));
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, userPath);
  }

  const isAdmin = isBootstrappedAdmin || hasAdminDoc;

  if (!existingSnap.exists()) {
    const displayName = sanitizeDisplayName(
      overrides?.displayName || user.displayName,
      email
    );
    const employeeId = sanitizeBadge(overrides?.employeeId, user.uid, email);
    const role: UserRole = isAdmin ? 'admin' : 'technician';

    try {
      await setDoc(doc(db, 'users', user.uid), {
        uid: user.uid,
        displayName,
        email,
        employeeId,
        role,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, userPath);
    }

    return {
      profile: {
        uid: user.uid,
        displayName,
        email,
        employeeId,
        role,
      },
      isAdmin,
    };
  }

  const data = existingSnap.data() as UserProfile;
  const effectiveAdmin = isAdmin || data.role === 'admin';

  // Ensure bootstrapped admin profile stays aligned with admin role
  if (isBootstrappedAdmin && data.role !== 'admin') {
    try {
      await updateDoc(doc(db, 'users', user.uid), {
        role: 'admin',
        updatedAt: serverTimestamp(),
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, userPath);
    }
    return {
      profile: { ...data, role: 'admin' },
      isAdmin: true,
    };
  }

  return {
    profile: { ...data, role: effectiveAdmin ? 'admin' : 'technician' },
    isAdmin: effectiveAdmin,
  };
}

export async function updateOwnProfile(
  uid: string,
  displayName: string,
  employeeId: string
): Promise<void> {
  const cleanName = displayName.trim().slice(0, VALIDATION_LIMITS.NAME_MAX);
  const cleanBadge = employeeId
    .trim()
    .toUpperCase()
    .replace(/[^a-zA-Z0-9_-]/g, '')
    .slice(0, VALIDATION_LIMITS.BADGE_MAX);

  if (cleanName.length < VALIDATION_LIMITS.NAME_MIN) {
    throw new Error(`Name must be at least ${VALIDATION_LIMITS.NAME_MIN} characters.`);
  }
  if (cleanBadge.length < VALIDATION_LIMITS.BADGE_MIN) {
    throw new Error(`Badge ID must be at least ${VALIDATION_LIMITS.BADGE_MIN} characters.`);
  }

  const path = `users/${uid}`;
  try {
    await updateDoc(doc(db, 'users', uid), {
      displayName: cleanName,
      employeeId: cleanBadge,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export function subscribeAllUsers(
  onData: (users: UserProfile[]) => void,
  onError: (err: Error) => void
): () => void {
  const path = 'users';
  const q = query(collection(db, 'users'), orderBy('displayName', 'asc'));

  return onSnapshot(
    q,
    (snapshot) => {
      const list = snapshot.docs.map((d) => d.data() as UserProfile);
      onData(list);
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

export async function setUserAdminRole(
  targetUser: UserProfile,
  makeAdmin: boolean,
  actingAdminUid: string
): Promise<void> {
  const batch = writeBatch(db);
  const userRef = doc(db, 'users', targetUser.uid);
  const adminRef = doc(db, 'admins', targetUser.uid);

  batch.update(userRef, {
    role: makeAdmin ? 'admin' : 'technician',
    updatedAt: serverTimestamp(),
  });

  if (makeAdmin) {
    batch.set(adminRef, {
      uid: targetUser.uid,
      grantedBy: actingAdminUid,
      createdAt: serverTimestamp(),
    });
  } else {
    batch.delete(adminRef);
  }

  try {
    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `users/${targetUser.uid}`);
  }
}

export async function removeAdminGrant(uid: string): Promise<void> {
  try {
    await deleteDoc(doc(db, 'admins', uid));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `admins/${uid}`);
  }
}
