// Aufräumen hängender Browser-Ausführungen (Folge zu PR C, offener Punkt 5).
//
// Ausgangslage (Migration 20260930190000, browser-execute):
//   'reserved' wird nie automatisch freigegeben. Bricht die Function zwischen
//   Reservierung und Abschluss ab (Playwright-Pfad) oder meldet der Desktop
//   nach `reserve` nie (`report` fehlt) bzw. stirbt nach dem Anspruch
//   (detail = 'report:claimed'), bleibt die Zeile für immer 'reserved'.
//   Die Freigabe ist damit verbraucht (gut, fail-closed), aber der Prüfpfad
//   sagt nicht, was passiert ist.
//
// Dieser Job ändert daran nichts an der Sicherheit:
//   - Keine Freigabe wird wieder nutzbar. UNIQUE(approval_id) bleibt; ein
//     neuer Versuch braucht weiter eine neue Freigabe.
//   - Statuswechsel nur über finish_browser_execution (nur aus 'reserved').
//     Ein später, gleichzeitiger Report gewinnt oder verliert atomar.
//
// Ablauf je Zeile mit status = 'reserved' und reserved_at älter als STALE:
//   1. Gibt es ein Ereignis 'browser.action.executed' mit dieser
//      browser_execution_id? Dann lief die Aktion, nur der Abschluss fehlt:
//      → executed_unrecorded ('sweep:event_found'). Sofort, unabhängig vom Alter.
//   2. Sonst, jünger als FINALIZE: nur einmal markieren
//      ('browser.execution.stale'), Status bleibt 'reserved'. Ein verspäteter
//      Desktop-Report kann so noch normal abschließen.
//   3. Sonst, älter als FINALIZE: → executor_failed
//      ('sweep:no_report' bzw. 'sweep:claimed_unfinished'). Ausgang unklar,
//      Zielsystem prüfen (Runbook in der Migration).
//   Jeder Abschluss schreibt 'browser.execution.swept' zur Prüfung.
//
// Fail-closed: Scheitert die Ereignissuche, wird die Zeile übersprungen und
// NICHT als executor_failed abgeschlossen. „Kein Ereignis“ wird nur
// behauptet, wenn die Suche erfolgreich leer war.
//
// Keine Deno-Imports: vitest-importierbar. Datenzugriff über SweepRepo.

export const STALE_MINUTES = 15;
export const FINALIZE_HOURS = 24;
export const BATCH_LIMIT = 200;

export interface StaleExecution {
  id: string;
  tenant_id: string;
  approval_id: string;
  detail: string | null;
  reserved_at: string;
}

export type FinishStatus = 'executed_unrecorded' | 'executor_failed';

export interface SweepEvent {
  tenant_id: string;
  event_type: 'browser.execution.stale' | 'browser.execution.swept';
  event_source: 'agent_runtime';
  title: string;
  summary: string;
  risk_level: 'medium';
  policy_action: 'require_approval';
  payload: Record<string, unknown>;
}

export interface SweepRepo {
  /** status = 'reserved' AND reserved_at < cutoff, älteste zuerst. Wirft bei Fehler. */
  listStale(cutoffIso: string, limit: number): Promise<StaleExecution[]>;
  /** Wirft bei Fehler (dann keine Aussage „kein Ereignis“). */
  hasEvent(tenantId: string, executionId: string, eventType: string): Promise<boolean>;
  /** finish_browser_execution: true nur, wenn die Zeile noch 'reserved' war. */
  finish(executionId: string, status: FinishStatus, detail: string): Promise<boolean>;
  insertEvent(event: SweepEvent): Promise<void>;
}

export interface SweepSummary {
  checked: number;
  flagged: number;
  already_flagged: number;
  finalized_unrecorded: number;
  finalized_failed: number;
  lost_race: number;
  errors: number;
  cutoff: string;
  finalize_before: string;
}

export interface SweepOptions {
  staleMinutes?: number;
  finalizeHours?: number;
  limit?: number;
}

function event(row: StaleExecution, type: SweepEvent['event_type'], title: string, summary: string, extra: Record<string, unknown>): SweepEvent {
  return {
    tenant_id: row.tenant_id,
    event_type: type,
    event_source: 'agent_runtime',
    title,
    summary,
    risk_level: 'medium',
    policy_action: 'require_approval',
    payload: {
      browser_execution_id: row.id,
      approval_id: row.approval_id,
      reserved_at: row.reserved_at,
      previous_detail: row.detail,
      ...extra,
    },
  };
}

export async function sweepBrowserExecutions(repo: SweepRepo, nowMs: number, opts: SweepOptions = {}): Promise<SweepSummary> {
  const staleMinutes = opts.staleMinutes ?? STALE_MINUTES;
  const finalizeHours = opts.finalizeHours ?? FINALIZE_HOURS;
  const limit = opts.limit ?? BATCH_LIMIT;
  const cutoff = new Date(nowMs - staleMinutes * 60_000).toISOString();
  const finalizeBefore = new Date(nowMs - finalizeHours * 3_600_000).toISOString();

  const summary: SweepSummary = {
    checked: 0, flagged: 0, already_flagged: 0, finalized_unrecorded: 0,
    finalized_failed: 0, lost_race: 0, errors: 0, cutoff, finalize_before: finalizeBefore,
  };

  const rows = await repo.listStale(cutoff, limit);
  for (const row of rows) {
    summary.checked += 1;
    const ageMinutes = Math.round((nowMs - Date.parse(row.reserved_at)) / 60_000);
    try {
      const executed = await repo.hasEvent(row.tenant_id, row.id, 'browser.action.executed');

      if (executed) {
        const ok = await repo.finish(row.id, 'executed_unrecorded', 'sweep:event_found');
        if (!ok) { summary.lost_race += 1; continue; }
        summary.finalized_unrecorded += 1;
        await repo.insertEvent(event(row, 'browser.execution.swept',
          'Browser execution closed by sweep (action ran, completion missing)',
          'An executed-event exists, but the execution was never finalized. Check the evidence trail.',
          { to_status: 'executed_unrecorded', age_minutes: ageMinutes }));
        continue;
      }

      if (row.reserved_at >= finalizeBefore) {
        if (await repo.hasEvent(row.tenant_id, row.id, 'browser.execution.stale')) {
          summary.already_flagged += 1;
          continue;
        }
        await repo.insertEvent(event(row, 'browser.execution.stale',
          'Browser execution without result',
          `Reserved ${ageMinutes} min ago without a report. Still open; a late report can complete it.`,
          { age_minutes: ageMinutes }));
        summary.flagged += 1;
        continue;
      }

      const detail = row.detail === 'report:claimed' ? 'sweep:claimed_unfinished' : 'sweep:no_report';
      const ok = await repo.finish(row.id, 'executor_failed', detail);
      if (!ok) { summary.lost_race += 1; continue; }
      summary.finalized_failed += 1;
      await repo.insertEvent(event(row, 'browser.execution.swept',
        'Browser execution closed by sweep (outcome unknown)',
        `No result after ${ageMinutes} min. Whether the action ran is unknown; check the target system.`,
        { to_status: 'executor_failed', detail, age_minutes: ageMinutes }));
    } catch {
      // Ereignissuche oder Schreiben gescheitert: Zeile bleibt unverändert
      // bzw. ist bereits verbindlich abgeschlossen; nächster Lauf versucht es erneut.
      summary.errors += 1;
    }
  }
  return summary;
}
