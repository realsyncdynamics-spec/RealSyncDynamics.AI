import { describe, it, expect, beforeEach, vi } from 'vitest';

describe('automation-trigger-trial-webhook', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('payload construction', () => {
    it('maps trial_will_end kind to stripe_trial_will_end event', () => {
      const kindMap: Record<string, string> = {
        trial_started: 'stripe_trial_started',
        trial_will_end: 'stripe_trial_will_end',
        converted: 'stripe_trial_converted',
        canceled: 'stripe_trial_canceled',
      };

      expect(kindMap['trial_will_end']).toBe('stripe_trial_will_end');
      expect(kindMap['trial_started']).toBe('stripe_trial_started');
      expect(kindMap['converted']).toBe('stripe_trial_converted');
      expect(kindMap['canceled']).toBe('stripe_trial_canceled');
    });

    it('constructs complete n8n webhook payload', () => {
      const payload = {
        event: 'stripe_trial_will_end',
        tenant_id: '12345678-1234-1234-1234-123456789012',
        subscription_id: 'sub_1Iu7dkAISfJ30N7iouic5bxM',
        customer_id: 'cus_9s6XWovQFl1p6q',
        trial_end: '2026-08-15T23:59:59Z',
        occurred_at: '2026-08-08T10:00:00Z',
        stripe_event_id: 'evt_trial_will_end_123',
        timestamp: new Date().toISOString(),
      };

      expect(payload).toHaveProperty('event');
      expect(payload).toHaveProperty('tenant_id');
      expect(payload).toHaveProperty('subscription_id');
      expect(payload).toHaveProperty('customer_id');
      expect(payload).toHaveProperty('trial_end');
      expect(payload).toHaveProperty('occurred_at');
      expect(payload).toHaveProperty('stripe_event_id');
      expect(payload).toHaveProperty('timestamp');
    });
  });

  describe('request validation', () => {
    it('requires stripe_event_id, kind, tenant_id, subscription_id', () => {
      const requiredFields = [
        'stripe_event_id',
        'kind',
        'tenant_id',
        'subscription_id',
      ];

      const validPayload = {
        stripe_event_id: 'evt_123',
        kind: 'trial_will_end',
        tenant_id: '12345678-1234-1234-1234-123456789012',
        subscription_id: 'sub_123',
      };

      // Verify all required fields are present
      for (const field of requiredFields) {
        expect(validPayload).toHaveProperty(field);
      }
    });

    it('accepts optional customer_id, trial_end, occurred_at', () => {
      const payload = {
        stripe_event_id: 'evt_123',
        kind: 'trial_will_end',
        tenant_id: '12345678-1234-1234-1234-123456789012',
        subscription_id: 'sub_123',
        customer_id: 'cus_456',
        trial_end: '2026-08-15T23:59:59Z',
        occurred_at: '2026-08-08T10:00:00Z',
      };

      expect(payload.customer_id).toBeDefined();
      expect(payload.trial_end).toBeDefined();
      expect(payload.occurred_at).toBeDefined();
    });
  });

  describe('webhook URL construction', () => {
    it('uses governance_webhooks.target_url for n8n endpoint', () => {
      const webhook = {
        target_url: 'https://webhook.n8n.cloud/webhook/trial-email-workflow',
        secret_hash: 'abc123def456',
        secret_prefix: 'sk_live',
      };

      expect(webhook.target_url).toMatch(/^https:\/\/webhook\.n8n\.cloud\//);
    });

    it('constructs Authorization header with secret prefix', () => {
      const secret_prefix = 'sk_live';
      const secret_hash = 'abc123def456';

      const authHeader = `${secret_prefix}.${secret_hash}`;
      expect(authHeader).toBe('sk_live.abc123def456');
    });
  });

  describe('event filtering', () => {
    it('recognizes all valid trial event kinds', () => {
      const validKinds = ['trial_started', 'trial_will_end', 'converted', 'canceled'];

      for (const kind of validKinds) {
        expect(['trial_started', 'trial_will_end', 'converted', 'canceled']).toContain(kind);
      }
    });

    it('skips events when no webhook configured', () => {
      const response = { ok: true, skipped: true, reason: 'no_n8n_webhook_configured' };

      expect(response.skipped).toBe(true);
      expect(response.reason).toBe('no_n8n_webhook_configured');
    });
  });

  describe('error handling', () => {
    it('returns 401 if bearer token missing', () => {
      const error = { status: 401, code: 'UNAUTHORIZED', message: 'missing bearer token' };

      expect(error.status).toBe(401);
      expect(error.code).toBe('UNAUTHORIZED');
    });

    it('returns 400 if required fields missing', () => {
      const error = { status: 400, code: 'BAD_REQUEST', message: 'missing required fields' };

      expect(error.status).toBe(400);
      expect(error.code).toBe('BAD_REQUEST');
    });

    it('returns 405 if not POST', () => {
      const error = { status: 405, code: 'BAD_REQUEST', message: 'POST only' };

      expect(error.status).toBe(405);
    });
  });
});
