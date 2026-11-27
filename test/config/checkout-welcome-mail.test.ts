import { describe, expect, it, vi } from 'vitest';
import { sendCheckoutWelcomeMail } from '../../supabase/functions/_shared/checkout-welcome-mail';

describe('checkout welcome email transport', () => {
  const input = { apiKey: 'fixture', sessionId: 'cs_test_fixture123', from: 'sender@example.test', email: 'recipient@example.test', subject: 'Test', html: '<p>Test</p>' };
  it('uses stable provider idempotency and requires acceptance ID', async () => {
    const send = vi.fn(async () => new Response(JSON.stringify({ id: 'mail_fixture' }), { status: 200 })) as unknown as typeof fetch;
    await expect(sendCheckoutWelcomeMail(input, send)).resolves.toBe('mail_fixture');
    expect(send).toHaveBeenCalledWith('https://api.resend.com/emails', expect.objectContaining({ headers: expect.objectContaining({ 'Idempotency-Key': 'checkout-welcome/cs_test_fixture123' }) }));
  });
  it('fails explicitly on rejected or malformed provider response', async () => {
    for (const status of [401, 429, 500]) {
      await expect(sendCheckoutWelcomeMail(input, async () => new Response('', { status }))).rejects.toThrow('WELCOME_EMAIL_HTTP_' + status);
    }
    await expect(sendCheckoutWelcomeMail(input, async () => new Response('{}'))).rejects.toThrow('WELCOME_EMAIL_NO_PROVIDER_ID');
  });
  it('rejects missing configuration without a network call', async () => {
    const send = vi.fn();
    await expect(sendCheckoutWelcomeMail({ ...input, apiKey: '' }, send)).rejects.toThrow('WELCOME_EMAIL_NOT_CONFIGURED');
    expect(send).not.toHaveBeenCalled();
  });
});
