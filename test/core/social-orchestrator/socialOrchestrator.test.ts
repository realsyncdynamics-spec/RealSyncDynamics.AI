import { describe, it, expect, beforeEach } from 'vitest';
import {
  SocialOrchestrator,
  __resetDefaultOrchestratorForTests,
} from '../../../src/core/social-orchestrator/socialOrchestrator';
import {
  DistributionQueue,
  MockPublisher,
} from '../../../src/core/social-orchestrator/distributionQueue';
import {
  preFilter,
  decideForSocialEvent,
  scrubFreeText,
  isBlockedNamespace,
  approvalStatusFromDecisions,
} from '../../../src/core/social-orchestrator/contentPolicy';
import { ALL_CHANNELS } from '../../../src/core/social-orchestrator/types';
import type {
  RuntimeEvent,
  SocialChannel,
} from '../../../src/core/social-orchestrator/types';

// ── helpers ────────────────────────────────────────────────────────

function evt(overrides: Partial<RuntimeEvent> = {}): RuntimeEvent {
  return {
    id: 'evt_runtime_001',
    type: 'tracker.detected',
    occurred_at: '2026-05-16T10:00:00Z',
    severity: 'medium',
    region: 'eu-central-1',
    payload: {},
    ...overrides,
  };
}

beforeEach(() => {
  __resetDefaultOrchestratorForTests();
});

// ── 1. Blocked namespace events never produce queue entries ────────

describe('blocked-namespace events', () => {
  for (const ns of [
    'tenant.internal.config_updated',
    'customer.private.contract_signed',
    'financial.invoice_paid',
    'personal_data.export_requested',
    'pii.email_changed',
  ]) {
    it(`${ns} produces a SocialEvent with approvalStatus=BLOCKED and no queue entries`, async () => {
      const orch = new SocialOrchestrator();
      const result = await orch.process(evt({ id: `evt_${ns}`, type: ns, severity: 'high' }));

      expect(result.socialEvent.approvalStatus).toBe('BLOCKED');
      expect(result.socialEvent.publicSafe).toBe(false);
      expect(result.queueEntries).toHaveLength(0);

      // Posts MAY be generated for inspection, but every one MUST also
      // carry BLOCKED so a UI can show them as such.
      for (const post of result.posts) {
        expect(post.approvalStatus).toBe('BLOCKED');
      }
    });
  }
});

// ── 2. PII in payload BLOCKS ───────────────────────────────────────

describe('PII payload guard', () => {
  it('blocks events whose payload contains an email address', async () => {
    const orch = new SocialOrchestrator();
    const result = await orch.process(evt({
      id: 'evt_email',
      payload: { contact_string: 'reach me at user@example.com please' },
    }));
    expect(result.socialEvent.approvalStatus).toBe('BLOCKED');
    expect(result.queueEntries).toHaveLength(0);
  });

  it('blocks events whose payload contains a DE phone number', async () => {
    const orch = new SocialOrchestrator();
    const result = await orch.process(evt({
      id: 'evt_phone',
      payload: { contact: 'call 0176 12345678' },
    }));
    expect(result.socialEvent.approvalStatus).toBe('BLOCKED');
  });

  it('blocks events whose payload carries an IBAN', async () => {
    const orch = new SocialOrchestrator();
    const result = await orch.process(evt({
      id: 'evt_iban',
      payload: { txn_note: 'transferred to DE89370400440532013000 yesterday' },
    }));
    expect(result.socialEvent.approvalStatus).toBe('BLOCKED');
  });

  it('blocks events whose payload mentions a DE company name pattern', async () => {
    const orch = new SocialOrchestrator();
    const result = await orch.process(evt({
      id: 'evt_company',
      payload: { context: 'das System bei Maschinenbau GmbH wurde aktualisiert' },
    }));
    expect(result.socialEvent.approvalStatus).toBe('BLOCKED');
  });

  it('blocks events whose payload uses a private key like customer_email', async () => {
    const orch = new SocialOrchestrator();
    const result = await orch.process(evt({
      id: 'evt_key',
      payload: { customer_email: 'foo@bar.de', other: 'safe' },
    }));
    expect(result.socialEvent.approvalStatus).toBe('BLOCKED');
  });
});

// ── 3. high_risk.classified always REVIEW (even publicSafe + high) ─

describe('high_risk.classified always REVIEW', () => {
  it('produces REVIEW status across all channels', async () => {
    const orch = new SocialOrchestrator();
    const result = await orch.process(evt({
      id: 'evt_hr',
      type: 'high_risk.classified',
      severity: 'high',
      publicApproved: true,
    }));
    expect(result.socialEvent.approvalStatus).toBe('REVIEW');
    expect(result.queueEntries).toHaveLength(ALL_CHANNELS.length);
    for (const e of result.queueEntries) {
      expect(e.status).toBe('pending');     // REVIEW posts → pending in queue
      expect(e.post.approvalStatus).toBe('REVIEW');
    }
  });

  it('keeps REVIEW even when severity is medium', async () => {
    const orch = new SocialOrchestrator();
    const result = await orch.process(evt({
      id: 'evt_hr_med',
      type: 'high_risk.classified',
      severity: 'medium',
    }));
    expect(result.socialEvent.approvalStatus).toBe('REVIEW');
  });

  it('also REVIEWs policy.violation.detected', async () => {
    const orch = new SocialOrchestrator();
    const result = await orch.process(evt({
      id: 'evt_pv',
      type: 'policy.violation.detected',
      severity: 'high',
    }));
    expect(result.socialEvent.approvalStatus).toBe('REVIEW');
  });
});

// ── 4. tracker.detected produces channel-specific posts ────────────

describe('tracker.detected produces per-channel posts', () => {
  it('one post per channel, each AUTO when severity is high + publicSafe', async () => {
    const orch = new SocialOrchestrator();
    const result = await orch.process(evt({
      id: 'evt_track_1',
      type: 'tracker.detected',
      severity: 'high',
    }));

    expect(result.posts).toHaveLength(ALL_CHANNELS.length);
    expect(result.queueEntries).toHaveLength(ALL_CHANNELS.length);

    for (const p of result.posts) {
      expect(p.approvalStatus).toBe('AUTO');
      expect(p.body.length).toBeGreaterThan(0);
    }
  });

  it('LinkedIn variants speak governance language; X is short alert-shape', async () => {
    const orch = new SocialOrchestrator();
    const result = await orch.process(evt({
      id: 'evt_track_2',
      type: 'tracker.detected',
      severity: 'high',
    }));

    const li = result.posts.find(p => p.channel === 'linkedin.enterprise');
    const x  = result.posts.find(p => p.channel === 'x.alert');
    expect(li).toBeDefined();
    expect(x).toBeDefined();

    expect(li!.body).toMatch(/Governance|Compliance|DSGVO/);
    expect(x!.body).toMatch(/Runtime Alert/);
    expect(x!.charCount).toBeLessThanOrEqual(260);
  });

  it('uses scoped channels when orchestrator is restricted', async () => {
    const orch = new SocialOrchestrator({ channels: ['x.alert'] });
    const result = await orch.process(evt({
      id: 'evt_track_3',
      type: 'tracker.detected',
      severity: 'high',
    }));
    expect(result.posts).toHaveLength(1);
    expect(result.posts[0]?.channel).toBe('x.alert');
  });
});

// ── 5. Customer domains anonymised in summaries ────────────────────

describe('domain anonymisation in summaries', () => {
  it('replaces customer-domain mentions with [customer-domain] when not publicApproved', async () => {
    const orch = new SocialOrchestrator();
    const result = await orch.process(evt({
      id: 'evt_dom_1',
      type: 'tracker.detected',
      severity: 'medium',
      payload: {
        summary: 'Tracker auf example-customer.de erkannt — siehe their-other-host.com.',
      },
    }));
    expect(result.socialEvent.anonymizedSummary).not.toMatch(/example-customer\.de/);
    expect(result.socialEvent.anonymizedSummary).not.toMatch(/their-other-host\.com/);
    expect(result.socialEvent.anonymizedSummary).toMatch(/\[customer-domain\]/);
  });

  it('keeps realsyncdynamicsai.de as a non-customer domain', async () => {
    const result = scrubFreeText(
      'Mehr unter realsyncdynamicsai.de und auch foo.de.',
      false,
    );
    expect(result).toMatch(/realsyncdynamicsai\.de/);
    expect(result).toMatch(/\[customer-domain\]/);
  });

  it('preserves customer domains when publicApproved=true', async () => {
    const orch = new SocialOrchestrator();
    const result = await orch.process(evt({
      id: 'evt_dom_2',
      type: 'tracker.detected',
      severity: 'medium',
      publicApproved: true,
      payload: { summary: 'Tracker auf example-customer.de erkannt.' },
    }));
    expect(result.socialEvent.anonymizedSummary).toMatch(/example-customer\.de/);
  });
});

// ── 6. Hashtags applied per channel ────────────────────────────────

describe('hashtag application per channel', () => {
  it('every channel post includes the channel-overlay hashtags', async () => {
    const orch = new SocialOrchestrator();
    const result = await orch.process(evt({
      id: 'evt_h_1',
      type: 'tracker.detected',
      severity: 'high',
    }));

    const li = byChannel(result.posts, 'linkedin.enterprise');
    const ig = byChannel(result.posts, 'instagram.reel');
    const tk = byChannel(result.posts, 'tiktok.fast');
    const xa = byChannel(result.posts, 'x.alert');

    expect(li.hashtags).toEqual(expect.arrayContaining(['#EnterpriseGovernance']));
    expect(ig.hashtags).toEqual(expect.arrayContaining(['#TechExplained']));
    expect(tk.hashtags).toEqual(expect.arrayContaining(['#TechTok']));
    expect(xa.hashtags).toEqual(expect.arrayContaining(['#Runtime']));
  });

  it('every channel post includes the event-derived base hashtags', async () => {
    const orch = new SocialOrchestrator();
    const result = await orch.process(evt({
      id: 'evt_h_2',
      type: 'consent.missing',
      severity: 'high',
    }));
    for (const p of result.posts) {
      // base hashtags for consent.missing include #DSGVO + #Consent
      expect(p.hashtags.some(h => h.toLowerCase() === '#dsgvo' || h.toLowerCase() === '#consent'))
        .toBe(true);
    }
  });

  it('hashtags are deduplicated case-insensitively', async () => {
    const orch = new SocialOrchestrator();
    const result = await orch.process(evt({
      id: 'evt_h_3',
      type: 'tracker.detected',
      severity: 'medium',
    }));
    const li = byChannel(result.posts, 'linkedin.enterprise');
    const lower = li.hashtags.map(h => h.toLowerCase());
    expect(new Set(lower).size).toBe(lower.length);
  });
});

// ── 7. Distribution queue + mock publisher ─────────────────────────

describe('distribution queue + mock publisher', () => {
  it('AUTO posts land as status=auto, REVIEW posts land as status=pending', async () => {
    const queue = new DistributionQueue();
    const orch = new SocialOrchestrator({ queue, channels: ['x.alert'] });

    const auto = await orch.process(evt({
      id: 'evt_q_auto', type: 'tracker.detected', severity: 'high',
    }));
    const review = await orch.process(evt({
      id: 'evt_q_review', type: 'high_risk.classified', severity: 'high',
    }));

    expect(auto.queueEntries[0]?.status).toBe('auto');
    expect(review.queueEntries[0]?.status).toBe('pending');
  });

  it('publishes ready entries via the registered MockPublisher', async () => {
    const queue = new DistributionQueue();
    const pub = new MockPublisher('x.alert');
    queue.registerPublisher(pub);
    const orch = new SocialOrchestrator({ queue, channels: ['x.alert'] });

    await orch.process(evt({ id: 'evt_q_pub', type: 'tracker.detected', severity: 'high' }));
    const published = await queue.publishAllReady();

    expect(published).toHaveLength(1);
    expect(published[0]?.status).toBe('published');
    expect(published[0]?.publishResult?.ok).toBe(true);
    expect(pub.published).toHaveLength(1);
  });

  it('approve() flips a pending entry to approved + records reviewer', async () => {
    const queue = new DistributionQueue();
    const orch = new SocialOrchestrator({ queue, channels: ['x.alert'] });
    await orch.process(evt({ id: 'evt_q_app', type: 'high_risk.classified', severity: 'high' }));

    const [entry] = queue.list({ status: 'pending' });
    expect(entry).toBeDefined();

    const after = queue.approve(entry!.id, 'reviewer-001');
    expect(after.status).toBe('approved');
    expect(after.reviewer).toBe('reviewer-001');
    expect(after.decidedAt).toBeDefined();
  });

  it('reject() flips a pending entry to rejected and disallows publish', async () => {
    const queue = new DistributionQueue();
    queue.registerPublisher(new MockPublisher('x.alert'));
    const orch = new SocialOrchestrator({ queue, channels: ['x.alert'] });
    await orch.process(evt({ id: 'evt_q_rej', type: 'high_risk.classified', severity: 'high' }));

    const [entry] = queue.list({ status: 'pending' });
    queue.reject(entry!.id, 'reviewer-002');

    await expect(queue.publish(entry!.id)).rejects.toThrow(/not publishable/);
  });

  it('BLOCKED posts never enter the queue', async () => {
    const queue = new DistributionQueue();
    const orch = new SocialOrchestrator({ queue });
    await orch.process(evt({
      id: 'evt_q_blocked',
      type: 'pii.email_changed',
      severity: 'high',
      payload: { context: 'safe' },
    }));
    expect(queue.size()).toBe(0);
  });

  it('records publisher failures as status=failed with error code', async () => {
    const queue = new DistributionQueue();
    queue.registerPublisher(new MockPublisher('x.alert', { succeed: false }));
    const orch = new SocialOrchestrator({ queue, channels: ['x.alert'] });
    await orch.process(evt({ id: 'evt_q_fail', type: 'tracker.detected', severity: 'high' }));
    const [out] = await queue.publishAllReady();
    expect(out.status).toBe('failed');
    expect(out.publishResult?.error?.code).toBe('MOCK_FAIL');
  });
});

// ── 8. Pure-function policy helpers ────────────────────────────────

describe('contentPolicy helpers', () => {
  it('preFilter detects every blocked namespace prefix', () => {
    expect(preFilter(evt({ type: 'tenant.internal.x' })).status).toBe('BLOCKED');
    expect(preFilter(evt({ type: 'customer.private.x' })).status).toBe('BLOCKED');
    expect(preFilter(evt({ type: 'financial.x' })).status).toBe('BLOCKED');
  });

  it('preFilter raises critical+!publicApproved to REVIEW', () => {
    expect(preFilter(evt({ severity: 'critical' })).status).toBe('REVIEW');
    expect(preFilter(evt({ severity: 'critical', publicApproved: true })).status).toBe('AUTO');
  });

  it('isBlockedNamespace works as expected', () => {
    expect(isBlockedNamespace('tenant.internal.foo')).toBe(true);
    expect(isBlockedNamespace('tracker.detected')).toBe(false);
  });

  it('approvalStatusFromDecisions picks strictest', () => {
    expect(approvalStatusFromDecisions([
      { status: 'AUTO',    reasons: [] },
      { status: 'REVIEW',  reasons: ['x'] },
    ])).toBe('REVIEW');
    expect(approvalStatusFromDecisions([
      { status: 'AUTO',    reasons: [] },
      { status: 'BLOCKED', reasons: ['y'] },
      { status: 'REVIEW',  reasons: ['z'] },
    ])).toBe('BLOCKED');
  });

  it('decideForSocialEvent demotes critical to REVIEW even when publicSafe', () => {
    const dec = decideForSocialEvent({
      id: 's', sourceEventId: 'h', type: 'tracker.detected',
      severity: 'critical', publicSafe: true, approvalStatus: 'AUTO',
      generatedAt: '2026-05-16T10:00:00Z', anonymizedSummary: '',
      hashtags: [],
    });
    expect(dec.status).toBe('REVIEW');
  });
});

// ── helpers ────────────────────────────────────────────────────────

function byChannel(posts: { channel: SocialChannel; hashtags: string[]; body: string }[], ch: SocialChannel) {
  const p = posts.find(x => x.channel === ch);
  if (!p) throw new Error(`no post for channel ${ch}`);
  return p;
}
