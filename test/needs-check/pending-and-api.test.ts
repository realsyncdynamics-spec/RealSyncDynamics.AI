/**
 * Zwischenspeicher und Backend-Anbindung — mit simuliertem Supabase-Client.
 * Kein echtes Backend; die Zugriffsregeln prüft
 * test/runtime/db/needs-check-rls.db.test.ts gegen Postgres.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { clearPending, readPending, writePending } from '../../src/features/needs-check/pending';
import { getCheck, listChecks, runWebsiteScan, saveCheck } from '../../src/features/needs-check/api';
import type { Answers } from '../../src/features/needs-check/model';

const answers: Answers = { goal: 'website', area: 'praxis', hasWebsite: true, websiteUrl: 'https://beispiel.de' };

describe('pending (sessionStorage)', () => {
  beforeEach(() => sessionStorage.clear());

  it('hält Angaben über die Anmeldung hinweg fest', () => {
    writePending({ answers, auditId: null, wantsSave: true }, 1_000);
    expect(readPending(1_000 + 60_000)).toEqual({ answers, auditId: null, wantsSave: true });
  });

  it('verwirft Einträge nach 60 Minuten', () => {
    writePending({ answers, auditId: null, wantsSave: true }, 1_000);
    expect(readPending(1_000 + 61 * 60_000)).toBeNull();
  });

  it('verwirft manipulierte Einträge', () => {
    sessionStorage.setItem('rsd.needsCheck.pending.v1', JSON.stringify({ at: Date.now(), answers: { goal: 'hack' } }));
    expect(readPending()).toBeNull();
    sessionStorage.setItem('rsd.needsCheck.pending.v1', '{kaputt');
    expect(readPending()).toBeNull();
  });

  it('clearPending entfernt den Eintrag', () => {
    writePending({ answers, auditId: null, wantsSave: false });
    clearPending();
    expect(readPending()).toBeNull();
  });
});

function fakeClient(opts: {
  user?: { id: string } | null;
  insert?: { data: unknown; error: unknown };
  select?: { data: unknown; error: unknown };
  invoke?: { data: unknown; error: unknown };
}) {
  const chain = {
    insert: vi.fn(() => chain),
    select: vi.fn(() => chain),
    single: vi.fn(async () => opts.insert ?? { data: null, error: null }),
    order: vi.fn(() => chain),
    limit: vi.fn(async () => opts.select ?? { data: [], error: null }),
    eq: vi.fn(() => chain),
    maybeSingle: vi.fn(async () => opts.select ?? { data: null, error: null }),
  };
  return {
    chain,
    client: {
      auth: { getUser: vi.fn(async () => ({ data: { user: opts.user ?? null } })) },
      from: vi.fn(() => chain),
      functions: { invoke: vi.fn(async () => opts.invoke ?? { data: null, error: null }) },
    } as never,
  };
}

function firstInsert(chain: { insert: { mock: { calls: unknown[] } } }): Record<string, unknown> {
  const call = chain.insert.mock.calls[0] as unknown as [Record<string, unknown>];
  return call[0];
}

describe('api.saveCheck', () => {
  it('meldet „nicht verfügbar“, wenn keine Verbindung eingerichtet ist', async () => {
    const r = await saveCheck(answers, ['build.modernize'], null, { client: null });
    expect(r).toEqual({ ok: false, error: { kind: 'unavailable' } });
  });

  it('verlangt eine Anmeldung', async () => {
    const { client } = fakeClient({ user: null });
    const r = await saveCheck(answers, ['build.modernize'], null, { client });
    expect(r).toEqual({ ok: false, error: { kind: 'unauthenticated' } });
  });

  it('meldet Erfolg erst mit der vom Backend bestätigten ID und sendet keine user_id', async () => {
    const { client, chain } = fakeClient({ user: { id: 'u1' }, insert: { data: { id: 'abc' }, error: null } });
    const r = await saveCheck(answers, ['build.modernize', 'govern.website_scan'], null, { client });
    expect(r).toEqual({ ok: true, data: { id: 'abc' } });
    const row = firstInsert(chain);
    expect(row).not.toHaveProperty('user_id');
    expect(row.result_basis).toBe('answers');
  });

  it('kennzeichnet ein Ergebnis mit Scan als answers_and_scan', async () => {
    const { client, chain } = fakeClient({ user: { id: 'u1' }, insert: { data: { id: 'abc' }, error: null } });
    await saveCheck(answers, ['build.modernize'], '11111111-1111-1111-1111-111111111111', { client });
    expect(firstInsert(chain).result_basis).toBe('answers_and_scan');
  });

  it('übersetzt das Tageslimit und RLS-Fehler', async () => {
    const limited = fakeClient({ user: { id: 'u1' }, insert: { data: null, error: { code: 'P0001', message: 'needs_check_rate_limited' } } });
    expect(await saveCheck(answers, ['build.modernize'], null, { client: limited.client })).toEqual({ ok: false, error: { kind: 'rate_limited' } });
    const rls = fakeClient({ user: { id: 'u1' }, insert: { data: null, error: { code: '42501', message: 'new row violates row-level security policy' } } });
    expect(await saveCheck(answers, ['build.modernize'], null, { client: rls.client })).toEqual({ ok: false, error: { kind: 'forbidden' } });
  });

  it('meldet kein „gespeichert“, wenn das Backend keine ID liefert', async () => {
    const { client } = fakeClient({ user: { id: 'u1' }, insert: { data: null, error: null } });
    const r = await saveCheck(answers, ['build.modernize'], null, { client });
    expect(r.ok).toBe(false);
  });
});

describe('api.getCheck / listChecks', () => {
  it('fremde oder unbekannte Ergebnisse erscheinen als „nicht gefunden“', async () => {
    const { client } = fakeClient({ user: { id: 'u1' }, select: { data: null, error: null } });
    expect(await getCheck('11111111-1111-1111-1111-111111111111', { client })).toEqual({ ok: false, error: { kind: 'not_found' } });
  });

  it('lehnt ungültige IDs ab, ohne das Backend zu fragen', async () => {
    const { client } = fakeClient({ user: { id: 'u1' } });
    expect(await getCheck('../../etc', { client })).toEqual({ ok: false, error: { kind: 'not_found' } });
  });

  it('liest eigene Ergebnisse und verwirft ungültige Zeilen', async () => {
    const { client } = fakeClient({
      user: { id: 'u1' },
      select: {
        data: [
          { id: 'a', created_at: '2026-11-15T10:00:00Z', goal: 'rules', area: 'kanzlei', has_website: false, website_url: null, recommendation_ids: ['govern.runtime'], audit_id: null, result_basis: 'answers' },
          { id: 'b', created_at: '2026-11-15T10:00:00Z', goal: 'kaputt', area: 'kanzlei', has_website: false, website_url: null, recommendation_ids: [], audit_id: null, result_basis: 'answers' },
        ],
        error: null,
      },
    });
    const r = await listChecks({ client });
    expect(r.ok && r.data.map((x) => x.id)).toEqual(['a']);
  });
});

describe('api.runWebsiteScan', () => {
  it('meldet das Stundenlimit verständlich', async () => {
    const { client } = fakeClient({ invoke: { data: null, error: { context: { status: 429 } } } });
    expect(await runWebsiteScan('https://beispiel.de', { client })).toEqual({ ok: false, error: { kind: 'rate_limited' } });
  });

  it('erfindet kein Ergebnis, wenn der Scan nichts liefert', async () => {
    const { client } = fakeClient({ invoke: { data: { ok: false }, error: null } });
    const r = await runWebsiteScan('https://beispiel.de', { client });
    expect(r.ok).toBe(false);
  });

  it('nutzt den Optimizer-Modus ohne E-Mail und sortiert Befunde nach Schwere', async () => {
    const { client } = fakeClient({
      invoke: {
        data: {
          ok: true, audit_id: 'id1', domain: 'beispiel.de', score: 61, coverage_notice: null,
          issues: [
            { title: 'Niedrig', severity: 'low' },
            { title: 'Kritisch', severity: 'critical', paragraph_ref: '§ 5 DDG' },
            { title: 'Hoch', severity: 'high' },
            { title: 'Mittel', severity: 'medium' },
          ],
        },
        error: null,
      },
    });
    const r = await runWebsiteScan('https://beispiel.de', { client });
    expect(r.ok && r.data.issues.map((x) => x.title)).toEqual(['Kritisch', 'Hoch', 'Mittel']);
    const body = (client as unknown as { functions: { invoke: { mock: { calls: unknown[][] } } } }).functions.invoke.mock.calls[0][1] as { body: Record<string, unknown> };
    expect(body.body.source).toBe('optimizer');
    expect(body.body).not.toHaveProperty('email');
  });
});
