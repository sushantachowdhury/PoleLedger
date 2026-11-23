import { formatReadableDate, PoleInspection } from '../types/inspection';

interface PrintableReportSheetProps {
  title: string;
  subtitle: string;
  preparedBy: string;
  records: PoleInspection[];
}

export function PrintableReportSheet({
  title,
  subtitle,
  preparedBy,
  records,
}: PrintableReportSheetProps) {
  const sorted = [...records].sort((a, b) => {
    const cmp = b.inspectionDate.localeCompare(a.inspectionDate);
    if (cmp !== 0) return cmp;
    return a.poleNo.localeCompare(b.poleNo);
  });

  const grouped = new Map<string, PoleInspection[]>();
  for (const r of sorted) {
    const list = grouped.get(r.inspectionDate);
    if (list) list.push(r);
    else grouped.set(r.inspectionDate, [r]);
  }

  const resolved = sorted.filter((r) => r.status === 'Resolved').length;
  const pending = sorted.filter((r) => r.status === 'Pending Follow-up').length;
  const escalated = sorted.filter((r) => r.status === 'Escalated').length;

  return (
    <div className="hidden print-only bg-white text-slate-900 p-2">
      {/* Masthead */}
      <div className="border-b-2 border-slate-900 pb-4 mb-5 flex items-end justify-between gap-6">
        <div>
          <p className="text-xs font-mono uppercase tracking-wider text-slate-500">
            PoleLedger Operations Archive
          </p>
          <h1 className="font-display text-2xl font-bold text-slate-900 mt-1">
            {title}
          </h1>
          <p className="text-xs text-slate-600 mt-0.5">{subtitle}</p>
        </div>
        <div className="text-right text-xs text-slate-600 space-y-0.5 tabular-nums">
          <p>
            Prepared by: <span className="font-medium text-slate-900">{preparedBy}</span>
          </p>
          <p>
            Printed:{' '}
            {new Date().toLocaleString('en-US', {
              month: 'short',
              day: 'numeric',
              year: 'numeric',
              hour: '2-digit',
              minute: '2-digit',
            })}
          </p>
          <p className="font-medium text-slate-900">
            Total: {sorted.length} · Resolved: {resolved} · Pending: {pending} · Escalated: {escalated}
          </p>
        </div>
      </div>

      {/* Date-Wise Sections */}
      {sorted.length === 0 ? (
        <p className="text-sm text-slate-600 py-8 text-center">
          No inspection records available for the selected filters.
        </p>
      ) : (
        <div className="space-y-6">
          {Array.from(grouped.entries()).map(([dateKey, items]) => (
            <section key={dateKey} className="print-break-inside-avoid">
              <div className="bg-slate-100 border border-slate-300 px-3 py-2 flex items-center justify-between">
                <h2 className="font-display text-sm font-semibold text-slate-900">
                  {formatReadableDate(dateKey)} ({dateKey})
                </h2>
                <span className="text-xs font-mono tabular-nums text-slate-700">
                  {items.length} {items.length === 1 ? 'report' : 'reports'}
                </span>
              </div>

              <table className="w-full text-left border-collapse border border-slate-300 text-xs">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-300 text-slate-700">
                    <th className="py-2 px-2.5 border-r border-slate-300">Pole No</th>
                    <th className="py-2 px-2.5 border-r border-slate-300">Location</th>
                    <th className="py-2 px-2.5 border-r border-slate-300">Technician</th>
                    <th className="py-2 px-2.5 border-r border-slate-300">Fault Type</th>
                    <th className="py-2 px-2.5 border-r border-slate-300">Part Replaced</th>
                    <th className="py-2 px-2.5 border-r border-slate-300">Status</th>
                    <th className="py-2 px-2.5 border-r border-slate-300">Remarks</th>
                    <th className="py-2 px-2.5">Admin Notes</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-300">
                  {items.map((item) => (
                    <tr key={item.id} className="align-top">
                      <td className="py-2 px-2.5 border-r border-slate-300 font-mono font-semibold whitespace-nowrap">
                        {item.poleNo}
                      </td>
                      <td className="py-2 px-2.5 border-r border-slate-300">
                        {item.location || '—'}
                      </td>
                      <td className="py-2 px-2.5 border-r border-slate-300 whitespace-nowrap">
                        {item.technicianName} ({item.technicianBadge})
                      </td>
                      <td className="py-2 px-2.5 border-r border-slate-300">
                        {item.faultType}
                      </td>
                      <td className="py-2 px-2.5 border-r border-slate-300">
                        {item.partReplaced}
                      </td>
                      <td className="py-2 px-2.5 border-r border-slate-300 font-medium whitespace-nowrap">
                        {item.status}
                      </td>
                      <td className="py-2 px-2.5 border-r border-slate-300">
                        {item.remarks}
                      </td>
                      <td className="py-2 px-2.5">
                        {item.adminNotes || '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
