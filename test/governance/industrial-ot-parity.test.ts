/**
 * Policy Pack "Industrial OT" — Parität zwischen Pack-JSON, TS-Prädikaten,
 * Migrations-SQL und Pricing-SSoT.
 *
 * Die Wertebereiche existieren mehrfach: im Pack-JSON (Fragebogen), in den
 * TS-Prädikaten (Evaluator), in den CHECK-Constraints der Migration und —
 * für das Kontingent — in shared/pricing.ts. Läuft eine Seite weg, bewertet
 * die Anwendung anders als die Datenbank speichert, und der Prüfpfad wird
 * unglaubwürdig. Diese Tests brauchen keine DB.
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  INDICATOR_PREDICATES,
  OUTCOME_SEVERITY,
  industrialOtPack,
} from '@/src/core/governance/industrial-ot';
import { ALL_PLANS_ORDERED, limitOf } from '../../shared/pricing';

const migrationSql = readFileSync(
  resolve(__dirname, '../../supabase/migrations/20260901000000_industrial_ot_classification.sql'),
  'utf8',
);

describe('Industrial OT / Parität — Pack-JSON ↔ Prädikate', () => {
  it('jeder Indikator im Pack hat genau ein Prädikat, und umgekehrt', () => {
    const packIds = industrialOtPack.indicators.map((i) => i.id).sort();
    const predicateIds = Object.keys(INDICATOR_PREDICATES).sort();
    expect(predicateIds).toEqual(packIds);
  });

  it('jedes Indikator-Outcome ist ein bekannter Ergebniszustand', () => {
    for (const ind of industrialOtPack.indicators) {
      expect(Object.keys(OUTCOME_SEVERITY)).toContain(ind.outcome);
    }
  });

  it('die severity-Werte im Pack decken sich mit OUTCOME_SEVERITY', () => {
    for (const outcome of industrialOtPack.outcomes) {
      expect(OUTCOME_SEVERITY[outcome.code as keyof typeof OUTCOME_SEVERITY]).toBe(outcome.severity);
    }
  });

  it('jede deadline_ref zeigt auf eine definierte Frist', () => {
    const deadlines = industrialOtPack.deadlines as Record<string, string>;
    for (const ind of industrialOtPack.indicators) {
      if (ind.deadline_ref) {
        expect(deadlines[ind.deadline_ref], `deadline_ref ${ind.deadline_ref} (${ind.id})`).toMatch(
          /^\d{4}-\d{2}-\d{2}$/,
        );
      }
    }
  });
});

describe('Industrial OT / Parität — Migrations-SQL', () => {
  it('ot_outcome-Enum führt exakt die vier Ergebniszustände', () => {
    for (const outcome of Object.keys(OUTCOME_SEVERITY)) {
      expect(migrationSql).toContain(`'${outcome}'`);
    }
  });

  it('CHECK-Constraints spiegeln die Antwort-Wertebereiche des Fragebogens', () => {
    // Wertebereiche aus dem Pack-JSON — die Quelle des Fragebogens.
    const enumInputs = industrialOtPack.inputs.filter((i) => 'values' in i && i.field !== 'sector');
    for (const input of enumInputs) {
      for (const value of (input as { values: string[] }).values) {
        expect(migrationSql, `${input.field}=${value}`).toContain(`'${value}'`);
      }
    }
  });

  it('das Kontingent-Gate liest den Katalog-Schlüssel industrialOtSystems', () => {
    expect(migrationSql).toContain("limits ->> 'industrialOtSystems'");
    // Kein Zugriff über Plan-Namen: nur der Free-Fallback für Mandanten ohne
    // aktives Abo ist zulässig.
    expect(migrationSql).not.toMatch(/WHEN\s+'(starter|growth|agency|enterprise)'/i);
  });
});

describe('Industrial OT / Parität — Pricing-SSoT', () => {
  it('jeder Plan definiert das Limit industrialOtSystems', () => {
    for (const plan of ALL_PLANS_ORDERED) {
      const limit = limitOf(plan, 'industrialOtSystems');
      expect(Number.isFinite(limit), plan.planKey).toBe(true);
      expect(limit === -1 || limit >= 1, `${plan.planKey}: ${limit}`).toBe(true);
    }
  });

  it('die Kontingent-Staffel ist monoton entlang der Abo-Leiter', () => {
    const ladder = ['free', 'starter', 'growth', 'agency', 'enterprise'] as const;
    const values = ladder.map((id) => {
      const plan = ALL_PLANS_ORDERED.find((p) => p.id === id);
      expect(plan, id).toBeDefined();
      const v = limitOf(plan!, 'industrialOtSystems');
      return v === -1 ? Number.POSITIVE_INFINITY : v;
    });
    for (let i = 1; i < values.length; i++) {
      expect(values[i]).toBeGreaterThanOrEqual(values[i - 1]);
    }
  });
});
