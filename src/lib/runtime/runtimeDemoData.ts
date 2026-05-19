// Demo-Telemetrie fuer den Governance Leitstand.
//
// Alle Werte sind statisch und ausdruecklich als „Demo" gekennzeichnet.
// Solange das Backend nicht angeschlossen ist, nutzt die UI diese Daten
// als Platzhalter — niemals als Live-Behauptung.

import type { RuntimeOverview } from './runtimeTypes';

export const RUNTIME_DEMO_OVERVIEW: RuntimeOverview = {
  generated_at: '2026-05-19T20:42:11.000Z',
  source_label: 'demo',
  kpis: [
    {
      id:    'kpi_open_incidents',
      label: 'Offene Governance-Incidents',
      value: '7',
      trend: 'up',
      delta: '+2 / 24h',
      state: 'demo',
      hint:  'Aus Beispielereignissen abgeleitet.',
    },
    {
      id:    'kpi_unreviewed_ai',
      label: 'Ungeprufte KI-Systeme',
      value: '3',
      trend: 'flat',
      state: 'demo',
    },
    {
      id:    'kpi_unknown_vendors',
      label: 'Unbekannte Vendoren',
      value: '4',
      trend: 'up',
      delta: '+1',
      state: 'demo',
    },
    {
      id:    'kpi_evidence_24h',
      label: 'Evidence-Events 24h',
      value: '128',
      trend: 'up',
      delta: '+12',
      state: 'demo',
    },
    {
      id:    'kpi_drift_events',
      label: 'Drift-Events',
      value: '11',
      trend: 'down',
      delta: '-3',
      state: 'demo',
    },
    {
      id:    'kpi_fix_snippets',
      label: 'Fix-Snippets verfugbar',
      value: '5',
      state: 'demo',
      hint:  'Pro Incident max. ein Snippet.',
    },
  ],
  agents: [
    { id: 'agt_drift',     name: 'Drift-Agent',     role: 'Runtime-Drift',     status: 'running',          last_seen: '2026-05-19T20:42:09.000Z' },
    { id: 'agt_ai_risk',   name: 'AI-Risk-Agent',   role: 'AI-Act-Triage',     status: 'review_required',  last_seen: '2026-05-19T20:41:55.000Z', notes: 'Beispiel-Review offen.' },
    { id: 'agt_evidence',  name: 'Evidence-Agent',  role: 'Nachweiskette',     status: 'running',          last_seen: '2026-05-19T20:42:10.000Z' },
    { id: 'agt_policy',    name: 'Policy-Agent',    role: 'Policy-Engine',     status: 'idle',             last_seen: '2026-05-19T20:38:02.000Z' },
  ],
  incidents: [
    {
      id:           'inc_001',
      severity:     'high',
      title:        'Tracker vor Einwilligung erkannt',
      rule_id:      'consent.pre_consent_tracker',
      rule_version: '1.2.0',
      detected_at:  '2026-05-19T20:41:02.000Z',
      source_url:   'https://www.example.com/',
      status:       'review_required',
    },
    {
      id:           'inc_002',
      severity:     'medium',
      title:        'Formular ohne Datenschutz-Hinweis',
      rule_id:      'forms.missing_privacy_notice',
      rule_version: '0.9.4',
      detected_at:  '2026-05-19T20:39:51.000Z',
      source_url:   'https://www.example.com/kontakt',
      status:       'open',
    },
    {
      id:           'inc_003',
      severity:     'high',
      title:        'Unbekannter AI-Endpunkt aufgerufen',
      rule_id:      'ai.endpoint.unknown',
      rule_version: '1.0.0',
      detected_at:  '2026-05-19T20:37:18.000Z',
      source_url:   'https://api.example.com/v1/assistant',
      status:       'review_required',
    },
    {
      id:           'inc_004',
      severity:     'low',
      title:        'Drittland-Transfer ohne SCC-Hinweis',
      rule_id:      'transfer.third_country.scc_missing',
      rule_version: '0.7.1',
      detected_at:  '2026-05-19T20:32:44.000Z',
      source_url:   'https://www.example.com/',
      status:       'open',
    },
  ],
  evidence: [
    { id: 'ev_001', occurred_at: '2026-05-19T20:42:10.000Z', subject: 'tracker.pre_consent.detected', hash: 'sha256:8f2a…b91c', agent: 'Drift-Agent',    category: 'drift' },
    { id: 'ev_002', occurred_at: '2026-05-19T20:41:33.000Z', subject: 'ai.endpoint.found',           hash: 'sha256:1c43…77ab', agent: 'AI-Risk-Agent',  category: 'agent' },
    { id: 'ev_003', occurred_at: '2026-05-19T20:40:02.000Z', subject: 'form.email.detected',         hash: 'sha256:f5d1…2204', agent: 'Drift-Agent',    category: 'drift' },
    { id: 'ev_004', occurred_at: '2026-05-19T20:37:18.000Z', subject: 'vendor.unknown.detected',     hash: 'sha256:9ab2…0e7e', agent: 'Drift-Agent',    category: 'drift' },
    { id: 'ev_005', occurred_at: '2026-05-19T20:33:44.000Z', subject: 'evidence.bundle.sealed',      hash: 'sha256:0a77…ff31', agent: 'Evidence-Agent', category: 'evidence' },
  ],
  infra: [
    { id: 'inf_edge',   label: 'Edge Functions',        state: 'ok',      detail: 'Demo · alle gruen' },
    { id: 'inf_ollama', label: 'Ollama (EU-lokal)',     state: 'warn',    detail: 'Demo · Latenz erhoeht' },
    { id: 'inf_db',     label: 'Supabase Postgres',     state: 'ok' },
    { id: 'inf_stripe', label: 'Stripe-Webhooks',       state: 'unknown', detail: 'Nicht verbunden' },
  ],
  log: [
    { id: 'log_1', occurred_at: '2026-05-19T20:42:11.000Z', severity: 'high',   category: 'drift',          message: 'tracker.pre_consent.detected · google-analytics.com',  source: 'drift-agent' },
    { id: 'log_2', occurred_at: '2026-05-19T20:42:09.000Z', severity: 'info',   category: 'evidence',       message: 'evidence.bundle.sealed · sha256:0a77…ff31',           source: 'evidence-agent' },
    { id: 'log_3', occurred_at: '2026-05-19T20:42:02.000Z', severity: 'medium', category: 'governance',     message: 'governance.review.requested · inc_002',               source: 'policy-agent' },
    { id: 'log_4', occurred_at: '2026-05-19T20:41:55.000Z', severity: 'high',   category: 'agent',          message: 'ai.endpoint.found · api.openai.com',                  source: 'ai-risk-agent' },
    { id: 'log_5', occurred_at: '2026-05-19T20:41:33.000Z', severity: 'low',    category: 'audit',          message: 'audit.finding.created · finding_inc_002',             source: 'policy-agent' },
    { id: 'log_6', occurred_at: '2026-05-19T20:40:02.000Z', severity: 'info',   category: 'infrastructure', message: 'infra.ollama.latency.spike · p95=812ms',              source: 'monitor' },
  ],
};
