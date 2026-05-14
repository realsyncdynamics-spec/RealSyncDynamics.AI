// Pre-rendered "live" governance runtime events for the homepage canvas
// section. Static (no real backend) — but reads like a realistic stream of
// what the platform actually does: discovery scans, drift detection,
// AI classification, consent compliance, evidence anchoring.
//
// The terminal feed in RuntimeCanvasSection reveals these one-by-one
// with a stagger so the visitor sees a "live system" on first paint.

export type RuntimeEventKind =
  | 'scan'
  | 'drift'
  | 'ai'
  | 'consent'
  | 'evidence'
  | 'incident'
  | 'agent';

export interface RuntimeEvent {
  /** Monotonic time-since-load label, e.g. "T+02s" */
  ts: string;
  kind: RuntimeEventKind;
  /** Two-character tag rendered in the terminal column. */
  short: string;
  /** Main one-line message. */
  text: string;
  /** Optional target/host string rendered in mono. */
  target?: string;
}

export const RUNTIME_MOCK_EVENTS: readonly RuntimeEvent[] = [
  { ts: 'T+00s', kind: 'scan',     short: 'SC', text: 'header fetch · TLS 1.3 · HSTS-on',                target: 'kunde-1.de' },
  { ts: 'T+01s', kind: 'consent',  short: 'CN', text: 'consent-banner detected · v2.4 IAB-TCF',          target: 'kunde-1.de' },
  { ts: 'T+02s', kind: 'drift',    short: 'DR', text: 'tracker added · googletagmanager · pre-consent', target: 'kunde-1.de' },
  { ts: 'T+02s', kind: 'ai',       short: 'AI', text: 'classify widget · chat-bot · AI-Act class: limited', target: 'kunde-2.io' },
  { ts: 'T+03s', kind: 'evidence', short: 'EV', text: 'sealed hash · sha256:9f2c…b81 · ledger-anchor ✓',  target: 'evidence-chain' },
  { ts: 'T+04s', kind: 'agent',    short: 'AG', text: 'dpo-agent → drafted §13 update · 14 lines',       target: 'kunde-1.de' },
  { ts: 'T+05s', kind: 'incident', short: 'IN', text: 'drift · pre-consent tracker · sev=high · open',  target: 'kunde-1.de' },
  { ts: 'T+06s', kind: 'scan',     short: 'SC', text: 'subpage crawl · /impressum · /datenschutz · OK',  target: 'kunde-3.com' },
  { ts: 'T+07s', kind: 'ai',       short: 'AI', text: 'detect · LLM-Endpoint · provider=openai · region=us-east', target: 'kunde-2.io' },
  { ts: 'T+08s', kind: 'consent',  short: 'CN', text: 'reject-all path missing · TTDSG §25 risk',        target: 'kunde-4.shop' },
  { ts: 'T+09s', kind: 'agent',    short: 'AG', text: 'triage-agent → owner=daniel · sla=72h',           target: 'kunde-1.de' },
  { ts: 'T+10s', kind: 'evidence', short: 'EV', text: 'audit-bundle 04-26 · 1,248 events · anchored',   target: 'evidence-chain' },
  { ts: 'T+11s', kind: 'drift',    short: 'DR', text: 'vendor added · plausible.io · no DPA on file',    target: 'kunde-3.com' },
  { ts: 'T+12s', kind: 'scan',     short: 'SC', text: 'header re-check · X-Frame-Options absent',        target: 'kunde-4.shop' },
  { ts: 'T+13s', kind: 'ai',       short: 'AI', text: 'register · openai/gpt-4o · classification: high', target: 'kunde-2.io' },
  { ts: 'T+14s', kind: 'evidence', short: 'EV', text: 'rolling backup · supabase-eu-west · 24 GB',       target: 'evidence-chain' },
];

export const KIND_LABEL: Record<RuntimeEventKind, string> = {
  scan: 'scan',
  drift: 'drift',
  ai: 'ai',
  consent: 'consent',
  evidence: 'evidence',
  incident: 'incident',
  agent: 'agent',
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
