/**
 * Evidence Vault — Mapping von RLS-Zeilen auf die Vault-UI.
 * Kein Demo-Fallback. Leere Mandanten bleiben leer.
 */
import type { DbGovernanceEvent, DbGovernanceEvidence } from '../governanceApi';
import type { TimelineEntry } from '../../evidence-vault/evidenceVaultApi';

export type EvidenceType =
  | 'Screenshot'
  | 'Scan Report'
  | 'Document'
  | 'Network Trace'
  | 'Policy Change'
  | 'AI Classification';

export type AuditOutcome = 'success' | 'warning' | 'error';
export type ActorType = 'agent' | 'user' | 'system';
export type ChangeType = 'Neu' | 'Geändert' | 'Entfernt' | 'Erkannt';
export type ChangeSeverity = 'critical' | 'high' | 'medium' | 'low';

export interface EvidenceItem {
  id: string;
  ts: string;
  type: EvidenceType;
  title: string;
  description: string;
  source: string;
  domain: string;
  hash: string;
  c2pa: boolean;
  eventId?: string;
}

export interface Snapshot {
  id: string;
  domain: string;
  date: string;
  hash: string;
  version: number;
  onHold: boolean;
  c2pa: boolean;
}

export interface AuditEntry {
  id: string;
  ts: string;
  actor: string;
  actorType: ActorType;
  action: string;
  target: string;
  outcome: AuditOutcome;
}

export interface ChangeEntry {
  id: string;
  artifact: string;
  type: ChangeType;
  field: string;
  before: string | null;
  after: string | null;
  ts: string;
  severity: ChangeSeverity;
}

export interface VaultMetrics {
  total: number;
  signed: number;
  thisWeek: number;
  lastCreated: string;
}

export function relativeTime(iso: string, now = Date.now()): string {
  const diffMs = now - new Date(iso).getTime();
  if (!Number.isFinite(diffMs)) return '–';
  const diffMin = Math.floor(diffMs / 60_000);
  if (diffMin < 1) return 'gerade eben';
  if (diffMin < 60) return `vor ${diffMin} Min.`;
  if (diffMin < 1440) return `vor ${Math.floor(diffMin / 60)} Std.`;
  const days = Math.floor(diffMin / 1440);
  return `vor ${days} Tag${days !== 1 ? 'en' : ''}`;
}

export function eventToEvidenceItem(e: DbGovernanceEvent, now = Date.now()): EvidenceItem {
  const typeMap: Record<string, EvidenceType> = {
    website_scanner: 'Scan Report',
    browser_extension: 'Screenshot',
    manual: 'Document',
    agent_runtime: 'AI Classification',
    api: 'Network Trace',
    sdk: 'Network Trace',
    github: 'Network Trace',
    ci_cd: 'Network Trace',
  };
  const hash =
    (typeof e.payload?.['hash'] === 'string' && e.payload['hash']) ||
    (typeof e.payload?.['content_hash'] === 'string' && e.payload['content_hash']) ||
    `sha256:${e.id.slice(0, 8)}…`;
  return {
    id: e.id,
    eventId: e.id,
    ts: relativeTime(e.created_at, now),
    type: typeMap[e.event_source] ?? 'Scan Report',
    title: e.title,
    description: e.summary ?? e.title,
    source: e.event_source,
    domain: (typeof e.payload?.['url'] === 'string' && e.payload['url']) || e.vendor || e.model_name || '–',
    hash,
    c2pa: e.payload?.['c2pa'] === true,
  };
}

export function evidenceToItem(row: DbGovernanceEvidence, now = Date.now()): EvidenceItem {
  const typeMap: Record<string, EvidenceType> = {
    screenshot: 'Screenshot',
    har: 'Network Trace',
    json: 'Scan Report',
    log: 'Network Trace',
    pdf: 'Document',
    hash: 'Document',
    policy_snapshot: 'Policy Change',
    approval: 'Document',
    pull_request: 'Document',
  };
  const hash = row.content_hash ?? (row.id ? `sha256:${row.id.slice(0, 8)}…` : '–');
  const domain =
    (typeof row.metadata?.['url'] === 'string' && row.metadata['url']) ||
    (typeof row.metadata?.['domain'] === 'string' && row.metadata['domain']) ||
    '–';
  return {
    id: row.id,
    eventId: row.event_id ?? undefined,
    ts: relativeTime(row.created_at, now),
    type: typeMap[row.evidence_type] ?? 'Document',
    title: row.title,
    description: row.title,
    source: row.evidence_type,
    domain,
    hash,
    c2pa: Boolean(row.content_hash),
  };
}

export function mergeTimeline(events: DbGovernanceEvent[], evidence: DbGovernanceEvidence[], now = Date.now()): EvidenceItem[] {
  const fromEvidence = evidence.map((row) => evidenceToItem(row, now));
  const evidenceEventIds = new Set(evidence.map((row) => row.event_id).filter(Boolean));
  const fromEvents = events
    .filter((e) => !evidenceEventIds.has(e.id))
    .map((e) => eventToEvidenceItem(e, now));
  return [...fromEvidence, ...fromEvents];
}

export function eventToAuditEntry(e: DbGovernanceEvent, now = Date.now()): AuditEntry {
  const actorType: ActorType = e.actor_email
    ? 'user'
    : e.event_source === 'agent_runtime'
      ? 'agent'
      : 'system';
  const outcome: AuditOutcome =
    e.risk_level === 'critical' || e.risk_level === 'high'
      ? 'error'
      : e.risk_level === 'medium'
        ? 'warning'
        : 'success';
  return {
    id: e.id,
    ts: relativeTime(e.created_at, now),
    actor: e.actor_email ?? e.event_source,
    actorType,
    action: e.title,
    target: e.vendor ?? e.model_name ?? e.event_type,
    outcome,
  };
}

export function eventToChangeEntry(e: DbGovernanceEvent, now = Date.now()): ChangeEntry | null {
  const before = typeof e.payload?.['before'] === 'string' ? e.payload['before'] : null;
  const after = typeof e.payload?.['after'] === 'string' ? e.payload['after'] : null;
  const field = typeof e.payload?.['field'] === 'string' ? e.payload['field'] : null;
  const looksLikeChange = /change|policy|update|diff/i.test(e.event_type) || before !== null || after !== null;
  if (!looksLikeChange) return null;
  const type: ChangeType =
    before === null && after !== null ? 'Neu' : after === null && before !== null ? 'Entfernt' : /erkannt|detect/i.test(e.event_type) ? 'Erkannt' : 'Geändert';
  const severityMap: Record<string, ChangeSeverity> = {
    critical: 'critical',
    high: 'high',
    medium: 'medium',
    low: 'low',
  };
  return {
    id: e.id,
    artifact: e.vendor ?? e.model_name ?? e.title,
    type,
    field: field ?? e.event_type,
    before,
    after,
    ts: relativeTime(e.created_at, now),
    severity: severityMap[e.risk_level] ?? 'low',
  };
}

export function timelineToSnapshot(entry: TimelineEntry, now = Date.now()): Snapshot {
  return {
    id: entry.id,
    domain: entry.subject_ref,
    date: relativeTime(entry.created_at, now),
    hash: entry.event_hash || entry.content_sha256,
    version: entry.version,
    onHold: entry.on_hold,
    c2pa: Boolean(entry.content_sha256),
  };
}

export function computeVaultMetrics(
  evidence: DbGovernanceEvidence[],
  now = Date.now(),
): VaultMetrics {
  const weekMs = 7 * 24 * 60 * 60 * 1000;
  const signed = evidence.filter((row) => Boolean(row.content_hash)).length;
  const thisWeek = evidence.filter((row) => now - new Date(row.created_at).getTime() < weekMs).length;
  const newest = evidence[0]?.created_at;
  return {
    total: evidence.length,
    signed,
    thisWeek,
    lastCreated: newest ? relativeTime(newest, now) : '–',
  };
}

export const EMPTY_VAULT_METRICS: VaultMetrics = {
  total: 0,
  signed: 0,
  thisWeek: 0,
  lastCreated: '–',
};
