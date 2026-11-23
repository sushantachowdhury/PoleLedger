import { AlertCircle, CheckCircle2, Clock } from 'lucide-react';
import { InspectionStatus } from '../types/inspection';

interface StatusIndicatorProps {
  status: InspectionStatus;
}

export function StatusIndicator({ status }: StatusIndicatorProps) {
  if (status === 'Resolved') {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-700 whitespace-nowrap">
        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" aria-hidden="true" />
        <span>Resolved</span>
      </span>
    );
  }

  if (status === 'Pending Follow-up') {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-medium text-amber-700 whitespace-nowrap">
        <Clock className="w-3.5 h-3.5 text-amber-600 shrink-0" aria-hidden="true" />
        <span>Pending Follow-up</span>
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1.5 text-xs font-medium text-red-700 whitespace-nowrap">
      <AlertCircle className="w-3.5 h-3.5 text-red-600 shrink-0" aria-hidden="true" />
      <span>Escalated</span>
    </span>
  );
}
