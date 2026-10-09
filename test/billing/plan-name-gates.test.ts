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
import { gatesIn } from '../../scripts/check-plan-name-gates.mjs';

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

  it('führt kein echtes Gate mehr — alle vier sind aufgelöst', () => {
    // Bis 2026-09-28 standen hier drei GATE-Einträge fest: Scan-Kontingent,
    // Monitoring-Takt, Aufbewahrungsdauer. Ein vierter (Browser-Scan per
    // `.includes(tier)`) lag im blinden Fleck des Prüfers. Aufgelöst:
    //   - useScanLimits liest nur noch `website.scan_monthly_limit`
    //   - audit-monitor-cron liest `monitoring.daily` / `.monthly` /
    //     `.browser_scan` aus dem Abo
    //   - AuditAgent war kein Gate, sondern eine Attrappe; entfernt
    // Ein neues GATE gehört nicht in die Grundlinie, sondern nach
    // hasPermission(), hasModule() oder limitOf().
    expect(baseline.filter((b) => b.art === 'GATE')).toEqual([]);
  });

  it('führt keine Fundstelle doppelt', () => {
    const keys = baseline.map((b) => `${b.datei}::${b.plan}`);
    expect(new Set(keys).size).toBe(keys.length);
  });
});

describe('gatesIn — was der Prüfer als Gate erkennt', () => {
  // Am Muster selbst geprüft, nicht am Bestand: Im Repo steht gerade keine
  // mehrzeilige Liste, also bliebe eine Rückkehr zur zeilenweisen Prüfung in
  // jedem Lauf gegen den Bestand unsichtbar.
  const plaene = (src: string) => gatesIn(src).map((g) => `${g.zeile}:${g.plan}`);

  it('erkennt eine Namensliste mit .includes(tier) in einer Zeile', () => {
    expect(plaene("const s = ['agency','enterprise'].includes(d.tier);")).toEqual(['1:agency', '1:enterprise']);
  });

  it('erkennt dieselbe Liste über mehrere Zeilen umbrochen', () => {
    const src = "const ok =\n  [\n    'agency',\n    'enterprise',\n  ].includes(d.tier);";
    expect(plaene(src)).toEqual(['2:agency', '2:enterprise']);
  });

  it('übergeht Kommentarzeilen, die die Regel nur zitieren', () => {
    expect(plaene("// ['agency'].includes(tier)\n * if (plan === 'free')")).toEqual([]);
  });

  it('meldet keine Liste, die gegen etwas anderes als einen Plan prüft', () => {
    expect(plaene("['agency'].includes(source)")).toEqual([]);
  });
});

describe('Der Prüfer selbst', () => {
  it('findet genau, was die Grundlinie führt — in beide Richtungen', () => {
    // Zwei Fehler, die derselbe Test fängt:
    //
    // 1. Der blinde Fleck kehrt zurück. Die Eingabelisten von /upgrade und
    //    /pay im Terminal sind nur über das `.includes(tier)`-Muster sichtbar
    //    (8 Fundstellen). Bricht das Muster weg, erscheinen sie hier als
    //    „verschwunden" — und die Zählung stimmt nicht mehr.
    // 2. Die Grundlinie lügt. Wer eine Fundstelle behebt, ohne `--update` zu
    //    laufen, lässt einen Eintrag stehen, der nichts mehr zählt. Genau das
    //    stand am 2026-09-28 in der Schwester-Grundlinie der erfundenen Werte:
    //    „Behoben in PR #1375" — der PR war nie gemergt.
    const out = execFileSync('node', ['scripts/check-plan-name-gates.mjs', '--json'], {
      cwd: ROOT, encoding: 'utf8',
    });
    const result = JSON.parse(out) as {
      summary: { gefunden: number };
      verschwunden: { datei: string; plan: string }[];
    };
    expect(result.verschwunden.map((v) => `${v.datei}::${v.plan}`)).toEqual([]);
    const gefuehrt = baseline.reduce((n, b) => n + b.fundstellen, 0);
    expect(result.summary.gefunden).toBe(gefuehrt);
  });

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
