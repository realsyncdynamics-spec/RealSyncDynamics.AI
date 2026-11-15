/**
 * Zwischenspeicher und Backend-Anbindung — mit simuliertem Supabase-Client.
 * Kein echtes Backend; die Zugriffsregeln prüft
 * test/runtime/db/needs-check-results.db.test.ts gegen Postgres.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { clearPending, readPending, writePending } from '../../src/features/needs-check/pending';
import { deleteCheck, getCheck, listChecks, mapDbError, saveCheck } from '../../src/features/needs-check/api';
import type { Answers } from '../../shared/needs-check';

const answers: Answers = { goal: 'website', area: 'praxis', hasWebsite: true, websiteUrl: 'https://beispiel.de' };
const KEY = 'rsd.needsCheck.pending.v2';

const serverRow = {
  id: '6f1d1c1e-2b7a-4d36-9a5e-0c7a3a1b2c3d',
  created_at: '2026-11-15T20:00:00Z',
  model_version: 1,
  goal: 'website',
  area: 'praxis',
  has_website: true,
  website_url: 'https://beispiel.de',
  recommendation_ids: ['build.modernize', 'govern.website_scan', 'automate.chat'],
};

describe('pending (sessionStorage)', () => {
  beforeEach(() => sessionStorage.clear());

  it('hält nur die Angaben über die Anmeldung hinweg fest', () => {
    writePending({ answers, wantsSave: true }, 1_000);
    expect(readPending(1_000 + 60_000)).toEqual({ answers, wantsSave: true });
    expect(Object.keys(JSON.parse(sessionStorage.getItem(KEY)!)).sort()).toEqual(['answers', 'at', 'wantsSave']);
  });

  it('verwirft Einträge nach 60 Minuten und Einträge aus der Zukunft', () => {
    writePending({ answers, wantsSave: true }, 1_000);
    expect(readPending(1_000 + 61 * 60_000)).toBeNull();
    writePending({ answers, wantsSave: true }, 10_000);
    expect(readPending(5_000)).toBeNull();
  });

  it('verwirft manipulierte Einträge', () => {
    sessionStorage.setItem(KEY, JSON.stringify({ at: Date.now(), answers: { goal: 'hack' } }));
    expect(readPending()).toBeNull();
    sessionStorage.setItem(KEY, '{kaputt');
    expect(readPending()).toBeNull();
  });

  it('clearPending entfernt den Eintrag', () => {
    writePending({ answers, wantsSave: false });
    clearPending();
    expect(readPending()).toBeNull();
  });
});

function fakeClient(opts: {
  user?: { id: string } | null;
  single?: { data: unknown; error: unknown };
  limit?: { data: unknown; error: unknown };
  maybeSingle?: { data: unknown; error: unknown };
  deleteSelect?: { data: unknown; error: unknown };
}) {
  let deleting = false;
  const chain = {
    insert: vi.fn(() => chain),
    delete: vi.fn(() => { deleting = true; return chain; }),
    select: vi.fn(() => (deleting ? Promise.resolve(opts.deleteSelect ?? { data: [], error: null }) : chain)),
    single: vi.fn(async () => opts.single ?? { data: null, error: null }),
    order: vi.fn(() => chain),
    limit: vi.fn(async () => opts.limit ?? { data: [], error: null }),
    eq: vi.fn(() => chain),
    maybeSingle: vi.fn(async () => opts.maybeSingle ?? { data: null, error: null }),
  };
  return {
    chain,
    client: {
      auth: { getUser: vi.fn(async () => ({ data: { user: opts.user ?? null } })) },
      from: vi.fn(() => chain),
    } as never,
  };
}

describe('saveCheck', () => {
  it('meldet „nicht verfügbar“ ohne Verbindung', async () => {
    expect(await saveCheck(answers, { client: null })).toEqual({ ok: false, error: { kind: 'unavailable' } });
  });

  it('verlangt eine Anmeldung', async () => {
    const { client } = fakeClient({ user: null });
    expect(await saveCheck(answers, { client })).toEqual({ ok: false, error: { kind: 'unauthenticated' } });
  });

  it('schickt nur die vier Angaben — keine user_id, Zeit, Version, Empfehlungen oder Scan-Referenz', async () => {
    const { client, chain } = fakeClient({ user: { id: 'u1' }, single: { data: serverRow, error: null } });
    await saveCheck(answers, { client });
    const sent = (chain.insert.mock.calls[0] as unknown[])[0] as Record<string, unknown>;
    expect(Object.keys(sent).sort()).toEqual(['area', 'goal', 'has_website', 'website_url']);
  });

  it('übernimmt Version und Empfehlungen aus der Antwort des Servers', async () => {
    const { client } = fakeClient({ user: { id: 'u1' }, single: { data: serverRow, error: null } });
    const r = await saveCheck(answers, { client });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.data.id).toBe(serverRow.id);
      expect(r.data.modelVersion).toBe(1);
      expect(r.data.recommendationIds).toEqual(serverRow.recommendation_ids);
    }
  });

  it('kein „Gespeichert“ ohne bestätigte Zeile', async () => {
    const { client } = fakeClient({ user: { id: 'u1' }, single: { data: null, error: { message: 'boom' } } });
    const r = await saveCheck(answers, { client });
    expect(r.ok).toBe(false);
  });

  it('unbekannte Modellversion vom Server wird nicht angezeigt', async () => {
    const { client } = fakeClient({ user: { id: 'u1' }, single: { data: { ...serverRow, model_version: 99 }, error: null } });
    const r = await saveCheck(answers, { client });
    expect(r.ok).toBe(false);
  });
});

describe('Fehlerzuordnung', () => {
  it.each([
    [{ code: 'P0001', message: 'needs_check_rate_limited' }, 'rate_limited'],
    [{ code: '42501', message: 'needs_check_unauthenticated' }, 'unauthenticated'],
    [{ code: '42501', message: 'permission denied for table needs_check_results' }, 'forbidden'],
    [{ code: '23514', message: 'violates check constraint' }, 'invalid'],
  ])('%o → %s', (err, kind) => {
    expect(mapDbError(err).kind).toBe(kind);
  });
});

describe('Lesen und Löschen', () => {
  it('getCheck lehnt ungültige IDs ab, ohne den Server zu fragen', async () => {
    const { client } = fakeClient({ user: { id: 'u1' } });
    expect(await getCheck('../etc', { client })).toEqual({ ok: false, error: { kind: 'not_found' } });
    expect((client as unknown as { from: ReturnType<typeof vi.fn> }).from).not.toHaveBeenCalled();
  });

  it('getCheck: fremd oder nicht vorhanden → nicht gefunden', async () => {
    const { client } = fakeClient({ user: { id: 'u1' }, maybeSingle: { data: null, error: null } });
    expect(await getCheck(serverRow.id, { client })).toEqual({ ok: false, error: { kind: 'not_found' } });
  });

  it('listChecks verwirft Zeilen mit unbekannten Werten', async () => {
    const { client } = fakeClient({ user: { id: 'u1' }, limit: { data: [serverRow, { ...serverRow, id: 'x', goal: 'hack' }], error: null } });
    const r = await listChecks({ client });
    expect(r.ok && r.data.map((c) => c.id)).toEqual([serverRow.id]);
  });

  it('deleteCheck: keine gelöschte Zeile → nicht gefunden', async () => {
    const { client } = fakeClient({ user: { id: 'u1' }, deleteSelect: { data: [], error: null } });
    expect(await deleteCheck(serverRow.id, { client })).toEqual({ ok: false, error: { kind: 'not_found' } });
  });
});
