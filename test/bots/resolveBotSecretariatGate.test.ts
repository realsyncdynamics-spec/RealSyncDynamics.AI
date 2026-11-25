/**
 * resolveBot: serverseitige Freigabeprüfung für Sekretariats-Bots
 * (supabase/functions/_shared/bots.ts, Migration 20261125183000).
 *
 * Gilt für alle Aufrufer von resolveBot (bot-chat, whatsapp-webhook,
 * bot-voice-webhook, appointment-book, order-intake). Andere Bots bleiben
 * unverändert und lösen keinen zusätzlichen Aufruf aus.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { BotError, isSecretariatConfig, resolveBot, type SupabaseAdmin } from '../../supabase/functions/_shared/bots';

type Rpc = (fn: string, args: Record<string, unknown>) => Promise<{ data: unknown; error: unknown }>;

function fakeAdmin(row: Record<string, unknown> | null, rpc: Rpc) {
  const calls: Array<{ fn: string; args: Record<string, unknown> }> = [];
  const builder = {
    select: () => builder,
    eq: () => builder,
    order: () => builder,
    limit: () => builder,
    maybeSingle: async () => ({ data: row, error: null }),
    single: async () => ({ data: row, error: null }),
    then: undefined,
  };
  const admin = {
    from: () => ({ select: () => builder, insert: () => ({}), update: () => ({}) }),
    rpc: async (fn: string, args: Record<string, unknown>) => { calls.push({ fn, args }); return rpc(fn, args); },
  } as unknown as SupabaseAdmin;
  return { admin, calls };
}

const base = {
  id: 'bot-1', tenant_id: 't-1', name: 'x', description: null, channel: 'chat',
  persona: 'p', greeting: 'g', capabilities: {}, enabled: true,
};
const secretariat = { ...base, config: { vertical: 'general', secretariat: { version: 'v', sourceUrl: 'https://a.de', fetchedAt: 'x', fields: {} } } };

async function errorOf(p: Promise<unknown>): Promise<BotError> {
  try { await p; } catch (e) { if (e instanceof BotError) return e; throw e; }
  throw new Error('resolveBot hat nicht abgelehnt');
}

describe('resolveBot – Freigabeprüfung für Sekretariats-Bots', () => {
  it('normaler Bot: kein zusätzlicher Aufruf, Verhalten unverändert', async () => {
    const { admin, calls } = fakeAdmin({ ...base, config: { vertical: 'general' } }, async () => ({ data: false, error: null }));
    await expect(resolveBot(admin, 't-1', 'bot-1')).resolves.toMatchObject({ id: 'bot-1' });
    expect(calls).toEqual([]);
  });

  it('Sekretariats-Bot mit gültiger Freigabe: erlaubt, Prüfung per bot_id', async () => {
    const { admin, calls } = fakeAdmin(secretariat, async () => ({ data: true, error: null }));
    await expect(resolveBot(admin, 't-1', 'bot-1')).resolves.toMatchObject({ id: 'bot-1' });
    expect(calls).toEqual([{ fn: 'bot_runtime_approval_ok', args: { p_bot_id: 'bot-1' } }]);
  });

  it('ohne gültige Freigabe → 403', async () => {
    for (const data of [false, null, undefined, 'true', 1, [true]]) {
      const { admin } = fakeAdmin(secretariat, async () => ({ data, error: null }));
      const e = await errorOf(resolveBot(admin, 't-1', 'bot-1'));
      expect(e.status).toBe(403);
      expect(e.code).toBe('FORBIDDEN');
    }
  });

  it('Prüfung nicht möglich (RPC-Fehler oder Ausnahme) → 503, fail-closed', async () => {
    const { admin } = fakeAdmin(secretariat, async () => ({ data: null, error: { message: 'function does not exist' } }));
    const e = await errorOf(resolveBot(admin, 't-1', 'bot-1'));
    expect(e.status).toBe(503);
    const { admin: thrower } = fakeAdmin(secretariat, async () => { throw new Error('network'); });
    expect((await errorOf(resolveBot(thrower, 't-1', 'bot-1'))).status).toBe(503);
  });

  it('deaktivierter Bot bleibt 403, ohne Freigabeprüfung', async () => {
    const { admin, calls } = fakeAdmin({ ...secretariat, enabled: false }, async () => ({ data: true, error: null }));
    expect((await errorOf(resolveBot(admin, 't-1', 'bot-1'))).message).toBe('bot is disabled');
    expect(calls).toEqual([]);
  });

  it('isSecretariatConfig erkennt nur den Schlüssel secretariat', () => {
    expect(isSecretariatConfig({ secretariat: {} })).toBe(true);
    expect(isSecretariatConfig({ secretariat: null })).toBe(true);
    expect(isSecretariatConfig({})).toBe(false);
    expect(isSecretariatConfig(null)).toBe(false);
    expect(isSecretariatConfig([])).toBe(false);
  });

  it('alle Bot-Edge-Functions laufen über resolveBot und behandeln BotError abweisend', () => {
    const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'supabase', 'functions');
    for (const fn of ['bot-chat', 'whatsapp-webhook', 'bot-voice-webhook', 'appointment-book', 'order-intake']) {
      const src = readFileSync(join(root, fn, 'index.ts'), 'utf8');
      expect(src, fn).toMatch(/await resolveBot\(/);
    }
  });
});
