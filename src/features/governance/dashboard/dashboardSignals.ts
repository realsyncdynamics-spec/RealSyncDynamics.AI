// Gemeinsame Schwellen und Signal-Ableitungen des Dashboards.
//
// EINE Quelle für: Risiko-Buckets (Residualrisiko-Kachel, Risk Distribution,
// Asset-Flows, Aufmerksamkeit), Evidence-Frische, Scan-Alter und
// Scanner-Befunde. Rein, ohne Netzwerk — damit Kachel, Verteilung,
// „Braucht Aufmerksamkeit“ und „Kritische Befunde“ nie widersprüchlich
// klassifizieren.

import type { GovernanceRiskLevel } from '../types';

/* ─── Risiko-Schwellen (Asset-Risk-Score 0..100, höher = schlechter) ─── */

/** Untergrenzen je Bucket. Einzige Quelle — nicht in JSX duplizieren. */
export const RISK_THRESHOLDS = {
  critical: 70,
  high: 50,
  medium: 30,
  low: 15,
} as const;

/** Ab dieser Schwelle gilt ein Asset als „erhöht“ (Bucket Hoch oder Kritisch). */
export const ELEVATED_RISK_THRESHOLD = RISK_THRESHOLDS.high;

export type RiskBucketId = 'critical' | 'high' | 'medium' | 'low' | 'passed';

export const RISK_BUCKET_LABEL: Record<RiskBucketId, string> = {
  critical: 'Kritisch',
  high: 'Hoch',
  medium: 'Mittel',
  low: 'Gering',
  passed: 'Stabil',
};

/** Reihenfolge schlecht → gut. */
export const RISK_BUCKET_ORDER: readonly RiskBucketId[] = ['critical', 'high', 'medium', 'low', 'passed'];

export function riskBucketFor(score: number): RiskBucketId {
  if (score >= RISK_THRESHOLDS.critical) return 'critical';
  if (score >= RISK_THRESHOLDS.high) return 'high';
  if (score >= RISK_THRESHOLDS.medium) return 'medium';
  if (score >= RISK_THRESHOLDS.low) return 'low';
  return 'passed';
}

export function isElevatedRisk(score: number): boolean {
  return score >= ELEVATED_RISK_THRESHOLD;
}

/* ─── Alter / Frische ─── */

/** Letzter Nachweis älter als so viele Tage ⇒ Evidence „veraltet“. */
export const EVIDENCE_STALE_DAYS = 30;
/** Unter so vielen Nachweisen kein Evidence-Wert, sondern „zu wenig Daten“. */
export const EVIDENCE_MIN_ENTRIES = 3;
/**
 * Letzter Website-Audit (scan_runs) älter als so viele Tage ⇒ Hinweis auf
 * erneuten Audit. Greift nur, wenn scan_runs Zeilen hat (siehe
 * workspaceBootstrapSteps) — derzeit plattformweit leer, bis der
 * tenant-audit-Fix (Backend) live ist.
 */
export const SCAN_STALE_DAYS = 30;

/**
 * Ehrliche Bezeichnung des Scan-CTAs: tenant-audit prüft HTML und Header der
 * Website — keine DNS-/DMARC-/E-Mail-Authentifizierung.
 */
export const WEBSITE_AUDIT_CTA_LABEL = 'Website-Audit (HTML/Header) starten';

const DAY_MS = 24 * 60 * 60 * 1000;

/** Volle Tage seit `iso`; `null` bei fehlendem/ungültigem Datum. Nie negativ. */
export function daysSince(iso: string | null | undefined, now: number = Date.now()): number | null {
  if (!iso) return null;
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return null;
  return Math.max(0, Math.floor((now - t) / DAY_MS));
}

/** „heute“ · „vor 1 Tag“ · „vor 89 Tagen“. */
export function formatAgeDe(days: number): string {
  if (days <= 0) return 'heute';
  if (days === 1) return 'vor 1 Tag';
  return `vor ${days} Tagen`;
}

/** Jüngster der Zeitstempel (ISO), `null` wenn keiner gültig ist. */
export function latestIso(...values: Array<string | null | undefined>): string | null {
  let best: string | null = null;
  let bestT = -Infinity;
  for (const v of values) {
    if (!v) continue;
    const t = Date.parse(v);
    if (!Number.isNaN(t) && t > bestT) {
      best = v;
      bestT = t;
    }
  }
  return best;
}

/* ─── Scanner-Befunde (governance_events, event_type `*_finding`) ─── */

export interface ScanFinding {
  id: string;
  title: string;
  level: GovernanceRiskLevel;
  eventType: string;
  source: string;
  createdAt: string;
  assetId: string | null;
  /** Behoben am (payload.checked_at, sonst created_at des `*_resolved`-Events); `null` = offen. */
  resolvedAt: string | null;
  /** Behebung per payload.source === 'manual_owner_approved'. */
  resolvedManually?: boolean;
}

/** Befund-Events: `*_finding` (z. B. email_auth_finding vom website_scanner). */
export function isFindingEventType(eventType: string): boolean {
  return eventType === 'finding' || eventType.endsWith('_finding');
}

/** Behebungs-Events: `*_resolved` (z. B. email_auth_resolved). */
export function isResolutionEventType(eventType: string): boolean {
  return eventType.endsWith('_resolved');
}

export interface PairableEvent {
  id: string;
  event_type: string;
  created_at: string;
  payload?: Record<string, unknown> | null;
}

export type ResolveCheck = 'dmarc' | 'spf' | 'dkim';
export type ResolveSource = 'scanner' | 'manual_owner_approved';

/**
 * Verbindlicher Payload-Vertrag (Backend, 25.09.2026) für `*_resolved`:
 * { resolves_event_id, check, domain, previous_state, current_state,
 *   checked_at, evidence_id, finding_id|null, scanner_version, source }.
 * Nur `resolves_event_id` ist Pflicht für die Paarung; alles andere wird
 * tolerant gelesen (unbekannt ⇒ null).
 */
export interface ResolvePayload {
  resolves_event_id: string;
  check: ResolveCheck | null;
  domain: string | null;
  previous_state: Record<string, unknown> | null;
  current_state: Record<string, unknown> | null;
  checked_at: string | null;
  evidence_id: string | null;
  finding_id: string | null;
  scanner_version: string | null;
  source: ResolveSource | null;
}

const str = (v: unknown): string | null => (typeof v === 'string' && v.length > 0 ? v : null);
const obj = (v: unknown): Record<string, unknown> | null =>
  v !== null && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : null;

/** Tolerant: ohne gültige `resolves_event_id` ⇒ `null` (Event wird ignoriert). */
export function parseResolvePayload(payload: unknown): ResolvePayload | null {
  const p = obj(payload);
  const target = p ? str(p.resolves_event_id) : null;
  if (!p || !target) return null;
  const check = str(p.check);
  const source = str(p.source);
  const checkedAt = str(p.checked_at);
  return {
    resolves_event_id: target,
    check: check === 'dmarc' || check === 'spf' || check === 'dkim' ? check : null,
    domain: str(p.domain),
    previous_state: obj(p.previous_state),
    current_state: obj(p.current_state),
    checked_at: checkedAt && !Number.isNaN(Date.parse(checkedAt)) ? checkedAt : null,
    evidence_id: str(p.evidence_id),
    finding_id: str(p.finding_id),
    scanner_version: str(p.scanner_version),
    source: source === 'scanner' || source === 'manual_owner_approved' ? source : null,
  };
}

/** `payload.resolves_event_id` eines Behebungs-Events, sonst `null`. */
export function resolvesEventIdOf(event: PairableEvent): string | null {
  if (!isResolutionEventType(event.event_type)) return null;
  return parseResolvePayload(event.payload)?.resolves_event_id ?? null;
}

export interface Resolution {
  /** payload.checked_at, sonst created_at des Behebungs-Events. */
  resolvedAt: string;
  resolveEventId: string;
  manual: boolean;
  check: ResolveCheck | null;
  evidenceId: string | null;
}

/**
 * Paarung append-only: governance_events hat keine Status-Spalte. Ein
 * Behebungs-Event (`*_resolved`) verweist per `payload.resolves_event_id`
 * auf das alte Event. Ergebnis: Event-ID → früheste Behebung.
 */
export function resolutionIndex(events: readonly PairableEvent[]): Map<string, Resolution> {
  const index = new Map<string, Resolution>();
  for (const event of events) {
    if (!isResolutionEventType(event.event_type)) continue;
    const payload = parseResolvePayload(event.payload);
    if (!payload) continue;
    const resolution: Resolution = {
      resolvedAt: payload.checked_at ?? event.created_at,
      resolveEventId: event.id,
      manual: payload.source === 'manual_owner_approved',
      check: payload.check,
      evidenceId: payload.evidence_id,
    };
    const prev = index.get(payload.resolves_event_id);
    if (!prev || Date.parse(resolution.resolvedAt) < Date.parse(prev.resolvedAt)) {
      index.set(payload.resolves_event_id, resolution);
    }
  }
  return index;
}

/** „behoben am 25.09.“ · optional „· manuell bestätigt“. */
export function resolvedLabel(resolvedAt: string, manual = false): string {
  const t = Date.parse(resolvedAt);
  const date = Number.isNaN(t)
    ? resolvedAt
    : new Date(t).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' });
  return `behoben am ${date}${manual ? ' · manuell bestätigt' : ''}`;
}

/** Befund-Events → ScanFinding inkl. `resolvedAt` aus der Paarung. */
export function pairFindings(
  events: ReadonlyArray<PairableEvent & {
    title: string;
    risk_level: GovernanceRiskLevel;
    event_source: string;
    asset_id: string | null;
  }>,
): ScanFinding[] {
  const resolved = resolutionIndex(events);
  return events
    .filter((e) => isFindingEventType(e.event_type))
    .map((e) => ({
      id: e.id,
      title: e.title,
      level: e.risk_level,
      eventType: e.event_type,
      source: e.event_source,
      createdAt: e.created_at,
      assetId: e.asset_id,
      resolvedAt: resolved.get(e.id)?.resolvedAt ?? null,
      resolvedManually: resolved.get(e.id)?.manual ?? false,
    }));
}

/** Nur offene (nicht behobene) Befunde. */
export function openFindings(findings: readonly ScanFinding[]): ScanFinding[] {
  return findings.filter((f) => !f.resolvedAt);
}

export interface FindingSummary {
  /** Hoch + Kritisch — zählen als kritische Befunde. */
  severe: ScanFinding[];
  /** Mittel — nur als Hinweis. */
  medium: ScanFinding[];
}

/** Nur offene Befunde zählen; behobene (gepaart) fallen heraus. */
export function summarizeFindings(findings: readonly ScanFinding[]): FindingSummary {
  const open = openFindings(findings);
  return {
    severe: open.filter((f) => f.level === 'high' || f.level === 'critical'),
    medium: open.filter((f) => f.level === 'medium'),
  };
}

/* ─── Erhöhte Assets ─── */

export interface ElevatedAsset {
  id: string;
  name: string;
  score: number;
  bucket: RiskBucketId;
}

export function elevatedAssetsOf(
  assets: ReadonlyArray<{ id: string; name: string; risk_score: number }>,
): ElevatedAsset[] {
  return assets
    .filter((a) => isElevatedRisk(a.risk_score))
    .map((a) => ({ id: a.id, name: a.name, score: a.risk_score, bucket: riskBucketFor(a.risk_score) }))
    .sort((a, b) => b.score - a.score);
}

/* ─── Signale im Cockpit ─── */

export interface DashboardSignals {
  /** Assets im Bucket Hoch/Kritisch; `null` = Assets nicht ladbar. */
  elevatedAssets: ElevatedAsset[] | null;
  /** Scanner-Befunde (neueste zuerst); `null` = nicht ladbar. */
  findings: ScanFinding[] | null;
  /** Jüngster Website-Audit laut scan_runs; `null` = keiner (Scanner-Events zählen nicht). */
  lastScanAt: string | null;
  /** Jüngster Evidence-Eintrag; `null` = keiner oder nicht ladbar. */
  latestEvidenceAt: string | null;
}

/* ─── „Braucht Aufmerksamkeit“ ─── */

export interface AttentionSignal {
  id: string;
  title: string;
  reason: string;
  href: string;
}

/**
 * Risiko- und Befund-Einträge für „Braucht Aufmerksamkeit“. Solange ein
 * Asset im Bucket Hoch/Kritisch liegt oder ein Scanner-Befund (≥ mittel)
 * vorliegt, darf dort nicht „Nichts offen“ stehen.
 *
 * governance_events kennt keinen Erledigt-Status — ein Befund gilt als
 * offen, solange kein `*_resolved`-Event per payload.resolves_event_id auf
 * ihn verweist (pairFindings).
 */
export function riskAttentionSignals(
  signals: DashboardSignals | null | undefined,
  now: number = Date.now(),
): AttentionSignal[] {
  if (!signals) return [];
  const out: AttentionSignal[] = [];
  for (const asset of signals.elevatedAssets ?? []) {
    out.push({
      id: `risk-${asset.id}`,
      title: asset.name,
      reason: `Risiko-Score ${asset.score} · ${RISK_BUCKET_LABEL[asset.bucket]} (ab ${RISK_THRESHOLDS[asset.bucket as 'high' | 'critical']})`,
      href: '/app/risk-inventory',
    });
  }
  for (const f of openFindings(signals.findings ?? [])) {
    if (f.level !== 'medium' && f.level !== 'high' && f.level !== 'critical') continue;
    const age = daysSince(f.createdAt, now);
    out.push({
      id: `finding-${f.id}`,
      title: f.title,
      reason: `Scanner-Befund · ${FINDING_LEVEL_LABEL[f.level]}${age === null ? '' : ` · ${formatAgeDe(age)}`}`,
      href: '/app/websites',
    });
  }
  return out;
}

export const FINDING_LEVEL_LABEL: Record<GovernanceRiskLevel, string> = {
  info: 'Info',
  low: 'niedrig',
  medium: 'mittel',
  high: 'hoch',
  critical: 'kritisch',
};

/* ─── Mandanten-Anzeigename ─── */

/**
 * Der Signup-Trigger legt Mandanten als „<Name>'s Workspace“ an (englischer
 * Genitiv). In der deutschen Oberfläche zeigen wir „Workspace von <Name>“.
 * Nur Anzeige — der gespeicherte Name bleibt unverändert.
 */
export function tenantDisplayName(name: string, lang: 'de' | 'en' = 'de'): string {
  if (lang !== 'de') return name;
  const m = /^(.+?)['’`]s Workspace$/.exec(name.trim());
  return m ? `Workspace von ${m[1]}` : name;
}
