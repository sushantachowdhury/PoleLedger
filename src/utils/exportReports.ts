import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import {
  formatReadableDate,
  formatTimestamp,
  getTodayDateString,
  PoleInspection,
} from '../types/inspection';

function sortDateWise(records: PoleInspection[]): PoleInspection[] {
  return [...records].sort((a, b) => {
    const dateCmp = b.inspectionDate.localeCompare(a.inspectionDate);
    if (dateCmp !== 0) return dateCmp;
    return a.poleNo.localeCompare(b.poleNo);
  });
}

export function exportInspectionsToCsv(
  records: PoleInspection[],
  filenameSuffix: string
): string | null {
  if (records.length === 0) return null;

  const sortedRecords = sortDateWise(records);

  const headers = [
    'Inspection Date',
    'Pole No',
    'Location / Feeder',
    'Technician Name',
    'Badge ID',
    'Fault Type',
    'Part Replaced',
    'Status',
    'Remarks',
    'Admin Notes',
    'Last Edited By',
    'Submitted At',
    'Last Updated',
  ];

  const escapeCell = (raw: string) => {
    const normalized = (raw || '').replace(/\r?\n/g, ' ').trim();
    const safe = /^[=+\-@\t\r]/.test(normalized) ? `'${normalized}` : normalized;
    return `"${safe.replace(/"/g, '""')}"`;
  };

  const rows = sortedRecords.map((r) =>
    [
      r.inspectionDate,
      r.poleNo,
      r.location,
      r.technicianName,
      r.technicianBadge,
      r.faultType,
      r.partReplaced,
      r.status,
      r.remarks,
      r.adminNotes,
      r.lastEditedByName,
      r.createdAt ? formatTimestamp(r.createdAt) : '',
      r.updatedAt ? formatTimestamp(r.updatedAt) : '',
    ]
      .map(escapeCell)
      .join(',')
  );

  const csvContent = `\uFEFF${[headers.join(','), ...rows].join('\r\n')}`;
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const filename = `pole-inspections-${filenameSuffix}.csv`;
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);

  return filename;
}

export interface PdfExportOptions {
  title?: string;
  subtitle?: string;
  preparedBy: string;
  filenameSuffix?: string;
}

export function exportInspectionsToPdf(
  records: PoleInspection[],
  options: PdfExportOptions
): string | null {
  if (records.length === 0) return null;

  const sortedRecords = sortDateWise(records);
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();

  const resolvedCount = sortedRecords.filter((r) => r.status === 'Resolved').length;
  const pendingCount = sortedRecords.filter((r) => r.status === 'Pending Follow-up').length;
  const escalatedCount = sortedRecords.filter((r) => r.status === 'Escalated').length;

  // Executive Header Band
  doc.setFillColor(15, 23, 42); // Slate-900
  doc.rect(0, 0, pageWidth, 24, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(15);
  doc.text('PoleLedger', 14, 11);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9.5);
  doc.setTextColor(203, 213, 225);
  doc.text(
    options.title || 'Utility Pole Inspection & Maintenance Ledger',
    14,
    17.5
  );

  const generatedLabel = `Generated: ${new Date().toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })}`;
  doc.setFontSize(8.5);
  doc.text(generatedLabel, pageWidth - 14, 11, { align: 'right' });
  doc.text(`Prepared by: ${options.preparedBy}`, pageWidth - 14, 17.5, {
    align: 'right',
  });

  // Summary Strip
  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(226, 232, 240);
  doc.rect(14, 28, pageWidth - 28, 12, 'FD');

  doc.setTextColor(51, 65, 85);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.text(options.subtitle || 'Date-Wise Field Inspection Summary', 18, 35.5);

  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42);
  const summaryText = `Total: ${sortedRecords.length}   |   Resolved: ${resolvedCount}   |   Pending: ${pendingCount}   |   Escalated: ${escalatedCount}`;
  doc.text(summaryText, pageWidth - 18, 35.5, { align: 'right' });

  // Group records by date for clean visual hierarchy in the PDF
  const tableBody: Array<Array<string | { content: string; colSpan?: number; styles?: Record<string, unknown> }>> = [];
  let lastDate = '';

  for (const item of sortedRecords) {
    if (item.inspectionDate !== lastDate) {
      lastDate = item.inspectionDate;
      const dayCount = sortedRecords.filter((r) => r.inspectionDate === lastDate).length;
      tableBody.push([
        {
          content: `${formatReadableDate(lastDate)}  (${lastDate}) — ${dayCount} ${dayCount === 1 ? 'report' : 'reports'}`,
          colSpan: 8,
          styles: {
            fillColor: [241, 245, 249],
            textColor: [15, 23, 42],
            fontStyle: 'bold',
            fontSize: 8.5,
            cellPadding: { top: 2.5, bottom: 2.5, left: 3, right: 3 },
          },
        },
      ]);
    }

    tableBody.push([
      item.poleNo,
      item.location || '—',
      `${item.technicianName}\n(${item.technicianBadge})`,
      item.faultType,
      item.partReplaced,
      item.status,
      item.remarks,
      item.adminNotes || '—',
    ]);
  }

  autoTable(doc, {
    startY: 44,
    margin: { left: 14, right: 14, bottom: 16 },
    head: [
      [
        'Pole No',
        'Location / Feeder',
        'Technician',
        'Fault Type',
        'Part Replaced',
        'Status',
        'Description / Remarks',
        'Admin Notes',
      ],
    ],
    body: tableBody,
    theme: 'grid',
    headStyles: {
      fillColor: [30, 41, 59],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 8,
      cellPadding: 2.5,
    },
    styles: {
      fontSize: 8,
      textColor: [30, 41, 59],
      lineColor: [226, 232, 240],
      lineWidth: 0.2,
      cellPadding: 2.5,
      valign: 'top',
      overflow: 'linebreak',
    },
    columnStyles: {
      0: { cellWidth: 24, fontStyle: 'bold' },
      1: { cellWidth: 32 },
      2: { cellWidth: 32 },
      3: { cellWidth: 32 },
      4: { cellWidth: 32 },
      5: { cellWidth: 26, fontStyle: 'bold' },
      6: { cellWidth: 56 },
      7: { cellWidth: 35 },
    },
    didParseCell: (data) => {
      if (data.section === 'body' && data.column.index === 5 && data.row.raw && Array.isArray(data.row.raw) && data.row.raw.length === 8) {
        const val = String(data.cell.raw || '');
        if (val === 'Resolved') data.cell.styles.textColor = [21, 128, 61];
        else if (val === 'Pending Follow-up') data.cell.styles.textColor = [180, 83, 9];
        else if (val === 'Escalated') data.cell.styles.textColor = [185, 28, 28];
      }
    },
    didDrawPage: () => {
      const pageNum = doc.getNumberOfPages();
      doc.setFontSize(8);
      doc.setTextColor(100, 116, 139);
      doc.text(
        'PoleLedger Field Maintenance Archive — Confidential Operational Record',
        14,
        pageHeight - 7
      );
      doc.text(`Page ${pageNum}`, pageWidth - 14, pageHeight - 7, { align: 'right' });
    },
  });

  const suffix = options.filenameSuffix || getTodayDateString();
  const filename = `pole-inspections-report-${suffix}.pdf`;
  doc.save(filename);
  return filename;
}

export function exportSingleInspectionToPdf(inspection: PoleInspection): string {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();

  doc.setFillColor(15, 23, 42);
  doc.rect(0, 0, pageWidth, 26, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.text('PoleLedger', 16, 12);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(203, 213, 225);
  doc.text('Pole Inspection & Repair Service Sheet', 16, 19);

  doc.setFontSize(9);
  doc.text(`Pole: ${inspection.poleNo}`, pageWidth - 16, 12, { align: 'right' });
  doc.text(`Date: ${inspection.inspectionDate}`, pageWidth - 16, 19, { align: 'right' });

  autoTable(doc, {
    startY: 36,
    margin: { left: 16, right: 16 },
    theme: 'grid',
    head: [['Field', 'Recorded Detail']],
    body: [
      ['Pole Number', inspection.poleNo],
      ['Inspection Date', `${formatReadableDate(inspection.inspectionDate)} (${inspection.inspectionDate})`],
      ['Location / Feeder', inspection.location || 'Not specified'],
      ['Technician', `${inspection.technicianName} (${inspection.technicianBadge})`],
      ['Type of Fault', inspection.faultType],
      ['Part Replaced', inspection.partReplaced],
      ['Repair Status', inspection.status],
      ['Description / Remarks', inspection.remarks],
      ['Admin Review Notes', inspection.adminNotes || 'None'],
      ['Submitted At', formatTimestamp(inspection.createdAt)],
      [
        'Last Updated',
        `${formatTimestamp(inspection.updatedAt)}${
          inspection.lastEditedByName ? ` by ${inspection.lastEditedByName}` : ''
        }`,
      ],
    ],
    headStyles: {
      fillColor: [30, 41, 59],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 9.5,
    },
    styles: {
      fontSize: 9.5,
      textColor: [15, 23, 42],
      lineColor: [226, 232, 240],
      cellPadding: 4,
    },
    columnStyles: {
      0: { cellWidth: 52, fontStyle: 'bold', fillColor: [248, 250, 252] },
      1: { cellWidth: 'auto' },
    },
  });

  const safePole = inspection.poleNo.replace(/[^a-zA-Z0-9_-]/g, '_');
  const filename = `pole-report-${safePole}-${inspection.inspectionDate}.pdf`;
  doc.save(filename);
  return filename;
}
