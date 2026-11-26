/** Resend accepts an idempotency key for a bounded provider retry window.
 * Acceptance is not proof of delivery. No recipient or secret is logged.
 */
export async function sendCheckoutWelcomeMail(input: {
  apiKey: string;
  sessionId: string;
  from: string;
  email: string;
  subject: string;
  html: string;
}, send: typeof fetch = fetch): Promise<string> {
  if (!input.apiKey.trim()) throw new Error('WELCOME_EMAIL_NOT_CONFIGURED');
  if (!/^cs_(test|live)_[a-zA-Z0-9]+$/.test(input.sessionId)) throw new Error('WELCOME_EMAIL_INVALID_SESSION');
  const response = await send('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: 'Bearer ' + input.apiKey,
      'Content-Type': 'application/json',
      'Idempotency-Key': 'checkout-welcome/' + input.sessionId,
    },
    body: JSON.stringify({ from: input.from, to: [input.email], subject: input.subject, html: input.html }),
  });
  if (!response.ok) throw new Error('WELCOME_EMAIL_HTTP_' + response.status);
  const body = await response.json() as { id?: unknown };
  if (typeof body.id !== 'string' || !body.id.trim()) throw new Error('WELCOME_EMAIL_NO_PROVIDER_ID');
  return body.id;
}
