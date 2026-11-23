import { useCallback, useEffect, useRef, useState } from 'react';
import { onAuthStateChanged, signOut, User } from 'firebase/auth';
import { auth } from './firebase';
import { ensureUserProfile } from './services/userService';
import { PortalMode, UserProfile } from './types/inspection';
import { ErrorBoundary } from './components/ErrorBoundary';
import { LoginPage } from './components/LoginPage';
import { TechnicianPortal } from './components/TechnicianPortal';
import { AdminPortal } from './components/AdminPortal';

function PoleLedgerApp() {
  const [authReady, setAuthReady] = useState(false);
  const [firebaseUser, setFirebaseUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [selectedPortal, setSelectedPortal] = useState<PortalMode>('technician');
  const [activeView, setActiveView] = useState<PortalMode>('technician');
  const [accessNotice, setAccessNotice] = useState<string | null>(null);
  const [profileLoading, setProfileLoading] = useState(false);

  const registrationDraftRef = useRef<{ displayName: string; employeeId: string } | null>(null);
  const selectedPortalRef = useRef<PortalMode>(selectedPortal);
  selectedPortalRef.current = selectedPortal;

  const hydrateUserProfile = useCallback(
    async (user: User, portalChoice: PortalMode) => {
      setProfileLoading(true);
      try {
        const draft = registrationDraftRef.current || undefined;
        registrationDraftRef.current = null;
        const result = await ensureUserProfile(user, draft);
        setProfile(result.profile);
        setIsAdmin(result.isAdmin);

        if (portalChoice === 'admin') {
          if (result.isAdmin) {
            setActiveView('admin');
            setAccessNotice(null);
          } else {
            setActiveView('technician');
            setAccessNotice(
              'Signed in as Technician. Your account does not have Administrator privileges yet, so you have been directed to the Technician Portal.'
            );
          }
        } else {
          setActiveView('technician');
          setAccessNotice(null);
        }
      } finally {
        setProfileLoading(false);
      }
    },
    []
  );

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setFirebaseUser(user);
      if (user && user.emailVerified) {
        await hydrateUserProfile(user, selectedPortalRef.current);
      } else {
        setProfile(null);
        setIsAdmin(false);
      }
      setAuthReady(true);
    });
    return () => unsubscribe();
  }, [hydrateUserProfile]);

  const handleSignOut = async () => {
    setAccessNotice(null);
    await signOut(auth);
  };

  if (!authReady || (firebaseUser && firebaseUser.emailVerified && profileLoading && !profile)) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-slate-300 border-t-slate-900 rounded-full animate-spin" />
          <p className="text-xs font-medium text-slate-500">Loading workspace...</p>
        </div>
      </div>
    );
  }

  // Unauthenticated or unverified email -> Login / Verification page
  if (!firebaseUser || !firebaseUser.emailVerified || !profile) {
    return (
      <LoginPage
        selectedPortal={selectedPortal}
        onSelectPortal={setSelectedPortal}
        pendingVerificationUser={
          firebaseUser && !firebaseUser.emailVerified ? firebaseUser : null
        }
        onVerificationComplete={async () => {
          if (auth.currentUser && auth.currentUser.emailVerified) {
            setFirebaseUser(auth.currentUser);
            await hydrateUserProfile(auth.currentUser, selectedPortalRef.current);
          }
        }}
        onRegistrationDraft={(draft) => {
          registrationDraftRef.current = draft;
        }}
        accessNotice={accessNotice}
        onDismissNotice={() => setAccessNotice(null)}
      />
    );
  }

  if (activeView === 'admin' && isAdmin) {
    return (
      <AdminPortal
        profile={profile}
        onSwitchToTechnician={() => setActiveView('technician')}
        onSignOut={handleSignOut}
      />
    );
  }

  return (
    <TechnicianPortal
      profile={profile}
      isAdmin={isAdmin}
      accessNotice={accessNotice}
      onDismissNotice={() => setAccessNotice(null)}
      onSwitchToAdmin={isAdmin ? () => setActiveView('admin') : undefined}
      onSignOut={handleSignOut}
    />
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <PoleLedgerApp />
    </ErrorBoundary>
  );
}
