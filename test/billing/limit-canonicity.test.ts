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
 * Vertragspläne (`availability: 'contract'`) der **Vertrag**.
 *
 * Am 2026-08-31 wurde nachgezogen, wie sich das ausdrücken lässt, ohne den
 * Vertrag in die Datenbank zu holen (Option A): Auf Vertragsplänen bedeutet
 * `-1` „das System begrenzt hier nicht, der Vertrag tut es". Die Quelle ist
 * damit **benannt**, nicht aufgelöst — der Vertrag liegt dem System weiterhin
 * nicht vor, und auf diesen Feldern entsteht weiterhin kein Gate.
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

  /**
   * Klasse B aus `kanonische-kontingente.md` §4 — am 2026-09-01 bereinigt.
   *
   * Bis dahin standen hier drei Kürzungen: `starter:seats` (3→1),
   * `starter:auditReportsPerMonth` (5→2) und `growth:auditReportsPerMonth`
   * (20→12). Der Test hielt sie fest, damit sie nicht aus der Grundlinie
   * fallen, bevor jemand die Bestandsfrage aus §1.3 beantwortet hat.
   *
   * Sie ist beantwortet und die Werte sind angeglichen
   * (`20260903050000_align_starter_growth_quota_entitlements.sql`). Gemessen
   * am Entscheidungstag: null Starter-Abos, ein Growth-Abo auf `past_due`,
   * sämtliche Nutzungstabellen leer, jeder Tenant mit genau einem Mitglied —
   * die Korrektur hat niemandem etwas genommen.
   *
   * Der Test kehrt sich deshalb um: Auf verkauften Self-Service-Plänen darf
   * **keine** Kürzung mehr in der Grundlinie stehen. Taucht dort wieder eine
   * auf, ist entweder ein Wert zurückgefallen oder ein neuer Datenfehler
   * entstanden — und dann gilt §1.3 erneut, diesmal womöglich mit echten
   * Bestandskunden.
   */
  it('führt keine Kürzung mehr auf verkauften Self-Service-Plänen', () => {
    const kuerzungen = grundlinie
      .filter((e) => e.richtung === 'kuerzung' && ['starter', 'growth'].includes(e.plan))
      .map(marke)
      .sort();
    expect(
      kuerzungen,
      'Eine Kürzung auf einem verkauften Plan bedeutet: die Berechtigung liegt ' +
        'über der Preisseite. Vor dem Angleichen ist die Bestandsfrage aus §1.3 ' +
        'zu beantworten — nicht nachträglich.',
    ).toEqual([]);
  });

  /**
   * Die Gegenprobe zur Bereinigung: Die drei Paare stimmen jetzt überein.
   * Ohne diesen Fall bliebe „keine Kürzung mehr" auch dann grün, wenn die
   * Felder aus dem Vergleich herausfielen statt angeglichen zu werden.
   */
  it('gleicht die drei bereinigten Paare wertgleich ab', () => {
    const erwartet: Array<[string, string, number]> = [
      ['starter', 'limit.team_seats', 1],
      ['starter', 'limit.compliance_exports_monthly', 2],
      ['growth', 'limit.compliance_exports_monthly', 12],
    ];
    for (const [planKey, key, wert] of erwartet) {
      expect(
        PLAN_ENTITLEMENTS[planKey]?.[key as keyof (typeof PLAN_ENTITLEMENTS)[string]],
        `${planKey}.${key} weicht von der Preisseite ab`,
      ).toBe(wert);
    }
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
     * Entschieden am 2026-08-31 (Option A der
     * `enterprise-quelle-entscheidungsvorlage.md`): `-1` ist auf
     * Vertragsplänen jetzt die **festgelegte** Kodierung für „das System
     * begrenzt hier nicht, der Vertrag tut es". Frühere Fassungen dieses
     * Kommentars nannten das ausdrücklich eine unbelegte Hypothese — das
     * war bis zur Entscheidung richtig und ist es seitdem nicht mehr.
     *
     * An der Aussage dieses Falls ändert die Entscheidung nichts: Der
     * Vertrag bleibt kanonisch, `products → entitlements` bleibt für
     * Vertragspläne eine blosse Ableitung, und auf diesen Feldern entsteht
     * weiterhin kein Gate. Option A hat die Quelle benannt, nicht in die
     * Datenbank geholt.
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

  /**
   * Option A, festgenagelt — Entscheidung vom 2026-08-31.
   *
   * Auf Vertragsplänen ist `-1` die Kodierung für „das System begrenzt hier
   * nicht, der Vertrag tut es". Diese Kodierung trägt genau so lange, wie
   * **kein** endlicher Wert danebensteht: Ein endlicher `limit.*`-Wert wäre
   * eine technisch durchgesetzte Obergrenze — und eine Obergrenze ist genau
   * der Fall, den Option A nicht abbilden kann.
   *
   * Fällt dieser Test, ist das kein Testfehler, sondern die Meldung, dass
   * der Auslöser für Option B (Tenant-Overrides) eingetreten ist. Der Wert
   * gehört dann nicht hierher, sondern an den Vertragswert-Ort, den Option B
   * schafft.
   *
   * Gemessen am 2026-08-31: Enterprise trägt 15 `limit.*`-Keys, alle `-1`.
   * Kein anderer Plan hat diese Eigenschaft — Starter, Growth, Agency,
   * Partner und Governance Launch führen überwiegend endliche Werte.
   */
  it('Vertragspläne tragen ausschliesslich `-1` als Kontingent', () => {
    const vertragsplaene = ORDERED_PLANS.filter((p) => p.availability === 'contract');
    expect(vertragsplaene.map((p) => p.id)).toEqual(['enterprise']);

    for (const plan of vertragsplaene) {
      const satz = PLAN_ENTITLEMENTS[plan.planKey] ?? {};
      const kontingente = Object.entries(satz).filter(([key]) => key.startsWith('limit.'));

      expect(
        kontingente.length,
        `${plan.planKey} führt keine Kontingent-Keys — dann prüft dieser Test nichts.`,
      ).toBeGreaterThan(0);

      const endlich = kontingente.filter(([, wert]) => wert !== -1);
      expect(
        endlich,
        `${plan.planKey}: endliche Kontingente auf einem Vertragsplan — ` +
          `${endlich.map(([k, v]) => `${k}=${v}`).join(', ')}. ` +
          `Unter Option A ist eine technisch durchgesetzte Obergrenze nicht vorgesehen; ` +
          `sie gehört in einen Vertragswert-Ort (Option B), nicht in PLAN_ENTITLEMENTS.`,
      ).toEqual([]);
    }
  });

  /**
   * Die Gegenprobe: Die Kodierung sagt nur auf VERTRAGSplänen „der Vertrag
   * entscheidet". Auf Self-Service-Plänen heisst `-1` weiterhin schlicht
   * „unbegrenzt" — dort gibt es keinen Vertrag, der etwas anderes regeln
   * könnte. Ohne diese Abgrenzung liesse sich jedes `-1` irgendwo im
   * Katalog nachträglich zu einer Vertragszusage umdeuten.
   */
  it('deutet `-1` nur auf Vertragsplänen als Vertragsvorbehalt', () => {
    const selfService = ORDERED_PLANS.filter((p) => p.availability !== 'contract');
    const mitUnbegrenzt = selfService.filter((p) =>
      Object.entries(PLAN_ENTITLEMENTS[p.planKey] ?? {})
        .some(([key, wert]) => key.startsWith('limit.') && wert === -1),
    );

    // Heute trifft das Agency (`limit.evidence_storage_gb`). Der Fall ist
    // erlaubt und bedeutet dort „unbegrenzt", nicht „vertraglich geregelt".
    for (const plan of mitUnbegrenzt) {
      expect(plan.availability).not.toBe('contract');
      const zeilen = grundlinie.filter((e) => e.plan === plan.id);
      for (const zeile of zeilen) {
        expect(
          zeile.kanonische_quelle,
          `${plan.id} ist kein Vertragsplan — seine Quelle bleibt die Preisseite.`,
        ).toBe('preisseite');
      }
    }
  });
});
