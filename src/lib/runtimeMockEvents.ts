// runtimeMockEvents.ts — Step 3: Runtime-Feed with real rule-event format
// Events now use wall-clock HH:MM:SS timestamps and real rule_id notation
// matching the scanner's actual rule identifiers (rule.*, evidence.*, policy.*).
// The terminal feed in GlobalRuntimeFeedSection reveals these one-by-one
// with a stagger so the visitor sees a "live system" on first paint.

// ⚠ DEMO-RUNTIME: Alle Events sind simulierte Beispieldaten.
// Keine Live-Telemetrie. Kein Anschluss an Produktions-Datenbank.
// Für echte Runtime-Daten: Phase 3 (Ingest Path, PR #373+).

export type RuntimeEventKind =
    | 'scan'
  | 'drift'
  | 'ai'
  | 'consent'
  | 'evidence'
  | 'incident'
  | 'agent';

export interface RuntimeEvent {
    /** Wall-clock timestamp in HH:MM:SS format, e.g. "07:14:22" */
  ts: string;
    kind: RuntimeEventKind;
    /** Dot-notation rule identifier, e.g. "rule.cookie.reject_button" */
  rule_id: string;
    /** Severity / status emitted by the rule engine */
  severity: 'info' | 'warning' | 'error' | 'sealed' | 'generated' | 'ok';
    /** Optional secondary detail (target host, hash, etc.) */
  detail?: string;
    /** Short label rendered in compact list views (MonitoringPage, RuntimeCanvas). */
  short?: string;
    /** Primary message body for list rendering. */
  text?: string;
    /** Optional resource the event applies to (host, file, etc.). */
  target?: string;
}

// ---------------------------------------------------------------------------
// Real rule-event log — 24 entries covering a realistic morning scan window
// Each rule_id mirrors the scanner rule identifiers surfaced in LiveFindingsSection
// ---------------------------------------------------------------------------
export const RUNTIME_MOCK_EVENTS: readonly RuntimeEvent[] = [
  { ts: '07:14:18', kind: 'scan',     rule_id: 'rule.header.hsts',                severity: 'ok',        detail: 'kunde-1.de' },
  { ts: '07:14:20', kind: 'scan',     rule_id: 'rule.header.x_frame_options',      severity: 'warning',   detail: 'kunde-1.de' },
  { ts: '07:14:22', kind: 'consent',  rule_id: 'rule.cookie.reject_button',        severity: 'warning',   detail: 'kunde-1.de' },
  { ts: '07:14:23', kind: 'consent',  rule_id: 'rule.cookie.consent_mode_v2',      severity: 'error',     detail: 'kunde-1.de' },
  { ts: '07:14:24', kind: 'evidence', rule_id: 'evidence.sha256.sealed',           severity: 'sealed',    detail: 'sha256:9f2c…b81' },
  { ts: '07:14:25', kind: 'drift',    rule_id: 'rule.tracker.pre_consent',         severity: 'error',     detail: 'kunde-1.de' },
  { ts: '07:14:26', kind: 'consent',  rule_id: 'rule.meta.pixel_fire',             severity: 'warning',   detail: 'kunde-2.io' },
  { ts: '07:14:27', kind: 'scan',     rule_id: 'rule.fonts.google_cdn',            severity: 'error',     detail: 'kunde-2.io' },
  { ts: '07:14:28', kind: 'agent',    rule_id: 'policy.snippet.generated',         severity: 'generated', detail: 'fix: self-host fonts' },
  { ts: '07:14:29', kind: 'ai',       rule_id: 'rule.ai_act.llm_endpoint',         severity: 'warning',   detail: 'gpt-4o · us-east' },
  { ts: '07:14:30', kind: 'consent',  rule_id: 'rule.cookie.sub_processor_table',  severity: 'warning',   detail: 'kunde-3.com' },
  { ts: '07:14:31', kind: 'scan',     rule_id: 'rule.page.datenschutz_route',      severity: 'error',     detail: 'kunde-3.com' },
  { ts: '07:14:32', kind: 'agent',    rule_id: 'policy.snippet.generated',         severity: 'generated', detail: 'fix: /datenschutz route' },
  { ts: '07:14:33', kind: 'evidence', rule_id: 'evidence.sha256.sealed',           severity: 'sealed',    detail: 'sha256:a7f1…c44' },
  { ts: '07:14:34', kind: 'drift',    rule_id: 'rule.vendor.dpa_missing',          severity: 'error',     detail: 'plausible.io' },
  { ts: '07:14:35', kind: 'ai',       rule_id: 'rule.ai_act.classify_widget',      severity: 'info',      detail: 'chat-bot → limited risk' },
  { ts: '07:14:36', kind: 'incident', rule_id: 'rule.tracker.pre_consent',         severity: 'error',     detail: 'sev=high · open' },
  { ts: '07:14:37', kind: 'agent',    rule_id: 'policy.dpo.notice_drafted',        severity: 'generated', detail: '§13 update · 14 lines' },
  { ts: '07:14:38', kind: 'consent',  rule_id: 'rule.cookie.reject_button',        severity: 'ok',        detail: 'kunde-4.shop · fixed' },
  { ts: '07:14:39', kind: 'scan',     rule_id: 'rule.header.csp',                  severity: 'warning',   detail: 'kunde-4.shop' },
  { ts: '07:14:40', kind: 'evidence', rule_id: 'evidence.audit_bundle.anchored',   severity: 'sealed',    detail: '1,248 events · 04-26' },
  { ts: '07:14:41', kind: 'ai',       rule_id: 'rule.ai_act.register_model',       severity: 'info',      detail: 'openai/gpt-4o · high-risk' },
  { ts: '07:14:42', kind: 'agent',    rule_id: 'policy.snippet.generated',         severity: 'generated', detail: 'fix: consent-mode v2' },
  { ts: '07:14:43', kind: 'evidence', rule_id: 'evidence.backup.supabase',         severity: 'sealed',    detail: 'eu-west · 24 GB' },
  ];

// ---------------------------------------------------------------------------
// Display helpers
// ---------------------------------------------------------------------------

export const KIND_LABEL: Record<RuntimeEventKind, string> = {
    scan:     'scan',
    drift:    'drift',
    ai:       'ai',
    consent:  'consent',
    evidence: 'evidence',
    incident: 'incident',
    agent:    'agent',
};

export const KIND_COLOR: Record<RuntimeEventKind, string> = {
    scan:     'text-cyan-300',
    drift:    'text-amber-300',
    ai:       'text-violet-300',
    consent:  'text-yellow-300',
    evidence: 'text-emerald-300',
    incident: 'text-red-300',
    agent:    'text-titanium-100',
};

export const SEVERITY_COLOR: Record<RuntimeEvent['severity'], string> = {
    ok:        'text-emerald-400',
    info:      'text-cyan-400',
    warning:   'text-amber-400',
    error:     'text-red-400',
    sealed:    'text-emerald-300',
    generated: 'text-violet-300',
};

/** Arrow suffix rendered after the rule_id, e.g. "rule.cookie.reject_button → warning" */
// ---------------------------------------------------------------------------
// RuntimeEvent v0 adoption (additive)
// ---------------------------------------------------------------------------
//
// Wir exportieren die SELBEN Mock-Events ZUSAETZLICH als v0-konforme
// `RuntimeEvent<T>` (siehe src/types/runtime-event.ts). Existierende
// Konsumenten lesen weiter den lokalen `RuntimeEvent` (oben). Neue
// Konsumenten (Phase-2-Validierungs-Tooling, kuenftige Dashboards) koennen
// `RUNTIME_MOCK_EVENTS_V0` lesen, ohne dass die alte Shape angefasst wird.
//
// Jeder Mock-Eintrag bleibt mit seinem ORIGINAL-Payload vollstaendig
// unter `event.payload` erhalten. Die v0-Felder (type/source/severity/actor)
// werden aus rule_id + kind + severity heuristisch abgeleitet.
//
// Adoption #1 aus dem RuntimeEvent-Standard-Rollout
// (siehe docs/architecture/runtime-event-standard.md).

import {
  createRuntimeEvent,
  type RuntimeEvent as RuntimeEventV0,
  type RuntimeEventSource,
  type RuntimeEventType,
  type RuntimeSeverity,
} from '../types/runtime-event';

export interface MockRuntimeEventPayloadV0 {
  /** Wall-clock HH:MM:SS aus dem Original-Mock. */
  ts: string;
  rule_id: string;
  /** Original-Kind aus dem alten Schema (unveraendert). */
  kind: RuntimeEventKind;
  /** Original-Severity aus dem alten Schema (unveraendert). */
  original_severity: RuntimeEvent['severity'];
  detail?: string;
}

function mapKindToSource(kind: RuntimeEventKind): RuntimeEventSource {
  switch (kind) {
    case 'scan':
    case 'drift':
    case 'consent': return 'browser_collector';
    case 'ai':      return 'ai_probe';
    case 'evidence':return 'evidence_engine';
    case 'agent':   return 'governance_agent';
    case 'incident':return 'policy_engine';
  }
}

function mapToEventType(rule_id: string, kind: RuntimeEventKind): RuntimeEventType {
  if (kind === 'incident' && rule_id.startsWith('rule.tracker.pre_consent')) return 'incident.opened';
  if (rule_id.startsWith('rule.tracker.pre_consent')) return 'tracker.pre_consent_detected';
  if (rule_id.startsWith('rule.cookie.reject_button')) return 'consent.reject_missing';
  if (rule_id.startsWith('rule.cookie.')) return 'consent.banner_detected';
  if (rule_id.startsWith('rule.header.')) return 'header.missing';
  if (rule_id.startsWith('rule.ai_act.llm_endpoint') ||
      rule_id.startsWith('rule.ai_act.register_model')) return 'ai.endpoint_found';
  if (rule_id.startsWith('rule.ai_act.')) return 'ai.risk_classified';
  if (rule_id.startsWith('rule.vendor.')) return 'vendor.detected';
  if (rule_id.startsWith('rule.meta.pixel')) return 'tracker.detected';
  if (rule_id.startsWith('rule.fonts.')) return 'vendor.detected';
  if (rule_id.startsWith('rule.page.')) return 'header.missing';
  if (rule_id.startsWith('evidence.')) return 'evidence.created';
  if (rule_id.startsWith('policy.')) return 'remediation.suggested';
  return 'scan.completed';
}

function mapSeverity(s: RuntimeEvent['severity']): RuntimeSeverity {
  switch (s) {
    case 'ok':        return 'info';
    case 'info':      return 'info';
    case 'warning':   return 'medium';
    case 'error':     return 'high';
    case 'sealed':    return 'info';
    case 'generated': return 'info';
  }
}

/**
 * Exakt dieselben 24 Mock-Events wie `RUNTIME_MOCK_EVENTS` — verpackt in
 * den v0-Envelope. Konsumenten, die gegen den RuntimeEvent-v0-Standard
 * programmieren, lesen diese Liste statt der alten.
 */
export const RUNTIME_MOCK_EVENTS_V0: ReadonlyArray<RuntimeEventV0<MockRuntimeEventPayloadV0>> =
  RUNTIME_MOCK_EVENTS.map((e) =>
    createRuntimeEvent<MockRuntimeEventPayloadV0>({
      spec_version: '0.1', // frozen v0 contract — see RUNTIME_MOCK_EVENTS_V0 name
      type:     mapToEventType(e.rule_id, e.kind),
      source:   mapKindToSource(e.kind),
      severity: mapSeverity(e.severity),
      actor:    { type: e.kind === 'agent' ? 'agent' : 'system' },
      payload:  {
        ts: e.ts,
        rule_id: e.rule_id,
        kind: e.kind,
        original_severity: e.severity,
        detail: e.detail,
      },
    }),
  );

export function formatEventLine(e: RuntimeEvent): string {
    return `${e.rule_id} \u2192 ${e.severity}${e.detail ? ' · ' + e.detail : ''}`;
}
