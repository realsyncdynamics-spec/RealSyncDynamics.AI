// Outbound webhook payload formatters.
//
// Auto-detect Slack and Microsoft Teams incoming-webhook URLs and
// emit the platform-native message shape so the alert renders as a
// real message instead of a JSON blob. Everything else falls back
// to the generic shape:
//
//   { event_id, tenant_id, event, decision }
//
// The HMAC signature is always computed over the *exact body that
// goes on the wire*, never the generic envelope, so receivers can
// verify regardless of format.

export type WebhookFormat = 'slack' | 'teams' | 'generic';

export interface WebhookEvent {
  event_type: string;
  event_source: string;
  title: string;
  summary?: string;
  risk_level?: string;
  vendor?: string;
  model_name?: string;
  data_types?: string[];
  policy_action?: string;
  payload?: Record<string, unknown>;
}

export interface WebhookDecision {
  policy_id: string;
  action: string;
}

export interface WebhookEnvelope {
  event_id: string;
  tenant_id: string;
  event: WebhookEvent;
  decision: WebhookDecision | null;
}

const RISK_COLOR_HEX: Record<string, string> = {
  critical: 'dc2626', // red-600
  high:     'f59e0b', // amber-500
  medium:   'eab308', // yellow-500
  low:      '0ea5e9', // sky-500
  info:     '6b7280', // gray-500
};

const RISK_EMOJI: Record<string, string> = {
  critical: ':rotating_light:',
  high:     ':warning:',
  medium:   ':large_yellow_circle:',
  low:      ':large_blue_circle:',
  info:     ':information_source:',
};

export function detectFormat(targetUrl: string): WebhookFormat {
  try {
    const u = new URL(targetUrl);
    const h = u.hostname.toLowerCase();
    if (h === 'hooks.slack.com')                   return 'slack';
    if (h.endsWith('.webhook.office.com'))         return 'teams';
    if (h === 'outlook.office.com' || h.endsWith('.office.com')) {
      if (u.pathname.includes('/webhook')) return 'teams';
    }
    return 'generic';
  } catch {
    return 'generic';
  }
}

export function formatPayload(env: WebhookEnvelope, format: WebhookFormat): string {
  switch (format) {
    case 'slack':   return JSON.stringify(buildSlack(env));
    case 'teams':   return JSON.stringify(buildTeams(env));
    default:        return JSON.stringify(env);
  }
}

/* ── Slack ──────────────────────────────────────────────────── */

function buildSlack(env: WebhookEnvelope): Record<string, unknown> {
  const e = env.event;
  const risk = (e.risk_level ?? 'info').toLowerCase();
  const emoji = RISK_EMOJI[risk] ?? ':information_source:';
  const action = env.decision?.action ?? e.policy_action;

  const fields: Array<{ type: string; text: string }> = [
    { type: 'mrkdwn', text: `*Risk*\n${(e.risk_level ?? 'info').toUpperCase()}` },
    { type: 'mrkdwn', text: `*Source*\n\`${e.event_source}\`` },
  ];
  if (action)        fields.push({ type: 'mrkdwn', text: `*Action*\n*${action.toUpperCase()}*` });
  if (e.vendor)      fields.push({ type: 'mrkdwn', text: `*Vendor*\n${esc(e.vendor)}` });
  if (e.model_name)  fields.push({ type: 'mrkdwn', text: `*Model*\n\`${esc(e.model_name)}\`` });

  const dataTypes = (e.data_types ?? []).join(', ');

  const blocks: Array<Record<string, unknown>> = [
    {
      type: 'header',
      text: { type: 'plain_text', text: `${emoji} ${truncate(e.title, 140)}`, emoji: true },
    },
    { type: 'section', fields },
  ];
  if (e.summary) {
    blocks.push({
      type: 'section',
      text: { type: 'mrkdwn', text: truncate(e.summary, 2900) },
    });
  }
  if (dataTypes) {
    blocks.push({
      type: 'context',
      elements: [
        { type: 'mrkdwn', text: `*Data Types:* ${truncate(dataTypes, 1900)}` },
      ],
    });
  }
  blocks.push({
    type: 'context',
    elements: [
      { type: 'mrkdwn', text: `Event ID: \`${env.event_id}\` · Type: \`${e.event_type}\`` },
    ],
  });

  return {
    text: `${emoji} ${e.title}`, // fallback for clients that don't render blocks
    blocks,
  };
}

/* ── Microsoft Teams ────────────────────────────────────────── */

function buildTeams(env: WebhookEnvelope): Record<string, unknown> {
  const e = env.event;
  const risk = (e.risk_level ?? 'info').toLowerCase();
  const themeColor = RISK_COLOR_HEX[risk] ?? '6b7280';
  const action = env.decision?.action ?? e.policy_action;

  const facts: Array<{ name: string; value: string }> = [
    { name: 'Risk',   value: (e.risk_level ?? 'info').toUpperCase() },
    { name: 'Source', value: e.event_source },
    { name: 'Type',   value: e.event_type },
    { name: 'Event ID', value: env.event_id },
  ];
  if (action)        facts.push({ name: 'Action', value: action.toUpperCase() });
  if (e.vendor)      facts.push({ name: 'Vendor', value: e.vendor });
  if (e.model_name)  facts.push({ name: 'Model',  value: e.model_name });
  if ((e.data_types ?? []).length > 0) {
    facts.push({ name: 'Data Types', value: e.data_types!.join(', ') });
  }

  return {
    '@type':    'MessageCard',
    '@context': 'http://schema.org/extensions',
    summary:    truncate(e.title, 200),
    title:      truncate(e.title, 200),
    themeColor,
    sections: [
      {
        facts,
        text: e.summary ? truncate(e.summary, 5000) : undefined,
      },
    ],
  };
}

/* ── Helpers ────────────────────────────────────────────────── */

function truncate(s: string, max: number): string {
  if (!s) return '';
  return s.length <= max ? s : s.slice(0, max - 1) + '…';
}

function esc(s: string): string {
  // Slack mrkdwn escape — `<`, `>`, `&` are special.
  return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
