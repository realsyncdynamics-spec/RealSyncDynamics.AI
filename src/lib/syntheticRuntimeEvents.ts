/**
 * syntheticRuntimeEvents.ts
 *
 * DEMO-RUNTIME — Synthetic Event Pool für die Interactive Runtime Demo.
 */

export type RuntimeEventKind =
  | 'scan'
  | 'drift'
  | 'ai'
  | 'consent'
  | 'evidence'
  | 'incident'
  | 'agent';

export type RuntimeEventSeverity =
  | 'info'
  | 'warning'
  | 'error'
  | 'sealed'
  | 'generated'
  | 'ok';

export interface SyntheticRuntimeEvent {
  id: string;
  ts: string;
  kind: RuntimeEventKind;
  rule_id: string;
  severity: RuntimeEventSeverity;
  detail?: string;
}

type EventTemplate = Omit<SyntheticRuntimeEvent, 'id' | 'ts'>;

export const SYNTHETIC_EVENT_POOL: readonly EventTemplate[] = [
  { kind: 'scan',     rule_id: 'rule.header.hsts',            severity: 'ok',      detail: 'demo-site.de' },
  { kind: 'scan',     rule_id: 'rule.header.x_frame_options', severity: 'warning', detail: 'demo-site.de' },
  { kind: 'scan',     rule_id: 'rule.header.csp',             severity: 'warning', detail: 'demo-shop.io' },
  { kind: 'scan',     rule_id: 'rule.header.referrer_policy', severity: 'info',    detail: 'demo-site.de' },
  { kind: 'scan',     rule_id: 'rule.fonts.google_cdn',       severity: 'error',   detail: 'demo-shop.io' },
  { kind: 'scan',     rule_id: 'rule.page.datenschutz_route', severity: 'error',   detail: 'demo-agency.com' },
  { kind: 'scan',     rule_id: 'rule.page.impressum_route',   severity: 'ok',      detail: 'demo-site.de' },
  { kind: 'scan',     rule_id: 'rule.tls.version',            severity: 'ok',      detail: 'TLS 1.3 · HSTS on' },
  { kind: 'consent',  rule_id: 'rule.cookie.reject_button',       severity: 'warning', detail: 'demo-site.de' },
  { kind: 'consent',  rule_id: 'rule.cookie.consent_mode_v2',     severity: 'error',   detail: 'demo-site.de' },
  { kind: 'consent',  rule_id: 'rule.cookie.sub_processor_table', severity: 'warning', detail: 'demo-agency.com' },
  { kind: 'consent',  rule_id: 'rule.meta.pixel_fire',            severity: 'warning', detail: 'demo-shop.io' },
  { kind: 'consent',  rule_id: 'rule.cookie.reject_button',       severity: 'ok',      detail: 'demo-shop.io · fixed' },
  { kind: 'consent',  rule_id: 'rule.ttdsg.§25',                  severity: 'error',   detail: 'demo-agency.com' },
  { kind: 'drift',    rule_id: 'rule.tracker.pre_consent',     severity: 'error',   detail: 'demo-site.de' },
  { kind: 'drift',    rule_id: 'rule.vendor.dpa_missing',      severity: 'error',   detail: 'plausible.io' },
  { kind: 'drift',    rule_id: 'rule.tracker.new_third_party', severity: 'warning', detail: 'cdn.tiktok.com detected' },
  { kind: 'drift',    rule_id: 'rule.header.csp_regression',   severity: 'error',   detail: 'demo-shop.io' },
  { kind: 'drift',    rule_id: 'rule.vendor.new_sub_processor',severity: 'warning', detail: 'stripe.com · DPA ok' },
  { kind: 'ai',       rule_id: 'rule.ai_act.llm_endpoint',    severity: 'warning', detail: 'gpt-4o · us-east' },
  { kind: 'ai',       rule_id: 'rule.ai_act.classify_widget', severity: 'info',    detail: 'chat-bot → limited risk' },
  { kind: 'ai',       rule_id: 'rule.ai_act.register_model',  severity: 'info',    detail: 'openai/gpt-4o · high-risk' },
  { kind: 'ai',       rule_id: 'rule.ai_act.human_oversight', severity: 'warning', detail: 'no override path defined' },
  { kind: 'ai',       rule_id: 'rule.ai_act.transparency',    severity: 'error',   detail: 'AI widget not labelled' },
  { kind: 'evidence', rule_id: 'evidence.sha256.sealed',         severity: 'sealed', detail: 'sha256:9f2c…b81' },
  { kind: 'evidence', rule_id: 'evidence.sha256.sealed',         severity: 'sealed', detail: 'sha256:a7f1…c44' },
  { kind: 'evidence', rule_id: 'evidence.audit_bundle.anchored', severity: 'sealed', detail: '1,248 events · anchored' },
  { kind: 'evidence', rule_id: 'evidence.backup.eu_west',        severity: 'sealed', detail: 'eu-west · snapshot ok' },
  { kind: 'evidence', rule_id: 'evidence.chain.verified',        severity: 'ok',     detail: 'Ed25519 sig valid' },
  { kind: 'incident', rule_id: 'rule.tracker.pre_consent', severity: 'error', detail: 'sev=high · open' },
  { kind: 'incident', rule_id: 'rule.ai_act.llm_endpoint', severity: 'error', detail: 'sev=medium · open' },
  { kind: 'incident', rule_id: 'rule.vendor.dpa_missing',  severity: 'error', detail: 'sev=high · plausible.io' },
  { kind: 'agent',    rule_id: 'policy.snippet.generated',   severity: 'generated', detail: 'fix: self-host fonts' },
  { kind: 'agent',    rule_id: 'policy.snippet.generated',   severity: 'generated', detail: 'fix: consent-mode v2' },
  { kind: 'agent',    rule_id: 'policy.snippet.generated',   severity: 'generated', detail: 'fix: /datenschutz route' },
  { kind: 'agent',    rule_id: 'policy.dpo.notice_drafted',  severity: 'generated', detail: '§13 update · 14 lines' },
  { kind: 'agent',    rule_id: 'policy.avv.delta_generated', severity: 'generated', detail: 'stripe.com · 3 clauses' },
  { kind: 'agent',    rule_id: 'policy.dpia.trigger',        severity: 'info',      detail: 'high-risk AI · DPIA required' },
  { kind: 'agent',    rule_id: 'policy.csp.header_patched',  severity: 'generated', detail: 'fix: strict-dynamic added' },
];

export const KIND_LABEL: Record<RuntimeEventKind, string> = {
  scan: 'scan', drift: 'drift', ai: 'ai', consent: 'consent',
  evidence: 'evidence', incident: 'incident', agent: 'agent',
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

export const SEVERITY_COLOR: Record<RuntimeEventSeverity, string> = {
  ok:        'text-emerald-400',
  info:      'text-cyan-400',
  warning:   'text-amber-400',
  error:     'text-red-400',
  sealed:    'text-emerald-300',
  generated: 'text-violet-300',
};

/** Gibt die aktuelle Uhrzeit als HH:MM:SS zurück. */
export function nowTimestamp(): string {
  return new Date().toLocaleTimeString('de-DE', {
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  });
}

/** Wählt pseudo-zufällig einen Event-Template aus dem Pool. */
export function pickRandomTemplate(): EventTemplate {
  return SYNTHETIC_EVENT_POOL[Math.floor(Math.random() * SYNTHETIC_EVENT_POOL.length)];
}
