// Abbildung persistierter Governance-Events auf die Evidence-Vault-Karten.
// Rein, testbar — keine Mock-Fallbacks, keine erfundenen Hashes.

import type { DbGovernanceEvent } from '../governanceApi';

export type VaultEvidenceType =
  | 'Screenshot'
  | 'Scan Report'
  | 'Document'
  | 'Network Trace'
  | 'Policy Change'
  | 'AI Classification';

export interface VaultEvidenceItem {
  id: string;
  ts: string;
  type: VaultEvidenceType;
  title: string;
  description: string;
  source: string;
  domain: string;
  hash: string;
  c2pa: boolean;
}

export interface VaultAuditEntry {
  id: string;
  ts: string;
  actor: string;
  actorType: 'agent' | 'user' | 'system';
  action: string;
  target: string;
  outcome: 'success' | 'warning' | 'error';
}

export interface VaultMetrics {
  total: number;
  hashed: number;
  c2pa: number;
  thisWeek: number;
}

const TYPE_MAP: Record<string, VaultEvidenceType> = {
  website_scanner: 'Scan Report',
  browser_extension: 'Screenshot',
  manual: 'Document',
  agent_runtime: 'AI Classification',
  api: 'Network Trace',
  sdk: 'Network Trace',
  github: 'Network Trace',
  ci_cd: 'Network Trace',
};

const MIN_DIGEST_LEN = 16;

/** Gleiche Fallback-Reihenfolge wie die Timeline-Karten: hash, sonst content_hash. */
export function resolvedEventDigest(payload: Record<string, unknown> | null | undefined): string | null {
  const payloadHash = typeof payload?.['hash'] === 'string' ? payload['hash'] : null;
  const contentHash = typeof payload?.['content_hash'] === 'string' ? payload['content_hash'] : null;
  if (payloadHash && payloadHash.length >= MIN_DIGEST_LEN) return payloadHash;
  if (contentHash && contentHash.length >= MIN_DIGEST_LEN) return contentHash;
  return null;
}

export function formatRelativeTs(iso: string, now = new Date()): string {
  const diffMin = Math.floor((now.getTime() - new Date(iso).getTime()) / 60_000);
  if (Number.isNaN(diffMin)) return '–';
  if (diffMin < 60) return `vor ${Math.max(0, diffMin)} Min.`;
  if (diffMin < 1440) return `vor ${Math.floor(diffMin / 60)} Std.`;
  const days = Math.floor(diffMin / 1440);
  return `vor ${days} Tag${days !== 1 ? 'en' : ''}`;
}

export function eventToEvidenceItem(event: DbGovernanceEvent, now = new Date()): VaultEvidenceItem {
  return {
    id: event.id,
    ts: formatRelativeTs(event.created_at, now),
    type: TYPE_MAP[event.event_source] ?? 'Scan Report',
    title: event.title,
    description: event.summary ?? event.title,
    source: event.event_source,
    domain:
      (typeof event.payload?.['url'] === 'string' ? event.payload['url'] : null) ??
      event.vendor ??
      event.model_name ??
      '–',
    hash: resolvedEventDigest(event.payload) ?? '—',
    c2pa: event.payload?.['c2pa'] === true,
  };
}

export function eventToAuditEntry(event: DbGovernanceEvent): VaultAuditEntry {
  const hasUser = Boolean(event.actor_email);
  const isAgent = event.event_source === 'agent_runtime' || event.event_source.endsWith('_agent');
  const risk = event.risk_level;
  const outcome: VaultAuditEntry['outcome'] =
    risk === 'critical' ? 'error' : risk === 'high' ? 'warning' : 'success';
  return {
    id: event.id,
    ts: new Date(event.created_at).toLocaleString('de-DE'),
    actor: event.actor_email ?? event.event_source,
    actorType: hasUser ? 'user' : isAgent ? 'agent' : 'system',
    action: event.title,
    target:
      (typeof event.payload?.['url'] === 'string' ? event.payload['url'] : null) ??
      event.vendor ??
      event.model_name ??
      '–',
    outcome,
  };
}

export function computeVaultMetrics(events: DbGovernanceEvent[], now = new Date()): VaultMetrics {
  const weekMs = 7 * 86_400_000;
  let hashed = 0;
  let c2pa = 0;
  let thisWeek = 0;
  for (const event of events) {
    if (resolvedEventDigest(event.payload)) hashed += 1;
    if (event.payload?.['c2pa'] === true) c2pa += 1;
    const t = new Date(event.created_at).getTime();
    if (Number.isFinite(t) && now.getTime() - t <= weekMs) thisWeek += 1;
  }
  return { total: events.length, hashed, c2pa, thisWeek };
}
