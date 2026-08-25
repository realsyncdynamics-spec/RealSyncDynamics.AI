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
 * der Eigentümer entschieden, welche kanonisch ist — und zwar abhängig von
 * der **Planart**: für öffentlich verkaufte Pläne die Preisseite, für
 * Vertragspläne (`availability: 'contract'`) der **Vertrag**. Für Enterprise
 * ist die Quelle damit heute unaufgelöst, weil der Vertrag dem System nicht
 * vorliegt.
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
  /** Woraus der verbindliche Wert stammt — Folge der Planart, nicht des Felds. */
  kanonische_quelle: 'preisseite' | 'vertrag';
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

  it('weist Enterprise als unaufgelösten Vertragsfall aus', () => {
    // Acht Felder, in denen die Berechtigung `unbegrenzt` sagt und die
    // Preisseite eine Zahl. Unter der verfeinerten Regel ist hier **keine**
    // der beiden Spalten die Wahrheit — der Vertrag ist es, und der liegt
    // dem System nicht vor. Deshalb darf auf diesen acht Feldern kein Gate
    // entstehen, solange die Quelle nicht aufgelöst ist.
    const ent = grundlinie.filter((e) => e.plan === 'enterprise');
    expect(ent).toHaveLength(8);
    for (const e of ent) {
      expect(e.berechtigung).toBe(-1);
      expect(e.kanonische_quelle).toBe('vertrag');
    }
  });

  it('leitet die kanonische Quelle aus der Planart ab, nicht aus dem Feld', () => {
    // Die Regel vom 2026-08-25: Planart entscheidet. Stünde hier eine Zeile
    // mit 'vertrag' auf einem Self-Service-Plan (oder umgekehrt), wäre die
    // Grundlinie nach einem anderen Kriterium gepflegt worden als der Regel.
    const art = new Map<string, string>(ORDERED_PLANS.map((p) => [p.id, p.availability]));
    for (const zeile of grundlinie) {
      const erwartet = art.get(zeile.plan) === 'contract' ? 'vertrag' : 'preisseite';
      expect(zeile.kanonische_quelle, `${marke(zeile)}`).toBe(erwartet);
      expect(zeile.availability).toBe(art.get(zeile.plan));
    }
  });

  it('hält `products → entitlements` für Vertragspläne ausdrücklich nicht kanonisch', () => {
    /**
     * Die Sicherung gegen ein späteres Refactoring.
     *
     * Der Auflöser `tenant_entitlements()` kennt genau einen Weg:
     * `subscriptions`/`entitlement_grants` → `products` →
     * `product_entitlements` → `entitlements`. Für Self-Service-Pläne ist das
     * eine korrekte **Ableitung** der Preisseite. Für Vertragspläne ist es
     * das **nicht** — dort ist der Vertrag kanonisch, und der liegt dem
     * System nicht vor.
     *
     * Ein Produkt- oder Pricing-Refactoring, das die Entitlement-Werte
     * „aufräumt", würde die Zeilen unten stillschweigend zur Wahrheit
     * erklären. Genau das soll hier auffallen.
     *
     * Bis zur Entscheidung aus `enterprise-quelle-entscheidungsvorlage.md`
     * bleibt der Wert unbestimmt. Insbesondere ist `-1` **keine** belegte
     * Kodierung für „der Vertrag entscheidet" — das ist eine Hypothese und
     * darf hier nicht als Semantik festgeschrieben werden.
     */
    const vertragsplaene = ORDERED_PLANS.filter((p) => p.availability === 'contract');
    expect(vertragsplaene.map((p) => p.id)).toEqual(['enterprise']);

    for (const plan of vertragsplaene) {
      const zeilen = grundlinie.filter((e) => e.plan === plan.id);
      expect(zeilen.length, `${plan.id} ohne Divergenzzeilen`).toBeGreaterThan(0);
      for (const zeile of zeilen) {
        // Weder die eine noch die andere Spalte darf als kanonisch gelten.
        expect(zeile.kanonische_quelle).toBe('vertrag');
        expect(zeile.kanonische_quelle).not.toBe('preisseite');
      }
    }
  });

  it('hält fest, dass nur Vertragspläne eine unaufgelöste Quelle haben', () => {
    // Die Zahl ist die Arbeitsmenge für Schritt 1 aus §7: acht Felder, deren
    // Wert erst bestimmbar ist, wenn es einen Ort für Vertragswerte gibt.
    const unaufgeloest = grundlinie.filter((e) => e.kanonische_quelle === 'vertrag');
    expect(unaufgeloest).toHaveLength(8);
    expect(new Set(unaufgeloest.map((e) => e.plan))).toEqual(new Set(['enterprise']));
  });
});
