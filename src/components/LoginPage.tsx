import React, { useState } from 'react';
import {
  createUserWithEmailAndPassword,
  reload,
  sendEmailVerification,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  User,
} from 'firebase/auth';
import {
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  Eye,
  EyeOff,
  ExternalLink,
  MailCheck,
  ShieldCheck,
  Wrench,
} from 'lucide-react';
import {
  auth,
  FIREBASE_PROJECT_ID,
  googleProvider,
} from '../firebase';
import { PortalMode, VALIDATION_LIMITS } from '../types/inspection';
import { BrandMark } from './BrandMark';

interface LoginPageProps {
  selectedPortal: PortalMode;
  onSelectPortal: (portal: PortalMode) => void;
  pendingVerificationUser: User | null;
  onVerificationComplete: () => Promise<void>;
  onRegistrationDraft: (draft: { displayName: string; employeeId: string }) => void;
  accessNotice: string | null;
  onDismissNotice: () => void;
}

export function LoginPage({
  selectedPortal,
  onSelectPortal,
  pendingVerificationUser,
  onVerificationComplete,
  onRegistrationDraft,
  accessNotice,
  onDismissNotice,
}: LoginPageProps) {
  const [authMode, setAuthMode] = useState<'signin' | 'signup'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [employeeId, setEmployeeId] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [needsEmailProviderSetup, setNeedsEmailProviderSetup] = useState(false);
  const [verificationFeedback, setVerificationFeedback] = useState<string | null>(null);
  const [imgError, setImgError] = useState(false);

  const isSignUp = selectedPortal === 'technician' && authMode === 'signup';

  const handlePortalSwitch = (portal: PortalMode) => {
    onSelectPortal(portal);
    setErrorMsg(null);
    onDismissNotice();
    if (portal === 'admin') {
      setAuthMode('signin');
    }
  };

  const mapAuthError = (err: unknown): string => {
    const code = (err as { code?: string })?.code || '';
    if (code === 'auth/operation-not-allowed' || code === 'auth/configuration-not-found') {
      setNeedsEmailProviderSetup(true);
      return 'Email/Password sign-in is not yet enabled in your Firebase project. Enable it in Firebase Console or sign in with Google below.';
    }
    if (code === 'auth/invalid-credential' || code === 'auth/wrong-password' || code === 'auth/user-not-found') {
      return 'Invalid email or password. Check your credentials and try again.';
    }
    if (code === 'auth/email-already-in-use') {
      return 'An account with this email already exists. Switch to Sign In instead.';
    }
    if (code === 'auth/weak-password') {
      return 'Password must be at least 6 characters.';
    }
    if (code === 'auth/invalid-email') {
      return 'Please enter a valid email address.';
    }
    if (code === 'auth/popup-closed-by-user') {
      return 'Google sign-in popup was closed before completion.';
    }
    return err instanceof Error ? err.message : 'Authentication failed. Please try again.';
  };

  const handleCredentialsSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setNeedsEmailProviderSetup(false);
    onDismissNotice();

    const trimmedEmail = email.trim();
    if (!trimmedEmail || !password) {
      setErrorMsg('Please enter both email and password.');
      return;
    }

    if (isSignUp) {
      const cleanName = displayName.trim();
      const cleanBadge = employeeId.trim().toUpperCase();
      if (cleanName.length < VALIDATION_LIMITS.NAME_MIN || cleanName.length > VALIDATION_LIMITS.NAME_MAX) {
        setErrorMsg(`Full name must be between ${VALIDATION_LIMITS.NAME_MIN} and ${VALIDATION_LIMITS.NAME_MAX} characters.`);
        return;
      }
      if (
        cleanBadge.length < VALIDATION_LIMITS.BADGE_MIN ||
        cleanBadge.length > VALIDATION_LIMITS.BADGE_MAX ||
        !VALIDATION_LIMITS.BADGE_REGEX.test(cleanBadge)
      ) {
        setErrorMsg('Badge / Employee ID must be 2–32 characters using letters, numbers, hyphens, or underscores.');
        return;
      }
      onRegistrationDraft({ displayName: cleanName, employeeId: cleanBadge });
    }

    setSubmitting(true);
    try {
      if (isSignUp) {
        const cred = await createUserWithEmailAndPassword(auth, trimmedEmail, password);
        if (!cred.user.emailVerified) {
          await sendEmailVerification(cred.user);
        }
      } else {
        await signInWithEmailAndPassword(auth, trimmedEmail, password);
      }
    } catch (err) {
      setErrorMsg(mapAuthError(err));
    } finally {
      setSubmitting(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setErrorMsg(null);
    setNeedsEmailProviderSetup(false);
    onDismissNotice();
    setSubmitting(true);
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (err) {
      setErrorMsg(mapAuthError(err));
    } finally {
      setSubmitting(false);
    }
  };

  const handleCheckVerification = async () => {
    if (!pendingVerificationUser) return;
    setSubmitting(true);
    setVerificationFeedback(null);
    try {
      await reload(pendingVerificationUser);
      await pendingVerificationUser.getIdToken(true);
      if (auth.currentUser?.emailVerified) {
        await onVerificationComplete();
      } else {
        setVerificationFeedback('Email is not verified yet. Please click the verification link sent to your inbox, then check again.');
      }
    } catch (err) {
      setVerificationFeedback(err instanceof Error ? err.message : 'Unable to refresh verification status.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleResendVerification = async () => {
    if (!pendingVerificationUser) return;
    setSubmitting(true);
    setVerificationFeedback(null);
    try {
      await sendEmailVerification(pendingVerificationUser);
      setVerificationFeedback(`Verification link resent to ${pendingVerificationUser.email}.`);
    } catch (err) {
      setVerificationFeedback(err instanceof Error ? err.message : 'Could not resend verification email right now.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen grid lg:grid-cols-2 bg-slate-50">
      {/* Left Architectural Visual Panel */}
      <div className="hidden lg:flex relative bg-slate-950 overflow-hidden flex-col justify-between p-12">
        {!imgError ? (
          <img
            src="/src/assets/images/login_pole_inspection_1795424445693.jpg"
            alt="Utility technician inspecting a streetlight pole at dawn"
            referrerPolicy="no-referrer"
            onError={() => setImgError(true)}
            className="absolute inset-0 w-full h-full object-cover"
          />
        ) : (
          <div className="absolute inset-0 bg-gradient-to-br from-slate-900 via-slate-950 to-sky-950" />
        )}
        <div
          className="absolute inset-0 bg-gradient-to-t from-slate-950/95 via-slate-950/45 to-slate-950/30"
          aria-hidden="true"
        />

        <div className="relative z-10 flex items-center gap-3 text-white">
          <BrandMark className="w-7 h-7" />
          <span className="font-display text-xl font-bold tracking-tight">
            PoleLedger
          </span>
        </div>

        <div className="relative z-10 max-w-lg space-y-4">
          <h1 className="font-display text-3xl xl:text-4xl font-semibold tracking-tight text-white leading-tight">
            Field pole maintenance and date-wise inspection records.
          </h1>
          <p className="text-sm xl:text-base text-slate-300 leading-relaxed">
            Technicians log bulb replacements, ballast faults, and feeder repairs directly from the field. Operations administrators review and update daily technician logs in real time.
          </p>
          <div className="pt-2 flex items-center gap-3 text-xs text-slate-300">
            <span>Scoped Technician Logs</span>
            <span aria-hidden="true">·</span>
            <span>Date-Wise Admin Audit</span>
            <span aria-hidden="true">·</span>
            <span>CSV Export</span>
          </div>
        </div>
      </div>

      {/* Right Authentication Panel */}
      <div className="flex flex-col justify-center items-center p-6 sm:p-10 lg:p-14 bg-slate-100/70">
        <div className="w-full max-w-md">
          <div className="lg:hidden mb-8 flex items-center gap-2.5 text-slate-900">
            <BrandMark className="w-6 h-6" />
            <span className="font-display text-xl font-bold tracking-tight">
              PoleLedger
            </span>
          </div>

          <div className="bg-white border border-slate-200/90 shadow-[0_1px_3px_rgba(15,23,42,0.05)] rounded-xl p-7 sm:p-8">
            {pendingVerificationUser ? (
              <div className="space-y-5">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-sky-50 border border-sky-200 flex items-center justify-center text-sky-700 shrink-0">
                    <MailCheck className="w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="font-display text-lg font-semibold text-slate-900">
                      Verify your email address
                    </h2>
                    <p className="text-xs text-slate-500 truncate max-w-[260px]">
                      {pendingVerificationUser.email}
                    </p>
                  </div>
                </div>

                <p className="text-sm text-slate-600 leading-relaxed">
                  We sent a verification link to your inbox. Confirm your email before accessing inspection logs, or sign in directly with a verified Google account.
                </p>

                {verificationFeedback && (
                  <div className="p-3 rounded-lg bg-slate-50 border border-slate-200 text-xs text-slate-700 leading-relaxed">
                    {verificationFeedback}
                  </div>
                )}

                <div className="space-y-2.5 pt-1">
                  <button
                    type="button"
                    disabled={submitting}
                    onClick={handleCheckVerification}
                    className="w-full flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium text-white bg-slate-900 rounded-lg hover:bg-slate-800 disabled:opacity-50 transition-colors cursor-pointer"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    I have verified — Continue
                  </button>
                  <button
                    type="button"
                    disabled={submitting}
                    onClick={handleResendVerification}
                    className="w-full px-4 py-2.5 text-sm font-medium text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 disabled:opacity-50 transition-colors cursor-pointer"
                  >
                    Resend verification email
                  </button>
                  <button
                    type="button"
                    disabled={submitting}
                    onClick={() => void signOut(auth)}
                    className="w-full px-4 py-2 text-xs font-medium text-slate-500 hover:text-slate-800 transition-colors cursor-pointer"
                  >
                    Sign out and use a different account
                  </button>
                </div>
              </div>
            ) : (
              <>
                <div className="mb-6">
                  <h2 className="font-display text-2xl font-semibold tracking-tight text-slate-900">
                    Sign in to workspace
                  </h2>
                  <p className="text-sm text-slate-500 mt-1">
                    Select your portal and enter your credentials.
                  </p>
                </div>

                {/* Portal Role Selector */}
                <div
                  className="grid grid-cols-2 gap-1 p-1 bg-slate-100 rounded-lg mb-6"
                  role="tablist"
                  aria-label="Portal selection"
                >
                  <button
                    type="button"
                    role="tab"
                    aria-selected={selectedPortal === 'technician'}
                    onClick={() => handlePortalSwitch('technician')}
                    className={`flex items-center justify-center gap-2 px-3 py-2 text-xs font-medium rounded-md transition-colors whitespace-nowrap cursor-pointer ${
                      selectedPortal === 'technician'
                        ? 'bg-white text-slate-900 shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <Wrench className="w-3.5 h-3.5 shrink-0" />
                    <span>Technician Login</span>
                  </button>
                  <button
                    type="button"
                    role="tab"
                    aria-selected={selectedPortal === 'admin'}
                    onClick={() => handlePortalSwitch('admin')}
                    className={`flex items-center justify-center gap-2 px-3 py-2 text-xs font-medium rounded-md transition-colors whitespace-nowrap cursor-pointer ${
                      selectedPortal === 'admin'
                        ? 'bg-white text-slate-900 shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <ShieldCheck className="w-3.5 h-3.5 shrink-0" />
                    <span>Admin Login</span>
                  </button>
                </div>

                {accessNotice && (
                  <div className="mb-5 p-3.5 rounded-lg bg-amber-50 border border-amber-200 text-xs text-amber-900 flex items-start gap-2.5">
                    <AlertCircle className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
                    <span className="leading-relaxed">{accessNotice}</span>
                  </div>
                )}

                {errorMsg && (
                  <div className="mb-5 p-3.5 rounded-lg bg-red-50 border border-red-200 text-xs text-red-800 space-y-2">
                    <div className="flex items-start gap-2">
                      <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                      <span className="leading-relaxed">{errorMsg}</span>
                    </div>
                    {needsEmailProviderSetup && (
                      <div className="pt-2 border-t border-red-200/70 text-[11px] text-red-900 space-y-1">
                        <p className="font-medium">How to enable Email/Password login:</p>
                        <ol className="list-decimal list-inside space-y-0.5 text-red-800">
                          <li>Open Firebase Authentication Providers</li>
                          <li>Select Email/Password and toggle Enable</li>
                          <li>Save changes and sign in with your credentials</li>
                        </ol>
                        <a
                          href={`https://console.firebase.google.com/project/${FIREBASE_PROJECT_ID}/authentication/providers`}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 font-medium text-red-900 underline hover:no-underline pt-0.5"
                        >
                          Open Firebase Console Providers
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      </div>
                    )}
                  </div>
                )}

                <form onSubmit={handleCredentialsSubmit} className="space-y-4">
                  {isSignUp && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label
                          htmlFor="tech-name"
                          className="block text-xs font-medium text-slate-700 mb-1.5"
                        >
                          Full Name
                        </label>
                        <input
                          id="tech-name"
                          type="text"
                          required
                          maxLength={VALIDATION_LIMITS.NAME_MAX}
                          value={displayName}
                          onChange={(e) => setDisplayName(e.target.value)}
                          placeholder="e.g. Rahul Das"
                          className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-600/20 focus:border-sky-600"
                        />
                      </div>
                      <div>
                        <label
                          htmlFor="tech-badge"
                          className="block text-xs font-medium text-slate-700 mb-1.5"
                        >
                          Badge / Employee ID
                        </label>
                        <input
                          id="tech-badge"
                          type="text"
                          required
                          maxLength={VALIDATION_LIMITS.BADGE_MAX}
                          value={employeeId}
                          onChange={(e) => setEmployeeId(e.target.value)}
                          placeholder="e.g. TECH-104"
                          className="w-full px-3 py-2 text-sm font-mono bg-white border border-slate-300 rounded-lg text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-600/20 focus:border-sky-600"
                        />
                      </div>
                    </div>
                  )}

                  <div>
                    <label
                      htmlFor="login-email"
                      className="block text-xs font-medium text-slate-700 mb-1.5"
                    >
                      Email Address
                    </label>
                    <input
                      id="login-email"
                      type="email"
                      autoComplete="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder={
                        selectedPortal === 'admin'
                          ? 'admin@utilityops.com'
                          : 'technician@utilityops.com'
                      }
                      className="w-full px-3 py-2.5 text-sm bg-white border border-slate-300 rounded-lg text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-600/20 focus:border-sky-600"
                    />
                  </div>

                  <div>
                    <label
                      htmlFor="login-password"
                      className="block text-xs font-medium text-slate-700 mb-1.5"
                    >
                      Password
                    </label>
                    <div className="relative">
                      <input
                        id="login-password"
                        type={showPassword ? 'text' : 'password'}
                        autoComplete={isSignUp ? 'new-password' : 'current-password'}
                        required
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="Enter your password"
                        className="w-full pl-3 pr-10 py-2.5 text-sm bg-white border border-slate-300 rounded-lg text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-600/20 focus:border-sky-600"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword((prev) => !prev)}
                        aria-label={showPassword ? 'Hide password' : 'Show password'}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600 cursor-pointer"
                      >
                        {showPassword ? (
                          <EyeOff className="w-4 h-4" />
                        ) : (
                          <Eye className="w-4 h-4" />
                        )}
                      </button>
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={submitting}
                    className="w-full flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium text-white bg-slate-900 rounded-lg hover:bg-slate-800 disabled:opacity-50 transition-colors cursor-pointer whitespace-nowrap"
                  >
                    <span>
                      {submitting
                        ? 'Authenticating...'
                        : isSignUp
                          ? 'Register Technician Account'
                          : selectedPortal === 'admin'
                            ? 'Sign In to Admin Console'
                            : 'Sign In to Technician Portal'}
                    </span>
                    <ArrowRight className="w-4 h-4 shrink-0" />
                  </button>
                </form>

                {selectedPortal === 'technician' && (
                  <div className="mt-3 text-center">
                    <button
                      type="button"
                      onClick={() => {
                        setAuthMode((m) => (m === 'signin' ? 'signup' : 'signin'));
                        setErrorMsg(null);
                      }}
                      className="text-xs font-medium text-sky-700 hover:text-sky-800 hover:underline cursor-pointer"
                    >
                      {authMode === 'signin'
                        ? 'New field technician? Register an account'
                        : 'Already registered? Sign in with credentials'}
                    </button>
                  </div>
                )}

                <div className="relative my-6">
                  <div className="absolute inset-0 flex items-center" aria-hidden="true">
                    <div className="w-full border-t border-slate-200" />
                  </div>
                  <div className="relative flex justify-center text-xs">
                    <span className="bg-white px-3 text-slate-400">or</span>
                  </div>
                </div>

                <button
                  type="button"
                  disabled={submitting}
                  onClick={handleGoogleSignIn}
                  className="w-full flex items-center justify-center gap-2.5 px-4 py-2.5 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 disabled:opacity-50 transition-colors cursor-pointer whitespace-nowrap"
                >
                  <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" aria-hidden="true">
                    <path
                      fill="#4285F4"
                      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                    />
                    <path
                      fill="#34A853"
                      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                    />
                    <path
                      fill="#FBBC05"
                      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                    />
                    <path
                      fill="#EA4335"
                      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                    />
                  </svg>
                  <span>Continue with Google</span>
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
