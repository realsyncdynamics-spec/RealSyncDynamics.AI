// AuditExportView — Audit-Ready Export Center
// DSGVO/EU AI Act Behördenexporte + Audit-Pakete
// Exporte laufen über die governance-analytics-export Edge Function (user JWT).
import React, { useState, useEffect } from 'react';
import { fetchTenantEvents, type DbGovernanceEvent } from '../governanceApi';
import {
  ClipboardCheck,
  Package,
  FileDown,
  CheckCircle,
  Clock,
  Download,
  FileText,
  Shield,
  Briefcase,
  BarChart3,
  AlertCircle,
  Loader2,
  AlertTriangle,
} from 'lucide-react';
import { useTenant } from '../../../core/access/TenantProvider';
import { AuthGate } from '../../kodee/connections/AuthGate';
import { withPerformanceMonitoring } from '../../../lib/hoc';
import {
  exportAnalytics,
  triggerBlobDownload,
  buildExportFilename,
  defaultRange,
  type ExportFormat,
} from './auditExportApi';

// ── Typen ──────────────────────────────────────────────────────────────────
type PackageStatus = 'bereit' | 'in-vorbereitung' | 'archiviert';

interface AuditPackage {
  id: string;
  name: string;
  status: PackageStatus;
  docCount: number;
  totalDocs?: number;
  signed: boolean;
  createdAt: string;
  period: string;
}

interface RecentExport {
  id: string;
  name: string;
  type: string;
  createdAt: string;
  signed: boolean;
  sizeKb: number;
}

interface AuditEvent {
  id: string;
  ts: string;
  actor: string;
  action: string;
  target: string;
  severity: 'info' | 'warn' | 'ok';
}

// ── Mock-Daten ─────────────────────────────────────────────────────────────
const AUDIT_PACKAGES: AuditPackage[] = [
  {
    id: 'dsgvo-q2',
    name: 'DSGVO 360° Audit Q2 2026',
    status: 'bereit',
    docCount: 47,
    signed: true,
    createdAt: '15.06.2026',
    period: 'Apr – Jun 2026',
  },
  {
    id: 'ai-act-readiness',
    name: 'EU AI Act Readiness Assessment',
    status: 'in-vorbereitung',
    docCount: 12,
    totalDocs: 18,
    signed: false,
    createdAt: '12.06.2026',
    period: 'Stand 16.06.2026',
  },
  {
    id: 'cookie-compliance',
    name: 'Cookie Compliance Export',
    status: 'bereit',
    docCount: 8,
    signed: true,
    createdAt: '10.06.2026',
    period: 'Mai – Jun 2026',
  },
];

const RECENT_EXPORTS: RecentExport[] = [
  { id: 'e1', name: 'DSE-Export Q2', type: 'PDF', createdAt: '15.06.2026 09:12', signed: true, sizeKb: 245 },
  { id: 'e2', name: 'VVT Vollständig', type: 'PDF', createdAt: '14.06.2026 16:30', signed: true, sizeKb: 189 },
  { id: 'e3', name: 'Cookie Evidence CSV', type: 'CSV', createdAt: '13.06.2026 11:00', signed: false, sizeKb: 58 },
  { id: 'e4', name: 'Behörden-Bundle BSI', type: 'ZIP', createdAt: '10.06.2026 14:22', signed: true, sizeKb: 1240 },
  { id: 'e5', name: 'Wirtschaftsprüfer-Bundle', type: 'ZIP', createdAt: '09.06.2026 09:00', signed: true, sizeKb: 876 },
];

const AUDIT_TRAIL: AuditEvent[] = [
  { id: 't1', ts: 'Heute 10:01', actor: 'Evidence Agent', action: 'Snapshot erstellt',     target: 'website:example.com', severity: 'ok' },
  { id: 't2', ts: 'Heute 09:32', actor: 'DSGVO Agent',    action: 'Scan abgeschlossen',    target: 'DSE v3.2',            severity: 'ok' },
  { id: 't3', ts: 'Heute 09:14', actor: 'Cookie Agent',   action: '2 Findings erkannt',    target: 'Meta Pixel',          severity: 'warn' },
  { id: 't4', ts: 'Gestern 16:30', actor: 'AVV Agent',    action: 'Dokument aktualisiert', target: 'AVV-Vorlage v2.1',    severity: 'ok' },
  { id: 't5', ts: 'Gestern 14:00', actor: 'Audit Agent',  action: 'Report exportiert',     target: 'Q2-Audit-Paket',      severity: 'ok' },
  { id: 't6', ts: '14.06. 11:20', actor: 'Risk Agent',    action: 'Risiko eskaliert',      target: 'DSFA: CV-Screening',  severity: 'warn' },
  { id: 't7', ts: '13.06. 09:00', actor: 'TOM Agent',     action: 'TOM-Check bestanden',   target: 'Verschlüsselung',     severity: 'ok' },
  { id: 't8', ts: '12.06. 15:45', actor: 'Incident Agent', action: 'Incident geschlossen', target: 'INC-2026-004',        severity: 'info' },
  { id: 't9', ts: '11.06. 08:30', actor: 'Audit Agent',   action: 'Behörden-Export bereit', target: 'BSI-Bundle',         severity: 'ok' },
  { id: 't10', ts: '10.06. 17:00', actor: 'AI Act Agent', action: 'Hochrisiko bestätigt',  target: 'KI-System: Recruiter', severity: 'warn' },
];

// ── Package Status Badge ───────────────────────────────────────────────────
function PackageStatusBadge({ status, docCount, totalDocs }: { status: PackageStatus; docCount: number; totalDocs?: number }) {
  if (status === 'bereit') {
    return (
      <span className="flex items-center gap-1.5 px-2.5 py-1 bg-teal-600/20 border border-teal-600/40 text-teal-400 font-mono text-[10px]">
        <CheckCircle className="h-3 w-3" />
        Bereit · {docCount} Dokumente
      </span>
    );
  }
  if (status === 'in-vorbereitung') {
    return (
      <span className="flex items-center gap-1.5 px-2.5 py-1 bg-amber-600/20 border border-amber-600/40 text-amber-400 font-mono text-[10px]">
        <Clock className="h-3 w-3" />
        In Vorbereitung · {docCount}/{totalDocs} Dokumente
      </span>
    );
  }
  return (
    <span className="flex items-center gap-1.5 px-2.5 py-1 bg-obsidian-800 border border-titanium-800 text-titanium-500 font-mono text-[10px]">
      <Clock className="h-3 w-3" />
      Archiviert
    </span>
  );
}

// ── Severity Icon ──────────────────────────────────────────────────────────
function SeverityIcon({ severity }: { severity: AuditEvent['severity'] }) {
  if (severity === 'ok')   return <CheckCircle className="h-3.5 w-3.5 text-teal-400 shrink-0" />;
  if (severity === 'warn') return <AlertCircle className="h-3.5 w-3.5 text-amber-400 shrink-0" />;
  return <Clock className="h-3.5 w-3.5 text-titanium-500 shrink-0" />;
}

function eventToAuditEvent(e: DbGovernanceEvent): AuditEvent {
  const diffMs  = Date.now() - new Date(e.created_at).getTime();
  const diffMin = Math.floor(diffMs / 60_000);
  const ts = diffMin < 60
    ? `vor ${diffMin} Min.`
    : diffMin < 1440
      ? `vor ${Math.floor(diffMin / 60)} Std.`
      : `vor ${Math.floor(diffMin / 1440)} Tag${Math.floor(diffMin / 1440) !== 1 ? 'en' : ''}`;
  const severity: AuditEvent['severity'] =
    e.risk_level === 'critical' || e.risk_level === 'high' ? 'warn' :
    e.risk_level === 'low' || e.risk_level === 'info'      ? 'ok'   : 'info';
  return {
    id:       e.id,
    ts,
    actor:    e.actor_email ?? e.event_source,
    action:   e.event_type,
    target:   e.title,
    severity,
  };
}

// ── AuditExportView ────────────────────────────────────────────────────────
function _AuditExportView() {
  return <AuthGate>{() => <Inner />}</AuthGate>;
}

export const AuditExportView = withPerformanceMonitoring(
  _AuditExportView,
  'AuditExportView',
  { threshold: 500, maxRenders: 10 }
);

function Inner() {
  return <div className="p-8 text-titanium-400">Audit Export view coming soon...</div>;
}
