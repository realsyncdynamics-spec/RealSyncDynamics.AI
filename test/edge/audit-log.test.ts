/**
 * Gate 0 — `_shared/auditLog.ts` darf einen fehlgeschlagenen Audit-Insert
 * nicht still verschlucken.
 *
 * supabase-js wirft bei DB-Fehlern nicht, sondern liefert `{ error }`. Vorher
 * prüfte `audit()` nur das `catch` — ein abgelehnter Insert (RLS, Constraint,
 * fehlende Spalte) blieb unsichtbar.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { audit } from '../../supabase/functions/_shared/auditLog';

const args = {
  tenant_id: 't-1',
  actor_user_id: 'u-1',
  actor_email: 'a@example.com',
  action: 'asset.create',
  target_type: 'governance_asset',
  target_id: 'asset-1',
};

function clientReturning(result: { error: unknown } | Error) {
  const insert = vi.fn(() =>
    result instanceof Error ? Promise.reject(result) : Promise.resolve(result),
  );
  return { client: { from: vi.fn(() => ({ insert })) }, insert };
}

afterEach(() => vi.restoreAllMocks());

describe('audit()', () => {
  it('meldet Erfolg und schreibt in governance_admin_log', async () => {
    const { client, insert } = clientReturning({ error: null });
    const res = await audit(client, args);
    expect(res).toEqual({ ok: true });
    expect(client.from).toHaveBeenCalledWith('governance_admin_log');
    expect(insert).toHaveBeenCalledWith(expect.objectContaining({ action: 'asset.create', tenant_id: 't-1' }));
  });

  it('prüft den zurückgegebenen DB-Fehler statt ihn zu verschlucken', async () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});
    const { client } = clientReturning({ error: { message: 'new row violates row-level security policy' } });
    const res = await audit(client, args);
    expect(res).toEqual({ ok: false, error: 'new row violates row-level security policy' });
    expect(log).toHaveBeenCalledTimes(1);
    const entry = JSON.parse(String(log.mock.calls[0]![0]));
    expect(entry).toMatchObject({ level: 'error', scope: 'audit_log_failed', action: 'asset.create', tenant_id: 't-1' });
  });

  it('meldet auch geworfene Fehler (Netzwerk) als ok:false', async () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});
    const { client } = clientReturning(new Error('fetch failed'));
    const res = await audit(client, args);
    expect(res).toEqual({ ok: false, error: 'fetch failed' });
    expect(log).toHaveBeenCalledTimes(1);
  });

  it('wirft nie — die Primäraktion scheitert nicht am Logging', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const { client } = clientReturning({ error: 'boom' });
    await expect(audit(client, args)).resolves.toEqual({ ok: false, error: 'boom' });
  });
});
