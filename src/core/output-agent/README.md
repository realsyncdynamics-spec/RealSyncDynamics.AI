# OutputAgent

The notification fan-out layer. Closes the observability loop:

```
MonitoringAgent  →  agent_observation  →  OutputAgent.deliver()
                                          ↓
                                       Slack / email / webhook / in_app
                                          ↓
                                    output_agent_deliveries  (audit)
```

**Hard safety rule (spec §15):** OutputAgent **delivers**. It never:

- modifies the source observation / task / decision
- auto-acknowledges anything
- auto-retries failed deliveries (humans trigger retry)

Every `deliver()` call produces exactly one `DeliveryRecord` per matching channel — including `'skipped_severity'` rows for sub-threshold severities, so the audit log is complete.

## Four channel kinds

| Kind | Config | Typical use |
|---|---|---|
| `slack` | `{ webhook_url, default_channel }` | Engineering on-call |
| `email` | `{ to, from, subject_prefix }` | DPO weekly digest |
| `webhook` | `{ url, secret_header_name, secret_value }` | PagerDuty / Opsgenie |
| `in_app` | `{ recipient_user_ids[] }` | Dashboard badge |

Each channel has:
- `min_severity` — only observations at or above this rank get delivered
- `rate_limit_per_hour` — hard cap; excess produces `'rate_limited'` rows
- `enabled` — kill-switch

Severity rank: `info < low < medium < high < critical`.

## Two tables

`output_agent_channels` (mutable config; owner+admin write) and `output_agent_deliveries` (append-only; service_role writes via the agent, members read via RLS).

## Public surface

```ts
import { OutputAgent } from '@/src/core/output-agent/output';

const agent = new OutputAgent();

// 1. Configure channels.
agent.addChannel({
  tenant_id:           'tenant_abc',
  name:                'eng-oncall-slack',
  kind:                'slack',
  config:              { webhook_url: 'https://hooks.slack.com/services/...' },
  min_severity:        'high',
  rate_limit_per_hour: 30,
});

agent.addChannel({
  tenant_id:    'tenant_abc',
  name:         'dpo-digest-email',
  kind:         'email',
  config:       { to: 'dpo@acme.de', subject_prefix: '[RealSync]' },
  min_severity: 'medium',
});

// 2. Plug in a real transport (default = no-op recorder).
import { httpTransport } from './transports/http';  // hypothetical
agent.setTransport(httpTransport);

// 3. Deliver an observation (fans out to every matching channel).
const records = await agent.deliver({
  id:        'obs_123',
  tenant_id: 'tenant_abc',
  severity:  'critical',
  title:     'SLO breach: promotion-agent failure rate',
  detail:    'failure_rate=0.18 over 24h (threshold 0.05)',
});
// records: [
//   { status: 'delivered', channel_id: …, severity: 'critical', … },
//   { status: 'delivered', channel_id: …, severity: 'critical', … },
// ]

// 4. Audit reads.
agent.deliveriesForObservation('obs_123');  // every channel attempt for this obs
agent.deliveriesForChannel(channelId, since);
agent.recentDeliveries('tenant_abc');       // newest first
```

### Bridge from MonitoringAgent

A natural pattern: monitoring emits → output delivers.

```ts
import { MonitoringAgent } from '@/src/core/monitoring-agent/monitoring';
import { OutputAgent }     from '@/src/core/output-agent/output';
import { AgentOsStore }    from '@/src/core/agent-os/store';

const store      = new AgentOsStore();
const monitoring = new MonitoringAgent();
const output     = new OutputAgent();

// Run monitoring's SLO sweep.
monitoring.evaluate(store, 'tenant_abc');

// For each unack high+critical observation, fan it out via OutputAgent.
const observations = store.listObservations({ tenant_id: 'tenant_abc', acknowledged: false })
  .filter(o => o.severity === 'high' || o.severity === 'critical');

for (const o of observations) {
  await output.deliver({
    id: o.id, tenant_id: o.tenant_id, severity: o.severity,
    title: o.title, detail: o.detail,
  });
}
```

## Files

```
src/core/output-agent/
├── README.md
├── types.ts           ChannelRecord + DeliveryRecord + ChannelTransport
│                       + SEVERITY_RANK + persist-hook
└── output.ts          OutputAgent class — addChannel, setEnabled,
                       listChannels, deliver, audit reads

supabase/migrations/
└── 20260601000000_output_agent.sql   2 tables + RLS

test/core/output-agent/
└── output.test.ts     16 unit tests
```

## Out of scope (Phase B)

- Postgres adapter for `OutputPersistHook`
- Real HTTP / SMTP / Slack transport implementations (today: `noopTransport`; Phase A tests inject their own)
- Manual retry verb (`retryDelivery(delivery_id)`) — today: failed = humans investigate
- Templates per channel (today: title + detail go through verbatim)
- DLQ for permanently-failing deliveries
- Per-recipient digest batching (today: one observation = one delivery per channel)
