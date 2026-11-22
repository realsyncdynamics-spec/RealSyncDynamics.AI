import { describe, expect, it } from 'vitest';
import {
  sweepBrowserExecutions,
  type FinishStatus,
  type StaleExecution,
  type SweepEvent,
  type SweepRepo,
} from '../../supabase/functions/browser-execution-sweep/logic';

const NOW = Date.parse('2026-11-22T12:00:00Z');
const minutesAgo = (m: number) => new Date(NOW - m * 60_000).toISOString();

interface Exec extends StaleExecution { status: string }

/** Nachbildung von browser_executions, governance_events und finish_browser_execution. */
function fakeRepo(execs: Exec[], events: Array<{ tenant_id: string; event_type: string; id: string }> = [], fail: { hasEvent?: string; insert?: boolean; list?: boolean } = {}) {
  const inserted: SweepEvent[] = [];
  const finishes: Array<{ id: string; status: FinishStatus; detail: string }> = [];
  const repo: SweepRepo = {
    async listStale(cutoff, limit) {
      if (fail.list) throw new Error('db down');
      return execs.filter((e) => e.status === 'reserved' && e.reserved_at < cutoff)
        .sort((a, b) => a.reserved_at.localeCompare(b.reserved_at)).slice(0, limit)
        .map(({ status: _s, ...rest }) => rest);
    },
    async hasEvent(tenantId, executionId, eventType) {
      if (fail.hasEvent === eventType) throw new Error('lookup failed');
      return [...events, ...inserted.map((e) => ({ tenant_id: e.tenant_id, event_type: e.event_type, id: e.payload.browser_execution_id as string }))]
        .some((e) => e.tenant_id === tenantId && e.event_type === eventType && e.id === executionId);
    },
    async finish(id, status, detail) {
      const e = execs.find((x) => x.id === id);
      if (!e || e.status !== 'reserved') return false;
      e.status = status;
      e.detail = detail;
      finishes.push({ id, status, detail });
      return true;
    },
    async insertEvent(ev) {
      if (fail.insert) throw new Error('insert failed');
      inserted.push(ev);
    },
  };
  return { repo, inserted, finishes, execs };
}

const exec = (id: string, ageMin: number, detail: string | null = null, tenant = 't1'): Exec =>
  ({ id, tenant_id: tenant, approval_id: `a-${id}`, detail, reserved_at: minutesAgo(ageMin), status: 'reserved' });

describe('sweepBrowserExecutions', () => {
  it('S1: jüngere Reservierungen (< 15 min) bleiben unberührt', async () => {
    const f = fakeRepo([exec('e1', 5)]);
    const s = await sweepBrowserExecutions(f.repo, NOW);
    expect(s.checked).toBe(0);
    expect(f.inserted).toEqual([]);
    expect(f.execs[0].status).toBe('reserved');
  });

  it('S2: ohne Ergebnis, < 24 h → einmal markieren, Status bleibt reserved', async () => {
    const f = fakeRepo([exec('e1', 60)]);
    const s1 = await sweepBrowserExecutions(f.repo, NOW);
    expect(s1).toMatchObject({ checked: 1, flagged: 1, finalized_failed: 0 });
    expect(f.execs[0].status).toBe('reserved');
    expect(f.inserted[0]).toMatchObject({ event_type: 'browser.execution.stale', tenant_id: 't1', payload: { browser_execution_id: 'e1', approval_id: 'a-e1', age_minutes: 60 } });

    const s2 = await sweepBrowserExecutions(f.repo, NOW);
    expect(s2).toMatchObject({ flagged: 0, already_flagged: 1 });
    expect(f.inserted).toHaveLength(1);
  });

  it('S3: verspäteter Report nach der Markierung schließt normal ab', async () => {
    const f = fakeRepo([exec('e1', 60)]);
    await sweepBrowserExecutions(f.repo, NOW);
    expect(await f.repo.finish('e1', 'executor_failed', 'desktop:TIMEOUT')).toBe(true);
    const s = await sweepBrowserExecutions(f.repo, NOW);
    expect(s.checked).toBe(0);
  });

  it('S4: älter als 24 h ohne Ereignis → executor_failed (sweep:no_report)', async () => {
    const f = fakeRepo([exec('e1', 25 * 60)]);
    const s = await sweepBrowserExecutions(f.repo, NOW);
    expect(s.finalized_failed).toBe(1);
    expect(f.finishes).toEqual([{ id: 'e1', status: 'executor_failed', detail: 'sweep:no_report' }]);
    expect(f.inserted[0]).toMatchObject({ event_type: 'browser.execution.swept', payload: { to_status: 'executor_failed', detail: 'sweep:no_report' } });
  });

  it('S5: beanspruchter, nie abgeschlossener Report → sweep:claimed_unfinished', async () => {
    const f = fakeRepo([exec('e1', 25 * 60, 'report:claimed')]);
    await sweepBrowserExecutions(f.repo, NOW);
    expect(f.finishes[0]).toMatchObject({ status: 'executor_failed', detail: 'sweep:claimed_unfinished' });
    expect(f.inserted[0].payload.previous_detail).toBe('report:claimed');
  });

  it('S6: Ereignis browser.action.executed vorhanden → sofort executed_unrecorded', async () => {
    const f = fakeRepo([exec('e1', 20, 'report:claimed')], [{ tenant_id: 't1', event_type: 'browser.action.executed', id: 'e1' }]);
    const s = await sweepBrowserExecutions(f.repo, NOW);
    expect(s.finalized_unrecorded).toBe(1);
    expect(f.finishes[0]).toEqual({ id: 'e1', status: 'executed_unrecorded', detail: 'sweep:event_found' });
  });

  it('S7: Ereignis eines anderen Mandanten zählt nicht', async () => {
    const f = fakeRepo([exec('e1', 25 * 60)], [{ tenant_id: 't2', event_type: 'browser.action.executed', id: 'e1' }]);
    await sweepBrowserExecutions(f.repo, NOW);
    expect(f.finishes[0].status).toBe('executor_failed');
    expect(f.inserted[0].tenant_id).toBe('t1');
  });

  it('S8: Ereignissuche scheitert → nichts abschließen (fail-closed)', async () => {
    const f = fakeRepo([exec('e1', 25 * 60)], [], { hasEvent: 'browser.action.executed' });
    const s = await sweepBrowserExecutions(f.repo, NOW);
    expect(s).toMatchObject({ errors: 1, finalized_failed: 0 });
    expect(f.execs[0].status).toBe('reserved');
  });

  it('S9: gleichzeitiger Abschluss gewinnt, Sweep schreibt kein Ereignis', async () => {
    const f = fakeRepo([exec('e1', 25 * 60)]);
    // Ein Desktop-Report schließt zwischen Lesen und Abschluss ab.
    f.repo.finish = async () => { f.execs[0].status = 'executed'; return false; };
    const s = await sweepBrowserExecutions(f.repo, NOW);
    expect(s).toMatchObject({ lost_race: 1, finalized_failed: 0 });
    expect(f.inserted).toEqual([]);
  });

  it('S10: abgeschlossene Zeilen werden nie angefasst', async () => {
    const done = { ...exec('e1', 48 * 60), status: 'executed' };
    const f = fakeRepo([done]);
    const s = await sweepBrowserExecutions(f.repo, NOW);
    expect(s.checked).toBe(0);
  });

  it('S11: Listenfehler wirft (Aufrufer antwortet 500, nichts geändert)', async () => {
    const f = fakeRepo([exec('e1', 60)], [], { list: true });
    await expect(sweepBrowserExecutions(f.repo, NOW)).rejects.toThrow('db down');
  });

  it('S12: Fehler bei einer Zeile stoppt die anderen nicht; Limit greift', async () => {
    const f = fakeRepo([exec('e1', 25 * 60), exec('e2', 26 * 60), exec('e3', 27 * 60)], [], { insert: true });
    const s = await sweepBrowserExecutions(f.repo, NOW, { limit: 2 });
    expect(s.checked).toBe(2);
    // Status ist verbindlich gesetzt, nur das Prüf-Ereignis fehlt (errors zählt es).
    expect(s).toMatchObject({ finalized_failed: 2, errors: 2 });
    expect(f.execs.find((e) => e.id === 'e1')!.status).toBe('reserved');
  });
});
