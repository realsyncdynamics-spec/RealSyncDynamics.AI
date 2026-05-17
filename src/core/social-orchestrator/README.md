# Social Orchestrator

Transforms runtime / governance events into anonymized, channel-optimized social-media drafts. Posts can flow straight to a publisher (when policy allows) or wait in a review queue.

**Pure module**, no React, no fetch in the hot path. Lives in `src/core/social-orchestrator/`.

---

## Pipeline

```
RuntimeEvent
   │
   ▼
eventNormalizer.normalize          → SocialEvent (anonymized,
   │                                  hash-linked back to source)
   ▼
contentPolicy.decideForSocialEvent → final approvalStatus
   │                                  (AUTO / REVIEW / BLOCKED)
   ▼
postGenerator.generatePost (×N)    → SocialPost[] (one per channel)
   │
   ▼
distributionQueue.enqueueMany      → QueueEntry[]
   │
   ▼
SocialPublisher (mock or real)     → PublishResult
```

---

## How to feed runtime events in

```ts
import { SocialOrchestrator } from '@/src/core/social-orchestrator/socialOrchestrator';

const orch = new SocialOrchestrator();   // shares one in-memory queue

const result = await orch.process({
  id:          'evt_runtime_42',
  type:        'tracker.detected',
  occurred_at: '2026-05-16T11:00:00Z',
  severity:    'high',
  region:      'eu-central-1',
  payload:     { summary: 'Tracker detected on /pricing' },
});

result.socialEvent      // anonymized event, audit-trail-quality
result.posts            // 5 channel drafts (LinkedIn ent/legal,
                        //   Instagram, TikTok, X)
result.queueEntries     // queue entries for non-BLOCKED posts
```

For batch ingestion, `orch.processMany([...])` runs the pipeline per
event in order and returns the per-event result.

In production a single `SocialOrchestrator` instance should live for
the lifetime of the worker process. Don't construct one per event —
the in-memory queue would not accumulate state across events.

---

## Approval flow

Every `SocialEvent` carries an `approvalStatus`:

| Status   | Meaning |
|----------|---------|
| `AUTO`   | Policy allows immediate publishing. The queue accepts it as `auto` and `publishAllReady()` can ship it without operator action. |
| `REVIEW` | A human must approve before publishing. The queue accepts it as `pending` and waits for `approve(queueId, reviewer)` or `reject(queueId, reviewer)`. |
| `BLOCKED`| The event is unsafe to surface publicly. The orchestrator still produces the SocialEvent + per-channel posts (so a UI can show what *would* have been published) but the queue refuses to accept them. |

The strictest decision wins. A `SocialEvent` that arrives `AUTO` from the normalizer can still be downgraded to `REVIEW` by the per-event policy (e.g., `high_risk.classified` is always REVIEW), and a generated post with forbidden language can be downgraded all the way to `BLOCKED` even when the underlying `SocialEvent` was `AUTO`.

Compliance-relevant policy rules (one summary):

- No customer names. No raw domains unless `publicApproved=true` is on the source event.
- No PII. Email / DE phone / IBAN / company name patterns BLOCK.
- No legal advice. No "garantiert DSGVO-konform". No "Bußgeld droht sicher".
- AI-Act language is hedged ("potenziell", "Indikator", "prüfpflichtig").

---

## How to add a new channel

1. Add the literal to the `SocialChannel` union in [`types.ts`](types.ts) and to `ALL_CHANNELS`.
2. Add an entry in `CHANNEL_CHAR_BUDGET` in [`postTemplates.ts`](postTemplates.ts).
3. Add a `CHANNEL_HASHTAGS` overlay (the per-channel hashtag block).
4. Add a `TEMPLATES['<new-channel>']` map with a `__default` and the per-event-type overrides you want.
5. Add a `MockPublisher`-style adapter for tests, then a real adapter when ready.
6. The orchestrator picks up the new channel automatically because it iterates `ALL_CHANNELS` by default.

Tests to add: at minimum, one `'<new-channel>' produces post for tracker.detected` case in `socialOrchestrator.test.ts`.

---

## How to wire a real publisher

```ts
import {
  DistributionQueue,
  type SocialPublisher,
} from '@/src/core/social-orchestrator/distributionQueue';

class LinkedInEnterprisePublisher implements SocialPublisher {
  channel = 'linkedin.enterprise' as const;

  async publish(post) {
    // 1. Read OAuth token from Supabase Vault (NEVER from env / repo).
    // 2. POST https://api.linkedin.com/v2/ugcPosts ...
    // 3. Map 4xx → { ok:false, error:{ code:'LINKEDIN_429_RATE_LIMIT', ... } }
    // 4. Return { ok:true, channel:this.channel, externalId, postedAt }
  }
}

const queue = new DistributionQueue();
queue.registerPublisher(new LinkedInEnterprisePublisher());
```

The `distributionQueue.ts` file ends with a `// Real publishers — TODO` block listing the API specifics for LinkedIn / Meta / TikTok / X. Each adapter is a one-PR follow-up.

---

## What the orchestrator does NOT do

- Call any external social API. The `SocialPublisher` interface is the boundary; only `MockPublisher` is shipped.
- Persist anything. The `DistributionQueue` is in-memory; persistence (Postgres, Redis-backed BullMQ) is a follow-up. The class is structured so a `persist()` hook would only need to wrap `enqueue` / `approve` / `reject` / `publish`.
- Do scheduling. There's no "post at 09:00 CET" feature here. Add it via a wrapper that calls `queue.publish(id)` from a cron or BullMQ job.
- Generate images. Templates produce text only. Asset attachment for Instagram / TikTok happens in the publisher adapter.
- Interact with the runtime spec validator. Runtime events are accepted as a loose superset of ESS — defensive parsing.

---

## Files

| File | Role |
|---|---|
| [`types.ts`](types.ts) | All shared types — `RuntimeEvent`, `SocialEvent`, `SocialPost`, `QueueEntry`, `SocialPublisher`, `OrchestrationResult`. |
| [`contentPolicy.ts`](contentPolicy.ts) | Pure policy functions — `preFilter`, `decideForSocialEvent`, `scrubFreeText`, `checkPostBodyForForbiddenLanguage`. |
| [`eventNormalizer.ts`](eventNormalizer.ts) | RuntimeEvent → SocialEvent. SHA-256 content-hash, anonymisation, default summaries. |
| [`postTemplates.ts`](postTemplates.ts) | Per-channel × per-event-type body templates + hashtag overlays + char-budget table. |
| [`postGenerator.ts`](postGenerator.ts) | Combines template + policy → `SocialPost`. Enforces char budget + forbidden-language guard. |
| [`distributionQueue.ts`](distributionQueue.ts) | In-memory queue + reviewer actions + `MockPublisher` for tests. Real publishers documented as TODOs. |
| [`socialOrchestrator.ts`](socialOrchestrator.ts) | Top-level `SocialOrchestrator` class wiring the pipeline. |
| [`../../../test/core/social-orchestrator/socialOrchestrator.test.ts`](../../../test/core/social-orchestrator/socialOrchestrator.test.ts) | 30+ unit tests. |

---

## Running the tests

```bash
npx vitest run test/core/social-orchestrator/
```

Or as part of the full suite:

```bash
npm test
```
