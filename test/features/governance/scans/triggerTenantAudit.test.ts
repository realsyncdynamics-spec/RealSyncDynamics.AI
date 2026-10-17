/**
 * triggerTenantAudit — Fehlerpfade des Scan-Triggers.
 *
 * Regression: eine leere Server-Antwort liess frueher `r.json()` mit
 * „Unexpected end of JSON input" durchschlagen; der rohe DOMException-Text
 * landete ungefangen im Websites-Tab.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('../../../../src/lib/supabase', () => ({
  getSupabase: () => ({
    auth: {
      getSession: () =>
        Promise.resolve({ data: { session: { access_token: 'tok-1' } } }),
    },
  }),
}));

import { TenantAuditError, triggerTenantAudit } from '../../../../src/features/governance/scans/scansApi';

function respond(status: number, body: string): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    text: () => Promise.resolve(body),
  } as unknown as Response;
}

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn());
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('triggerTenantAudit', () => {
  it('meldet einen lesbaren Fehler statt eines JSON-Parse-Fehlers bei leerem Body', async () => {
    vi.mocked(fetch).mockResolvedValue(respond(504, ''));

    await expect(triggerTenantAudit('t-1', 'example.de')).rejects.toThrow(
      /Timeout/,
    );
  });

  it('wirft keinen „Unexpected end of JSON input" bei leerer 500-Antwort', async () => {
    vi.mocked(fetch).mockResolvedValue(respond(500, ''));

    await expect(triggerTenantAudit('t-1', 'example.de')).rejects.toThrow(
      /Website-Audit fehlgeschlagen.*HTTP 500/,
    );
  });

  it('500 mit JSON-Fehler: Status sichtbar, Server-Detail als Zusatz (tenant-audit, Stand 25.09.)', async () => {
    vi.mocked(fetch).mockResolvedValue(
      respond(500, JSON.stringify({ ok: false, error: { message: 'scan_run_id missing' } })),
    );

    await expect(triggerTenantAudit('t-1', 'example.de')).rejects.toThrow(
      /HTTP 500.*Details: scan_run_id missing/,
    );
  });

  it('meldet ungueltiges JSON bei HTTP 200 als Server-Antwort-Fehler', async () => {
    vi.mocked(fetch).mockResolvedValue(respond(200, '<html>gateway</html>'));

    await expect(triggerTenantAudit('t-1', 'example.de')).rejects.toThrow(
      /Ung.ltige Antwort/,
    );
  });

  it('reicht die strukturierte Fehlermeldung des Servers durch', async () => {
    vi.mocked(fetch).mockResolvedValue(
      respond(400, JSON.stringify({ ok: false, error: { message: 'Domain nicht registriert.' } })),
    );

    await expect(triggerTenantAudit('t-1', 'example.de')).rejects.toThrow(
      'Domain nicht registriert.',
    );
  });

  it('meldet Netzwerkausfall als erreichbarkeitsfehler', async () => {
    vi.mocked(fetch).mockRejectedValue(new TypeError('Failed to fetch'));

    await expect(triggerTenantAudit('t-1', 'example.de')).rejects.toThrow(
      /nicht erreichbar/,
    );
  });

  it('gibt das Scan-Ergebnis bei Erfolg zurueck', async () => {
    vi.mocked(fetch).mockResolvedValue(
      respond(200, JSON.stringify({
        ok: true,
        scan_run_id: 'sr-1',
        finding_count: 4,
        severity_max: 'high',
      })),
    );

    await expect(triggerTenantAudit('t-1', 'example.de')).resolves.toEqual({
      scan_run_id: 'sr-1',
      finding_count: 4,
      severity_max: 'high',
      // Ältere Server-Antwort ohne asset_binding: aus website_id abgeleitet.
      asset_binding: 'none',
      website_id: null,
      evidence_id: null,
    });
  });

  it('meldet die Asset-Bindung und die Evidence des Laufs (Stand 29.09.)', async () => {
    vi.mocked(fetch).mockResolvedValue(
      respond(200, JSON.stringify({
        ok: true, scan_run_id: 'sr-2', finding_count: 0, severity_max: null,
        asset_binding: 'website', website_id: 'w-1', evidence_id: 'ev-1',
      })),
    );

    await expect(triggerTenantAudit('t-1', 'example.de', { website_id: 'w-1' })).resolves.toMatchObject({
      asset_binding: 'website', website_id: 'w-1', evidence_id: 'ev-1',
    });
  });

  it('WEBSITE_AMBIGUOUS: TenantAuditError mit Code und Kandidaten — nichts wird geraten', async () => {
    const candidates = [{ id: 'w-1', domain: 'example.de' }, { id: 'w-2', domain: 'www.example.de' }];
    vi.mocked(fetch).mockResolvedValue(
      respond(409, JSON.stringify({ ok: false, error: { code: 'WEBSITE_AMBIGUOUS', message: 'x', details: { candidates } } })),
    );

    const err = await triggerTenantAudit('t-1', 'example.de').catch((e: unknown) => e);
    expect(err).toBeInstanceOf(TenantAuditError);
    expect(err).toMatchObject({ code: 'WEBSITE_AMBIGUOUS', status: 409, details: { candidates } });
  });

  it('429 RATE_LIMITED: deutsche Meldung mit Code, ohne Server-Rohtext und ohne erfundene Zahl', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      respond(429, JSON.stringify({ ok: false, error: { code: 'RATE_LIMITED', message: 'max 30 scans per tenant and hour' } })),
    );
    const err = await triggerTenantAudit('t-1', 'example.de').catch((e: unknown) => e);
    expect(err).toBeInstanceOf(TenantAuditError);
    expect(err).toMatchObject({ code: 'RATE_LIMITED', status: 429, message: 'Scan-Limit erreicht. Bitte später erneut versuchen.' });
  });
});
