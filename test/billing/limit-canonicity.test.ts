import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

import { ORDERED_PLANS, PLAN_ENTITLEMENTS } from '../../shared/pricing';

/**
 * Kanonizität der Kontingente.
 *
 * ## Warum es diese Datei gibt
 *
 * Für dieselbe Zahl existieren zwei Fassungen: `plan.limits.*` steht auf der
 * Preisseite, `PLAN_ENTITLEMENTS['limit.*']` autorisiert. Am 2026-08-25 hat
 * der Eigentümer entschieden, dass die **Preisseite** kanonisch ist.
 *
 * Die Bereinigung der 21 bestehenden Abweichungen ist eine eigene
 * Entscheidung mit Bestandskundenwirkung und bewusst noch nicht erfolgt
 * (`docs/product/kanonische-kontingente.md` §4). Bis dahin sichert dieser
 * Test das Einzige, was ohne Entscheidung passieren kann: dass keine
 * **neue** Abweichung entsteht und keine bestehende unbemerkt verschwindet.
 *
 * Der gleiche Vergleich läuft als `npm run check:limits`. Er steht hier
 * zusätzlich, weil `npm test` in jedem PR läuft und der Guard nicht.
 */

const PAARE: Record<string, string> = {
  bots: 'limit.bots',
  answersPerMonth: 'limit.bot_messages_monthly',
  domains: 'limit.domains',
  automationRunsPerMonth: 'limit.automation_runs_monthly',
  seats: 'limit.team_seats',
  apiCallsPerMonth: 'limit.api_calls_monthly',
  evidenceStorageGb: 'limit.evidence_storage_gb',
  auditReportsPerMonth: 'limit.compliance_exports_monthly',
  bulkJobsPerMonth: 'limit.bulk_jobs_monthly',
};

interface Grundlinienzeile {
  plan: string;
  feld: string;
  key: string;
  preisseite: number;
  berechtigung: number;
  richtung: 'kuerzung' | 'ausweitung';
  availability: string;
  grund: string;
}

const grundlinie: Grundlinienzeile[] = JSON.parse(
  readFileSync('scripts/limit-canonicity-baseline.json', 'utf8'),
);

/** Der gemessene Ist-Zustand, aus der Quelle heraus. */
function gemessen() {
  const raus: Array<{ plan: string; feld: string; preisseite: number; berechtigung: number }> = [];
  for (const plan of ORDERED_PLANS) {
    const ent = (PLAN_ENTITLEMENTS[plan.id] ?? {}) as Record<string, number | boolean>;
    for (const [feld, key] of Object.entries(PAARE)) {
      const rechts = ent[key];
      if (typeof rechts !== 'number') continue;
      const links = plan.limits[feld as keyof typeof plan.limits];
      if (links !== rechts) raus.push({ plan: plan.id, feld, preisseite: links, berechtigung: rechts });
    }
  }
  return raus;
}

const marke = (e: { plan: string; feld: string }) => `${e.plan}:${e.feld}`;

describe('Kontingente — plan.limits gegen PLAN_ENTITLEMENTS', () => {
  it('bringt keine neue Abweichung hervor', () => {
    const bekannt = new Set(grundlinie.map(marke));
    const neu = gemessen().filter((e) => !bekannt.has(marke(e)));
    // Kommt hier etwas an, ist entweder ein Planwert oder ein Entitlement
    // geändert worden, ohne die jeweils andere Seite mitzuziehen.
    expect(neu).toEqual([]);
  });

  it('verliert keine Abweichung aus der Grundlinie, ohne sie dort zu streichen', () => {
    const jetzt = new Set(gemessen().map(marke));
    const verschwunden = grundlinie.filter((e) => !jetzt.has(marke(e)));
    // Das wäre vermutlich gut — aber dann gehört die Grundlinie gepflegt,
    // sonst misst sie nicht mehr, was sie behauptet.
    expect(verschwunden).toEqual([]);
  });

  it('hält die Grundlinie deckungsgleich mit den gemessenen Werten', () => {
    const ist = new Map(gemessen().map((e) => [marke(e), e]));
    for (const zeile of grundlinie) {
      const e = ist.get(marke(zeile));
      expect(e, `${marke(zeile)} fehlt in der Messung`).toBeDefined();
      expect(e!.preisseite).toBe(zeile.preisseite);
      expect(e!.berechtigung).toBe(zeile.berechtigung);
    }
  });

  it('begründet jede Zeile der Grundlinie', () => {
    // Eine Ausnahme ohne Grund ist eine stillschweigende Freigabe.
    for (const zeile of grundlinie) {
      expect(zeile.grund.length, `${marke(zeile)} ohne Begründung`).toBeGreaterThan(20);
      expect(['kuerzung', 'ausweitung']).toContain(zeile.richtung);
    }
  });

  it('weist die drei Kürzungen auf verkauften Self-Service-Plänen aus', () => {
    // Klasse B aus `kanonische-kontingente.md` §4: Diese drei treffen aktive,
    // selbst gebuchte Kunden. Sie dürfen nicht aus der Grundlinie fallen,
    // ohne dass jemand die Bestandsfrage beantwortet hat.
    const betroffen = grundlinie
      .filter((e) => e.richtung === 'kuerzung' && ['starter', 'growth'].includes(e.plan))
      .map(marke)
      .sort();
    expect(betroffen).toEqual([
      'growth:auditReportsPerMonth',
      'starter:auditReportsPerMonth',
      'starter:seats',
    ]);
  });

  it('weist Enterprise als offenen Vertragsfall aus', () => {
    // Acht Felder, in denen die Berechtigung `unbegrenzt` sagt und die
    // Preisseite eine Zahl. Wörtlich angewandt macht die Entscheidung aus
    // einem unbegrenzten Vertrag einen mit 20 Bots. Das ist ungeklärt.
    const ent = grundlinie.filter((e) => e.plan === 'enterprise');
    expect(ent).toHaveLength(8);
    for (const e of ent) {
      expect(e.berechtigung).toBe(-1);
      expect(e.richtung).toBe('kuerzung');
    }
  });
});
