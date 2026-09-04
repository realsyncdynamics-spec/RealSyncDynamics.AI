/**
 * ADR 0011 — Invarianten der Agenten-Organisationsebene
 *
 * Die Entscheidungen D1–D5 sind Zusagen über Zugriff, nicht über Geschmack.
 * Sie stehen in `docs/adr/0011-agent-organisationsmodell-plattform-scope.md`
 * und sind in zehn Migrationen kodiert — aber eine Migration ist einmalig,
 * und die nächste kann sie stillschweigend aufweichen: eine INSERT-Policy
 * „nur für den Prototyp", ein `visibility`-Vergleich, der beim Kopieren
 * verlorengeht, eine Tabelle, deren RLS erst in einer Folgemigration kommt.
 *
 * Genau diese Klasse Fehler bricht nichts und fällt niemandem auf. Deshalb
 * prüfen diese Tests die SQL-Dateien selbst. Sie brauchen keine Datenbank und
 * laufen damit in jeder PR-CI, nicht nur im nächtlichen Guard.
 *
 * Was sie NICHT leisten: Sie prüfen den Text, nicht das Verhalten der
 * Datenbank. Das Verhalten wurde beim Entwurf gegen einen echten Postgres
 * verifiziert (drei Scope-Fälle, visibility-Verengung, Selbstbeförderung
 * abgewiesen); diese Suite hält das Ergebnis fest, sie ersetzt es nicht.
 */

import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const MIGRATIONS = resolve(__dirname, '../../supabase/migrations');

/** Die acht Tabellen aus D4, plus die zwei, die das Modell mitbringt. */
const SCOPED_TABLES = [
  'org_units',
  'agent_roles',
  'agents',
  'agent_teams',
  'agent_team_members',
  'agent_tickets',
  'agent_reports',
  'agent_kg_nodes',
  'agent_kg_edges',
  'agent_escalations',
] as const;

/** Tabellen, deren Sichtbarkeit `visibility` zusätzlich verengt (D4). */
const NARROWED_TABLES = ['agent_tickets', 'agent_reports'] as const;

const FILES = readdirSync(MIGRATIONS).filter((f) => /^20260904010\d00_.*\.sql$/.test(f));

function read(file: string): string {
  return readFileSync(resolve(MIGRATIONS, file), 'utf8');
}

/** Die Migration, die diese Tabelle anlegt. */
function migrationFor(table: string): string {
  const hits = FILES.filter((f) =>
    new RegExp(`CREATE TABLE IF NOT EXISTS public\\.${table}\\b`).test(read(f)),
  );
  expect(hits, `genau eine Migration legt public.${table} an`).toHaveLength(1);
  return hits[0];
}

/** Kommentare entfernen — sonst zählt eine Erklärung wie ein Statement. */
function code(sql: string): string {
  return sql
    .split('\n')
    .filter((l) => !l.trimStart().startsWith('--'))
    .join('\n');
}

/**
 * Nur ausführbares DDL: zusätzlich zu den `--`-Zeilen fallen auch
 * COMMENT-ON-Texte weg. Sonst schlägt eine Prüfung auf Wörter wie „Budget"
 * beim Kommentar an, der gerade erklärt, dass es kein Budget gibt.
 */
function ddl(sql: string): string {
  return code(sql).replace(/COMMENT ON [\s\S]*?;/g, '');
}

describe('ADR 0011 D4 — RLS steht in derselben Migration wie die Tabelle', () => {
  it.each([...SCOPED_TABLES, 'platform_operators'])(
    'public.%s: CREATE TABLE und ENABLE ROW LEVEL SECURITY in einer Datei',
    (table) => {
      const sql = code(read(migrationFor(table)));
      expect(
        sql,
        `RLS für ${table} fehlt in der anlegenden Migration — eine Tabelle, die ` +
          'zwischen zwei Migrationen ohne Policy in Produktion steht, ist in diesem ' +
          'Fenster offen (ADR 0011 D4).',
      ).toMatch(new RegExp(`ALTER TABLE public\\.${table}\\s+ENABLE ROW LEVEL SECURITY`));
    },
  );
});

describe('Schreibzugriff bleibt Service-Role', () => {
  it('keine INSERT/UPDATE/DELETE/ALL-Policy in der gesamten Ebene', () => {
    for (const file of FILES) {
      const sql = code(read(file));
      const policies = sql.match(/CREATE POLICY[\s\S]*?(?=;)/g) ?? [];
      for (const p of policies) {
        expect(
          p,
          `${file}: Policy erlaubt mehr als SELECT. Agenten laufen nie im ` +
            'Browser; geschrieben wird ausschließlich per Service-Role (CLAUDE.md §4).',
        ).toMatch(/FOR SELECT/);
      }
    }
  });

  it.each(SCOPED_TABLES)('public.%s: nur GRANT SELECT für authenticated, nichts für anon', (table) => {
    const sql = code(read(migrationFor(table)));
    expect(sql).toMatch(new RegExp(`REVOKE ALL ON public\\.${table}\\s+FROM anon, authenticated`));
    expect(sql).toMatch(new RegExp(`GRANT SELECT ON public\\.${table}\\s+TO authenticated`));
    expect(sql).not.toMatch(new RegExp(`GRANT[^;]*ON public\\.${table}[^;]*TO[^;]*anon`));
  });
});

describe('ADR 0011 D5 — platform_operators ist eine Sicherheitsgrenze, keine Nutzertabelle', () => {
  const file = '20260904010000_platform_operators.sql';

  it('trägt RLS ohne jede Client-Policy', () => {
    const sql = code(read(file));
    expect(sql).toContain('ALTER TABLE public.platform_operators ENABLE ROW LEVEL SECURITY');
    expect(
      sql.match(/CREATE POLICY[^;]*ON public\.platform_operators/g),
      'Eine Berechtigungsquelle, die ihr eigenes Subjekt beschreiben darf, ist ' +
        'keine Sicherheitsgrenze (ADR 0011 D5, Begründung B1).',
    ).toBeNull();
  });

  it('gibt anon und authenticated keinerlei Rechte', () => {
    const sql = code(read(file));
    expect(sql).toMatch(/REVOKE ALL ON public\.platform_operators FROM anon, authenticated/);
    expect(sql).not.toMatch(/GRANT[^;]*ON public\.platform_operators/);
  });

  it('is_platform_operator ist STABLE, SECURITY DEFINER, mit festem search_path', () => {
    const sql = code(read(file));
    const fn = sql.slice(sql.indexOf('CREATE OR REPLACE FUNCTION public.is_platform_operator'));
    expect(fn).toMatch(/\bSTABLE\b/);
    expect(fn).toMatch(/\bSECURITY DEFINER\b/);
    expect(fn).toMatch(/SET search_path = public/);
  });

  it('liest aus platform_operators und nirgends aus profiles', () => {
    const sql = code(read(file));
    expect(sql).toMatch(/FROM public\.platform_operators/);
    expect(
      sql,
      'D5: Die Plattform-Berechtigung darf nicht aus einem Tenant-Kontext ' +
        'abgeleitet werden. profiles ist genau dieser Kontext.',
    ).not.toMatch(/\bprofiles\b(?![^\n]*NICHT)/);
  });

  it('EXECUTE für authenticated, nicht für anon', () => {
    const sql = code(read(file));
    expect(sql).toMatch(/GRANT EXECUTE ON FUNCTION public\.is_platform_operator\(\) TO authenticated/);
    expect(sql).not.toMatch(/GRANT EXECUTE ON FUNCTION public\.is_platform_operator\(\) TO anon/);
  });

  it('steht vor jeder Tabelle, die sie aufruft', () => {
    const version = (f: string) => f.slice(0, 14);
    for (const table of SCOPED_TABLES) {
      expect(
        version(migrationFor(table)) > version('20260904010000_platform_operators.sql'),
        `${table} wird vor platform_operators angelegt — die erste Platform-Scope-` +
          'Policy hätte dann keine Funktion zum Aufrufen (ADR 0011 D4).',
      ).toBe(true);
    }
  });

  it('ist im ACL-Drift-Guard als Pflicht-Grant hinterlegt', () => {
    const guard = readFileSync(resolve(__dirname, '../../scripts/check-function-acl-drift.mjs'), 'utf8');
    expect(
      guard,
      'CLAUDE.md §5: Wer per Migration Client-Grants ändert, zieht die Soll-Liste ' +
        'im Guard nach — sonst meldet der nächtliche Lauf einen Drift, den es nicht gibt.',
    ).toMatch(/'is_platform_operator'/);
  });
});

describe('ADR 0011 D4 — das Scope-Modell kennt drei Fälle', () => {
  it.each(SCOPED_TABLES)('public.%s: Platform-Zweig steht ausdrücklich da', (table) => {
    const sql = code(read(migrationFor(table)));
    expect(
      sql,
      'is_tenant_member(NULL) liefert zwar false, aber das ist eine Eigenschaft ' +
        'der Implementierung, kein zugesicherter Vertrag (ADR 0011 D4).',
    ).toContain('(tenant_id IS NULL AND public.is_platform_operator())');
  });

  it.each(SCOPED_TABLES)('public.%s: Tenant-Zweig prüft die Mitgliedschaft', (table) => {
    const sql = code(read(migrationFor(table)));
    expect(sql).toContain('tenant_id IS NOT NULL AND public.is_tenant_member(tenant_id)');
  });
});

describe('ADR 0011 D4 — visibility verengt, es erweitert nie', () => {
  it.each(NARROWED_TABLES)('public.%s: tenant_shared ist zusätzliche Bedingung', (table) => {
    const sql = code(read(migrationFor(table)));
    expect(sql).toMatch(
      new RegExp(
        `tenant_id IS NOT NULL AND public\\.is_tenant_member\\(tenant_id\\) AND visibility = 'tenant_shared'`,
      ),
    );
  });

  it.each(NARROWED_TABLES)('public.%s: tenant_shared ohne Tenant per CHECK ausgeschlossen', (table) => {
    const sql = code(read(migrationFor(table)));
    expect(
      sql,
      'tenant_shared bei tenant_id IS NULL ist ein Widerspruch — mit wem geteilt? ' +
        'Das gehört per CHECK ausgeschlossen, nicht per Konvention (ADR 0011 D4).',
    ).toMatch(/CHECK \(NOT \(tenant_id IS NULL AND visibility = 'tenant_shared'\)\)/);
  });
});

describe('ADR 0011 D3 — Snapshot pro Tag, keine Versionskette', () => {
  const sql = () => code(read(migrationFor('agent_reports')));

  it('Eindeutigkeit pro (Scope, Tag), auch wenn tenant_id NULL ist', () => {
    expect(sql()).toMatch(
      /CREATE UNIQUE INDEX[^;]*agent_reports \(org_unit_id, tenant_id, period, report_day\) NULLS NOT DISTINCT/,
    );
  });

  it('kein version/supersedes mehr', () => {
    expect(
      sql(),
      'D3 hat die Versionskette aus dem Entwurf v0.1 verworfen: agent_reports ist ' +
        'ein Zustandsbild, kein Event Store.',
    ).not.toMatch(/^\s*(version|supersedes)\s/m);
  });

  it('deckelt die Berichte bei zehn Punkten', () => {
    expect(sql()).toMatch(/coalesce\(array_length\(bullet_points, 1\), 0\) <= 10/);
  });
});

describe('ADR 0011 D1 — die Autonomiegrenze ist kein Feld', () => {
  it('keine Spalte, die Freigabe an der Zeile festmacht', () => {
    for (const file of FILES) {
      const sql = code(read(file));
      expect(
        sql,
        `${file}: Ein Agent, der seine eigene Autonomiegrenze auswertet, ist kein ` +
          'Gate — er ist eine Selbstauskunft (ADR 0011 D1). Die Prüfung gehört in ' +
          'die Policy Engine, nicht auf die Zeile.',
      ).not.toMatch(/^\s*(auto_?deploy|autonomous|may_deploy|is_autonomous|bypass_approval)\b/mi);
    }
  });

  it('decision_scope ist ausdrücklich als Nicht-Gate dokumentiert', () => {
    const raw = read(migrationFor('agent_roles'));
    expect(raw).toMatch(/KEIN GATE/);
  });
});

describe('ADR 0011 D2 — Ledger jetzt, Enforcement später', () => {
  const file = '20260904010900_ai_tool_runs_agent_attribution.sql';

  it('ergänzt die Zuordnungsachse additiv und nullable', () => {
    const sql = code(read(file));
    expect(sql).toMatch(/ADD COLUMN IF NOT EXISTS agent_id\s+uuid NULL/);
    expect(sql).toMatch(/ADD COLUMN IF NOT EXISTS org_unit_id uuid NULL/);
  });

  it('führt kein Budget und keine Blocking-Logik ein', () => {
    const sql = ddl(read(file));
    expect(
      sql,
      'D2: Ein Cap mit ausgedachter Zahl ist schlechter als kein Cap — er sieht ' +
        'aus wie eine Zusage. Enforcement kommt nach dem Business-Entscheid.',
    ).not.toMatch(/\b(budget|quota|monthly_limit|daily_limit)\b/i);
    expect(sql).not.toMatch(/CREATE (OR REPLACE )?(TRIGGER|FUNCTION)|RAISE EXCEPTION/i);
  });

  it('ergänzt genau zwei Spalten, nicht mehr', () => {
    const added = ddl(read(file)).match(/ADD COLUMN IF NOT EXISTS (\w+)/g) ?? [];
    expect(added.map((a) => a.replace('ADD COLUMN IF NOT EXISTS ', ''))).toEqual([
      'agent_id',
      'org_unit_id',
    ]);
  });

  it('fasst keine bestehende Spalte an', () => {
    const sql = code(read(file));
    expect(sql).not.toMatch(/DROP COLUMN|ALTER COLUMN|DROP TABLE|DROP CONSTRAINT/);
  });
});

describe('Alle zehn Migrationen sind additiv', () => {
  it.each(FILES)('%s löscht nichts Bestehendes', (file) => {
    const sql = code(read(file));
    expect(sql).not.toMatch(/\bDROP TABLE\b/);
    expect(sql).not.toMatch(/\bDROP COLUMN\b/);
    // DROP POLICY IF EXISTS direkt vor CREATE POLICY ist Wiederholbarkeit,
    // kein destruktiver Eingriff — alles andere wäre einer.
    for (const m of sql.match(/DROP\s+\w+/g) ?? []) {
      expect(m).toMatch(/DROP POLICY/);
    }
  });
});
