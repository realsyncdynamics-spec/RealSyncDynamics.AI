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
export function formatEventLine(e: RuntimeEvent): string {
    return `${e.rule_id} \u2192 ${e.severity}${e.detail ? ' · ' + e.detail : ''}`;
}
