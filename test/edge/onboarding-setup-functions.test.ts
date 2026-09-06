/**
 * Die beiden Functions des Registrierungs-Onboardings, vor ihrem ersten Deploy.
 *
 * ## Warum es diesen Test gibt
 *
 * `save-company-profile` und `create-trial-subscription` lagen seit ihrer
 * Entstehung im Repo, ohne je deployt zu sein. Niemand hat sie je laufen
 * sehen — deshalb sind auch die Fehler nie aufgefallen. Vier davon waren
 * am 2026-08-19 am Live-Schema nachweisbar:
 *
 *  1. Beide suchten den Mandanten über `profiles.active_tenant_id`. Diese
 *     Spalte existiert im ganzen Schema nicht. Die einzige Zuordnung
 *     Nutzer→Mandant ist `memberships`.
 *  2. Beide übernahmen `tenantId` aus dem Body **ungeprüft** — mit
 *     Service-Role-Schlüssel, also an RLS vorbei. Ein angemeldeter Nutzer
 *     hätte in einen fremden Mandanten schreiben können.
 *  3. `save-company-profile` schrieb nach `public.company_profiles` — eine
 *     Tabelle, die es nicht gab — und meldete den fehlgeschlagenen Insert als
 *     `success: true`.
 *  4. `create-trial-subscription` machte einen Upsert auf `UNIQUE
 *     (tenant_id)`. Ein laufendes, bezahltes Abo wäre durch einen
 *     14-Tage-Test ersetzt worden.
 *
 * Geprüft wird am Quelltext, weil Deno-Functions in vitest nicht ausführbar
 * sind. Das ist schwächer als ein Aufruf — aber es hält genau die vier
 * Eigenschaften fest, deren Fehlen niemandem auffiel.
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = (p: string) => resolve(__dirname, '../..', p);

const FUNCTIONS = {
  'save-company-profile': readFileSync(root('supabase/functions/save-company-profile/index.ts'), 'utf8'),
  'create-trial-subscription': readFileSync(root('supabase/functions/create-trial-subscription/index.ts'), 'utf8'),
  // Vierte Ebene des Branchen-Vertrags. Lag bis 2026-08-29 live in Produktion,
  // ohne im Repo zu sein — der Drift-Guard hat sie als ORPHAN gemeldet. Sie
  // validiert `sector` eigenstaendig und schreibt in dieselben Tabellen.
  'onboarding-orchestrator': readFileSync(root('supabase/functions/onboarding-orchestrator/index.ts'), 'utf8'),
} as const;

const MIGRATION = readFileSync(root('supabase/migrations/20260824000000_company_profiles.sql'), 'utf8');

// Den Wertebereich definiert nicht mehr die Ursprungsmigration, sondern die
// Erweiterung um die Unternehmenstypen der Onboarding-Erklaerung. Die Prüfung
// muss gegen den zuletzt gesetzten Constraint laufen, sonst vergleicht sie
// gegen einen Stand, den die Datenbank gar nicht mehr führt.
const SECTOR_MIGRATION = readFileSync(
  root('supabase/migrations/20260902000010_company_profiles_sector_extend.sql'),
  'utf8',
);

// Die Auswahl steht seit der Vereinheitlichung zentral in der Config, nicht
// mehr im JSX der Seite — beide Onboarding-Oberflächen lesen von dort.
const SECTOR_CONFIG = readFileSync(root('src/config/sectors.ts'), 'utf8');

/** Ohne Kommentare — dort steht die Begründung, nicht der Verstoß. */
/** Kanonische Branchen-IDs — Quelle fuer den industryOf-Test unten. */
const TENANT_INDUSTRY_IDS = new Set(
  [
    ...readFileSync(root('src/lib/policy-packs/recommend.ts'), 'utf8')
      .slice(
        readFileSync(root('src/lib/policy-packs/recommend.ts'), 'utf8').indexOf(
          'TENANT_INDUSTRY_OPTIONS',
        ),
      )
      .matchAll(/\{ id: '([a-z-]+)'/g),
  ].map((m) => m[1]),
);

const stripComments = (s: string) =>
  s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

describe('Mandantenauflösung', () => {
  for (const [name, source] of Object.entries(FUNCTIONS)) {
    const code = stripComments(source);

    it(`${name}: sucht den Mandanten nicht über die nicht existierende Spalte`, () => {
      expect(
        code,
        'profiles.active_tenant_id gibt es im Schema nicht — die Auflösung läuft über memberships.'
      ).not.toContain('active_tenant_id');
    });

    it(`${name}: löst über memberships auf`, () => {
      expect(code).toContain("from('memberships')");
    });

    it(`${name}: prüft eine mitgeschickte tenantId gegen die Mitgliedschaft`, () => {
      // Der Kern des Befunds: `body.tenantId` darf nicht ohne Prüfung in eine
      // Query mit Service-Role-Rechten wandern.
      const guarded = /if\s*\(tenantId\)\s*\{[\s\S]{0,400}?from\('memberships'\)[\s\S]{0,300}?FORBIDDEN/;
      expect(
        guarded.test(code),
        'Ohne diese Prüfung schreibt ein beliebiger angemeldeter Nutzer in einen fremden Mandanten.'
      ).toBe(true);
    });

    it(`${name}: rät bei mehreren Mandanten nicht`, () => {
      expect(code).toContain('TENANT_AMBIGUOUS');
    });
  }
});

describe('Prüfpfad', () => {
  // Nur die Functions, die tatsächlich nach `trial_audit_logs` schreiben.
  // Vorher lief die Schleife über FUNCTIONS insgesamt — das ging gut, solange
  // dort genau diese beiden standen. Mit onboarding-orchestrator (schreibt in
  // inventory_audit_events und enterprise_ai_audit_events, ganz ohne
  // ip_address) verlangte sie plötzlich etwas, das es dort nicht geben muss.
  const WRITES_TRIAL_AUDIT_LOG = ['save-company-profile', 'create-trial-subscription'] as const;

  for (const name of WRITES_TRIAL_AUDIT_LOG) {
    const code = stripComments(FUNCTIONS[name]);

    it(`${name}: schreibt keine ungültige inet-Adresse`, () => {
      // `trial_audit_logs.ip_address` ist vom Typ inet. Der Text 'unknown'
      // lässt den Insert scheitern — und weil der Fehler abgefangen wird,
      // fehlt der Eintrag stillschweigend.
      expect(code).not.toContain("|| 'unknown'");
      expect(code).toContain('clientIp(req)');
    });
  }

  it('save-company-profile: protokolliert ein echtes Vorher', () => {
    const code = stripComments(FUNCTIONS['save-company-profile']);
    // `old_values` kam aus einer Zeile, die nur mit `.select('id')` geladen
    // war — das Vorher war immer undefined.
    expect(code).toMatch(/select\('id,\s*sector/);
    expect(code).toContain('old_values: { sector: existing.sector');
  });
});

describe('Kein Erfolg ohne Wirkung', () => {
  it('save-company-profile: meldet einen fehlgeschlagenen Insert als Fehler', () => {
    const code = stripComments(FUNCTIONS['save-company-profile']);
    expect(code).toContain('if (createError) throw createError;');
    expect(
      code,
      'Der frühere Stand antwortete success:true und verlor die Eingaben spurlos.'
    ).not.toContain('table not yet available');
  });

  it('create-trial-subscription: legt keinen Test über ein laufendes Abo', () => {
    const code = stripComments(FUNCTIONS['create-trial-subscription']);
    expect(code).toContain('LIVE_SUBSCRIPTION_STATES');
    expect(code).toContain('SUBSCRIPTION_EXISTS');
    // Zweimal Absenden ist kein Fehler, sondern derselbe Zustand.
    expect(code).toContain('alreadyExisted');
  });

  it('create-trial-subscription: bleibt bei Growth', () => {
    const code = stripComments(FUNCTIONS['create-trial-subscription']);
    expect(code).toContain("body.planKey !== 'growth'");
    expect(code).toContain('TRIAL_NOT_AVAILABLE');
  });
});

describe('Branchen-Wertebereich steht vierfach — und muss übereinstimmen', () => {
  const fromFunction = [
    ...stripComments(FUNCTIONS['save-company-profile'])
      .match(/VALID_SECTORS = new Set\(\[([^\]]+)\]\)/)![1]
      .matchAll(/'([a-z_]+)'/g),
  ].map((m) => m[1]);

  const fromMigration = [
    ...SECTOR_MIGRATION.slice(
      SECTOR_MIGRATION.indexOf('ADD CONSTRAINT company_profiles_sector_check'),
    ).match(/sector IN \(([^)]+)\)/)![1].matchAll(/'([a-z_]+)'/g),
  ].map((m) => m[1]);

  const fromPage = [
    ...SECTOR_CONFIG.matchAll(/^\s{4}id: '([a-z_]+)',$/gm),
  ].map((m) => m[1]);

  const fromOrchestrator = [
    ...stripComments(FUNCTIONS['onboarding-orchestrator'])
      .match(/const\s+sectors\s*=\s*new\s+Set\(\[([^\]]+)\]\)/)![1]
      .matchAll(/'([a-z_]+)'/g),
  ].map((m) => m[1]);

  it('liest überhaupt vier Listen', () => {
    // Ohne diese Zusicherung verglichen die folgenden Fälle leere Mengen.
    expect(fromFunction.length).toBeGreaterThan(3);
    expect(fromMigration.length).toBeGreaterThan(3);
    expect(fromPage.length).toBeGreaterThan(3);
    expect(fromOrchestrator.length).toBeGreaterThan(3);
  });

  it('onboarding-orchestrator führt denselben Wertebereich', () => {
    // Diese Ebene war lange unsichtbar: Die Function lag nicht im Repo, also
    // konnte kein Test sie kennen. Eine Branche, die sie ablehnt, waere im
    // Onboarding als INVALID_SECTOR gescheitert, obwohl Datenbank und
    // save-company-profile sie akzeptieren.
    expect([...fromOrchestrator].sort()).toEqual([...fromMigration].sort());
  });

  it('Function und CHECK-Constraint führen denselben Wertebereich', () => {
    expect([...fromFunction].sort()).toEqual([...fromMigration].sort());
  });

  it('Auswahl-Katalog bietet nichts an, was die Datenbank ablehnt', () => {
    const allowed = new Set(fromMigration);
    const rejected = fromPage.filter((s) => !allowed.has(s));
    expect(
      rejected,
      'Diese Auswahl im Onboarding würde am CHECK-Constraint scheitern.'
    ).toEqual([]);
  });
});

describe('onboarding-orchestrator: industryOf schreibt kanonische Branchen', () => {
  /**
   * `industryOf()` schreibt nach `tenants.industry`. Der Vergleich in
   * `recommendPacks` ist strikt (`pack.industry === industry`, W_INDUSTRY = 40
   * Punkte) — ein Wert ausserhalb von TENANT_INDUSTRY_OPTIONS laesst die
   * Branchen-Empfehlung also stillschweigend nie greifen.
   *
   * Genau das war der Fall: 'software' und 'professional-services' gab es dort
   * nicht, 'healthcare' heisst dort 'health'. Der Fehler war unsichtbar, weil
   * nichts fehlschlaegt — es passiert nur nichts. Deshalb dieser Test.
   */
  const targets = [
    ...stripComments(FUNCTIONS['onboarding-orchestrator'])
      .match(/function industryOf\(s:string\)\{return \(\{([^}]+)\}/)![1]
      .matchAll(/:\s*'([a-z-]+)'/g),
  ].map((m) => m[1]);

  it('liest ueberhaupt eine Abbildung', () => {
    expect(targets.length).toBeGreaterThan(3);
  });

  it('jeder Zielwert existiert in TENANT_INDUSTRY_OPTIONS', () => {
    const unknown = [...new Set(targets)].filter((t) => !TENANT_INDUSTRY_IDS.has(t));
    expect(
      unknown,
      'Diese Werte landen in tenants.industry, matchen aber keinen Pack — die Branchen-Empfehlung greift fuer sie nie.',
    ).toEqual([]);
  });
});

describe('onboarding_tenant_policy_packs: SQL liest dasselbe Branchen-Vokabular', () => {
  /**
   * `tenants.industry` hat zwei Leser: den TypeScript-Empfehlungspfad
   * (TENANT_INDUSTRY_OPTIONS) und diese SQL-Funktion. Sie sprachen
   * unterschiedliche Sprachen — die Funktion prüfte auf 'healthcare' und
   * 'public_sector', geschrieben wird 'health' und 'public-sector'.
   *
   * Folge war kein Fehler, sondern Stille: eu-ai-act-high-risk und
   * nis2-cybersecurity wurden nie aktiviert, obwohl beide im Katalog stehen.
   * Genau deshalb dieser Test — er prüft die Seite, die niemand ansieht.
   */
  const SQL = readFileSync(
    root('supabase/migrations/20260902000011_onboarding_policy_packs_industry_vocabulary.sql'),
    'utf8',
  );

  /** Nur der Funktionsrumpf — der Kommentarkopf nennt die alten Werte absichtlich. */
  const body = SQL.slice(SQL.indexOf('create or replace function'));

  const literals = [
    ...body.matchAll(/v_industry\s*(?:in\s*\(([^)]*)\)|=\s*('[a-z-]+'))/g),
  ]
    .flatMap((m) => [...(m[1] ?? m[2]).matchAll(/'([a-z-]+)'/g)].map((x) => x[1]))
    .filter((v) => v !== 'all');

  it('liest ueberhaupt Branchen-Literale', () => {
    expect(literals.length).toBeGreaterThan(3);
  });

  /**
   * `text[] || 'literal'` ist in Postgres nicht das, wonach es aussieht: Von
   * den Kandidaten `anyarray || anyelement` und `anyarray || anyarray` gewinnt
   * bei einem Literal ohne Typ die Array-Variante — Postgres versucht, den
   * String als Array-Literal zu lesen, und wirft "malformed array literal".
   *
   * Der Fehler ist latent: Er schlaegt erst zu, wenn der Zweig ueberhaupt
   * erreicht wird. Genau das aendert die Vokabular-Korrektur oben — sie macht
   * die Zweige zum ersten Mal erreichbar. Ohne den Cast wuerde aus stiller
   * Wirkungslosigkeit ein harter Abbruch des Onboardings.
   */
  it('haengt Packs mit explizitem ::text an, nicht als Array-Literal', () => {
    const ungecastet = [...body.matchAll(/v_packs\s*\|\|\s*'([a-z0-9-]+)'(?!::text)/g)].map(
      (m) => m[1],
    );
    expect(
      ungecastet,
      'Ohne ::text liest Postgres das Literal als Array — die Funktion bricht ab, sobald der Zweig greift.',
    ).toEqual([]);
  });

  it('jedes Literal existiert in TENANT_INDUSTRY_OPTIONS', () => {
    const unknown = [...new Set(literals)].filter((v) => !TENANT_INDUSTRY_IDS.has(v));
    expect(
      unknown,
      'Diese Werte prueft die SQL-Funktion, aber niemand schreibt sie — die Pack-Aktivierung greift fuer sie nie.',
    ).toEqual([]);
  });
});

describe('Migration', () => {
  it('trennt die Mandanten', () => {
    expect(MIGRATION).toContain('ENABLE ROW LEVEL SECURITY');
    expect(MIGRATION).toContain('FROM public.memberships WHERE user_id = auth.uid()');
  });

  it('lässt genau ein Profil je Mandant zu', () => {
    // Die Function macht „vorhanden? UPDATE, sonst INSERT" — bei mehreren
    // Zeilen je Mandant wäre das nicht deterministisch.
    expect(MIGRATION).toContain('UNIQUE (tenant_id)');
  });

  it('ist additiv', () => {
    expect(MIGRATION).toContain('CREATE TABLE IF NOT EXISTS');
    expect(MIGRATION).not.toMatch(/DROP TABLE|DROP COLUMN|TRUNCATE/);
  });
});
