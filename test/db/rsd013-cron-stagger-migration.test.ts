/**
 * RSD-013: Staffelung der drei um 03:00 UTC kollidierenden Cron-Jobs.
 * Rein dateibasiert, kein Live-DB-Zugriff.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

const migration = resolve(
  __dirname,
  '../../supabase/migrations/20261114104600_rsd013_stagger_cron_jobs.sql',
);
const rollback = resolve(
  __dirname,
  '../../supabase/rollback/20261114104600_rsd013_stagger_cron_jobs.sql',
);
const sql = readFileSync(migration, 'utf8');
const rb = readFileSync(rollback, 'utf8');

const TARGETS: Record<string, { from: string; to: string }> = {
  'dsr-erasure-sweep': { from: '0 3 * * *', to: '1 3 * * *' },
  'memory-decay-hourly': { from: '0 * * * *', to: '2 * * * *' },
  'scan-scheduler-dispatch': { from: '*/15 * * * *', to: '4,19,34,49 * * * *' },
};

describe('RSD-013 Migration 20261114104600', () => {
  it('liegt zusammen mit einer Rollback-Datei vor', () => {
    expect(existsSync(migration)).toBe(true);
    expect(existsSync(rollback)).toBe(true);
  });

  it('setzt genau die drei Freigabe-Jobs auf die neuen Plaene', () => {
    for (const [name, plans] of Object.entries(TARGETS)) {
      expect(sql).toContain(name);
      expect(sql).toContain(plans.to);
    }
    expect(sql).toContain('cron.alter_job');
    expect(sql).toContain('IS NOT DISTINCT FROM new_schedule');
    expect(sql).toContain("to_regclass('cron.job')");
  });

  it('fasst Kommandos und Secrets nicht an, ausser als unveraenderter Fallback-Wert', () => {
    expect(sql).not.toMatch(/vault\./i);
    expect(sql).not.toMatch(/Bearer /);
    expect(sql).not.toMatch(/net\.http_post/);
    expect(sql).toContain('saved_command := rec.command');
    expect(sql).toContain('cron.schedule(rec.jobname, new_schedule, saved_command)');
  });

  it('die neuen Plaene kollidieren untereinander nicht zur Minute 0 von Stunde 3', () => {
    const minuteOf = (plan: string) => plan.split(/\s+/)[0];
    const atHour3 = Object.values(TARGETS).map((p) => {
      const [min, hour] = p.to.split(/\s+/);
      const hours = hour === '*' || hour.split(',').includes('3');
      return hours ? min : null;
    });
    const expanded = atHour3.flatMap((m) => (m ? m.split(',') : []));
    expect(new Set(expanded).size).toBe(expanded.length);
    expect(expanded).not.toContain('0');
    expect(expanded).not.toContain('5');
    expect(expanded).not.toContain('15');
    expect(expanded).not.toContain('17');
    expect(expanded).not.toContain('30');
  });
});

describe('RSD-013 Rollback', () => {
  it('stellt die Originalplaene wieder her', () => {
    for (const [name, plans] of Object.entries(TARGETS)) {
      expect(rb).toContain(name);
      expect(rb).toContain(plans.from);
    }
    expect(rb).toContain('cron.alter_job');
  });
});
