import React, { useEffect, useState } from 'react';
import { FileDown, Pencil, Save, Trash2, X } from 'lucide-react';
import {
  FAULT_TYPES,
  FaultType,
  formatReadableDate,
  formatTimestamp,
  INSPECTION_STATUSES,
  InspectionFormValues,
  InspectionStatus,
  PoleInspection,
  UserProfile,
  validateInspectionValues,
  VALIDATION_LIMITS,
} from '../types/inspection';
import {
  deletePoleInspectionByAdmin,
  updatePoleInspectionByAdmin,
} from '../services/inspectionService';
import { exportSingleInspectionToPdf } from '../utils/exportReports';
import { StatusIndicator } from './StatusIndicator';

interface InspectionDetailDrawerProps {
  inspection: PoleInspection | null;
  canEdit: boolean;
  initialEditMode?: boolean;
  currentUser: UserProfile;
  onClose: () => void;
  onSaved?: (message: string) => void;
}

export function InspectionDetailDrawer({
  inspection,
  canEdit,
  initialEditMode = false,
  currentUser,
  onClose,
  onSaved,
}: InspectionDetailDrawerProps) {
  const [isEditing, setIsEditing] = useState(initialEditMode);
  const [formValues, setFormValues] = useState<InspectionFormValues>({
    poleNo: '',
    inspectionDate: '',
    location: '',
    faultType: 'Bulb / Lamp Failure',
    partReplaced: '',
    remarks: '',
    status: 'Resolved',
  });
  const [adminNotes, setAdminNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (inspection) {
      setIsEditing(canEdit && initialEditMode);
      setFormValues({
        poleNo: inspection.poleNo,
        inspectionDate: inspection.inspectionDate,
        location: inspection.location || '',
        faultType: inspection.faultType,
        partReplaced: inspection.partReplaced,
        remarks: inspection.remarks,
        status: inspection.status,
      });
      setAdminNotes(inspection.adminNotes || '');
      setConfirmDelete(false);
      setErrorMsg(null);
    }
  }, [inspection, canEdit, initialEditMode]);

  if (!inspection) return null;

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canEdit) return;
    setErrorMsg(null);

    const validationError = validateInspectionValues(formValues, adminNotes);
    if (validationError) {
      setErrorMsg(validationError);
      return;
    }

    setSaving(true);
    try {
      await updatePoleInspectionByAdmin(
        inspection.id,
        formValues,
        adminNotes,
        currentUser
      );
      setIsEditing(false);
      onSaved?.(`Updated inspection record for pole ${formValues.poleNo.trim()}.`);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Unable to save changes.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!canEdit) return;
    setSaving(true);
    setErrorMsg(null);
    try {
      await deletePoleInspectionByAdmin(inspection.id);
      onSaved?.(`Deleted inspection record for pole ${inspection.poleNo}.`);
      onClose();
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Unable to delete record.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex justify-end bg-slate-950/40 backdrop-blur-[1px] no-print"
      role="dialog"
      aria-modal="true"
      aria-labelledby="drawer-pole-title"
    >
      <div className="w-full max-w-xl bg-white h-full border-l border-slate-200 shadow-2xl flex flex-col">
        {/* Drawer Header */}
        <div className="px-6 py-5 border-b border-slate-200 flex items-center justify-between gap-4 bg-slate-50/70">
          <div className="min-w-0">
            <p className="text-xs text-slate-500">
              {isEditing ? 'Editing Inspection Report' : 'Pole Service Sheet'}
            </p>
            <h3
              id="drawer-pole-title"
              className="font-display text-lg font-semibold text-slate-900 font-mono truncate mt-0.5"
            >
              {inspection.poleNo}
            </h3>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {!isEditing && (
              <button
                type="button"
                onClick={() => exportSingleInspectionToPdf(inspection)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors cursor-pointer whitespace-nowrap"
              >
                <FileDown className="w-3.5 h-3.5" />
                PDF
              </button>
            )}
            {canEdit && !isEditing && (
              <button
                type="button"
                onClick={() => setIsEditing(true)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-slate-900 rounded-lg hover:bg-slate-800 transition-colors cursor-pointer whitespace-nowrap"
              >
                <Pencil className="w-3.5 h-3.5" />
                Edit Report
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              aria-label="Close report drawer"
              className="p-2 text-slate-500 hover:text-slate-900 rounded-lg hover:bg-slate-200/60 transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Drawer Body */}
        <div className="flex-1 overflow-y-auto p-6">
          {errorMsg && (
            <div className="mb-5 p-3 rounded-lg bg-red-50 border border-red-200 text-xs text-red-800">
              {errorMsg}
            </div>
          )}

          {isEditing && canEdit ? (
            <form id="admin-edit-inspection-form" onSubmit={handleSave} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1.5">
                    Pole No
                  </label>
                  <input
                    type="text"
                    required
                    maxLength={VALIDATION_LIMITS.POLE_NO_MAX}
                    value={formValues.poleNo}
                    onChange={(e) =>
                      setFormValues((prev) => ({ ...prev, poleNo: e.target.value }))
                    }
                    className="w-full px-3 py-2 text-sm font-mono bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-600/20 focus:border-sky-600"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1.5">
                    Inspection Date
                  </label>
                  <input
                    type="date"
                    required
                    value={formValues.inspectionDate}
                    onChange={(e) =>
                      setFormValues((prev) => ({ ...prev, inspectionDate: e.target.value }))
                    }
                    className="w-full px-3 py-2 text-sm font-mono tabular-nums bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-600/20 focus:border-sky-600"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1.5">
                  Location / Feeder
                </label>
                <input
                  type="text"
                  maxLength={VALIDATION_LIMITS.LOCATION_MAX}
                  value={formValues.location}
                  onChange={(e) =>
                    setFormValues((prev) => ({ ...prev, location: e.target.value }))
                  }
                  placeholder="Sector, street, or feeder line"
                  className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-600/20 focus:border-sky-600"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1.5">
                    Type of Fault
                  </label>
                  <select
                    value={formValues.faultType}
                    onChange={(e) =>
                      setFormValues((prev) => ({
                        ...prev,
                        faultType: e.target.value as FaultType,
                      }))
                    }
                    className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-600/20 focus:border-sky-600"
                  >
                    {FAULT_TYPES.map((ft) => (
                      <option key={ft} value={ft}>
                        {ft}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1.5">
                    Repair Status
                  </label>
                  <select
                    value={formValues.status}
                    onChange={(e) =>
                      setFormValues((prev) => ({
                        ...prev,
                        status: e.target.value as InspectionStatus,
                      }))
                    }
                    className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-600/20 focus:border-sky-600"
                  >
                    {INSPECTION_STATUSES.map((st) => (
                      <option key={st} value={st}>
                        {st}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1.5">
                  Part Replaced
                </label>
                <input
                  type="text"
                  required
                  maxLength={VALIDATION_LIMITS.PART_MAX}
                  value={formValues.partReplaced}
                  onChange={(e) =>
                    setFormValues((prev) => ({ ...prev, partReplaced: e.target.value }))
                  }
                  className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-600/20 focus:border-sky-600"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1.5">
                  Description / Field Remark
                </label>
                <textarea
                  rows={4}
                  required
                  maxLength={VALIDATION_LIMITS.REMARKS_MAX}
                  value={formValues.remarks}
                  onChange={(e) =>
                    setFormValues((prev) => ({ ...prev, remarks: e.target.value }))
                  }
                  className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-600/20 focus:border-sky-600 resize-y"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1.5">
                  Admin Review Notes
                </label>
                <textarea
                  rows={3}
                  maxLength={VALIDATION_LIMITS.ADMIN_NOTES_MAX}
                  value={adminNotes}
                  onChange={(e) => setAdminNotes(e.target.value)}
                  placeholder="Optional supervisor instructions, verification notes, or follow-up details..."
                  className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-600/20 focus:border-sky-600 resize-y"
                />
              </div>
            </form>
          ) : (
            <div className="space-y-6">
              <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-slate-200">
                <StatusIndicator status={inspection.status} />
                <span className="text-xs font-mono tabular-nums text-slate-500">
                  {formatReadableDate(inspection.inspectionDate)}
                </span>
              </div>

              <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-5 text-sm">
                <div>
                  <dt className="text-xs text-slate-500 mb-1">Pole Number</dt>
                  <dd className="font-mono font-medium text-slate-900">{inspection.poleNo}</dd>
                </div>
                <div>
                  <dt className="text-xs text-slate-500 mb-1">Inspection Date</dt>
                  <dd className="font-mono tabular-nums text-slate-900">
                    {inspection.inspectionDate}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-slate-500 mb-1">Type of Fault</dt>
                  <dd className="text-slate-900 font-medium">{inspection.faultType}</dd>
                </div>
                <div>
                  <dt className="text-xs text-slate-500 mb-1">Part Replaced</dt>
                  <dd className="text-slate-900 font-medium">{inspection.partReplaced}</dd>
                </div>
                <div className="sm:col-span-2">
                  <dt className="text-xs text-slate-500 mb-1">Location / Feeder</dt>
                  <dd className="text-slate-900">
                    {inspection.location ? inspection.location : 'Not specified'}
                  </dd>
                </div>
                <div className="sm:col-span-2">
                  <dt className="text-xs text-slate-500 mb-1">Submitted By</dt>
                  <dd className="text-slate-900">
                    {inspection.technicianName}{' '}
                    <span className="text-slate-400" aria-hidden="true">·</span>{' '}
                    <span className="font-mono text-xs text-slate-600">
                      {inspection.technicianBadge}
                    </span>
                  </dd>
                </div>
              </dl>

              <div className="pt-4 border-t border-slate-200">
                <h4 className="text-xs font-medium text-slate-500 mb-2">
                  Description / Field Remark
                </h4>
                <p className="text-sm text-slate-800 leading-relaxed whitespace-pre-wrap">
                  {inspection.remarks}
                </p>
              </div>

              {inspection.adminNotes && (
                <div className="pt-4 border-t border-slate-200">
                  <h4 className="text-xs font-medium text-slate-500 mb-2">
                    Admin Review Notes
                  </h4>
                  <p className="text-sm text-slate-800 leading-relaxed whitespace-pre-wrap">
                    {inspection.adminNotes}
                  </p>
                </div>
              )}

              <div className="pt-4 border-t border-slate-200 text-xs text-slate-500 space-y-1 tabular-nums">
                <p>Submitted: {formatTimestamp(inspection.createdAt)}</p>
                <p>
                  Last Updated: {formatTimestamp(inspection.updatedAt)}
                  {inspection.lastEditedByName
                    ? ` by ${inspection.lastEditedByName}`
                    : ''}
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Drawer Footer */}
        <div className="px-6 py-4 border-t border-slate-200 bg-slate-50 flex items-center justify-between gap-3">
          {isEditing && canEdit ? (
            <>
              <div>
                {!confirmDelete ? (
                  <button
                    type="button"
                    disabled={saving}
                    onClick={() => setConfirmDelete(true)}
                    className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-red-700 hover:bg-red-50 rounded-lg transition-colors cursor-pointer whitespace-nowrap"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    Delete Record
                  </button>
                ) : (
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      disabled={saving}
                      onClick={handleDelete}
                      className="px-3 py-1.5 text-xs font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 transition-colors cursor-pointer whitespace-nowrap"
                    >
                      Confirm Delete
                    </button>
                    <button
                      type="button"
                      disabled={saving}
                      onClick={() => setConfirmDelete(false)}
                      className="px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:text-slate-900 cursor-pointer"
                    >
                      Cancel
                    </button>
                  </div>
                )}
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => setIsEditing(false)}
                  className="px-4 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors cursor-pointer whitespace-nowrap"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  form="admin-edit-inspection-form"
                  disabled={saving}
                  className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium text-white bg-slate-900 rounded-lg hover:bg-slate-800 disabled:opacity-50 transition-colors cursor-pointer whitespace-nowrap"
                >
                  <Save className="w-3.5 h-3.5" />
                  {saving ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </>
          ) : (
            <div className="ml-auto">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors cursor-pointer whitespace-nowrap"
              >
                Close
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
