/**
 * P0 Telegram webhook authentication: no configured secret = no processing.
 * The helper used by the deployed Deno handler is pure and tested here.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { telegramWebhookAuthorized } from '../../supabase/functions/telegram-webhook/auth';

describe('Telegram incoming update authorization (fail-closed)', () => {
  it('accepts only exact configured secret', () => {
    expect(telegramWebhookAuthorized('telegram-secret_123', 'telegram-secret_123')).toBe(true);
    expect(telegramWebhookAuthorized('telegram-secret_123', 'telegram-secret_124')).toBe(false);
    expect(telegramWebhookAuthorized('telegram-secret_123', 'telegram-secret_12')).toBe(false);
  });

  it.each([undefined, null, '', '   ', 'secret with space', 'secret\n'])(
    'denies all updates when WEBHOOK_SECRET is missing or invalid (%s)',
    (configured) => {
      expect(telegramWebhookAuthorized(configured, 'anything')).toBe(false);
      expect(telegramWebhookAuthorized(configured, configured)).toBe(false);
    },
  );

  it.each([undefined, null, '', '   ', 'WRONG', 'abc*def'])(
    'denies missing, malformed and forged request secret (%s)',
    (presented) => {
      expect(telegramWebhookAuthorized('valid_secret-123', presented)).toBe(false);
    },
  );

  it('rejects updates before creating an admin client and avoids Telegram retries', () => {
    const source = readFileSync('supabase/functions/telegram-webhook/index.ts', 'utf8');
    const validateAt = source.indexOf('if (!telegramWebhookAuthorized(WEBHOOK_SECRET, incomingSecret))');
    const adminAt = source.indexOf('const admin = createClient(', validateAt);
    expect(validateAt).toBeGreaterThan(0);
    expect(adminAt).toBeGreaterThan(validateAt);
    expect(source.slice(validateAt, adminAt)).toContain("new Response('OK', { status: 200 })");
  });

  it('setup script refuses to register a webhook without a validated secret', () => {
    const source = readFileSync('scripts/setup-telegram-webhook.ts', 'utf8');
    expect(source).toContain("if (!SECRET || !/^[A-Za-z0-9_-]{1,256}$/.test(SECRET))");
    expect(source).toContain("body.secret_token = SECRET;");
    expect(source).not.toContain('if (SECRET) {');
  });
});
