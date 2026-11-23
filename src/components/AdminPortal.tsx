import React, { useEffect, useMemo, useState } from 'react';
import {
  Calendar,
  CheckCircle2,
  ClipboardCheck,
  Database,
  Download,
  Eye,
  FileDown,
  LogOut,
  Pencil,
  Printer,
  Search,
  Shield,
  Users,
  Wrench,
  X,
} from 'lucide-react';
import { BOOTSTRAPPED_ADMIN_EMAIL } from '../firebase';
import {
  FAULT_TYPES,
  formatReadableDate,
  getTodayDateString,
  INSPECTION_STATUSES,
  PoleInspection,
  UserProfile,
} from '../types/inspection';
import {
  seedDemoInspections,
  subscribeAllInspections,
} from '../services/inspectionService';
import { setUserAdminRole, subscribeAllUsers } from '../services/userService';
import {
  exportInspectionsToCsv,
  exportInspectionsToPdf,
} from '../utils/exportReports';
import { BrandMark } from './BrandMark';
import { InspectionDetailDrawer } from './InspectionDetailDrawer';
import { PrintableReportSheet } from './PrintableReportSheet';
import { StatusIndicator } from './StatusIndicator';

interface AdminPortalProps {
  profile: UserProfile;
  onSwitchToTechnician: () => void;
  onSignOut: () => Promise<void>;
}

type DatePreset = 'ALL' | 'TODAY' | 'LAST_7' | 'SPECIFIC' | 'RANGE';

export function AdminPortal({
  profile,
  onSwitchToTechnician,
  onSignOut,
}: AdminPortalProps) {
  const [activeTab, setActiveTab] = useState<'reports' | 'team'>('reports');
  const [inspections, setInspections] = useState<PoleInspection[]>([]);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const [seedingDemo, setSeedingDemo] = useState(false);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [datePreset, setDatePreset] = useState<DatePreset>('ALL');
  const [specificDate, setSpecificDate] = useState(getTodayDateString());
  const [rangeStartDate, setRangeStartDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 7);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  });
  const [rangeEndDate, setRangeEndDate] = useState(getTodayDateString());
  const [selectedTechnicianId, setSelectedTechnicianId] = useState<string>('ALL');
  const [selectedFault, setSelectedFault] = useState<string>('ALL');
  const [selectedStatus, setSelectedStatus] = useState<string>('ALL');
  const [viewMode, setViewMode] = useState<'grouped' | 'table'>('grouped');

  // Drawer state
  const [drawerState, setDrawerState] = useState<{
    report: PoleInspection | null;
    editMode: boolean;
  }>({ report: null, editMode: false });

  // Role toggle pending UID
  const [updatingRoleUid, setUpdatingRoleUid] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    setLoadError(null);
    const unsubInspections = subscribeAllInspections(
      (records) => {
        setInspections(records);
        setLoading(false);
      },
      (err) => {
        setLoadError(err.message);
        setLoading(false);
      }
    );
    const unsubUsers = subscribeAllUsers(
      (userList) => {
        setUsers(userList);
      },
      (err) => {
        setLoadError(err.message);
      }
    );

    return () => {
      unsubInspections();
      unsubUsers();
    };
  }, []);

  const technicianOptions = useMemo(() => {
    const map = new Map<string, { id: string; label: string }>();
    for (const u of users) {
      map.set(u.uid, { id: u.uid, label: `${u.displayName} (${u.employeeId})` });
    }
    for (const r of inspections) {
      if (!map.has(r.technicianId)) {
        map.set(r.technicianId, {
          id: r.technicianId,
          label: `${r.technicianName} (${r.technicianBadge})`,
        });
      }
    }
    return Array.from(map.values()).sort((a, b) => a.label.localeCompare(b.label));
  }, [users, inspections]);

  const filteredInspections = useMemo(() => {
    const today = getTodayDateString();
    const sevenDaysAgoDate = new Date();
    sevenDaysAgoDate.setDate(sevenDaysAgoDate.getDate() - 6);
    const sevenDaysAgoStr = `${sevenDaysAgoDate.getFullYear()}-${String(
      sevenDaysAgoDate.getMonth() + 1
    ).padStart(2, '0')}-${String(sevenDaysAgoDate.getDate()).padStart(2, '0')}`;

    const q = searchQuery.trim().toLowerCase();

    return inspections.filter((item) => {
      if (datePreset === 'TODAY' && item.inspectionDate !== today) return false;
      if (datePreset === 'LAST_7' && item.inspectionDate < sevenDaysAgoStr) return false;
      if (datePreset === 'SPECIFIC' && specificDate && item.inspectionDate !== specificDate) {
        return false;
      }
      if (datePreset === 'RANGE') {
        const minDate =
          rangeStartDate && rangeEndDate && rangeStartDate > rangeEndDate
            ? rangeEndDate
            : rangeStartDate;
        const maxDate =
          rangeStartDate && rangeEndDate && rangeStartDate > rangeEndDate
            ? rangeStartDate
            : rangeEndDate;
        if (minDate && item.inspectionDate < minDate) return false;
        if (maxDate && item.inspectionDate > maxDate) return false;
      }
      if (selectedTechnicianId !== 'ALL' && item.technicianId !== selectedTechnicianId) {
        return false;
      }
      if (selectedFault !== 'ALL' && item.faultType !== selectedFault) return false;
      if (selectedStatus !== 'ALL' && item.status !== selectedStatus) return false;
      if (q) {
        const hay = `${item.poleNo} ${item.location} ${item.partReplaced} ${item.faultType} ${item.remarks} ${item.technicianName} ${item.technicianBadge}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [
    inspections,
    datePreset,
    specificDate,
    rangeStartDate,
    rangeEndDate,
    selectedTechnicianId,
    selectedFault,
    selectedStatus,
    searchQuery,
  ]);

  const groupedByDate = useMemo(() => {
    const groups = new Map<string, PoleInspection[]>();
    for (const item of filteredInspections) {
      const existingList = groups.get(item.inspectionDate);
      if (existingList) {
        existingList.push(item);
      } else {
        groups.set(item.inspectionDate, [item]);
      }
    }
    return Array.from(groups.entries()).sort(([dateA], [dateB]) =>
      dateB.localeCompare(dateA)
    );
  }, [filteredInspections]);

  const kpis = useMemo(() => {
    const resolved = filteredInspections.filter((r) => r.status === 'Resolved').length;
    const pending = filteredInspections.filter((r) => r.status === 'Pending Follow-up').length;
    const escalated = filteredInspections.filter((r) => r.status === 'Escalated').length;
    const completionPct =
      filteredInspections.length > 0
        ? Math.round((resolved / filteredInspections.length) * 100)
        : 0;
    return {
      total: filteredInspections.length,
      resolved,
      pending,
      escalated,
      completionPct,
    };
  }, [filteredInspections]);

  const activeScopeLabel = useMemo(() => {
    if (datePreset === 'TODAY') return `Date Scope: Today (${getTodayDateString()})`;
    if (datePreset === 'LAST_7') return 'Date Scope: Last 7 Days';
    if (datePreset === 'SPECIFIC' && specificDate) return `Date Scope: ${specificDate}`;
    if (datePreset === 'RANGE') {
      return `Date Range: ${rangeStartDate || 'Start'} to ${rangeEndDate || 'Present'}`;
    }
    return 'Date Scope: All Recorded Dates';
  }, [datePreset, specificDate, rangeStartDate, rangeEndDate]);

  const hasActiveFilters =
    searchQuery.trim() !== '' ||
    datePreset !== 'ALL' ||
    selectedTechnicianId !== 'ALL' ||
    selectedFault !== 'ALL' ||
    selectedStatus !== 'ALL';

  const resetFilters = () => {
    setSearchQuery('');
    setDatePreset('ALL');
    setSelectedTechnicianId('ALL');
    setSelectedFault('ALL');
    setSelectedStatus('ALL');
  };

  const getExportSuffix = () => {
    if (datePreset === 'SPECIFIC' && specificDate) return specificDate;
    if (datePreset === 'RANGE' && rangeStartDate && rangeEndDate) {
      return `${rangeStartDate}-to-${rangeEndDate}`;
    }
    if (datePreset === 'TODAY') return `today-${getTodayDateString()}`;
    if (datePreset === 'LAST_7') return `last-7-days-${getTodayDateString()}`;
    return `date-wise-${getTodayDateString()}`;
  };

  const handleDownloadCsv = (records = filteredInspections, suffix = getExportSuffix()) => {
    const filename = exportInspectionsToCsv(records, suffix);
    if (filename) {
      setToastMsg(
        `Downloaded ${records.length} ${records.length === 1 ? 'report' : 'reports'} to ${filename}.`
      );
    }
  };

  const handleDownloadPdf = (records = filteredInspections, suffix = getExportSuffix(), customSubtitle?: string) => {
    const filename = exportInspectionsToPdf(records, {
      title: 'Utility Pole Inspection & Maintenance Report',
      subtitle: customSubtitle || activeScopeLabel,
      preparedBy: `${profile.displayName} (${profile.employeeId})`,
      filenameSuffix: suffix,
    });
    if (filename) {
      setToastMsg(
        `Downloaded PDF report (${records.length} ${records.length === 1 ? 'entry' : 'entries'}) to ${filename}.`
      );
    }
  };

  const handleSeedDemo = async () => {
    setSeedingDemo(true);
    setLoadError(null);
    try {
      const count = await seedDemoInspections(profile, true);
      setToastMsg(`Created ${count} demo pole inspection reports across recent dates.`);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'Unable to create demo reports.');
    } finally {
      setSeedingDemo(false);
    }
  };

  const handleToggleAdminRole = async (targetUser: UserProfile) => {
    if (targetUser.uid === profile.uid) return;
    if (targetUser.email.toLowerCase() === BOOTSTRAPPED_ADMIN_EMAIL.toLowerCase()) return;

    setUpdatingRoleUid(targetUser.uid);
    try {
      const makeAdmin = targetUser.role !== 'admin';
      await setUserAdminRole(targetUser, makeAdmin, profile.uid);
      setToastMsg(
        `${targetUser.displayName} is now ${makeAdmin ? 'an Admin' : 'a Technician'}.`
      );
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'Unable to update user role.');
    } finally {
      setUpdatingRoleUid(null);
    }
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

            <nav className="p-4 space-y-1.5" aria-label="Admin navigation">
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
                  <ClipboardCheck className="w-4 h-4 shrink-0" />
                  <span className="whitespace-nowrap">Date-Wise Reports</span>
                </span>
                <span className="font-mono text-xs tabular-nums text-slate-400">
                  {inspections.length}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('team')}
                className={`w-full flex items-center justify-between px-3.5 py-2.5 text-sm font-medium rounded-lg transition-colors cursor-pointer ${
                  activeTab === 'team'
                    ? 'bg-white/12 text-white'
                    : 'text-slate-400 hover:bg-white/6 hover:text-white'
                }`}
              >
                <span className="flex items-center gap-3">
                  <Users className="w-4 h-4 shrink-0" />
                  <span className="whitespace-nowrap">Team & Access</span>
                </span>
                <span className="font-mono text-xs tabular-nums text-slate-400">
                  {users.length}
                </span>
              </button>

              <div className="pt-4 mt-4 border-t border-slate-800/80">
                <button
                  type="button"
                  onClick={onSwitchToTechnician}
                  className="w-full flex items-center gap-3 px-3.5 py-2.5 text-xs font-medium text-sky-300 hover:bg-white/6 hover:text-sky-200 rounded-lg transition-colors cursor-pointer"
                >
                  <Wrench className="w-4 h-4 shrink-0" />
                  <span className="whitespace-nowrap">Technician Field Entry</span>
                </button>
              </div>
            </nav>
          </div>

          <div className="p-4 border-t border-slate-800/80 space-y-3">
            <div className="px-2">
              <p className="text-sm font-medium text-white truncate">
                {profile.displayName}
              </p>
              <p className="text-xs text-slate-400 truncate mt-0.5">
                Administrator <span aria-hidden="true">·</span>{' '}
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
          {/* Clean Top Bar */}
          <header className="bg-white border-b border-slate-200 px-4 sm:px-8 h-16 flex items-center justify-between gap-4">
            <div className="flex items-center gap-2.5 text-sm min-w-0">
              <BrandMark className="w-5 h-5 text-slate-900 lg:hidden shrink-0" />
              <span className="lg:hidden font-display font-bold text-slate-900 whitespace-nowrap">
                PoleLedger
              </span>
              <span className="hidden lg:inline text-slate-400">Admin Console</span>
              <span className="text-slate-300" aria-hidden="true">/</span>
              <span className="font-medium text-slate-900 truncate">
                {activeTab === 'reports'
                  ? 'Date-Wise Technician Reports'
                  : 'Team & Role Management'}
              </span>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              {activeTab === 'reports' && (
                <button
                  type="button"
                  disabled={filteredInspections.length === 0}
                  onClick={() => handleDownloadPdf()}
                  className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium text-white bg-slate-900 rounded-lg hover:bg-slate-800 disabled:opacity-40 transition-colors whitespace-nowrap cursor-pointer"
                >
                  <FileDown className="w-3.5 h-3.5" />
                  <span>Download PDF</span>
                </button>
              )}
              <button
                type="button"
                onClick={onSwitchToTechnician}
                className="lg:hidden px-3 py-2 text-xs font-medium text-slate-700 bg-slate-100 rounded-lg whitespace-nowrap cursor-pointer"
              >
                Field Form
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

          {/* Mobile Compact Nav */}
          <div className="lg:hidden bg-white border-b border-slate-200 px-4 py-2 flex items-center gap-2">
            <button
              type="button"
              onClick={() => setActiveTab('reports')}
              className={`flex-1 py-1.5 text-xs font-medium rounded-md transition-colors cursor-pointer ${
                activeTab === 'reports'
                  ? 'bg-slate-900 text-white'
                  : 'text-slate-600 bg-slate-100'
              }`}
            >
              Reports ({inspections.length})
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('team')}
              className={`flex-1 py-1.5 text-xs font-medium rounded-md transition-colors cursor-pointer ${
                activeTab === 'team'
                  ? 'bg-slate-900 text-white'
                  : 'text-slate-600 bg-slate-100'
              }`}
            >
              Team ({users.length})
            </button>
          </div>

          <main className="flex-1 p-4 sm:p-8 max-w-7xl w-full mx-auto space-y-6">
            {toastMsg && (
              <div className="p-3.5 rounded-lg bg-emerald-50 border border-emerald-200 text-xs text-emerald-900 flex items-center justify-between gap-3">
                <span className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>{toastMsg}</span>
                </span>
                <button
                  type="button"
                  onClick={() => setToastMsg(null)}
                  aria-label="Dismiss notification"
                  className="text-emerald-700 hover:text-emerald-900 cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            )}

            {loadError && (
              <div className="p-4 rounded-lg bg-red-50 border border-red-200 text-sm text-red-800">
                {loadError}
              </div>
            )}

            {activeTab === 'reports' ? (
              <>
                {/* Executive Action Header */}
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div>
                    <h1 className="font-display text-xl sm:text-2xl font-semibold tracking-tight text-slate-900">
                      Inspection Operations Ledger
                    </h1>
                    <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
                      Review technician submissions by date, update repair statuses, or print and export offline reports.
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      disabled={seedingDemo}
                      onClick={() => void handleSeedDemo()}
                      className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 disabled:opacity-50 transition-colors whitespace-nowrap cursor-pointer"
                    >
                      <Database className="w-3.5 h-3.5 text-sky-600" />
                      <span>{seedingDemo ? 'Creating Demo...' : 'Create Demo Reports'}</span>
                    </button>

                    <button
                      type="button"
                      disabled={filteredInspections.length === 0}
                      onClick={() => window.print()}
                      className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 disabled:opacity-40 transition-colors whitespace-nowrap cursor-pointer"
                    >
                      <Printer className="w-3.5 h-3.5" />
                      <span>Print All Reports</span>
                    </button>

                    <button
                      type="button"
                      disabled={filteredInspections.length === 0}
                      onClick={() => handleDownloadCsv()}
                      className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 disabled:opacity-40 transition-colors whitespace-nowrap cursor-pointer"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>Download CSV</span>
                    </button>
                  </div>
                </div>

                {/* 4-Column KPI Strip */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                  <div className="bg-white border border-slate-200/90 shadow-[0_1px_2px_rgba(15,23,42,0.04)] rounded-xl p-5">
                    <p className="text-xs text-slate-500">Filtered Reports</p>
                    <div className="flex items-baseline justify-between mt-1.5">
                      <p className="font-display text-2xl font-semibold text-slate-900 tabular-nums">
                        {kpis.total}
                      </p>
                      <span className="text-xs font-mono tabular-nums text-slate-400">
                        {groupedByDate.length} {groupedByDate.length === 1 ? 'day' : 'days'}
                      </span>
                    </div>
                  </div>
                  <div className="bg-white border border-slate-200/90 shadow-[0_1px_2px_rgba(15,23,42,0.04)] rounded-xl p-5">
                    <p className="text-xs text-slate-500">Resolved</p>
                    <div className="flex items-baseline justify-between mt-1.5">
                      <p className="font-display text-2xl font-semibold text-emerald-700 tabular-nums">
                        {kpis.resolved}
                      </p>
                      <span className="text-xs font-mono tabular-nums text-slate-400">
                        {kpis.completionPct}%
                      </span>
                    </div>
                  </div>
                  <div className="bg-white border border-slate-200/90 shadow-[0_1px_2px_rgba(15,23,42,0.04)] rounded-xl p-5">
                    <p className="text-xs text-slate-500">Pending Follow-up</p>
                    <p className="font-display text-2xl font-semibold text-amber-700 tabular-nums mt-1.5">
                      {kpis.pending}
                    </p>
                  </div>
                  <div className="bg-white border border-slate-200/90 shadow-[0_1px_2px_rgba(15,23,42,0.04)] rounded-xl p-5">
                    <p className="text-xs text-slate-500">Escalated</p>
                    <p className="font-display text-2xl font-semibold text-red-700 tabular-nums mt-1.5">
                      {kpis.escalated}
                    </p>
                  </div>
                </div>

                {/* Search & Filter Bar */}
                <div className="bg-white border border-slate-200/90 shadow-[0_1px_2px_rgba(15,23,42,0.04)] rounded-xl p-4 space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    {/* Date & Range Presets */}
                    <div className="flex flex-wrap items-center gap-2">
                      <div className="inline-flex flex-wrap items-center p-1 bg-slate-100 rounded-lg">
                        {(
                          [
                            { id: 'ALL', label: 'All Dates' },
                            { id: 'TODAY', label: 'Today' },
                            { id: 'LAST_7', label: 'Last 7 Days' },
                            { id: 'SPECIFIC', label: 'Single Date' },
                            { id: 'RANGE', label: 'Date Range' },
                          ] as const
                        ).map((preset) => (
                          <button
                            key={preset.id}
                            type="button"
                            onClick={() => setDatePreset(preset.id)}
                            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap cursor-pointer ${
                              datePreset === preset.id
                                ? 'bg-white text-slate-900 shadow-xs'
                                : 'text-slate-600 hover:text-slate-900'
                            }`}
                          >
                            {preset.label}
                          </button>
                        ))}
                      </div>

                      {datePreset === 'SPECIFIC' && (
                        <input
                          type="date"
                          value={specificDate}
                          onChange={(e) => setSpecificDate(e.target.value)}
                          aria-label="Select specific inspection date"
                          className="px-3 py-1.5 text-xs font-mono tabular-nums bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-600/20 focus:border-sky-600"
                        />
                      )}

                      {datePreset === 'RANGE' && (
                        <div className="flex flex-wrap items-center gap-2">
                          <label className="inline-flex items-center gap-1.5 text-xs text-slate-600">
                            <span>From</span>
                            <input
                              type="date"
                              value={rangeStartDate}
                              onChange={(e) => setRangeStartDate(e.target.value)}
                              aria-label="Start date"
                              className="px-2.5 py-1.5 text-xs font-mono tabular-nums bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-600/20 focus:border-sky-600"
                            />
                          </label>
                          <label className="inline-flex items-center gap-1.5 text-xs text-slate-600">
                            <span>To</span>
                            <input
                              type="date"
                              value={rangeEndDate}
                              onChange={(e) => setRangeEndDate(e.target.value)}
                              aria-label="End date"
                              className="px-2.5 py-1.5 text-xs font-mono tabular-nums bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-600/20 focus:border-sky-600"
                            />
                          </label>
                        </div>
                      )}
                    </div>

                    {/* Layout Mode Toggle */}
                    <div className="inline-flex items-center p-1 bg-slate-100 rounded-lg">
                      <button
                        type="button"
                        onClick={() => setViewMode('grouped')}
                        className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap cursor-pointer ${
                          viewMode === 'grouped'
                            ? 'bg-white text-slate-900 shadow-xs'
                            : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        Grouped by Date
                      </button>
                      <button
                        type="button"
                        onClick={() => setViewMode('table')}
                        className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap cursor-pointer ${
                          viewMode === 'table'
                            ? 'bg-white text-slate-900 shadow-xs'
                            : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        Flat Table
                      </button>
                    </div>
                  </div>

                  {/* Pole ID Search & Attribute Filters */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-1">
                    <div className="relative">
                      <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        aria-label="Search by Pole ID or keyword"
                        placeholder="Search Pole ID (e.g. PL-1042) or keyword..."
                        className="w-full pl-9 pr-8 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-600/20 focus:border-sky-600"
                      />
                      {searchQuery && (
                        <button
                          type="button"
                          onClick={() => setSearchQuery('')}
                          aria-label="Clear search text"
                          className="absolute right-2.5 top-1/2 -translate-y-1/2 p-0.5 text-slate-400 hover:text-slate-700 cursor-pointer"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>

                    <select
                      value={selectedTechnicianId}
                      onChange={(e) => setSelectedTechnicianId(e.target.value)}
                      aria-label="Filter by technician name"
                      className="px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-600/20 focus:border-sky-600"
                    >
                      <option value="ALL">All Technicians</option>
                      {technicianOptions.map((tech) => (
                        <option key={tech.id} value={tech.id}>
                          {tech.label}
                        </option>
                      ))}
                    </select>

                    <select
                      value={selectedFault}
                      onChange={(e) => setSelectedFault(e.target.value)}
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

                    <select
                      value={selectedStatus}
                      onChange={(e) => setSelectedStatus(e.target.value)}
                      aria-label="Filter by status"
                      className="px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-600/20 focus:border-sky-600"
                    >
                      <option value="ALL">All Statuses</option>
                      {INSPECTION_STATUSES.map((st) => (
                        <option key={st} value={st}>
                          {st}
                        </option>
                      ))}
                    </select>
                  </div>

                  {hasActiveFilters && (
                    <div className="pt-2 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-600">
                      <span className="tabular-nums">
                        Showing <strong className="font-semibold text-slate-900">{filteredInspections.length}</strong> of{' '}
                        <span className="font-mono">{inspections.length}</span> inspection reports
                      </span>
                      <button
                        type="button"
                        onClick={resetFilters}
                        className="inline-flex items-center gap-1 font-medium text-sky-700 hover:text-sky-800 cursor-pointer"
                      >
                        <X className="w-3.5 h-3.5" />
                        <span>Clear all filters</span>
                      </button>
                    </div>
                  )}
                </div>

                {/* Reports Content */}
                {loading ? (
                  <div className="bg-white border border-slate-200/90 rounded-xl p-6 space-y-3">
                    {[1, 2, 3, 4, 5].map((n) => (
                      <div key={n} className="h-11 bg-slate-100 rounded-lg animate-pulse" />
                    ))}
                  </div>
                ) : filteredInspections.length === 0 ? (
                  <div className="bg-white border border-slate-200/90 shadow-[0_1px_2px_rgba(15,23,42,0.04)] rounded-xl p-12 text-center">
                    <h3 className="font-display text-base font-semibold text-slate-900">
                      {inspections.length === 0
                        ? 'No inspection reports submitted yet'
                        : 'No reports match the current filters'}
                    </h3>
                    <p className="text-sm text-slate-500 mt-1">
                      {inspections.length === 0
                        ? 'Create sample multi-day reports to explore date-wise logs, printing, and PDF/CSV exports.'
                        : 'Adjust the selected date, technician, fault type, or search query.'}
                    </p>
                    <div className="mt-5 flex items-center justify-center gap-3">
                      {inspections.length === 0 ? (
                        <button
                          type="button"
                          disabled={seedingDemo}
                          onClick={() => void handleSeedDemo()}
                          className="inline-flex items-center gap-2 px-4 py-2 text-xs font-medium text-white bg-slate-900 rounded-lg hover:bg-slate-800 disabled:opacity-50 cursor-pointer"
                        >
                          <Database className="w-3.5 h-3.5" />
                          <span>{seedingDemo ? 'Creating Demo...' : 'Create Demo Reports'}</span>
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => {
                            setSearchQuery('');
                            setDatePreset('ALL');
                            setSelectedTechnicianId('ALL');
                            setSelectedFault('ALL');
                            setSelectedStatus('ALL');
                          }}
                          className="px-4 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 cursor-pointer"
                        >
                          Reset All Filters
                        </button>
                      )}
                    </div>
                  </div>
                ) : viewMode === 'grouped' ? (
                  <div className="space-y-6">
                    {groupedByDate.map(([dateKey, items]) => (
                      <section
                        key={dateKey}
                        className="bg-white border border-slate-200/90 shadow-[0_1px_2px_rgba(15,23,42,0.04)] rounded-xl overflow-hidden"
                      >
                        <div className="px-5 py-3.5 bg-slate-50/90 border-b border-slate-200 flex flex-wrap items-center justify-between gap-4">
                          <div className="flex items-center gap-2.5">
                            <Calendar className="w-4 h-4 text-slate-500 shrink-0" />
                            <h3 className="font-display text-sm font-semibold text-slate-900">
                              {formatReadableDate(dateKey)}
                            </h3>
                            <span className="text-xs font-mono text-slate-400">
                              {dateKey}
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-mono tabular-nums text-slate-600 mr-1">
                              {items.length} {items.length === 1 ? 'report' : 'reports'}
                            </span>
                            <button
                              type="button"
                              onClick={() =>
                                handleDownloadPdf(
                                  items,
                                  dateKey,
                                  `Daily Inspection Log — ${formatReadableDate(dateKey)}`
                                )
                              }
                              className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-md hover:bg-slate-100 transition-colors whitespace-nowrap cursor-pointer"
                            >
                              <FileDown className="w-3 h-3" />
                              <span>PDF</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDownloadCsv(items, dateKey)}
                              className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-md hover:bg-slate-100 transition-colors whitespace-nowrap cursor-pointer"
                            >
                              <Download className="w-3 h-3" />
                              <span>CSV</span>
                            </button>
                          </div>
                        </div>

                        <div className="overflow-x-auto">
                          <table className="w-full text-left border-collapse">
                            <thead>
                              <tr className="border-b border-slate-200 text-xs font-medium text-slate-500">
                                <th className="py-2.5 px-4">Pole No</th>
                                <th className="py-2.5 px-4">Technician</th>
                                <th className="py-2.5 px-4">Fault Type</th>
                                <th className="py-2.5 px-4">Part Replaced</th>
                                <th className="py-2.5 px-4">Status</th>
                                <th className="py-2.5 px-4 text-right">Actions</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-200 text-sm">
                              {items.map((item) => (
                                <tr
                                  key={item.id}
                                  className="hover:bg-slate-50/80 transition-colors"
                                >
                                  <td className="py-3 px-4 font-mono font-medium text-slate-900 whitespace-nowrap">
                                    {item.poleNo}
                                  </td>
                                  <td className="py-3 px-4 whitespace-nowrap">
                                    <span className="text-slate-900 font-medium">
                                      {item.technicianName}
                                    </span>{' '}
                                    <span className="text-slate-300" aria-hidden="true">·</span>{' '}
                                    <span className="font-mono text-xs text-slate-500">
                                      {item.technicianBadge}
                                    </span>
                                  </td>
                                  <td className="py-3 px-4 text-slate-700 whitespace-nowrap">
                                    {item.faultType}
                                  </td>
                                  <td className="py-3 px-4 text-slate-700 max-w-[200px] truncate">
                                    {item.partReplaced}
                                  </td>
                                  <td className="py-3 px-4 whitespace-nowrap">
                                    <StatusIndicator status={item.status} />
                                  </td>
                                  <td className="py-3 px-4 text-right whitespace-nowrap">
                                    <div className="inline-flex items-center gap-1.5">
                                      <button
                                        type="button"
                                        onClick={() =>
                                          setDrawerState({ report: item, editMode: false })
                                        }
                                        className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-md hover:bg-slate-50 transition-colors cursor-pointer"
                                      >
                                        <Eye className="w-3.5 h-3.5" />
                                        View
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() =>
                                          setDrawerState({ report: item, editMode: true })
                                        }
                                        className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-white bg-slate-900 rounded-md hover:bg-slate-800 transition-colors cursor-pointer"
                                      >
                                        <Pencil className="w-3.5 h-3.5" />
                                        Edit
                                      </button>
                                    </div>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </section>
                    ))}
                  </div>
                ) : (
                  <div className="bg-white border border-slate-200/90 shadow-[0_1px_2px_rgba(15,23,42,0.04)] rounded-xl overflow-hidden">
                    <div className="overflow-x-auto">
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr className="border-b border-slate-200 bg-slate-50 text-xs font-medium text-slate-500">
                            <th className="py-3 px-4">Date</th>
                            <th className="py-3 px-4">Pole No</th>
                            <th className="py-3 px-4">Technician</th>
                            <th className="py-3 px-4">Fault Type</th>
                            <th className="py-3 px-4">Part Replaced</th>
                            <th className="py-3 px-4">Status</th>
                            <th className="py-3 px-4 text-right">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200 text-sm">
                          {filteredInspections.map((item) => (
                            <tr
                              key={item.id}
                              className="hover:bg-slate-50/80 transition-colors"
                            >
                              <td className="py-3 px-4 font-mono tabular-nums text-xs text-slate-600 whitespace-nowrap">
                                {item.inspectionDate}
                              </td>
                              <td className="py-3 px-4 font-mono font-medium text-slate-900 whitespace-nowrap">
                                {item.poleNo}
                              </td>
                              <td className="py-3 px-4 whitespace-nowrap">
                                <span className="text-slate-900 font-medium">
                                  {item.technicianName}
                                </span>{' '}
                                <span className="text-slate-300" aria-hidden="true">·</span>{' '}
                                <span className="font-mono text-xs text-slate-500">
                                  {item.technicianBadge}
                                </span>
                              </td>
                              <td className="py-3 px-4 text-slate-700 whitespace-nowrap">
                                {item.faultType}
                              </td>
                              <td className="py-3 px-4 text-slate-700 max-w-[200px] truncate">
                                {item.partReplaced}
                              </td>
                              <td className="py-3 px-4 whitespace-nowrap">
                                <StatusIndicator status={item.status} />
                              </td>
                              <td className="py-3 px-4 text-right whitespace-nowrap">
                                <div className="inline-flex items-center gap-1.5">
                                  <button
                                    type="button"
                                    onClick={() =>
                                      setDrawerState({ report: item, editMode: false })
                                    }
                                    className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-md hover:bg-slate-50 transition-colors cursor-pointer"
                                  >
                                    <Eye className="w-3.5 h-3.5" />
                                    View
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() =>
                                      setDrawerState({ report: item, editMode: true })
                                    }
                                    className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-white bg-slate-900 rounded-md hover:bg-slate-800 transition-colors cursor-pointer"
                                  >
                                    <Pencil className="w-3.5 h-3.5" />
                                    Edit
                                  </button>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </>
            ) : (
              /* Team & Access Tab */
              <div className="bg-white border border-slate-200/90 shadow-[0_1px_2px_rgba(15,23,42,0.04)] rounded-xl overflow-hidden">
                <div className="px-6 py-5 border-b border-slate-200">
                  <h2 className="font-display text-base font-semibold text-slate-900">
                    Registered Field Technicians & Administrators
                  </h2>
                  <p className="text-xs text-slate-500 mt-1">
                    Manage who has administrative permissions to review and edit date-wise pole inspection reports.
                  </p>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-slate-200 bg-slate-50 text-xs font-medium text-slate-500">
                        <th className="py-3 px-5">Name</th>
                        <th className="py-3 px-5">Badge ID</th>
                        <th className="py-3 px-5">Email</th>
                        <th className="py-3 px-5">Role</th>
                        <th className="py-3 px-5 text-right">Access Control</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 text-sm">
                      {users.map((u) => {
                        const isPrimaryAdmin =
                          u.email.toLowerCase() === BOOTSTRAPPED_ADMIN_EMAIL.toLowerCase();
                        const isSelf = u.uid === profile.uid;
                        return (
                          <tr key={u.uid} className="hover:bg-slate-50/70">
                            <td className="py-3.5 px-5 font-medium text-slate-900 whitespace-nowrap">
                              {u.displayName}
                            </td>
                            <td className="py-3.5 px-5 font-mono text-xs text-slate-600 whitespace-nowrap">
                              {u.employeeId}
                            </td>
                            <td className="py-3.5 px-5 text-slate-600 whitespace-nowrap">
                              {u.email}
                            </td>
                            <td className="py-3.5 px-5 whitespace-nowrap">
                              <span
                                className={`inline-flex items-center gap-1.5 text-xs font-medium ${
                                  u.role === 'admin' ? 'text-sky-700' : 'text-slate-700'
                                }`}
                              >
                                {u.role === 'admin' ? (
                                  <Shield className="w-3.5 h-3.5" />
                                ) : (
                                  <Wrench className="w-3.5 h-3.5" />
                                )}
                                <span>{u.role === 'admin' ? 'Admin' : 'Technician'}</span>
                              </span>
                            </td>
                            <td className="py-3.5 px-5 text-right whitespace-nowrap">
                              {isPrimaryAdmin || isSelf ? (
                                <span className="text-xs text-slate-400">
                                  {isPrimaryAdmin ? 'Primary Admin' : 'Current Session'}
                                </span>
                              ) : (
                                <button
                                  type="button"
                                  disabled={updatingRoleUid === u.uid}
                                  onClick={() => void handleToggleAdminRole(u)}
                                  className="px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-md hover:bg-slate-50 disabled:opacity-50 transition-colors cursor-pointer"
                                >
                                  {updatingRoleUid === u.uid
                                    ? 'Updating...'
                                    : u.role === 'admin'
                                      ? 'Revoke Admin'
                                      : 'Grant Admin'}
                                </button>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </main>
        </div>

        {/* Admin View & Edit Drawer */}
        <InspectionDetailDrawer
          inspection={drawerState.report}
          canEdit={true}
          initialEditMode={drawerState.editMode}
          currentUser={profile}
          onClose={() => setDrawerState({ report: null, editMode: false })}
          onSaved={(msg) => setToastMsg(msg)}
        />
      </div>

      {/* Print-Only Sheet */}
      <PrintableReportSheet
        title="Utility Pole Inspection & Maintenance Ledger"
        subtitle={activeScopeLabel}
        preparedBy={`${profile.displayName} (${profile.employeeId})`}
        records={filteredInspections}
      />
    </>
  );
}
