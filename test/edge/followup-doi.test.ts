/**
 * Double-Opt-in für Follow-up-E-Mails, Bestätigung und Löschung (Art. 17).
 */
import { describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  FOLLOWUP_DOI_SUBJECT,
  followupConfirmUrl,
  renderFollowupDoiEmail,
  sendFollowupDoi,
} from '../../supabase/functions/gdpr-audit/followup-doi';
import { requestFollowupDoi, type FunnelDbClient } from '../../supabase/functions/gdpr-audit/funnel-lead';

const ROOT = resolve(__dirname, '../..');
const read = (p: string) => readFileSync(resolve(ROOT, p), 'utf8');
const gdprAudit = read('supabase/functions/gdpr-audit/index.ts');
const confirmFn = read('supabase/functions/newsletter-confirm/index.ts');
const gdprDelete = read('supabase/functions/gdpr-delete/index.ts');
const confirmPage = read('src/pages/NewsletterConfirm.tsx');

describe('followup DOI mail', () => {
  it('builds the confirm URL on the existing confirm page with kind=followup', () => {
    expect(followupConfirmUrl('https://realsyncdynamicsai.de/', 'abc-123'))
      .toBe('https://realsyncdynamicsai.de/newsletter/confirm?token=abc-123&kind=followup');
  });
  it('escapes the address and says no follow-ups happen without confirmation', () => {
    const html = renderFollowupDoiEmail('<script>@x.de', 'https://x.de/?a="b"');
    expect(html).not.toContain('<script>@x.de');
    expect(html).toContain('&lt;script&gt;@x.de');
    expect(html).toContain('&quot;b&quot;');
    expect(html).toMatch(/Ohne Bestätigung senden wir keine Follow-up-E-Mails/);
    expect(html).toMatch(/§ 7 UWG/);
    expect(FOLLOWUP_DOI_SUBJECT).toMatch(/bestätigen/);
  });
  it('never throws when the mail provider fails', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const failing = vi.fn(async () => { throw new Error('down'); }) as unknown as typeof fetch;
    await expect(sendFollowupDoi({ apiKey: 're_x', from: 'a@b.de', to: 'c@d.de', confirmUrl: 'https://x', fetchImpl: failing })).resolves.toBe(false);
    const notOk = vi.fn(async () => new Response('no', { status: 500 })) as unknown as typeof fetch;
    await expect(sendFollowupDoi({ apiKey: 're_x', from: 'a@b.de', to: 'c@d.de', confirmUrl: 'https://x', fetchImpl: notOk })).resolves.toBe(false);
    expect(JSON.stringify(spy.mock.calls)).not.toContain('c@d.de');
    spy.mockRestore();
  });
});

describe('requestFollowupDoi', () => {
  const db = (result: { data: unknown; error: { code?: string } | null }): FunnelDbClient => ({
    rpc: vi.fn(async () => result),
    from: vi.fn(() => ({ insert: vi.fn(async () => ({ error: null })) })),
  });
  it('returns token + email when a mail is due', async () => {
    await expect(requestFollowupDoi(db({ data: [{ token: 't', email: 'a@b.de' }], error: null }), 'L1'))
      .resolves.toEqual({ token: 't', email: 'a@b.de' });
  });
  it('returns null when throttled, confirmed or the RPC is missing', async () => {
    await expect(requestFollowupDoi(db({ data: [], error: null }), 'L1')).resolves.toBeNull();
    await expect(requestFollowupDoi(db({ data: null, error: { code: 'PGRST202' } }), 'L1')).resolves.toBeNull();
  });
});

describe('gdpr-audit wiring', () => {
  it('rate limit runs before the lead is captured (Rate-Limit vor Lead)', () => {
    const limit = gdprAudit.indexOf("if ((count ?? 0) >= 5) return jsonError(429, 'RATE_LIMITED'");
    expect(limit).toBeGreaterThan(0);
    expect(limit).toBeLessThan(gdprAudit.indexOf('captureFunnelLead(funnelDb'));
  });
  it('requests the DOI only when the visitor ticked the checkbox', () => {
    expect(gdprAudit).toMatch(/if \(consentCols\.marketing_consent\) \{\s*const doi = await requestFollowupDoi\(funnelDb, leadId\);/);
    // Der Scan selbst löst keinen Werbeversand aus — nur die Bestätigungs-Mail.
    expect(gdprAudit).not.toMatch(/sendStarterOffer\(|rpc\('audit_email_drip|from\('audit_email_drip'/);
  });
});

describe('confirmation and erasure endpoints', () => {
  it('newsletter-confirm handles kind=followup via confirm_followup_doi', () => {
    expect(confirmFn).toMatch(/searchParams\.get\('kind'\) === 'followup'/);
    expect(confirmFn).toMatch(/rpc\('confirm_followup_doi', \{ p_token: token \}\)/);
    expect(confirmPage).toMatch(/params\.get\('kind'\) === 'followup'/);
    expect(confirmPage).toContain("isFollowup ? '&kind=followup' : ''");
  });
  it('gdpr-delete erases lead data before the account is deleted and logs no address', () => {
    const erase = gdprDelete.indexOf("admin.rpc('erase_lead_data'");
    const delUser = gdprDelete.indexOf('admin.auth.admin.deleteUser(userId)');
    expect(erase).toBeGreaterThan(0);
    expect(erase).toBeLessThan(delUser);
    expect(gdprDelete).toMatch(/console\.error\('gdpr-delete: erase_lead_data failed', \{ code: leadErasure\.logCode \}\)/);
  });
});
