/**
 * Enterprise AI OS · Discovery — Client. Vorher posteten Formular und Liste
 * ohne Sitzung und ohne Mandant (Zeilen landeten mit tenant_id NULL, die
 * Liste scheiterte immer). Jetzt über supabase-js mit Nutzer-JWT; der
 * Mandant ist nur ein Claim, den der Server gegen die Mitgliedschaft prüft.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

const invoke = vi.hoisted(() => vi.fn());
vi.mock('../../src/lib/supabase', () => ({
  getSupabase: () => ({ functions: { invoke } }),
}));

import {
  functionErrorMessage,
  listPendingDiscovery,
  submitDiscoveryIntake,
} from '../../src/lib/enterprise-ai-os/discovery';

const T = '11111111-1111-4111-8111-111111111111';
const INPUT = {
  systemName: 'ChatGPT Enterprise', provider: 'OpenAI', dataCategories: ['customer_data'],
  externalUsage: false, containsPersonalData: true, containsSensitiveData: false,
};

function httpError(status: number, body: unknown) {
  return { context: new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } }) };
}

beforeEach(() => invoke.mockReset());

describe('submitDiscoveryIntake', () => {
  it('sendet über invoke (JWT) mit Mandanten-Claim, ohne Actor', async () => {
    invoke.mockResolvedValue({ data: { ok: true, registry: { id: 'r1' }, runs: { risk: { riskLevel: 'limited' } } }, error: null });
    await expect(submitDiscoveryIntake(T, INPUT)).resolves.toEqual({ registryId: 'r1', riskLevel: 'limited' });
    const [name, options] = invoke.mock.calls[0]!;
    expect(name).toBe('enterprise-ai-os-discovery-intake');
    expect(options.body).toMatchObject({ ...INPUT, tenantId: T });
    expect(options.body).not.toHaveProperty('actor');
  });

  it('Serverablehnung wird lesbar — beide Fehlerformen', async () => {
    invoke.mockResolvedValue({ data: null, error: httpError(403, { ok: false, error: { code: 'FORBIDDEN', message: 'not a member of the requested tenant' } }) });
    await expect(submitDiscoveryIntake(T, INPUT)).rejects.toThrow('not a member of the requested tenant');
    invoke.mockResolvedValue({ data: null, error: httpError(400, { error: 'systemName and provider are required (max 200 chars)' }) });
    await expect(submitDiscoveryIntake(T, INPUT)).rejects.toThrow('systemName and provider are required');
  });

  it('Antwort ohne Registry-ID gilt nicht als Erfolg', async () => {
    invoke.mockResolvedValue({ data: { ok: true }, error: null });
    await expect(submitDiscoveryIntake(T, INPUT)).rejects.toThrow('Meldung konnte nicht gespeichert werden');
  });
});

describe('listPendingDiscovery', () => {
  it('GET mit Mandant in der Query', async () => {
    invoke.mockResolvedValue({ data: { pending: [{ id: 'p1' }] }, error: null });
    await expect(listPendingDiscovery(T)).resolves.toEqual([{ id: 'p1' }]);
    const [name, options] = invoke.mock.calls[0]!;
    expect(name).toBe(`enterprise-ai-os-discovery-pending?tenantId=${T}&limit=100`);
    expect(options).toEqual({ method: 'GET' });
  });
});

describe('functionErrorMessage', () => {
  it('401/403 ohne JSON → verständlicher Text; sonst Rückfall mit Status', async () => {
    expect(await functionErrorMessage({ context: new Response('x', { status: 401 }) }, 'f')).toBe('Bitte anmelden.');
    expect(await functionErrorMessage({ context: new Response('x', { status: 403 }) }, 'f'))
      .toBe('Keine Schreibberechtigung in diesem Mandanten.');
    expect(await functionErrorMessage({ context: new Response('x', { status: 502 }) }, 'Fehler')).toBe('Fehler (HTTP 502)');
    expect(await functionErrorMessage(new Error('network'), 'Fehler')).toBe('Fehler');
  });
});
