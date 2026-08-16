/**
 * B3 — Monitoring-Beziehung Asset ↔ Zeitplan (Schreibpfad).
 *
 * Mockt den Admin-Client; keine DB-Roundtrips. Die DB-Seite (Constraints,
 * RLS, Backfill) ist über den lokalen PG-16-Lauf der Migration abgedeckt.
 *
 * Warum das getestet wird: `asset_lifecycle_state` leitet „Monitoring aktiv"
 * ausschliesslich aus scan_schedule_assets ab. Bleibt die Tabelle leer, meldet
 * die Ableitung dauerhaft `false` — die Anzeige wäre dann falsch nach unten,
 * was harmlos aussieht, aber ein aktives Monitoring verschweigt.
 */
import { describe, it, expect } from 'vitest';
import {
  syncScheduleAssets,
  type ScheduleAssetsAdmin,
} from '../../supabase/functions/_shared/schedule-assets';

interface Call { table: string; verb: string; payload: unknown }

function mockAdmin(opts: {
  websites?: Array<{ domain: string; governance_asset_id: string | null }>;
  lookupError?: { message: string };
  deleteError?: { message: string };
  upsertError?: { message: string };
} = {}): { admin: ScheduleAssetsAdmin; calls: Call[] } {
  const calls: Call[] = [];
  const admin: ScheduleAssetsAdmin = {
    from(table: string) {
      return {
        select(cols: string) {
          const chain = {
            eq: (col: string, val: unknown) => {
              calls.push({ table, verb: 'select.eq', payload: { cols, col, val } });
              return chain;
            },
            in: (col: string, vals: unknown[]) => {
              calls.push({ table, verb: 'select.in', payload: { col, vals } });
              return Promise.resolve({
                data: opts.lookupError ? null : (opts.websites ?? []),
                error: opts.lookupError ?? null,
              });
            },
          };
          return chain;
        },
        delete() {
          const chain = {
            eq: (col: string, val: unknown) => {
              calls.push({ table, verb: 'delete.eq', payload: { col, val } });
              return Object.assign(
                Promise.resolve({ error: opts.deleteError ?? null }),
                { not: chain.not, error: opts.deleteError ?? null },
              );
            },
            not: (col: string, op: string, val: unknown) => {
              calls.push({ table, verb: 'delete.not', payload: { col, op, val } });
              return { error: opts.deleteError ?? null };
            },
          };
          return chain;
        },
        upsert(rows: unknown, options: unknown) {
          calls.push({ table, verb: 'upsert', payload: { rows, options } });
          return Promise.resolve({ error: opts.upsertError ?? null });
        },
      };
    },
  };
  return { admin, calls };
}

const T = '11111111-1111-1111-1111-111111111111';
const S = '22222222-2222-2222-2222-222222222222';

describe('syncScheduleAssets', () => {
  it('verknüpft aufgelöste Domains mit ihrem Asset', async () => {
    const { admin, calls } = mockAdmin({
      websites: [
        { domain: 'a.example', governance_asset_id: 'aaaa1111-1111-1111-1111-111111111111' },
        { domain: 'b.example', governance_asset_id: 'bbbb2222-2222-2222-2222-222222222222' },
      ],
    });
    const res = await syncScheduleAssets(admin, S, T, ['a.example', 'b.example']);

    expect(res.ok).toBe(true);
    expect(res.linked).toBe(2);
    expect(res.unresolved).toEqual([]);

    const upsert = calls.find((c) => c.verb === 'upsert');
    expect(upsert).toBeDefined();
    const rows = (upsert!.payload as { rows: Array<Record<string, string>> }).rows;
    expect(rows).toHaveLength(2);
    // tenant_id wird mitgeschrieben — die RLS-Policy prüft ihn ohne Join.
    expect(rows.every((r) => r.tenant_id === T && r.schedule_id === S)).toBe(true);
  });

  it('meldet Domains ohne Asset, statt einen Bezug zu erfinden', async () => {
    const { admin } = mockAdmin({
      websites: [{ domain: 'a.example', governance_asset_id: 'aaaa1111-1111-1111-1111-111111111111' }],
    });
    const res = await syncScheduleAssets(admin, S, T, ['a.example', 'ghost.example']);

    expect(res.ok).toBe(true);
    expect(res.linked).toBe(1);
    expect(res.unresolved).toEqual(['ghost.example']);
  });

  it('behandelt eine Website ohne Asset wie eine unaufgelöste Domain', async () => {
    const { admin } = mockAdmin({
      websites: [{ domain: 'a.example', governance_asset_id: null }],
    });
    const res = await syncScheduleAssets(admin, S, T, ['a.example']);

    expect(res.linked).toBe(0);
    expect(res.unresolved).toEqual(['a.example']);
  });

  it('räumt die Beziehung ab, wenn die Domain-Liste leer ist', async () => {
    const { admin, calls } = mockAdmin();
    const res = await syncScheduleAssets(admin, S, T, []);

    expect(res.ok).toBe(true);
    expect(res.linked).toBe(0);
    expect(calls.some((c) => c.table === 'scan_schedule_assets' && c.verb === 'delete.eq')).toBe(true);
    // Ohne Domains darf nichts nachgeschrieben werden.
    expect(calls.some((c) => c.verb === 'upsert')).toBe(false);
  });

  it('räumt vor dem Schreiben ab, damit entfernte Domains kein Monitoring behalten', async () => {
    const { admin, calls } = mockAdmin({
      websites: [{ domain: 'a.example', governance_asset_id: 'aaaa1111-1111-1111-1111-111111111111' }],
    });
    await syncScheduleAssets(admin, S, T, ['a.example']);

    const deleteAt = calls.findIndex((c) => c.verb.startsWith('delete'));
    const upsertAt = calls.findIndex((c) => c.verb === 'upsert');
    expect(deleteAt).toBeGreaterThanOrEqual(0);
    expect(upsertAt).toBeGreaterThan(deleteAt);
  });

  it('gibt Fehler durch, statt einen Erfolg zu behaupten', async () => {
    const { admin } = mockAdmin({ lookupError: { message: 'boom' } });
    const res = await syncScheduleAssets(admin, S, T, ['a.example']);

    expect(res.ok).toBe(false);
    expect(res.error).toBe('boom');
    expect(res.linked).toBe(0);
  });

  it('verlangt schedule_id und tenant_id', async () => {
    const { admin } = mockAdmin();
    expect((await syncScheduleAssets(admin, '', T, ['a.example'])).ok).toBe(false);
    expect((await syncScheduleAssets(admin, S, '', ['a.example'])).ok).toBe(false);
  });
});
