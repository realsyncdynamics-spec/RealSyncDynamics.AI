/**
 * Evidence Vault — Governance Operating System
 * Hauptansicht für DSGVO- und EU-AI-Act-Nachweise.
 *
 * Tabs:
 *   1. Timeline      — chronologische Nachweis-Liste
 *   2. Snapshots     — Website-/System-Snapshots
 *   3. Audit Trail   — Wer hat wann was getan
 *   4. Change Tracking — Diff-Ansicht governance-relevanter Artefakte
 *   5. Exports       — Export-Steuerung
 */
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTenant } from '../../../core/access/TenantProvider';
import { AuthGate } from '../../kodee/connections/AuthGate';
import { withPerformanceMonitoring } from '../../../lib/hoc';
import { fetchTenantEvents, type DbGovernanceEvent } from '../governanceApi';
import {
  exportAnalytics,
  triggerBlobDownload,
  buildExportFilename,
  defaultRange,
  type ExportFormat,
} from '../audit/auditExportApi';
import {
  Camera,
  Shield,
  FileText,
  Activity,
  Edit,
  Cpu,
  Download,
  Bot,
  User,
  Settings,
  CheckCircle,
  XCircle,
  Clock,
  AlertTriangle,
  Package,
  ChevronRight,
  Eye,
  GitCompare,
  Plus,
  Minus,
  Loader2,
} from 'lucide-react';

// ── Typen ────────────────────────────────────────────────────────────────────

type EvidenceType = 'Screenshot' | 'Scan Report' | 'Document' | 'Network Trace' | 'Policy Change' | 'AI Classification';
type AuditOutcome = 'success' | 'warning' | 'error';
type ActorType = 'agent' | 'user' | 'system';
type ChangeType = 'Neu' | 'Geändert' | 'Entfernt' | 'Erkannt';
type ChangeSeverity = 'critical' | 'high' | 'medium' | 'low';
type SnapshotStatus = 'passed' | 'medium' | 'high' | 'critical';

interface EvidenceItem {
  id: string;
  ts: string;
  type: EvidenceType;
  title: string;
  description: string;
  source: string;
  domain: string;
  hash: string;
  c2pa: boolean;
}

interface Snapshot {
  id: string;
  domain: string;
  date: string;
  score: number;
  findings: number;
  status: SnapshotStatus;
  c2pa: boolean;
}

interface AuditEntry {
  id: string;
  ts: string;
  actor: string;
  actorType: ActorType;
  action: string;
  target: string;
  outcome: AuditOutcome;
}

interface ChangeEntry {
  id: string;
  artifact: string;
  type: ChangeType;
  field: string;
  before: string | null;
  after: string | null;
  ts: string;
  severity: ChangeSeverity;
}

interface ExportEntry {
  id: string;
  name: string;
  type: string;
  size: string;
  items: number;
  created: string;
  signed: boolean;
  signedBy: string | null;
}

// ── Mock-Daten ────────────────────────────────────────────────────────────────

const EVIDENCE_TIMELINE: EvidenceItem[] = [
  { id: 'ev-001', ts: '16.06.2026 · 06:00', type: 'Scan Report',       title: 'Vollständiger Compliance-Scan abgeschlossen',          description: '5 Domains, 791 Seiten, 3 neue Findings. DSGVO-Score: 78/100',                              source: 'Automatisierter Scan',   domain: 'atelier-nord.de',         hash: 'sha256:9f4a...e91c', c2pa: true  },
  { id: 'ev-002', ts: '15.06.2026 · 23:14', type: 'Screenshot',         title: 'Cookie-Banner Zustand — shop.atelier-nord.de',         description: 'Zustand des Cookie-Banners vor und nach Interaktion dokumentiert',                           source: 'Monitoring Agent',       domain: 'shop.atelier-nord.de',    hash: 'sha256:3b7d...f20a', c2pa: true  },
  { id: 'ev-003', ts: '15.06.2026 · 17:42', type: 'AI Classification',  title: 'Risikoklassifizierung Empfehlungsalgorithmus v2.3',    description: 'EU AI Act Art. 6 — Begrenztes Risiko. Transparenzpflichten aktiv.',                        source: 'AI Act Agent',           domain: 'AI Use Case Registry',   hash: 'sha256:7c91...b44e', c2pa: true  },
  { id: 'ev-004', ts: '15.06.2026 · 11:05', type: 'Document',           title: 'Evidence-Bundle für externen Wirtschaftsprüfer',      description: '47 Nachweise, C2PA-signiert, PDF + JSON-LD Export',                                         source: 'Audit Agent',            domain: 'Organisation',            hash: 'sha256:a12f...09d3', c2pa: true  },
  { id: 'ev-005', ts: '14.06.2026 · 09:14', type: 'Network Trace',      title: 'Drittanbieter-Requests — app.atelier-nord.de',        description: 'HAR-Datei: Meta Pixel vor Consent-Interaktion initialisiert',                               source: 'Tracking Agent',         domain: 'app.atelier-nord.de',    hash: 'sha256:8f3a...d21c', c2pa: true  },
  { id: 'ev-006', ts: '14.06.2026 · 08:00', type: 'Policy Change',      title: 'Datenschutzerklärung v3.1 → v3.2',                   description: 'Sub-Prozessoren-Liste aktualisiert (Mailchimp entfernt, Brevo hinzugefügt)',                  source: 'DPO: L. Vogel',          domain: 'atelier-nord.de',         hash: 'sha256:2d88...77bc', c2pa: false },
  { id: 'ev-007', ts: '13.06.2026 · 14:20', type: 'Screenshot',         title: 'Drittland-Transfer Nachweis — Schriftarten-CDN',      description: 'US-CDN ohne SCC-Nachweis. Netzwerkrequest nach fonts.googleapis.com',                       source: 'Tracking Agent',         domain: 'atelier-nord.de',         hash: 'sha256:1e4b...5f39', c2pa: true  },
  { id: 'ev-008', ts: '12.06.2026 · 10:02', type: 'Scan Report',        title: 'Sub-Domain Discovery — partner.atelier-nord.de',      description: 'Neue Sub-Domain automatisch erkannt und zu Asset-Inventar hinzugefügt',                      source: 'Website Agent',          domain: 'partner.atelier-nord.de', hash: 'sha256:4a93...c81d', c2pa: true  },
  { id: 'ev-009', ts: '11.06.2026 · 07:00', type: 'Document',           title: 'Wöchentlicher Compliance-Report KW24',                description: 'Management-Summary: 3 kritische, 5 hohe, 8 mittlere Risiken',                               source: 'Report Builder Agent',   domain: 'Organisation',            hash: 'sha256:b56e...2a44', c2pa: true  },
  { id: 'ev-010', ts: '10.06.2026 · 03:00', type: 'Network Trace',      title: 'SSL-Zertifikat Erneuerung — app.atelier-nord.de',     description: 'TLS 1.3 Zertifikat automatisch erneuert. Ablauf: 10.09.2026',                               source: 'Security Header Agent',  domain: 'app.atelier-nord.de',    hash: 'sha256:d77a...9c12', c2pa: false },
  { id: 'ev-011', ts: '09.06.2026 · 16:30', type: 'AI Classification',  title: 'CV-Screening Tool — Hochrisiko-Klassifizierung',      description: 'EU AI Act Art. 6 Anhang III — Hochrisiko bestätigt. Konformitätsbewertung erforderlich.',   source: 'AI Act Agent',           domain: 'AI Use Case Registry',   hash: 'sha256:e23f...a90b', c2pa: true  },
  { id: 'ev-012', ts: '08.06.2026 · 14:15', type: 'Document',           title: 'TOM-Dokumentation 2026 freigegeben',                  description: 'Art. 32 DSGVO — TOMs geprüft und durch M. Brandt freigegeben',                              source: 'DPO: M. Brandt',         domain: 'Organisation',            hash: 'sha256:f91c...3b77', c2pa: true  },
  { id: 'ev-013', ts: '07.06.2026 · 11:00', type: 'Screenshot',         title: 'Cookie-Kategorien fehlen — blog.atelier-nord.de',     description: 'TDDDG §25 Verstoß: Nur „Alle akzeptieren" oder „Alle ablehnen" möglich',                    source: 'Cookie Agent',           domain: 'blog.atelier-nord.de',   hash: 'sha256:6d40...c55e', c2pa: true  },
  { id: 'ev-014', ts: '06.06.2026 · 09:30', type: 'Network Trace',      title: 'Google Analytics — Consent-Timing-Analyse',           description: 'GA4 Event-Fire vor Consent-Bestätigung (Δt = -2.3s)',                                      source: 'Tracking Agent',         domain: 'blog.atelier-nord.de',   hash: 'sha256:3a19...7f82', c2pa: true  },
  { id: 'ev-015', ts: '05.06.2026 · 15:45', type: 'Policy Change',      title: 'AVV mit Netlify aktualisiert',                        description: 'Art. 28 DSGVO — AVV v2 signiert und archiviert',                                            source: 'DPO: L. Vogel',          domain: 'Organisation',            hash: 'sha256:8b22...d03f', c2pa: false },
  { id: 'ev-016', ts: '04.06.2026 · 08:00', type: 'Scan Report',        title: 'AI Act Readiness Assessment',                         description: '18 Prüfpunkte, 12/18 erfüllt. Gap: Konformitätsbewertung CV-Screening',                     source: 'AI Act Agent',           domain: 'Organisation',            hash: 'sha256:c44d...1e96', c2pa: true  },
  { id: 'ev-017', ts: '03.06.2026 · 14:00', type: 'Document',           title: 'VVT Export Q2 2026',                                  description: '23 Verarbeitungstätigkeiten, Art. 30 DSGVO konform',                                        source: 'VVZ Agent',              domain: 'Organisation',            hash: 'sha256:a02d...f9e1', c2pa: true  },
  { id: 'ev-018', ts: '02.06.2026 · 10:20', type: 'Screenshot',         title: 'Security Header Audit — atelier-nord.de',             description: 'CSP, HSTS, X-Frame-Options vorhanden. Referrer-Policy fehlt.',                              source: 'Security Header Agent',  domain: 'atelier-nord.de',         hash: 'sha256:5f87...2c44', c2pa: true  },
  { id: 'ev-019', ts: '01.06.2026 · 08:00', type: 'Document',           title: 'DSGVO 360° Audit Q1 2026 abgeschlossen',              description: 'Vollständiger Audit-Report, 47 Dokumente, C2PA-signiert',                                   source: 'Audit Agent',            domain: 'Organisation',            hash: 'sha256:1b9e...77af', c2pa: true  },
  { id: 'ev-020', ts: '28.05.2026 · 16:00', type: 'AI Classification',  title: 'Chatbot „Kodee" — Begrenzte Risikostufe',             description: 'EU AI Act Art. 52 — Transparenzpflicht aktiv. Nutzer-Information vorhanden.',              source: 'AI Act Agent',           domain: 'AI Use Case Registry',   hash: 'sha256:7a03...b11c', c2pa: true  },
];

const SNAPSHOTS: Snapshot[] = [
  { id: 'snap-1', domain: 'atelier-nord.de',         date: '16.06.2026 06:00', score: 92, findings: 1, status: 'passed',   c2pa: true  },
  { id: 'snap-2', domain: 'shop.atelier-nord.de',    date: '16.06.2026 06:00', score: 68, findings: 4, status: 'medium',   c2pa: true  },
  { id: 'snap-3', domain: 'blog.atelier-nord.de',    date: '16.06.2026 06:00', score: 54, findings: 6, status: 'high',     c2pa: true  },
  { id: 'snap-4', domain: 'app.atelier-nord.de',     date: '16.06.2026 06:00', score: 38, findings: 9, status: 'critical', c2pa: true  },
  { id: 'snap-5', domain: 'partner.atelier-nord.de', date: '16.06.2026 06:00', score: 88, findings: 2, status: 'passed',   c2pa: true  },
  { id: 'snap-6', domain: 'atelier-nord.de',         date: '09.06.2026 06:00', score: 89, findings: 2, status: 'passed',   c2pa: false },
];

const AUDIT_TRAIL: AuditEntry[] = [
  { id: 'at-1',  ts: '16.06.2026 06:17', actor: 'System',         actorType: 'system', action: 'Compliance-Scan gestartet',             target: 'Alle 5 Domains',            outcome: 'success' },
  { id: 'at-2',  ts: '15.06.2026 17:42', actor: 'AI Act Agent',   actorType: 'agent',  action: 'Risikoklassifizierung erstellt',         target: 'Empfehlungsalgorithmus v2.3', outcome: 'success' },
  { id: 'at-3',  ts: '15.06.2026 11:05', actor: 'M. Brandt',      actorType: 'user',   action: 'Evidence-Export genehmigt',              target: 'Audit Bundle Q2 2026',      outcome: 'success' },
  { id: 'at-4',  ts: '14.06.2026 09:14', actor: 'Tracking Agent', actorType: 'agent',  action: 'Meta Pixel Nachweis erstellt',           target: 'app.atelier-nord.de',       outcome: 'success' },
  { id: 'at-5',  ts: '14.06.2026 08:00', actor: 'L. Vogel',       actorType: 'user',   action: 'Datenschutzerklärung v3.2 freigegeben',  target: 'DSE atelier-nord.de',       outcome: 'success' },
  { id: 'at-6',  ts: '13.06.2026 14:20', actor: 'Tracking Agent', actorType: 'agent',  action: 'Drittland-Transfer erkannt',             target: 'fonts.googleapis.com',      outcome: 'warning' },
  { id: 'at-7',  ts: '12.06.2026 10:02', actor: 'Website Agent',  actorType: 'agent',  action: 'Neue Domain hinzugefügt',               target: 'partner.atelier-nord.de',   outcome: 'success' },
  { id: 'at-8',  ts: '11.06.2026 07:00', actor: 'Report Builder', actorType: 'agent',  action: 'Weekly Report erstellt',                target: 'KW24 Report',               outcome: 'success' },
  { id: 'at-9',  ts: '10.06.2026 03:00', actor: 'System',         actorType: 'system', action: 'SSL-Zertifikat erneuert',               target: 'app.atelier-nord.de',       outcome: 'success' },
  { id: 'at-10', ts: '09.06.2026 16:30', actor: 'AI Act Agent',   actorType: 'agent',  action: 'Hochrisiko-Klassifizierung erstellt',   target: 'CV-Screening Tool',         outcome: 'warning' },
  { id: 'at-11', ts: '08.06.2026 14:15', actor: 'M. Brandt',      actorType: 'user',   action: 'TOM-Dokumentation freigegeben',         target: 'TOM v2026.1',               outcome: 'success' },
  { id: 'at-12', ts: '07.06.2026 11:00', actor: 'Cookie Agent',   actorType: 'agent',  action: 'Cookie-Verstoß dokumentiert',           target: 'blog.atelier-nord.de',      outcome: 'error'   },
];

const CHANGES: ChangeEntry[] = [
  { id: 'ch-1', artifact: 'shop.atelier-nord.de',  type: 'Erkannt',  field: 'Neuer Tracker',     before: null,                      after: 'analytics.partner.io',     ts: '12.06.2026 09:14', severity: 'high'     },
  { id: 'ch-2', artifact: 'Datenschutzerklärung',  type: 'Geändert', field: 'Sub-Prozessoren',   before: 'Mailchimp, HubSpot, Stripe', after: 'Brevo, HubSpot, Stripe',  ts: '14.06.2026 08:00', severity: 'medium'   },
  { id: 'ch-3', artifact: 'atelier-nord.de',       type: 'Erkannt',  field: 'Cookie-Anzahl',     before: '11',                      after: '12',                       ts: '15.06.2026 23:14', severity: 'low'      },
  { id: 'ch-4', artifact: 'AI Use Case Registry',  type: 'Geändert', field: 'Modellversion',     before: 'Empfehlung v2.2',         after: 'Empfehlung v2.3',          ts: '15.06.2026 17:42', severity: 'medium'   },
  { id: 'ch-5', artifact: 'partner.atelier-nord.de', type: 'Neu',    field: 'Domain entdeckt',   before: null,                      after: 'partner.atelier-nord.de',  ts: '12.06.2026 10:02', severity: 'low'      },
  { id: 'ch-6', artifact: 'app.atelier-nord.de',   type: 'Erkannt',  field: 'Meta Pixel',        before: 'consent-gated',           after: 'immer aktiv',              ts: '14.06.2026 09:14', severity: 'critical' },
  { id: 'ch-7', artifact: 'AVV Netlify',            type: 'Geändert', field: 'Version',           before: 'v1',                      after: 'v2',                       ts: '05.06.2026 15:45', severity: 'low'      },
  { id: 'ch-8', artifact: 'blog.atelier-nord.de',  type: 'Geändert', field: 'Cookie-Banner',     before: 'Granular',                after: 'Binär (alle/keine)',        ts: '07.06.2026 11:00', severity: 'high'     },
];

const RECENT_EXPORTS: ExportEntry[] = [
  { id: 'exp-1', name: 'DSGVO Audit Bundle Q2 2026',    type: 'PDF + JSON-LD', size: '8.4 MB', items: 47, created: '15.06.2026 11:05', signed: true,  signedBy: 'M. Brandt' },
  { id: 'exp-2', name: 'Cookie Evidence Export',         type: 'CSV',          size: '124 KB', items: 12, created: '12.06.2026 09:30', signed: false, signedBy: null        },
  { id: 'exp-3', name: 'AI Act Readiness Report',        type: 'PDF',          size: '2.1 MB', items: 18, created: '04.06.2026 08:00', signed: true,  signedBy: 'M. Brandt' },
  { id: 'exp-4', name: 'VVT Export Q2 2026',             type: 'PDF + DOCX',   size: '540 KB', items: 23, created: '03.06.2026 14:00', signed: true,  signedBy: 'L. Vogel'  },
  { id: 'exp-5', name: 'DSR Export — subject_ref: 3f9a...', type: 'JSON-LD',   size: '48 KB',  items: 34, created: '01.06.2026 10:00', signed: false, signedBy: null        },
];

// ── Hilfsfunktionen ───────────────────────────────────────────────────────────

function evidenceTypeConfig(type: EvidenceType): { color: string; icon: React.ReactNode } {
  switch (type) {
    case 'Screenshot':        return { color: 'text-teal-400',   icon: <Camera className="h-4 w-4" /> };
    case 'Scan Report':       return { color: 'text-blue-400',   icon: <Shield className="h-4 w-4" /> };
    case 'Document':          return { color: 'text-amber-400',  icon: <FileText className="h-4 w-4" /> };
    case 'Network Trace':     return { color: 'text-purple-400', icon: <Activity className="h-4 w-4" /> };
    case 'Policy Change':     return { color: 'text-orange-400', icon: <Edit className="h-4 w-4" /> };
    case 'AI Classification': return { color: 'text-pink-400',   icon: <Cpu className="h-4 w-4" /> };
  }
}

function snapshotStatusConfig(status: SnapshotStatus): { label: string; color: string; scoreColor: string } {
  switch (status) {
    case 'passed':   return { label: 'Bestanden',  color: 'text-teal-400',   scoreColor: 'text-teal-400'   };
    case 'medium':   return { label: 'Mittel',     color: 'text-amber-400',  scoreColor: 'text-amber-400'  };
    case 'high':     return { label: 'Hoch',       color: 'text-orange-400', scoreColor: 'text-orange-400' };
    case 'critical': return { label: 'Kritisch',   color: 'text-red-400',    scoreColor: 'text-red-400'    };
  }
}

function outcomeConfig(outcome: AuditOutcome): { color: string; icon: React.ReactNode } {
  switch (outcome) {
    case 'success': return { color: 'text-teal-400',   icon: <CheckCircle className="h-3.5 w-3.5" /> };
    case 'warning': return { color: 'text-amber-400',  icon: <AlertTriangle className="h-3.5 w-3.5" /> };
    case 'error':   return { color: 'text-red-400',    icon: <XCircle className="h-3.5 w-3.5" /> };
  }
}

function actorIcon(type: ActorType): React.ReactNode {
  switch (type) {
    case 'agent':  return <Bot className="h-3.5 w-3.5 text-teal-400" />;
    case 'user':   return <User className="h-3.5 w-3.5 text-blue-400" />;
    case 'system': return <Settings className="h-3.5 w-3.5 text-titanium-500" />;
  }
}

function changeTypeConfig(type: ChangeType): { color: string; bgColor: string } {
  switch (type) {
    case 'Neu':      return { color: 'text-teal-300',   bgColor: 'bg-teal-950 border-teal-800'   };
    case 'Geändert': return { color: 'text-amber-300',  bgColor: 'bg-amber-950 border-amber-800'  };
    case 'Entfernt': return { color: 'text-red-300',    bgColor: 'bg-red-950 border-red-800'      };
    case 'Erkannt':  return { color: 'text-purple-300', bgColor: 'bg-purple-950 border-purple-800' };
  }
}

function severityColor(severity: ChangeSeverity): string {
  switch (severity) {
    case 'critical': return 'text-red-400';
    case 'high':     return 'text-orange-400';
    case 'medium':   return 'text-amber-400';
    case 'low':      return 'text-blue-400';
  }
}

// ── C2PA Badge ────────────────────────────────────────────────────────────────

function C2paBadge() {
  return (
    <span className="text-[9px] font-mono bg-teal-950 border border-teal-800 text-teal-300 px-1.5 py-0.5 whitespace-nowrap">
      C2PA
    </span>
  );
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function eventToEvidenceItem(e: DbGovernanceEvent): EvidenceItem {
  const typeMap: Record<string, EvidenceType> = {
    website_scanner:  'Scan Report',
    browser_extension:'Screenshot',
    manual:           'Document',
    agent_runtime:    'AI Classification',
    api:              'Network Trace',
    sdk:              'Network Trace',
    github:           'Network Trace',
    ci_cd:            'Network Trace',
  };
  const diffMs = Date.now() - new Date(e.created_at).getTime();
  const diffMin = Math.floor(diffMs / 60_000);
  const ts = diffMin < 60
    ? `vor ${diffMin} Min.`
    : diffMin < 1440
    ? `vor ${Math.floor(diffMin / 60)} Std.`
    : `vor ${Math.floor(diffMin / 1440)} Tag${Math.floor(diffMin / 1440) !== 1 ? 'en' : ''}`;
  return {
    id: e.id,
    ts,
    type: typeMap[e.event_source] ?? 'Scan Report',
    title: e.title,
    description: e.summary ?? e.title,
    source: e.event_source,
    domain: (e.payload?.['url'] as string | undefined) ?? e.vendor ?? e.model_name ?? '-',
    hash: (e.payload?.['hash'] as string | undefined) ?? `sha256:${e.id.slice(0, 8)}…`,
    c2pa: (e.payload?.['c2pa'] as boolean | undefined) ?? false,
  };
}

// ── Tab 1 — Evidence Timeline ─────────────────────────────────────────────────

interface EvidenceHandlers {
  onExport: (prefix: string, format: ExportFormat, key: string) => void;
  onViewEvidence: (id: string, isLive: boolean) => void;
  onCompare: () => void;
  onShowTimeline: () => void;
  busy: string | null;
}

function TimelineTab({ liveEvents, handlers }: { liveEvents: DbGovernanceEvent[] | null; handlers: EvidenceHandlers }) {
  const isLive = liveEvents !== null && liveEvents.length > 0;
  const items = isLive
    ? liveEvents.map(eventToEvidenceItem)
    : EVIDENCE_TIMELINE;
  return (
    <div className="divide-y divide-titanium-900">
      {items.map((item) => {
        const cfg = evidenceTypeConfig(item.type);
        return (
          <div key={item.id} className="flex gap-4 px-4 py-3 hover:bg-obsidian-900/60 group">
            {/* Timestamp */}
            <div className="w-36 shrink-0 pt-0.5">
              <span className="font-mono text-[11px] text-titanium-500 whitespace-nowrap">{item.ts}</span>
            </div>

            {/* Typ-Icon */}
            <div className={`shrink-0 pt-0.5 ${cfg.color}`}>{cfg.icon}</div>

            {/* Inhalt */}
            <div className="flex-1 min-w-0">
              <div className="flex items-start gap-2 flex-wrap">
                <span className="text-sm font-semibold text-titanium-50 leading-tight">{item.title}</span>
                {item.c2pa && <C2paBadge />}
              </div>
              <p className="text-[11px] text-titanium-400 mt-0.5 leading-relaxed">{item.description}</p>
              <div className="flex items-center gap-3 mt-1">
                <span className="font-mono text-[10px] text-titanium-600">{item.source}</span>
                <span className="text-titanium-800">·</span>
                <span className="font-mono text-[10px] text-teal-700">{item.domain}</span>
              </div>
            </div>

            {/* Rechte Seite */}
            <div className="shrink-0 flex flex-col items-end gap-1.5 pt-0.5 min-w-[160px]">
              <span className={`text-[10px] font-mono font-semibold uppercase tracking-wider ${cfg.color}`}>
                {item.type}
              </span>
              <span className="font-mono text-[10px] text-titanium-500">{item.hash}</span>
              <button
                onClick={() => handlers.onViewEvidence(item.id, isLive)}
                className="text-[10px] font-mono text-teal-400 hover:text-teal-300 border border-teal-900 hover:border-teal-700 px-2 py-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
              >
                Ansehen
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── Tab 2 — Snapshots ─────────────────────────────────────────────────────────

function SnapshotsTab({ handlers }: { handlers: EvidenceHandlers }) {
  return (
    <div className="p-4 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
      {SNAPSHOTS.map((snap) => {
        const cfg = snapshotStatusConfig(snap.status);
        return (
          <div key={snap.id} className="border border-titanium-900 bg-obsidian-900/40 flex flex-col">
            {/* Screenshot-Platzhalter */}
            <div className="bg-obsidian-950 border-b border-titanium-900 h-28 flex flex-col items-center justify-center gap-1">
              <Camera className="h-5 w-5 text-titanium-700" />
              <span className="font-mono text-[11px] text-titanium-600">{snap.domain}</span>
              <span className="font-mono text-[9px] text-titanium-700 uppercase tracking-wider">Snapshot</span>
            </div>

            {/* Meta */}
            <div className="px-3 pt-2.5 pb-1">
              <div className="flex items-start justify-between gap-2">
                <span className="font-mono text-[11px] text-titanium-100 font-semibold break-all">{snap.domain}</span>
                {snap.c2pa && <C2paBadge />}
              </div>
              <span className="font-mono text-[10px] text-titanium-500">{snap.date}</span>
            </div>

            {/* Score */}
            <div className="px-3 py-2 flex items-center gap-3">
              <div className="flex-1">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[10px] font-mono text-titanium-500 uppercase tracking-wider">Score</span>
                  <span className={`text-sm font-display font-bold tabular-nums ${cfg.scoreColor}`}>{snap.score}</span>
                </div>
                <div className="h-1 bg-obsidian-950 border border-titanium-900">
                  <div
                    className={`h-full ${snap.status === 'passed' ? 'bg-teal-600' : snap.status === 'medium' ? 'bg-amber-600' : snap.status === 'high' ? 'bg-orange-600' : 'bg-red-600'}`}
                    style={{ width: `${snap.score}%` }}
                  />
                </div>
              </div>
            </div>

            {/* Findings + Status */}
            <div className="px-3 pb-2 flex items-center justify-between">
              <span className="text-[10px] text-titanium-500">{snap.findings} Findings</span>
              <span className={`text-[10px] font-mono font-semibold uppercase ${cfg.color}`}>{cfg.label}</span>
            </div>

            {/* Aktionen */}
            <div className="border-t border-titanium-900 px-3 py-2 flex items-center gap-2">
              <button
                onClick={() => handlers.onExport(`Snapshot-${snap.domain}`, 'pdf', `snap-${snap.id}`)}
                disabled={handlers.busy === `snap-${snap.id}`}
                className="flex-1 text-[10px] font-mono text-titanium-400 hover:text-titanium-200 border border-titanium-900 hover:border-titanium-700 py-1 flex items-center justify-center gap-1 disabled:opacity-50"
              >
                {handlers.busy === `snap-${snap.id}` ? <Loader2 className="h-3 w-3 animate-spin" /> : <Download className="h-3 w-3" />}Herunterladen
              </button>
              <button
                onClick={handlers.onCompare}
                className="flex-1 text-[10px] font-mono text-titanium-400 hover:text-titanium-200 border border-titanium-900 hover:border-titanium-700 py-1 flex items-center justify-center gap-1"
              >
                <GitCompare className="h-3 w-3" />Vergleichen
              </button>
              <button
                onClick={handlers.onShowTimeline}
                className="flex-1 text-[10px] font-mono text-teal-500 hover:text-teal-300 border border-teal-900 hover:border-teal-700 py-1 flex items-center justify-center gap-1"
              >
                <Eye className="h-3 w-3" />Nachweis
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── Tab 3 — Audit Trail ───────────────────────────────────────────────────────

function AuditTrailTab() {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-[10px] font-mono uppercase tracking-wider text-titanium-500 border-b border-titanium-900">
            <th className="text-left py-2.5 px-4">Zeitstempel</th>
            <th className="text-left py-2.5 px-3">Akteur</th>
            <th className="text-left py-2.5 px-3">Aktion</th>
            <th className="text-left py-2.5 px-3">Ziel</th>
            <th className="text-center py-2.5 px-4">Status</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-titanium-900">
          {AUDIT_TRAIL.map((entry) => {
            const outcome = outcomeConfig(entry.outcome);
            return (
              <tr key={entry.id} className="hover:bg-obsidian-900/40">
                <td className="py-2.5 px-4 font-mono text-[11px] text-titanium-400 whitespace-nowrap">{entry.ts}</td>
                <td className="py-2.5 px-3">
                  <div className="flex items-center gap-1.5">
                    {actorIcon(entry.actorType)}
                    <span className="text-[12px] text-titanium-200">{entry.actor}</span>
                  </div>
                </td>
                <td className="py-2.5 px-3 text-[12px] text-titanium-100">{entry.action}</td>
                <td className="py-2.5 px-3 font-mono text-[11px] text-titanium-400">{entry.target}</td>
                <td className="py-2.5 px-4">
                  <div className={`flex items-center justify-center gap-1 ${outcome.color}`}>
                    {outcome.icon}
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ── Tab 4 — Change Tracking ───────────────────────────────────────────────────

function ChangeTrackingTab() {
  return (
    <div className="divide-y divide-titanium-900">
      {CHANGES.map((change) => {
        const typeCfg = changeTypeConfig(change.type);
        return (
          <div key={change.id} className="px-4 py-3 hover:bg-obsidian-900/40">
            <div className="flex items-start gap-3 flex-wrap">
              {/* Linke Spalte */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap mb-1">
                  <span className="text-[12px] font-semibold text-titanium-50">{change.artifact}</span>
                  <span className={`text-[9px] font-mono border px-1.5 py-0.5 ${typeCfg.bgColor} ${typeCfg.color}`}>
                    {change.type}
                  </span>
                  <span className={`text-[10px] font-mono font-semibold uppercase ${severityColor(change.severity)}`}>
                    {change.severity}
                  </span>
                </div>
                <div className="text-[11px] font-mono text-titanium-500 mb-2">{change.field}</div>

                {/* Diff */}
                <div className="space-y-1">
                  {change.before !== null && (
                    <div className="flex items-start gap-2 bg-red-950/30 border border-red-900/50 px-2 py-1">
                      <Minus className="h-3 w-3 text-red-400 shrink-0 mt-0.5" />
                      <span className="font-mono text-[11px] text-red-300">{change.before}</span>
                    </div>
                  )}
                  {change.after !== null && (
                    <div className="flex items-start gap-2 bg-teal-950/30 border border-teal-900/50 px-2 py-1">
                      <Plus className="h-3 w-3 text-teal-400 shrink-0 mt-0.5" />
                      <span className="font-mono text-[11px] text-teal-300">{change.after}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Zeitstempel */}
              <div className="shrink-0 text-right">
                <span className="font-mono text-[10px] text-titanium-600">{change.ts}</span>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── Tab 5 — Exports ───────────────────────────────────────────────────────────

const QUICK_EXPORTS: { label: string; icon: React.ReactNode; format: ExportFormat }[] = [
  { label: 'PDF Paket',           icon: <FileText className="h-3.5 w-3.5" />, format: 'pdf' },
  { label: 'CSV Evidence',        icon: <Activity className="h-3.5 w-3.5" />, format: 'csv' },
  { label: 'JSON-LD (DSR)',       icon: <Package className="h-3.5 w-3.5" />, format: 'csv' },
  { label: 'Behörden-Bundle',     icon: <Shield className="h-3.5 w-3.5" />, format: 'pdf' },
  { label: 'Wirtschaftsprüfer-ZIP', icon: <Download className="h-3.5 w-3.5" />, format: 'pdf' },
];

function ExportsTab({ handlers }: { handlers: EvidenceHandlers }) {
  return (
    <div className="p-4 space-y-6">
      {/* Aktive Jobs */}
      <div>
        <h3 className="text-[10px] font-mono uppercase tracking-wider text-titanium-500 mb-3">Aktive Export-Jobs</h3>
        <div className="space-y-2">
          {[
            { name: 'Wirtschaftsprüfer-Bundle Jun 2026', progress: 72 },
            { name: 'AI Act Full Documentation Pack', progress: 38 },
          ].map((job) => (
            <div key={job.name} className="border border-titanium-900 bg-obsidian-900/40 px-3 py-2">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-[12px] text-titanium-100">{job.name}</span>
                <div className="flex items-center gap-1.5">
                  <Clock className="h-3 w-3 text-amber-400" />
                  <span className="font-mono text-[10px] text-amber-400">{job.progress}%</span>
                </div>
              </div>
              <div className="h-1 bg-obsidian-950 border border-titanium-900">
                <div className="h-full bg-amber-600" style={{ width: `${job.progress}%` }} />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Quick Export */}
      <div>
        <h3 className="text-[10px] font-mono uppercase tracking-wider text-titanium-500 mb-3">Schnell-Export</h3>
        <div className="flex flex-wrap gap-2">
          {QUICK_EXPORTS.map((qe) => (
            <button
              key={qe.label}
              onClick={() => handlers.onExport(qe.label, qe.format, `qe-${qe.label}`)}
              disabled={handlers.busy === `qe-${qe.label}`}
              className="flex items-center gap-2 border border-titanium-900 hover:border-teal-700 bg-obsidian-900 hover:bg-obsidian-800 px-3 py-2 text-[11px] font-mono text-titanium-300 hover:text-titanium-100 transition-colors disabled:opacity-50"
            >
              <span className="text-teal-500">{handlers.busy === `qe-${qe.label}` ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : qe.icon}</span>
              {qe.label}
            </button>
          ))}
        </div>
      </div>

      {/* Letzte Exporte */}
      <div>
        <h3 className="text-[10px] font-mono uppercase tracking-wider text-titanium-500 mb-3">Letzte Exporte</h3>
        <div className="border border-titanium-900 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-[10px] font-mono uppercase tracking-wider text-titanium-500 border-b border-titanium-900 bg-obsidian-950">
                <th className="text-left py-2 px-3">Name</th>
                <th className="text-left py-2 px-3">Typ</th>
                <th className="text-right py-2 px-3">Größe</th>
                <th className="text-right py-2 px-3">Nachweise</th>
                <th className="text-left py-2 px-3">Erstellt</th>
                <th className="text-center py-2 px-3">Signiert</th>
                <th className="py-2 px-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-titanium-900">
              {RECENT_EXPORTS.map((exp) => (
                <tr key={exp.id} className="hover:bg-obsidian-900/40">
                  <td className="py-2.5 px-3 text-[12px] text-titanium-100 max-w-[220px] truncate">{exp.name}</td>
                  <td className="py-2.5 px-3 font-mono text-[10px] text-titanium-400">{exp.type}</td>
                  <td className="py-2.5 px-3 text-right font-mono text-[11px] text-titanium-400">{exp.size}</td>
                  <td className="py-2.5 px-3 text-right font-mono text-[11px] tabular-nums text-titanium-300">{exp.items}</td>
                  <td className="py-2.5 px-3 font-mono text-[10px] text-titanium-500 whitespace-nowrap">{exp.created}</td>
                  <td className="py-2.5 px-3 text-center">
                    {exp.signed ? (
                      <div className="flex flex-col items-center gap-0.5">
                        <CheckCircle className="h-3.5 w-3.5 text-teal-400" />
                        <span className="font-mono text-[9px] text-teal-600">{exp.signedBy}</span>
                      </div>
                    ) : (
                      <XCircle className="h-3.5 w-3.5 text-titanium-700 mx-auto" />
                    )}
                  </td>
                  <td className="py-2.5 px-3">
                    <button
                      onClick={() => handlers.onExport(exp.name, exp.type.toUpperCase().includes('CSV') ? 'csv' : 'pdf', `re-${exp.id}`)}
                      disabled={handlers.busy === `re-${exp.id}`}
                      className="text-[10px] font-mono text-teal-500 hover:text-teal-300 border border-teal-900 hover:border-teal-700 px-2 py-0.5 flex items-center gap-1 disabled:opacity-50"
                    >
                      {handlers.busy === `re-${exp.id}` ? <Loader2 className="h-3 w-3 animate-spin" /> : <Download className="h-3 w-3" />}
                      <ChevronRight className="h-3 w-3" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ── Haupt-Komponente ──────────────────────────────────────────────────────────

type TabId = 'timeline' | 'snapshots' | 'audittrail' | 'changes' | 'exports';

const TABS: { id: TabId; label: string }[] = [
  { id: 'timeline',   label: 'Timeline'       },
  { id: 'snapshots',  label: 'Snapshots'      },
  { id: 'audittrail', label: 'Audit Trail'    },
  { id: 'changes',    label: 'Change Tracking' },
  { id: 'exports',    label: 'Exports'        },
];

const METRICS = [
  { label: 'Nachweise gesamt', value: '1.247' },
  { label: 'C2PA-signiert',    value: '1.198' },
  { label: 'Diese Woche',      value: '23'    },
  { label: 'Letzter Export',   value: '12.06.2026' },
];

function _EvidenceVaultView() {
  return <AuthGate>{() => <Inner />}</AuthGate>;
}

export const EvidenceVaultView = withPerformanceMonitoring(
  _EvidenceVaultView,
  'EvidenceVaultView',
  { threshold: 500, maxRenders: 10 }
);

function Inner() {
  const { activeTenantId: tenantId } = useTenant();
  const [activeTab, setActiveTab] = useState<TabId>('timeline');
  const [liveEvents, setLiveEvents] = useState<DbGovernanceEvent[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const handlers: EvidenceHandlers = {
    onExport: async (prefix: string, format: ExportFormat, key: string) => {
      setBusy(key);
      try {
        const range = defaultRange();
        const result = await exportAnalytics({
          tenantId: tenantId ?? '',
          format,
          range,
          includeCharts: true,
        });
        if (result.ok && result.blob) {
          const filename = buildExportFilename(prefix, format, range);
          triggerBlobDownload(result.blob, filename);
        } else {
          console.error('Export failed:', result.error);
        }
      } catch (err) {
        console.error('Export failed:', err);
      } finally {
        setBusy(null);
      }
    },
    onViewEvidence: (id: string, isLive: boolean) => {
      console.log('View evidence:', id, 'isLive:', isLive);
    },
    onCompare: () => {
      console.log('Compare snapshots');
    },
    onShowTimeline: () => {
      setActiveTab('timeline');
    },
    busy,
  };

  return (
    <div className="min-h-screen flex flex-col bg-obsidian-950 text-titanium-50">
      {/* Header */}
      <div className="border-b border-titanium-900 px-8 py-6">
        <div className="flex items-center gap-3 mb-6">
          <Shield className="h-6 w-6 text-teal-400" />
          <div>
            <h1 className="font-display text-2xl font-bold">Evidence Vault</h1>
            <p className="text-sm text-titanium-400 mt-1">C2PA-signierte Nachweise für DSGVO & EU AI Act</p>
          </div>
        </div>

        {/* Metrics */}
        <div className="grid grid-cols-4 gap-4">
          {METRICS.map((metric) => (
            <div key={metric.label} className="border border-titanium-800 bg-obsidian-900 p-3">
              <p className="font-mono text-[10px] uppercase tracking-wider text-titanium-500 mb-1">
                {metric.label}
              </p>
              <p className="font-display text-lg font-bold text-titanium-100">{metric.value}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-titanium-900 overflow-x-auto">
        <div className="flex px-8">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-3 font-mono text-xs uppercase tracking-wider border-b-2 transition-colors whitespace-nowrap ${
                activeTab === tab.id
                  ? 'border-teal-500 text-teal-300'
                  : 'border-transparent text-titanium-500 hover:text-titanium-300'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Tab Content */}
      <div className="flex-1 overflow-y-auto bg-obsidian-950">
        {activeTab === 'timeline' && <TimelineTab liveEvents={liveEvents} handlers={handlers} />}
        {activeTab === 'snapshots' && <SnapshotsTab handlers={handlers} />}
        {activeTab === 'audittrail' && <AuditTrailTab />}
        {activeTab === 'changes' && <ChangeTrackingTab />}
        {activeTab === 'exports' && <ExportsTab handlers={handlers} />}
      </div>
    </div>
  );
}
