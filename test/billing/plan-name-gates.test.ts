// Die Ratsche gegen Plan-Namen-Gates — Zielarchitektur §10.
//
// Geprüft wird nicht, ob das Skript läuft, sondern ob die **Grundlinie eine
// Aussage trägt**. Eine Ratsche mit lauter `UNGEPRUEFT`-Einträgen sperrt zwar
// Neuzugänge, sagt aber niemandem, was der Bestand bedeutet — und wird beim
// nächsten Umbau blind mit `--update` überschrieben.

import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT = resolve(__dirname, '../..');
const BASELINE = resolve(ROOT, 'scripts/plan-name-gate-baseline.json');

interface BaselineEntry {
  datei: string;
  plan: string;
  fundstellen: number;
  art: string;
  grund: string;
  seit: string;
}

const baseline: BaselineEntry[] = JSON.parse(readFileSync(BASELINE, 'utf8'));

/**
 * Die Einordnungen, die eine Fundstelle haben darf.
 *
 * `GATE` ist die einzige, die §10 tatsächlich verletzt — der Rest hängt zwar
 * ebenfalls am Namen, entscheidet aber nicht über den Funktionsumfang. Die
 * Unterscheidung ist der Kern: Sie sagt, was beim Katalogumbau **kaputtgeht**
 * (alle) und was dabei **Kunden trifft** (nur GATE).
 */
const ERLAUBTE_ARTEN = ['GATE', 'KAUFWEG', 'EMPFEHLUNG', 'ABLAUF', 'ANZEIGE', 'KAMPAGNE'];

describe('Grundlinie der Plan-Namen-Gates', () => {
  it('ordnet jede Fundstelle ein — kein UNGEPRUEFT', () => {
    const offen = baseline.filter((b) => !ERLAUBTE_ARTEN.includes(b.art));
    expect(offen.map((b) => `${b.datei} (${b.art})`)).toEqual([]);
  });

  it('begründet jede Fundstelle, statt sie nur zu dulden', () => {
    for (const b of baseline) {
      expect(b.grund.length, `${b.datei} ohne belastbare Begründung`).toBeGreaterThan(60);
      expect(b.seit).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    }
  });

  it('nennt die drei echten Gates namentlich', () => {
    // Diese drei entscheiden, was ein zahlender Kunde bekommt: Kontingent,
    // Monitoring-Takt, Aufbewahrungsdauer. Verschwindet einer aus der Liste,
    // ohne dass die Fundstelle behoben wurde, ist die Ratsche stumpf
    // geworden — deshalb stehen sie hier fest.
    const gates = baseline.filter((b) => b.art === 'GATE').map((b) => b.datei).sort();
    expect(gates).toEqual([
      'src/core/billing/useScanLimits.ts',
      'src/features/governance/terminal/agents/AuditAgent.ts',
      'supabase/functions/audit-monitor-cron/index.ts',
    ]);
  });

  it('führt keine Fundstelle doppelt', () => {
    const keys = baseline.map((b) => `${b.datei}::${b.plan}`);
    expect(new Set(keys).size).toBe(keys.length);
  });
});

describe('Der Prüfer selbst', () => {
  it('läuft gegen den aktuellen Stand grün', () => {
    // Wenn dieser Test bricht, ist eine NEUE Zugriffsprüfung auf einen
    // Plan-Namen dazugekommen. Sie gehört nach hasPermission(), hasModule()
    // oder limitOf() — nicht in die Grundlinie, es sei denn, sie ist
    // nachweislich kein Gate.
    const out = execFileSync('node', ['scripts/check-plan-name-gates.mjs', '--json'], {
      cwd: ROOT, encoding: 'utf8',
    });
    const result = JSON.parse(out) as { summary: { neu: number }; neu: unknown[] };
    expect(result.neu).toEqual([]);
    expect(result.summary.neu).toBe(0);
  });
});
