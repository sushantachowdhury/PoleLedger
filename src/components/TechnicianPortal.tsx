import React, { useEffect, useMemo, useState } from 'react';
import {
  CheckCircle2,
  ClipboardList,
  Database,
  Eye,
  FileDown,
  FilePlus2,
  LogOut,
  Printer,
  Search,
  ShieldCheck,
  X,
} from 'lucide-react';
import {
  FAULT_TYPES,
  FaultType,
  formatReadableDate,
  getTodayDateString,
  INSPECTION_STATUSES,
  InspectionFormValues,
  InspectionStatus,
  PoleInspection,
  UserProfile,
  validateInspectionValues,
  VALIDATION_LIMITS,
} from '../types/inspection';
import {
  createPoleInspection,
  seedDemoInspections,
  subscribeTechnicianInspections,
} from '../services/inspectionService';
import { exportInspectionsToPdf } from '../utils/exportReports';
import { BrandMark } from './BrandMark';
import { InspectionDetailDrawer } from './InspectionDetailDrawer';
import { PrintableReportSheet } from './PrintableReportSheet';
import { StatusIndicator } from './StatusIndicator';

interface TechnicianPortalProps {
  profile: UserProfile;
  isAdmin: boolean;
  accessNotice?: string | null;
  onDismissNotice?: () => void;
  onSwitchToAdmin?: () => void;
  onSignOut: () => Promise<void>;
}

const COMMON_PARTS = [
  '90W LED Luminaire',
  '60W LED Bulb',
  'LED Driver 24V',
  'Photocell Sensor',
  'MCB 16A',
  'Armature Cable & Fuse',
];

export function TechnicianPortal({
  profile,
  isAdmin,
  accessNotice,
  onDismissNotice,
  onSwitchToAdmin,
  onSignOut,
}: TechnicianPortalProps) {
  const [activeTab, setActiveTab] = useState<'submit' | 'reports'>('submit');
  const [inspections, setInspections] = useState<PoleInspection[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [seedingDemo, setSeedingDemo] = useState(false);

  // Submission Form State
  const [poleNo, setPoleNo] = useState('');
  const [inspectionDate, setInspectionDate] = useState(getTodayDateString());
  const [location, setLocation] = useState('');
  const [faultType, setFaultType] = useState<FaultType>('Bulb / Lamp Failure');
  const [partReplaced, setPartReplaced] = useState('');
  const [status, setStatus] = useState<InspectionStatus>('Resolved');
  const [remarks, setRemarks] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [submitSuccess, setSubmitSuccess] = useState<string | null>(null);

  // My Reports Filter State
  const [searchQuery, setSearchQuery] = useState('');
  const [filterDate, setFilterDate] = useState('');
  const [filterFault, setFilterFault] = useState<string>('ALL');
  const [selectedReport, setSelectedReport] = useState<PoleInspection | null>(null);

  useEffect(() => {
    setLoading(true);
    setLoadError(null);
    const unsubscribe = subscribeTechnicianInspections(
      profile.uid,
      (records) => {
        setInspections(records);
        setLoading(false);
      },
      (err) => {
        setLoadError(err.message);
        setLoading(false);
      }
    );
    return () => unsubscribe();
  }, [profile.uid]);

  const filteredReports = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return inspections.filter((item) => {
      if (filterDate && item.inspectionDate !== filterDate) return false;
      if (filterFault !== 'ALL' && item.faultType !== filterFault) return false;
      if (q) {
        const hay = `${item.poleNo} ${item.location} ${item.partReplaced} ${item.faultType} ${item.remarks}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [inspections, searchQuery, filterDate, filterFault]);

  const stats = useMemo(() => {
    const resolved = inspections.filter((r) => r.status === 'Resolved').length;
    const attention = inspections.length - resolved;
    return { total: inspections.length, resolved, attention };
  }, [inspections]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setSubmitSuccess(null);

    const values: InspectionFormValues = {
      poleNo,
      inspectionDate,
      location,
      faultType,
      partReplaced,
      remarks,
      status,
    };

    const validationError = validateInspectionValues(values);
    if (validationError) {
      setFormError(validationError);
      return;
    }

    setSubmitting(true);
    try {
      await createPoleInspection(values, profile);
      const savedPole = poleNo.trim();
      setPoleNo('');
      setLocation('');
      setPartReplaced('');
      setRemarks('');
      setStatus('Resolved');
      setInspectionDate(getTodayDateString());
      setSubmitSuccess(`Inspection report submitted for pole ${savedPole}.`);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Unable to submit inspection report.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSeedDemo = async () => {
    setSeedingDemo(true);
    setLoadError(null);
    try {
      const count = await seedDemoInspections(profile, false);
      setSubmitSuccess(`Added ${count} sample inspection reports to your log.`);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'Unable to load demo reports.');
    } finally {
      setSeedingDemo(false);
    }
  };

  const handleDownloadPdf = () => {
    exportInspectionsToPdf(filteredReports, {
      title: 'Technician Field Inspection Log',
      subtitle: `Technician: ${profile.displayName} (${profile.employeeId})`,
      preparedBy: `${profile.displayName} (${profile.employeeId})`,
      filenameSuffix: `my-reports-${getTodayDateString()}`,
    });
  };

  return (
    <>
      <div className="min-h-screen bg-slate-100/70 flex flex-col lg:flex-row no-print">
        {/* Dark Precision Sidebar */}
        <aside className="hidden lg:flex lg:w-64 lg:shrink-0 bg-slate-950 text-slate-100 flex-col justify-between">
          <div>
            <div className="h-16 px-6 flex items-center gap-3 border-b border-slate-800/80">
              <BrandMark className="w-6 h-6 text-white shrink-0" />
              <span className="font-display text-lg font-bold tracking-tight text-white whitespace-nowrap">
                PoleLedger
              </span>
            </div>

            <nav className="p-4 space-y-1.5" aria-label="Technician navigation">
              <button
                type="button"
                onClick={() => setActiveTab('submit')}
                className={`w-full flex items-center gap-3 px-3.5 py-2.5 text-sm font-medium rounded-lg transition-colors cursor-pointer ${
                  activeTab === 'submit'
                    ? 'bg-white/12 text-white'
                    : 'text-slate-400 hover:bg-white/6 hover:text-white'
                }`}
              >
                <FilePlus2 className="w-4 h-4 shrink-0" />
                <span className="whitespace-nowrap">Log Pole Inspection</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('reports')}
                className={`w-full flex items-center justify-between px-3.5 py-2.5 text-sm font-medium rounded-lg transition-colors cursor-pointer ${
                  activeTab === 'reports'
                    ? 'bg-white/12 text-white'
                    : 'text-slate-400 hover:bg-white/6 hover:text-white'
                }`}
              >
                <span className="flex items-center gap-3">
                  <ClipboardList className="w-4 h-4 shrink-0" />
                  <span className="whitespace-nowrap">My Reports</span>
                </span>
                <span className="font-mono text-xs tabular-nums text-slate-400">
                  {inspections.length}
                </span>
              </button>

              {isAdmin && onSwitchToAdmin && (
                <div className="pt-4 mt-4 border-t border-slate-800/80">
                  <button
                    type="button"
                    onClick={onSwitchToAdmin}
                    className="w-full flex items-center gap-3 px-3.5 py-2.5 text-xs font-medium text-sky-300 hover:bg-white/6 hover:text-sky-200 rounded-lg transition-colors cursor-pointer"
                  >
                    <ShieldCheck className="w-4 h-4 shrink-0" />
                    <span className="whitespace-nowrap">Switch to Admin Console</span>
                  </button>
                </div>
              )}
            </nav>
          </div>

          <div className="p-4 border-t border-slate-800/80 space-y-3">
            <div className="px-2">
              <p className="text-sm font-medium text-white truncate">
                {profile.displayName}
              </p>
              <p className="text-xs text-slate-400 truncate mt-0.5">
                Technician <span aria-hidden="true">·</span>{' '}
                <span className="font-mono text-slate-300">{profile.employeeId}</span>
              </p>
            </div>
            <button
              type="button"
              onClick={() => void onSignOut()}
              className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-medium text-slate-300 hover:text-white hover:bg-white/8 rounded-lg transition-colors cursor-pointer"
            >
              <LogOut className="w-3.5 h-3.5 shrink-0" />
              <span>Sign Out</span>
            </button>
          </div>
        </aside>

        {/* Main Content Area */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* Top Header */}
          <header className="bg-white border-b border-slate-200 px-4 sm:px-8 h-16 flex items-center justify-between gap-4">
            <div className="flex items-center gap-2.5 text-sm min-w-0">
              <BrandMark className="w-5 h-5 text-slate-900 lg:hidden shrink-0" />
              <span className="lg:hidden font-display font-bold text-slate-900 whitespace-nowrap">
                PoleLedger
              </span>
              <span className="hidden lg:inline text-slate-400">Technician Portal</span>
              <span className="text-slate-300" aria-hidden="true">/</span>
              <span className="font-medium text-slate-900 truncate">
                {activeTab === 'submit' ? 'New Pole Inspection' : 'My Submitted Reports'}
              </span>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              {isAdmin && onSwitchToAdmin && (
                <button
                  type="button"
                  onClick={onSwitchToAdmin}
                  className="lg:hidden px-3 py-1.5 text-xs font-medium text-sky-700 bg-sky-50 rounded-lg whitespace-nowrap cursor-pointer"
                >
                  Admin
                </button>
              )}
              <button
                type="button"
                onClick={() =>
                  setActiveTab((t) => (t === 'submit' ? 'reports' : 'submit'))
                }
                className="px-4 py-2 text-xs font-medium text-white bg-slate-900 rounded-lg hover:bg-slate-800 transition-colors whitespace-nowrap cursor-pointer"
              >
                {activeTab === 'submit'
                  ? `View My Reports (${inspections.length})`
                  : '+ New Inspection'}
              </button>
              <button
                type="button"
                onClick={() => void onSignOut()}
                aria-label="Sign out"
                className="lg:hidden p-2 text-slate-600 hover:text-slate-900 rounded-lg hover:bg-slate-100 cursor-pointer"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          </header>

          {/* Mobile Compact Tab Bar */}
          <div className="lg:hidden bg-white border-b border-slate-200 px-4 py-2 flex items-center gap-2">
            <button
              type="button"
              onClick={() => setActiveTab('submit')}
              className={`flex-1 py-1.5 text-xs font-medium rounded-md transition-colors cursor-pointer ${
                activeTab === 'submit'
                  ? 'bg-slate-900 text-white'
                  : 'text-slate-600 bg-slate-100'
              }`}
            >
              Log Inspection
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('reports')}
              className={`flex-1 py-1.5 text-xs font-medium rounded-md transition-colors cursor-pointer ${
                activeTab === 'reports'
                  ? 'bg-slate-900 text-white'
                  : 'text-slate-600 bg-slate-100'
              }`}
            >
              My Reports ({inspections.length})
            </button>
          </div>

          <main className="flex-1 p-4 sm:p-8 max-w-6xl w-full mx-auto">
            {accessNotice && (
              <div className="mb-6 p-3.5 rounded-lg bg-amber-50 border border-amber-200 text-xs text-amber-900 flex items-center justify-between gap-3">
                <span>{accessNotice}</span>
                {onDismissNotice && (
                  <button
                    type="button"
                    onClick={onDismissNotice}
                    aria-label="Dismiss notice"
                    className="text-amber-700 hover:text-amber-900 cursor-pointer shrink-0"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>
            )}

            {loadError && (
              <div className="mb-6 p-4 rounded-lg bg-red-50 border border-red-200 text-sm text-red-800">
                Unable to load your inspection records: {loadError}
              </div>
            )}

            {activeTab === 'submit' ? (
              <div className="grid grid-cols-1 xl:grid-cols-12 gap-8 items-start">
                {/* Submission Form */}
                <section className="xl:col-span-7 bg-white border border-slate-200/90 shadow-[0_1px_2px_rgba(15,23,42,0.04)] rounded-xl p-6 sm:p-8">
                  <div className="mb-6">
                    <h1 className="font-display text-xl font-semibold text-slate-900">
                      Pole Inspection & Repair Submission
                    </h1>
                    <p className="text-sm text-slate-500 mt-1">
                      Record the pole number, fault found, component replaced, and field remarks. Submitted reports are read-only for technicians.
                    </p>
                  </div>

                  {formError && (
                    <div className="mb-5 p-3.5 rounded-lg bg-red-50 border border-red-200 text-xs text-red-800">
                      {formError}
                    </div>
                  )}

                  {submitSuccess && (
                    <div className="mb-5 p-3.5 rounded-lg bg-emerald-50 border border-emerald-200 text-xs text-emerald-900 flex items-center justify-between gap-3">
                      <span className="flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                        <span>{submitSuccess}</span>
                      </span>
                      <button
                        type="button"
                        onClick={() => setActiveTab('reports')}
                        className="font-medium underline hover:no-underline whitespace-nowrap cursor-pointer"
                      >
                        View report
                      </button>
                    </div>
                  )}

                  <form onSubmit={handleSubmit} className="space-y-5">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label
                          htmlFor="pole-no"
                          className="block text-xs font-medium text-slate-700 mb-1.5"
                        >
                          Pole Number <span className="text-red-600">*</span>
                        </label>
                        <input
                          id="pole-no"
                          type="text"
                          required
                          maxLength={VALIDATION_LIMITS.POLE_NO_MAX}
                          value={poleNo}
                          onChange={(e) => setPoleNo(e.target.value)}
                          placeholder="e.g. PL-1042"
                          className="w-full px-3 py-2.5 text-sm font-mono bg-white border border-slate-300 rounded-lg text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-600/20 focus:border-sky-600"
                        />
                      </div>

                      <div>
                        <label
                          htmlFor="inspection-date"
                          className="block text-xs font-medium text-slate-700 mb-1.5"
                        >
                          Inspection Date <span className="text-red-600">*</span>
                        </label>
                        <input
                          id="inspection-date"
                          type="date"
                          required
                          value={inspectionDate}
                          onChange={(e) => setInspectionDate(e.target.value)}
                          className="w-full px-3 py-2.5 text-sm font-mono tabular-nums bg-white border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-sky-600/20 focus:border-sky-600"
                        />
                      </div>
                    </div>

                    <div>
                      <label
                        htmlFor="pole-location"
                        className="block text-xs font-medium text-slate-700 mb-1.5"
                      >
                        Location / Feeder Line
                      </label>
                      <input
                        id="pole-location"
                        type="text"
                        maxLength={VALIDATION_LIMITS.LOCATION_MAX}
                        value={location}
                        onChange={(e) => setLocation(e.target.value)}
                        placeholder="e.g. Sector 4 Main Road, Feeder B"
                        className="w-full px-3 py-2.5 text-sm bg-white border border-slate-300 rounded-lg text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-600/20 focus:border-sky-600"
                      />
                    </div>

                    <div>
                      <label
                        htmlFor="fault-type"
                        className="block text-xs font-medium text-slate-700 mb-1.5"
                      >
                        Type of Fault <span className="text-red-600">*</span>
                      </label>
                      <select
                        id="fault-type"
                        value={faultType}
                        onChange={(e) => setFaultType(e.target.value as FaultType)}
                        className="w-full px-3 py-2.5 text-sm bg-white border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-sky-600/20 focus:border-sky-600"
                      >
                        {FAULT_TYPES.map((ft) => (
                          <option key={ft} value={ft}>
                            {ft}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label
                        htmlFor="part-replaced"
                        className="block text-xs font-medium text-slate-700 mb-1.5"
                      >
                        Part Replaced <span className="text-red-600">*</span>
                      </label>
                      <input
                        id="part-replaced"
                        type="text"
                        required
                        maxLength={VALIDATION_LIMITS.PART_MAX}
                        value={partReplaced}
                        onChange={(e) => setPartReplaced(e.target.value)}
                        placeholder="e.g. 90W LED Bulb"
                        className="w-full px-3 py-2.5 text-sm bg-white border border-slate-300 rounded-lg text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-600/20 focus:border-sky-600"
                      />
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {COMMON_PARTS.map((part) => (
                          <button
                            key={part}
                            type="button"
                            onClick={() => setPartReplaced(part)}
                            className="px-2.5 py-1 text-xs text-slate-600 bg-slate-100 hover:bg-slate-200 hover:text-slate-900 rounded-md transition-colors cursor-pointer whitespace-nowrap"
                          >
                            {part}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div>
                      <span className="block text-xs font-medium text-slate-700 mb-1.5">
                        Repair Status <span className="text-red-600">*</span>
                      </span>
                      <div className="grid grid-cols-3 gap-1.5 p-1 bg-slate-100 rounded-lg">
                        {INSPECTION_STATUSES.map((st) => (
                          <button
                            key={st}
                            type="button"
                            onClick={() => setStatus(st)}
                            className={`px-3 py-2 text-xs font-medium rounded-md transition-colors whitespace-nowrap cursor-pointer ${
                              status === st
                                ? 'bg-white text-slate-900 shadow-xs'
                                : 'text-slate-600 hover:text-slate-900'
                            }`}
                          >
                            {st}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <label
                          htmlFor="field-remarks"
                          className="block text-xs font-medium text-slate-700"
                        >
                          Description / Remark <span className="text-red-600">*</span>
                        </label>
                        <span className="text-xs font-mono tabular-nums text-slate-400">
                          {remarks.length}/{VALIDATION_LIMITS.REMARKS_MAX}
                        </span>
                      </div>
                      <textarea
                        id="field-remarks"
                        rows={4}
                        required
                        maxLength={VALIDATION_LIMITS.REMARKS_MAX}
                        value={remarks}
                        onChange={(e) => setRemarks(e.target.value)}
                        placeholder="Describe the fault observed, replacement performed, voltage or wiring checks..."
                        className="w-full px-3 py-2.5 text-sm bg-white border border-slate-300 rounded-lg text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-600/20 focus:border-sky-600 resize-y"
                      />
                    </div>

                    <div className="pt-2 flex items-center justify-end gap-3">
                      <button
                        type="submit"
                        disabled={submitting}
                        className="px-5 py-2.5 text-sm font-medium text-white bg-slate-900 rounded-lg hover:bg-slate-800 disabled:opacity-50 transition-colors cursor-pointer whitespace-nowrap"
                      >
                        {submitting ? 'Submitting Report...' : 'Submit Inspection Report'}
                      </button>
                    </div>
                  </form>
                </section>

                {/* Recent Own Submissions */}
                <section className="xl:col-span-5 bg-white border border-slate-200/90 shadow-[0_1px_2px_rgba(15,23,42,0.04)] rounded-xl p-6">
                  <div className="flex items-center justify-between gap-4 pb-4 border-b border-slate-200">
                    <div>
                      <h2 className="font-display text-base font-semibold text-slate-900">
                        My Recent Submissions
                      </h2>
                      <p className="text-xs text-slate-500 mt-0.5">
                        Reports logged under badge {profile.employeeId}.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setActiveTab('reports')}
                      className="text-xs font-medium text-sky-700 hover:text-sky-800 whitespace-nowrap cursor-pointer"
                    >
                      View all
                    </button>
                  </div>

                  {loading ? (
                    <div className="py-6 space-y-3">
                      {[1, 2, 3].map((n) => (
                        <div key={n} className="h-14 bg-slate-100 rounded-lg animate-pulse" />
                      ))}
                    </div>
                  ) : inspections.length === 0 ? (
                    <div className="py-10 text-center space-y-3">
                      <div>
                        <p className="text-sm font-medium text-slate-700">
                          No pole inspections logged yet
                        </p>
                        <p className="text-xs text-slate-500 mt-1">
                          Submit a form on the left or load sample field reports.
                        </p>
                      </div>
                      <button
                        type="button"
                        disabled={seedingDemo}
                        onClick={() => void handleSeedDemo()}
                        className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 disabled:opacity-50 transition-colors cursor-pointer"
                      >
                        <Database className="w-3.5 h-3.5" />
                        <span>{seedingDemo ? 'Loading...' : 'Load Demo Reports'}</span>
                      </button>
                    </div>
                  ) : (
                    <ul className="divide-y divide-slate-200">
                      {inspections.slice(0, 5).map((item) => (
                        <li key={item.id}>
                          <button
                            type="button"
                            onClick={() => setSelectedReport(item)}
                            className="w-full py-3.5 px-2 -mx-2 rounded-lg text-left hover:bg-slate-50 transition-colors flex items-start justify-between gap-3 cursor-pointer"
                          >
                            <div className="min-w-0">
                              <div className="flex items-center gap-2 text-sm">
                                <span className="font-mono font-semibold text-slate-900">
                                  {item.poleNo}
                                </span>
                                <span className="text-slate-300" aria-hidden="true">·</span>
                                <span className="text-xs font-mono tabular-nums text-slate-500">
                                  {item.inspectionDate}
                                </span>
                              </div>
                              <p className="text-xs text-slate-600 truncate mt-1">
                                {item.faultType} <span aria-hidden="true">·</span> {item.partReplaced}
                              </p>
                            </div>
                            <div className="shrink-0 pt-0.5">
                              <StatusIndicator status={item.status} />
                            </div>
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </section>
              </div>
            ) : (
              <div className="space-y-6">
                {/* Summary Metrics & Print/PDF Toolbar */}
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div>
                    <h1 className="font-display text-xl font-semibold text-slate-900">
                      My Inspection Reports
                    </h1>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Read-only log of pole maintenance reports submitted by {profile.displayName}.
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      disabled={seedingDemo}
                      onClick={() => void handleSeedDemo()}
                      className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 disabled:opacity-50 transition-colors whitespace-nowrap cursor-pointer"
                    >
                      <Database className="w-3.5 h-3.5" />
                      <span>{seedingDemo ? 'Loading...' : 'Load Demo Reports'}</span>
                    </button>
                    <button
                      type="button"
                      disabled={filteredReports.length === 0}
                      onClick={() => window.print()}
                      className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 disabled:opacity-40 transition-colors whitespace-nowrap cursor-pointer"
                    >
                      <Printer className="w-3.5 h-3.5" />
                      <span>Print Reports</span>
                    </button>
                    <button
                      type="button"
                      disabled={filteredReports.length === 0}
                      onClick={handleDownloadPdf}
                      className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-white bg-slate-900 rounded-lg hover:bg-slate-800 disabled:opacity-40 transition-colors whitespace-nowrap cursor-pointer"
                    >
                      <FileDown className="w-3.5 h-3.5" />
                      <span>Download PDF</span>
                    </button>
                  </div>
                </div>

                {submitSuccess && (
                  <div className="p-3.5 rounded-lg bg-emerald-50 border border-emerald-200 text-xs text-emerald-900 flex items-center justify-between gap-3">
                    <span className="flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                      <span>{submitSuccess}</span>
                    </span>
                    <button
                      type="button"
                      onClick={() => setSubmitSuccess(null)}
                      className="text-emerald-700 hover:text-emerald-900 cursor-pointer"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="bg-white border border-slate-200/90 shadow-[0_1px_2px_rgba(15,23,42,0.04)] rounded-xl p-5">
                    <p className="text-xs text-slate-500">My Total Reports</p>
                    <p className="font-display text-2xl font-semibold text-slate-900 tabular-nums mt-1">
                      {stats.total}
                    </p>
                  </div>
                  <div className="bg-white border border-slate-200/90 shadow-[0_1px_2px_rgba(15,23,42,0.04)] rounded-xl p-5">
                    <p className="text-xs text-slate-500">Resolved</p>
                    <p className="font-display text-2xl font-semibold text-emerald-700 tabular-nums mt-1">
                      {stats.resolved}
                    </p>
                  </div>
                  <div className="bg-white border border-slate-200/90 shadow-[0_1px_2px_rgba(15,23,42,0.04)] rounded-xl p-5">
                    <p className="text-xs text-slate-500">Pending / Escalated</p>
                    <p className="font-display text-2xl font-semibold text-amber-700 tabular-nums mt-1">
                      {stats.attention}
                    </p>
                  </div>
                </div>

                {/* Filters */}
                <div className="bg-white border border-slate-200/90 shadow-[0_1px_2px_rgba(15,23,42,0.04)] rounded-xl p-4 flex flex-wrap items-center gap-3">
                  <div className="relative flex-1 min-w-[220px]">
                    <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Search by pole no, part replaced, or remark..."
                      className="w-full pl-9 pr-3 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-600/20 focus:border-sky-600"
                    />
                  </div>
                  <input
                    type="date"
                    value={filterDate}
                    onChange={(e) => setFilterDate(e.target.value)}
                    aria-label="Filter by date"
                    className="px-3 py-2 text-sm font-mono tabular-nums bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-600/20 focus:border-sky-600"
                  />
                  <select
                    value={filterFault}
                    onChange={(e) => setFilterFault(e.target.value)}
                    aria-label="Filter by fault type"
                    className="px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-600/20 focus:border-sky-600"
                  >
                    <option value="ALL">All Fault Types</option>
                    {FAULT_TYPES.map((ft) => (
                      <option key={ft} value={ft}>
                        {ft}
                      </option>
                    ))}
                  </select>
                  {(searchQuery || filterDate || filterFault !== 'ALL') && (
                    <button
                      type="button"
                      onClick={() => {
                        setSearchQuery('');
                        setFilterDate('');
                        setFilterFault('ALL');
                      }}
                      className="inline-flex items-center gap-1 px-3 py-2 text-xs font-medium text-slate-600 hover:text-slate-900 cursor-pointer"
                    >
                      <X className="w-3.5 h-3.5" />
                      Clear
                    </button>
                  )}
                </div>

                {/* My Reports Table */}
                <div className="bg-white border border-slate-200/90 shadow-[0_1px_2px_rgba(15,23,42,0.04)] rounded-xl overflow-hidden">
                  {loading ? (
                    <div className="p-6 space-y-3">
                      {[1, 2, 3, 4].map((n) => (
                        <div key={n} className="h-11 bg-slate-100 rounded-lg animate-pulse" />
                      ))}
                    </div>
                  ) : filteredReports.length === 0 ? (
                    <div className="p-12 text-center">
                      <h3 className="font-display text-base font-semibold text-slate-900">
                        {inspections.length === 0
                          ? 'No reports submitted yet'
                          : 'No matching reports found'}
                      </h3>
                      <p className="text-sm text-slate-500 mt-1">
                        {inspections.length === 0
                          ? 'Submit your first inspection or load demo reports to preview.'
                          : 'Try clearing or adjusting your date and search filters.'}
                      </p>
                      {inspections.length === 0 && (
                        <div className="mt-5 flex items-center justify-center gap-3">
                          <button
                            type="button"
                            onClick={() => setActiveTab('submit')}
                            className="px-4 py-2 text-xs font-medium text-white bg-slate-900 rounded-lg hover:bg-slate-800 cursor-pointer"
                          >
                            Log First Inspection
                          </button>
                          <button
                            type="button"
                            disabled={seedingDemo}
                            onClick={() => void handleSeedDemo()}
                            className="px-4 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 cursor-pointer"
                          >
                            Load Demo Reports
                          </button>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr className="border-b border-slate-200 bg-slate-50 text-xs font-medium text-slate-500">
                            <th className="py-3 px-4">Pole No</th>
                            <th className="py-3 px-4">Date</th>
                            <th className="py-3 px-4">Type of Fault</th>
                            <th className="py-3 px-4">Part Replaced</th>
                            <th className="py-3 px-4">Status</th>
                            <th className="py-3 px-4 text-right">Action</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200 text-sm">
                          {filteredReports.map((item) => (
                            <tr
                              key={item.id}
                              className="hover:bg-slate-50/80 transition-colors"
                            >
                              <td className="py-3 px-4 font-mono font-medium text-slate-900 whitespace-nowrap">
                                {item.poleNo}
                              </td>
                              <td className="py-3 px-4 font-mono tabular-nums text-xs text-slate-600 whitespace-nowrap">
                                {formatReadableDate(item.inspectionDate)}
                              </td>
                              <td className="py-3 px-4 text-slate-700 whitespace-nowrap">
                                {item.faultType}
                              </td>
                              <td className="py-3 px-4 text-slate-700 max-w-[220px] truncate">
                                {item.partReplaced}
                              </td>
                              <td className="py-3 px-4 whitespace-nowrap">
                                <StatusIndicator status={item.status} />
                              </td>
                              <td className="py-3 px-4 text-right whitespace-nowrap">
                                <button
                                  type="button"
                                  onClick={() => setSelectedReport(item)}
                                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-md hover:bg-slate-50 transition-colors cursor-pointer"
                                >
                                  <Eye className="w-3.5 h-3.5" />
                                  View
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>
            )}
          </main>
        </div>

        {/* Technician Read-Only Report Drawer */}
        <InspectionDetailDrawer
          inspection={selectedReport}
          canEdit={false}
          currentUser={profile}
          onClose={() => setSelectedReport(null)}
        />
      </div>

      {/* Print-Only Sheet */}
      <PrintableReportSheet
        title="Technician Field Inspection Report"
        subtitle={`Submitted by ${profile.displayName} (${profile.employeeId})`}
        preparedBy={profile.displayName}
        records={filteredReports}
      />
    </>
  );
}
