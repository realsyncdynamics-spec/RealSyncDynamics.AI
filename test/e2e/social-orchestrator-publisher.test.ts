/**
 * E2E tests for the full social orchestrator publisher chain.
 *
 * Tests the complete flow:
 *   RuntimeEvent → Orchestrator → QueueEntry → Persistence → Publisher → PublishResult
 */

import { describe, it, expect, beforeEach } from 'vitest';
import type { RuntimeEvent } from '../../src/core/social-orchestrator/types';
import { SocialOrchestrator } from '../../src/core/social-orchestrator/socialOrchestrator';
import { DistributionQueue, MockPublisher } from '../../src/core/social-orchestrator/distributionQueue';

// ── Helpers ────────────────────────────────────────────────────────

function runtimeEvent(opts: Partial<RuntimeEvent> = {}): RuntimeEvent {
  return {
    id: `evt_${Date.now()}_${Math.random().toString(36).slice(2)}`,
    type: opts.type || 'tracker.detected',
    occurred_at: opts.occurred_at || new Date().toISOString(),
    severity: opts.severity || 'medium',
    ...opts,
  };
}

describe('Social Orchestrator Publisher Chain (E2E)', () => {
  let queue: DistributionQueue;
  let orch: SocialOrchestrator;

  beforeEach(() => {
    queue = new DistributionQueue();
    // Register MockPublisher for all channels
    for (const channel of [
      'linkedin.enterprise', 'linkedin.legal', 'instagram.reel',
      'tiktok.fast', 'x.alert', 'wordpress.blog', 'ghost.blog',
      'webhook.custom', 'email.newsletter',
    ]) {
      queue.registerPublisher(new MockPublisher(channel as any));
    }
    orch = new SocialOrchestrator({ queue });
  });

  // ── 1. Full pipeline: event → queue → publish ────────────────────

  it('orchestrates tracker.detected event through all channels', async () => {
    const evt = runtimeEvent({ type: 'tracker.detected', severity: 'high' });
    const result = await orch.process(evt);

    expect(result.socialEvent).toBeDefined();
    expect(result.posts).toHaveLength(9); // All 9 channels
    expect(result.queueEntries).toHaveLength(9); // AUTO status → queue

    // All should be in 'auto' status (AUTO posts don't require review)
    for (const entry of result.queueEntries) {
      expect(entry.status).toBe('auto');
      expect(entry.post.approvalStatus).toBe('AUTO');
    }
  });

  it('respects channel-specific approval policies', async () => {
    const evt = runtimeEvent({
      type: 'policy.violation.detected',  // ALWAYS_REVIEW type
      severity: 'high',
    });
    const result = await orch.process(evt);

    // policy.violation.detected is ALWAYS_REVIEW
    for (const entry of result.queueEntries) {
      expect(entry.status).toBe('pending');
      expect(entry.post.approvalStatus).toBe('REVIEW');
    }
  });

  it('blocks BLOCKED events from queuing', async () => {
    const evt = runtimeEvent({
      type: 'tenant.internal.custom_data',  // blocked namespace
      severity: 'high',
    });
    const result = await orch.process(evt);

    // Posts exist (for audit) but queue entries are empty
    expect(result.posts.length).toBeGreaterThan(0);
    expect(result.queueEntries).toHaveLength(0);
  });

  // ── 2. Approval workflow (REVIEW posts) ─────────────────────────

  it('allows reviewer to approve pending posts', async () => {
    const evt = runtimeEvent({ type: 'policy.violation.detected', severity: 'high' });
    const result = await orch.process(evt);
    const [entry] = result.queueEntries;

    expect(entry.status).toBe('pending');

    const approved = await queue.approve(entry.id, 'reviewer@acme.com');

    expect(approved.status).toBe('approved');
    expect(approved.reviewer).toBe('reviewer@acme.com');
    expect(approved.decidedAt).toBeDefined();
  });

  it('allows reviewer to reject pending posts', async () => {
    const evt = runtimeEvent({ type: 'policy.violation.detected', severity: 'high' });
    const result = await orch.process(evt);
    const [entry] = result.queueEntries;

    const rejected = await queue.reject(entry.id, 'reviewer@acme.com');

    expect(rejected.status).toBe('rejected');
    expect(rejected.reviewer).toBe('reviewer@acme.com');
  });

  it('prevents publishing of rejected entries', async () => {
    const evt = runtimeEvent({ type: 'policy.violation.detected', severity: 'high' });
    const result = await orch.process(evt);
    const [entry] = result.queueEntries;

    await queue.reject(entry.id, 'reviewer@acme.com');

    await expect(queue.publish(entry.id)).rejects.toThrow(/not publishable/);
  });

  // ── 3. Publishing flow ─────────────────────────────────────────

  it('publishes auto entries successfully', async () => {
    const evt = runtimeEvent({ type: 'tracker.detected', severity: 'high' });
    const result = await orch.process(evt);

    // All should be auto
    const published = await Promise.all(
      result.queueEntries.map(e => queue.publish(e.id))
    );

    for (const entry of published) {
      expect(entry.status).toBe('published');
      expect(entry.publishResult?.ok).toBe(true);
      expect(entry.publishResult?.externalId).toBeDefined();
      expect(entry.publishedAt).toBeDefined();
    }
  });

  it('publishes approved entries', async () => {
    const evt = runtimeEvent({ type: 'policy.violation.detected', severity: 'high' });
    const result = await orch.process(evt);
    const [entry] = result.queueEntries;

    // Should be pending (REVIEW status)
    expect(entry.status).toBe('pending');

    await queue.approve(entry.id, 'reviewer@acme.com');
    const published = await queue.publish(entry.id);

    expect(published.status).toBe('published');
    expect(published.publishResult?.ok).toBe(true);
  });

  // ── 4. Publisher failure handling ──────────────────────────────

  it('records publisher failures as failed status', async () => {
    const queue2 = new DistributionQueue();
    // Register a failing publisher
    queue2.registerPublisher(new MockPublisher('x.alert', { succeed: false }));
    const orch2 = new SocialOrchestrator({ queue: queue2, channels: ['x.alert'] });

    const evt = runtimeEvent({ type: 'tracker.detected', severity: 'high' });
    const result = await orch2.process(evt);
    const [entry] = result.queueEntries;

    const published = await queue2.publish(entry.id);

    expect(published.status).toBe('failed');
    expect(published.publishResult?.ok).toBe(false);
    expect(published.publishResult?.error?.code).toBe('MOCK_FAIL');
  });

  // ── 5. Batch operations ────────────────────────────────────────

  it('publishes all ready entries in batch', async () => {
    const evt1 = runtimeEvent({ type: 'tracker.detected', severity: 'high' });
    const evt2 = runtimeEvent({ type: 'tracker.detected', severity: 'high' });

    await orch.process(evt1);
    await orch.process(evt2);

    const results = await queue.publishAllReady();

    // 9 channels × 2 events = 18 entries
    expect(results).toHaveLength(18);
    for (const entry of results) {
      expect(entry.status).toBe('published');
    }
  });

  // ── 6. Queue state inspection ──────────────────────────────────

  it('filters queue by status and channel', async () => {
    const evt = runtimeEvent({ type: 'tracker.detected', severity: 'high' });
    const result = await orch.process(evt);

    // All are auto → all in 'auto' status
    const autoEntries = queue.list({ status: 'auto' });
    expect(autoEntries.length).toBeGreaterThan(0);

    const xAlertOnly = queue.list({ status: 'auto', channel: 'x.alert' });
    expect(xAlertOnly).toHaveLength(1);
    expect(xAlertOnly[0].post.channel).toBe('x.alert');
  });

  it('tracks queue size', async () => {
    const evt = runtimeEvent({ type: 'tracker.detected', severity: 'high' });
    await orch.process(evt);

    expect(queue.size()).toBe(9); // 9 channels
  });

  // ── 7. Multiple event types ────────────────────────────────────

  it('handles different event types with different approval policies', async () => {
    // AUTO event (tracker.detected is HIGH_VIRALITY and AUTO for high+publicSafe)
    const autoEvt = await orch.process(runtimeEvent({ type: 'tracker.detected', severity: 'high' }));
    expect(autoEvt.queueEntries.every(e => e.status === 'auto')).toBe(true);

    // REVIEW event (policy.violation.detected is ALWAYS_REVIEW)
    const reviewEvt = await orch.process(runtimeEvent({ type: 'policy.violation.detected', severity: 'high' }));
    expect(reviewEvt.queueEntries.every(e => e.status === 'pending')).toBe(true);

    // BLOCKED event (blocked namespace)
    const blockEvt = await orch.process(runtimeEvent({
      type: 'tenant.internal.x',
    }));
    expect(blockEvt.queueEntries).toHaveLength(0);
  });

  // ── 8. Post content integrity ──────────────────────────────────

  it('preserves post body and hashtags through queue', async () => {
    const evt = runtimeEvent({ type: 'tracker.detected', severity: 'high' });
    const result = await orch.process(evt);
    const [entry] = result.queueEntries;

    // Post body should be non-empty
    expect(entry.post.body.length).toBeGreaterThan(0);

    // Hashtags should exist (at least channel overlays)
    expect(entry.post.hashtags.length).toBeGreaterThan(0);

    // charCount should match body
    expect(entry.post.charCount).toBe(entry.post.body.length);
  });

  // ── 9. Complex approval scenario ────────────────────────────────

  it('handles mixed approval state (some approved, some rejected, some pending)', async () => {
    const evt = runtimeEvent({ type: 'policy.violation.detected', severity: 'high' });
    const result = await orch.process(evt);

    // All should be pending since policy.violation.detected is ALWAYS_REVIEW
    expect(result.queueEntries.every(e => e.status === 'pending')).toBe(true);

    // Approve some
    await queue.approve(result.queueEntries[0].id, 'alice@acme.com');
    await queue.approve(result.queueEntries[1].id, 'bob@acme.com');

    // Reject some
    await queue.reject(result.queueEntries[2].id, 'charlie@acme.com');

    // Leave some pending

    const approved = queue.list({ status: 'approved' });
    const rejected = queue.list({ status: 'rejected' });
    const pending = queue.list({ status: 'pending' });

    expect(approved).toHaveLength(2);
    expect(rejected).toHaveLength(1);
    expect(pending.length).toBeGreaterThan(0);
  });

  // ── 10. Stress test: many events ────────────────────────────────

  it('handles bulk event processing without data loss', async () => {
    const eventCount = 50;
    const events = Array.from({ length: eventCount }, (_, i) =>
      runtimeEvent({ id: `evt_stress_${i}`, type: 'tracker.detected' })
    );

    const results = await orch.processMany(events);

    // 50 events × 9 channels = 450 total queue entries
    const totalQueued = results.reduce((sum, r) => sum + r.queueEntries.length, 0);
    expect(totalQueued).toBe(eventCount * 9);

    // Publish all
    const allReady = await queue.publishAllReady();
    expect(allReady).toHaveLength(totalQueued);

    // All should succeed
    for (const entry of allReady) {
      expect(entry.status).toBe('published');
    }
  });
});
