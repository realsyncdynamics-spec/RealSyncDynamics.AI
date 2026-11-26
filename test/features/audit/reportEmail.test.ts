import { describe, expect, it, vi } from 'vitest';
import { requestAuditReportEmail } from '../../../src/features/audit/reportEmail';

const ID = '6adc8f8a-bcf9-48c2-94eb-61fbdb65f11a';
const BASE = 'https://example.supabase.co';
const mockFetch = (body: object, status = 200) =>
  vi.fn(async () => ({ ok: status >= 200 && status < 300, json: async () => body } as Response));

describe('requestAuditReportEmail', () => {
  it('accepts an actual provider send id, not a bare 200', async () => {
    expect(await requestAuditReportEmail(BASE, ID, mockFetch({ ok: true, sent_id: 'resend-test' }))).toBe('accepted');
    expect(await requestAuditReportEmail(BASE, ID, mockFetch({ ok: true }))).toBe('failed');
  });
  it('handles skipped reasons instead of calling them sent', async () => {
    expect(await requestAuditReportEmail(BASE, ID, mockFetch({ ok: true, skipped: 'no_api_key' }))).toBe('not_sent');
    expect(await requestAuditReportEmail(BASE, ID, mockFetch({ ok: true, skipped: 'no_recipient' }))).toBe('not_sent');
    expect(await requestAuditReportEmail(BASE, ID, mockFetch({ ok: true, skipped: 'already_sent' }))).toBe('already_sent');
  });
  it('fails closed on http errors, transport errors and invalid ids', async () => {
    const blocked = mockFetch({ ok: false }, 502);
    expect(await requestAuditReportEmail(BASE, ID, blocked)).toBe('failed');
    expect(await requestAuditReportEmail(BASE, ID, vi.fn(async () => { throw new Error('network'); }))).toBe('failed');
    const send = mockFetch({ ok: true, sent_id: 'x' });
    expect(await requestAuditReportEmail(BASE, 'invalid', send)).toBe('failed');
    expect(send).not.toHaveBeenCalled();
  });
});
