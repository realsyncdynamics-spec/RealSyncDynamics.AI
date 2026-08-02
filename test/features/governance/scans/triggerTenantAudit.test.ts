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

import { triggerTenantAudit } from '../../../../src/features/governance/scans/scansApi';

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
      /nicht verf/,
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
    });
  });
});
