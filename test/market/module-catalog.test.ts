/**
 * Marketplace-Katalog: Modul → tatsächlicher Zustand.
 *
 * Der teuerste Fehler dieser Oberfläche wäre ein „aktiv", hinter dem nichts
 * steht — der Kunde hielte sich für versorgt und merkte es erst im Ernstfall.
 * Die Fälle unten prüfen deshalb vor allem, wann **nicht** aktiv angezeigt
 * wird.
 */
import { describe, expect, it } from 'vitest';
import {
  BOOKABLE_MODULES,
  PLAN_ORDER,
  planGrants,
  type BookableModule,
} from '@/shared/pricing';
import {
  buildCatalog,
  cheapestPlanFor,
  isModuleActive,
  planLabel,
} from '../../src/features/market/moduleCatalog';

function modul(id: string): BookableModule {
  const found = BOOKABLE_MODULES.find((m) => m.id === id);
  if (!found) throw new Error(`Modul ${id} fehlt im Katalog`);
  return found;
}

describe('isModuleActive', () => {
  it('ist aktiv, wenn jede Fähigkeit im Plan liegt', () => {
    const core = modul('governance_core');
    const plan = cheapestPlanFor(core);
    expect(plan).not.toBeNull();
    expect(isModuleActive(plan, core)).toBe(true);
  });

  it('ist nicht aktiv, wenn auch nur eine Fähigkeit fehlt', () => {
    const core = modul('governance_core');
    // Ein Plan, dem mindestens eine der Fähigkeiten fehlt, darf das Modul
    // nicht als aktiv ausweisen — teilweise ist nicht aktiv.
    const unvollstaendig = PLAN_ORDER.find(
      (p) => core.unlocks.some((c) => !planGrants(p, c)),
    );
    expect(unvollstaendig).toBeDefined();
    expect(isModuleActive(unvollstaendig, core)).toBe(false);
  });

  it('hält ein Modul ohne Fähigkeiten nie für aktiv', () => {
    // `ai_frontend` ist eine Dienstleistung, kein Berechtigungsschalter —
    // seine `unlocks` sind leer. Ohne Sonderbehandlung würde `every()` auf
    // der leeren Menge `true` liefern und das Modul bei **jedem** Kunden als
    // vorhanden anzeigen.
    const frontend = modul('ai_frontend');
    expect(frontend.unlocks).toEqual([]);
    for (const plan of PLAN_ORDER) {
      expect(isModuleActive(plan, frontend)).toBe(false);
    }
  });

  it('ist bei unbekanntem oder fehlendem Plan nicht aktiv', () => {
    const core = modul('governance_core');
    expect(isModuleActive(null, core)).toBe(false);
    expect(isModuleActive(undefined, core)).toBe(false);
    expect(isModuleActive('erfundener-plan', core)).toBe(false);
  });
});

describe('cheapestPlanFor', () => {
  it('nennt den günstigsten Plan, der das Modul vollständig abdeckt', () => {
    for (const module of BOOKABLE_MODULES) {
      const plan = cheapestPlanFor(module);
      if (plan === null) continue;

      expect(isModuleActive(plan, module)).toBe(true);
      // Kein früherer Plan in der Leiter darf es auch schon können.
      const index = PLAN_ORDER.indexOf(plan);
      for (const niedriger of PLAN_ORDER.slice(0, index)) {
        expect(isModuleActive(niedriger, module)).toBe(false);
      }
    }
  });

  it('liefert null für Module, die kein Plan abdeckt', () => {
    expect(cheapestPlanFor(modul('ai_frontend'))).toBeNull();
  });
});

describe('buildCatalog', () => {
  it('führt jedes buchbare Modul auf — keines fällt unter den Tisch', () => {
    const katalog = buildCatalog('free');
    expect(katalog).toHaveLength(BOOKABLE_MODULES.length);
    expect(katalog.map((e) => e.module.id).sort()).toEqual(BOOKABLE_MODULES.map((m) => m.id).sort());
  });

  it('weist ohne Plan nichts als aktiv aus', () => {
    for (const eintrag of buildCatalog(null)) {
      expect(eintrag.status).toBe('available');
    }
  });

  it('weist im Free-Plan höchstens das aus, was Free wirklich kann', () => {
    for (const eintrag of buildCatalog('free')) {
      if (eintrag.status !== 'active') continue;
      for (const capability of eintrag.module.unlocks) {
        expect(planGrants('free_audit', capability)).toBe(true);
      }
    }
  });

  it('kennt zu jedem Eintrag entweder einen Plan oder ausdrücklich keinen', () => {
    for (const eintrag of buildCatalog('growth')) {
      expect(
        eintrag.unlockedByPlan === null || PLAN_ORDER.includes(eintrag.unlockedByPlan),
      ).toBe(true);
    }
  });
});

describe('planLabel', () => {
  it('löst einen Plan in seinen Anzeigenamen auf', () => {
    expect(planLabel('growth')).toBeTruthy();
  });

  it('rät nicht, wenn kein Plan vorliegt', () => {
    expect(planLabel(null)).toBeNull();
  });
});
