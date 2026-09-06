/**
 * Regel des Cron-Health-Guards: „letzter Lauf fehlgeschlagen".
 *
 * ## Warum diese Regel getestet gehört
 *
 * Der Guard läuft täglich gegen die Produktions-DB. Wäre seine Einteilung
 * falsch, fiele das erst im nächtlichen Lauf auf — und zwar in der stillen
 * Richtung: Ein Guard, der Ausfälle als grün einstuft, sieht aus wie ein
 * gesundes System. Genau dieser Fehlertyp hat `drift-alert.yml` einen Monat
 * lang wirkungslos gemacht.
 *
 * Die Abgrenzung ist nicht theoretisch. Bei der Messung vom 2026-09-06 trugen
 * `dsr-erasure-sweep` (52 Fehler) und `agent-os-runner-hourly` (2272 Fehler)
 * hunderte Fehlläufe aus der Zeit vor `20260820000000_cron_dispatch_fix.sql`
 * und liefen trotzdem sauber. Eine Regel über die Fehlerquote hätte beide als
 * kaputt gemeldet; eine Regel über den letzten Lauf meldet sie als repariert.
 */
import { describe, expect, it } from 'vitest';
import { causeKey, evaluate, groupByCause, SQL } from '../../scripts/check-cron-health.mjs';

interface Zeile {
  name: string;
  schedule: string;
  active: boolean;
  last_status: string | null;
  last_run: string | null;
  last_message: string;
  fehler: number;
  erfolge: number;
  letzter_erfolg: string | null;
}

const job = (p: Partial<Zeile> & { name: string }): Zeile => ({
  schedule: '0 * * * *',
  active: true,
  last_status: 'succeeded',
  last_run: '2026-09-06T11:00:00Z',
  last_message: '1 row',
  fehler: 0,
  erfolge: 10,
  letzter_erfolg: '2026-09-06T11:00:00Z',
  ...p,
});

const FEHLT_SECRET =
  'ERROR:  Cron-Dispatch "memory-decay-worker" abgebrochen: Vault-Secret "service_role_key" fehlt.';

describe('evaluate teilt nach dem letzten Lauf ein', () => {
  it('meldet einen Job, dessen letzter Lauf fehlschlug', () => {
    const { broken } = evaluate([
      job({ name: 'memory-decay-hourly', last_status: 'failed', fehler: 600, erfolge: 0, letzter_erfolg: null }),
    ]);
    expect(broken.map((r: Zeile) => r.name)).toEqual(['memory-decay-hourly']);
  });

  it('meldet einen reparierten Job NICHT, egal wie viele Altfehler er trägt', () => {
    // dsr-erasure-sweep, real: 52 Fehler aus der GUC-Zeit, letzter Lauf grün.
    const { broken, ok } = evaluate([
      job({ name: 'dsr-erasure-sweep', fehler: 52, erfolge: 25 }),
    ]);
    expect(broken).toEqual([]);
    expect(ok.map((r: Zeile) => r.name)).toEqual(['dsr-erasure-sweep']);
  });

  it('bewertet inaktive Jobs nicht', () => {
    const { broken, inaktiv } = evaluate([
      job({ name: 'abgeschaltet', active: false, last_status: 'failed' }),
    ]);
    expect(broken).toEqual([]);
    expect(inaktiv.map((r: Zeile) => r.name)).toEqual(['abgeschaltet']);
  });

  it('zählt einen frisch registrierten Job ohne Lauf nicht als Ausfall', () => {
    const { broken, nie } = evaluate([
      job({ name: 'frisch', last_status: null, last_run: null, erfolge: 0, letzter_erfolg: null }),
    ]);
    expect(broken).toEqual([]);
    expect(nie.map((r: Zeile) => r.name)).toEqual(['frisch']);
  });

  it('stellt „noch nie erfolgreich" vor „schon mal gelaufen"', () => {
    // scan-scheduler-dispatch hat in 2403 Läufen keinen einzigen Erfolg — das
    // ist ein anderer Befund als ein Job, der kürzlich noch lief.
    const { broken } = evaluate([
      job({ name: 'war-mal-gruen', last_status: 'failed', fehler: 3, erfolge: 40 }),
      job({ name: 'nie-gruen', last_status: 'failed', fehler: 2403, erfolge: 0, letzter_erfolg: null }),
    ]);
    expect(broken.map((r: Zeile) => r.name)).toEqual(['nie-gruen', 'war-mal-gruen']);
  });
});

/**
 * Diese Gruppe hat der erste echte Lauf des Guards erzwungen (2026-09-06,
 * Job 101483869051): Die vier Jobs scheitern an EINEM fehlenden Vault-Secret,
 * die Ausgabe zeigte aber drei Gruppen — weil `dispatch_cron_function` die
 * aufgerufene Function der Meldung voranstellt. Die Gruppierung behauptete
 * damit das Gegenteil dessen, wofür sie da ist. Roher Meldungstext gruppiert
 * nicht; die Normalisierung tut es.
 */
describe('groupByCause bündelt Ausfälle nach Ursache, nicht nach Wortlaut', () => {
  const meldung = (fn: string) =>
    `ERROR:  Cron-Dispatch "${fn}" abgebrochen: Vault-Secret "service_role_key" fehlt.\n` +
    'CONTEXT:  PL/pgSQL function dispatch_cron_function(text,text,jsonb) line 12 at RAISE';

  it('fasst die vier Jobs des fehlenden Secrets zu EINER Ursache zusammen', () => {
    const { broken } = evaluate([
      job({ name: 'scan-scheduler-dispatch', last_status: 'failed', last_message: meldung('scheduler-dispatch'), erfolge: 0 }),
      job({ name: 'governance-monitoring-hourly', last_status: 'failed', last_message: meldung('governance-monitoring-scheduler'), erfolge: 0 }),
      job({ name: 'governance-monitoring-daily', last_status: 'failed', last_message: meldung('governance-monitoring-scheduler'), erfolge: 0 }),
      job({ name: 'memory-decay-hourly', last_status: 'failed', last_message: meldung('memory-decay-worker'), erfolge: 0 }),
    ]);
    const gruppen = groupByCause(broken);
    expect(gruppen).toHaveLength(1);
    expect(gruppen[0][1]).toHaveLength(4);
  });

  it('hält zwei verschiedene fehlende Secrets auseinander', () => {
    // Das ist die Grenze der Normalisierung: Der Secret-Name bleibt stehen,
    // weil er die Ursache IST — zwei fehlende Secrets sind zwei Befunde.
    const { broken } = evaluate([
      job({ name: 'a', last_status: 'failed', last_message: FEHLT_SECRET, erfolge: 0 }),
      job({
        name: 'b',
        last_status: 'failed',
        erfolge: 0,
        last_message: 'ERROR:  Cron-Dispatch "x" abgebrochen: Vault-Secret "agent_os_runner_token" fehlt.',
      }),
    ]);
    expect(groupByCause(broken)).toHaveLength(2);
  });

  it('schneidet den plpgsql-Aufrufpfad ab', () => {
    expect(causeKey(meldung('memory-decay-worker'))).not.toContain('CONTEXT:');
    expect(causeKey(meldung('memory-decay-worker'))).toContain('service_role_key');
  });

  it('verträgt eine leere Meldung', () => {
    expect(causeKey('')).toBe('(ohne Meldung)');
    expect(causeKey(null as unknown as string)).toBe('(ohne Meldung)');
  });
});

describe('Die Abfrage misst Läufe, nicht Registrierung', () => {
  it('liest cron.job_run_details, nicht nur cron.job', () => {
    // CLAUDE.md §5: „Prüfen also nicht an `cron.job`, sondern an
    // `cron.job_run_details.status`." Ein Guard, der nur cron.job liest, hätte
    // alle vier Ausfälle als gesund gemeldet — sie stehen dort als active.
    expect(SQL).toContain('cron.job_run_details');
    expect(SQL).toContain("status = 'failed'");
  });
});
