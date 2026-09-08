import { describe, expect, it, vi, beforeEach } from 'vitest';

/**
 * `currentAccessToken` darf **nie** werfen.
 *
 * Der Vertrag ist nicht kosmetisch: An dieser Funktion haengt der anonyme
 * Pfad. Wuerde sie bei einem Sitzungsfehler eine Ausnahme werfen, bliebe der
 * Free Scan auf `/audit` stehen — der Trichter, der Kunden bringt. `null`
 * bedeutet schlicht „anonym" und damit exakt das Verhalten von vor dem
 * 2026-09-08.
 */

const getSession = vi.fn();
const isConfigured = vi.fn();

vi.mock('../../../src/lib/supabase', () => ({
  getSupabase: () => ({ auth: { getSession } }),
  isSupabaseConfigured: () => isConfigured(),
}));

const { currentAccessToken } = await import('../../../src/core/ai-gateway/session');

beforeEach(() => {
  getSession.mockReset();
  isConfigured.mockReset();
  isConfigured.mockReturnValue(true);
});

describe('currentAccessToken', () => {
  it('liefert das Token der laufenden Sitzung', async () => {
    getSession.mockResolvedValue({ data: { session: { access_token: 'jwt-1' } } });
    await expect(currentAccessToken()).resolves.toBe('jwt-1');
  });

  it('liefert null, wenn niemand angemeldet ist', async () => {
    getSession.mockResolvedValue({ data: { session: null } });
    await expect(currentAccessToken()).resolves.toBeNull();
  });

  it('liefert null statt zu werfen, wenn die Sitzungsabfrage scheitert', async () => {
    getSession.mockRejectedValue(new Error('network down'));
    await expect(currentAccessToken()).resolves.toBeNull();
  });

  it('fragt gar nicht erst, wenn Supabase nicht konfiguriert ist', async () => {
    isConfigured.mockReturnValue(false);
    await expect(currentAccessToken()).resolves.toBeNull();
    expect(getSession).not.toHaveBeenCalled();
  });

  it('vertraegt eine Antwort ohne data-Feld', async () => {
    getSession.mockResolvedValue({});
    await expect(currentAccessToken()).resolves.toBeNull();
  });
});
