/**
 * Migrations-Kollisions-Guard — Logik.
 *
 * Geprueft wird die reine Vergleichslogik aus
 * `scripts/check-migration-collisions.mjs`, nicht der Lauf gegen Git oder die
 * GitHub-API. Grund: Die beiden Faelle, die der Guard fangen soll, sind
 * Eigenschaften des VERGLEICHS, nicht der Beschaffung — und der Vergleich
 * gegen fremde offene PRs laesst sich lokal ueberhaupt nicht ausfuehren
 * (Token, Netz). Waere er nur im echten Lauf geprueft, waere er faktisch
 * ungeprueft.
 *
 * Die Faelle stammen aus der Messung vom 2026-09-06 und stehen mit ihren
 * echten Nummern hier, damit erkennbar bleibt, wogegen der Guard gebaut wurde:
 *   #1121 ↔ main   20260904000300  (Version schon vergeben)
 *   #1121 ↔ #1214  20260904000400  (Version zwischen zwei PRs)
 *   #1202 ↔ main   org_units       (Tabelle schon angelegt)
 *   #1221 ↔ main   audit_evidence  (dasselbe, aber gewollt → Vermerk)
 */

import { describe, expect, it } from 'vitest';
import {
  allowedExistingTables,
  collide,
  duplicateVersions,
  stripSqlComments,
  tablesCreatedBy,
  versionOf,
} from '../../scripts/check-migration-collisions.mjs';

const idx = (
  versions: Record<string, string> = {},
  tables: Record<string, string> = {},
) => ({ versions: new Map(Object.entries(versions)), tables: new Map(Object.entries(tables)) });

const mig = (file: string, tables: string[] = [], allowed: string[] = []) => ({
  file,
  version: versionOf(file) as string,
  tables: new Set(tables),
  allowed: new Set(allowed),
});

describe('versionOf', () => {
  it('liest 14-stellige Versionen', () => {
    expect(versionOf('20260904000300_siteos_workflow_vocabulary.sql')).toBe('20260904000300');
  });

  it('akzeptiert die achtstellige Altform, die auf main liegt', () => {
    // 20260510_ai_governance_core.sql ist gueltiger Bestand. Eine starre
    // 14-Stellen-Regel hat diese Datei in der ersten Fassung des Guards als
    // Fehler gemeldet — und damit jeden fremden PR rot gefaerbt.
    expect(versionOf('20260510_ai_governance_core.sql')).toBe('20260510');
  });

  it('nimmt die eine Legacy-Datei aus', () => {
    expect(versionOf('00001_initial_schema.sql')).toBeNull();
  });

  it('verweigert Namen ohne brauchbare Version', () => {
    expect(versionOf('add_column.sql')).toBeNull();
    expect(versionOf('123_zu_kurz.sql')).toBeNull();
  });
});

describe('SQL-Auswertung', () => {
  it('zaehlt CREATE TABLE in Kommentaren NICHT mit', () => {
    // 20260904010000_platform_operators.sql enthaelt den Satz
    // "`CREATE TABLE IF NOT EXISTS` fiel still durch" als Kommentar. Eine
    // naive Suche macht daraus eine Tabelle namens "if" — genau dieser
    // Fehlgriff ist bei der Handmessung passiert.
    const sql = `
      -- \`CREATE TABLE IF NOT EXISTS\` fiel still durch, und der erste Zugriff auf
      /* CREATE TABLE public.aus_dem_blockkommentar ( */
      CREATE TABLE IF NOT EXISTS public.agent_roles (id uuid);
    `;
    expect([...tablesCreatedBy(sql)]).toEqual(['agent_roles']);
  });

  it('erkennt alle Schreibweisen von CREATE TABLE', () => {
    const sql = `
      CREATE TABLE alpha (id uuid);
      create table if not exists public.beta (id uuid);
      CREATE  TABLE   "public"."gamma" (id uuid);
    `;
    expect([...tablesCreatedBy(sql)].sort()).toEqual(['alpha', 'beta', 'gamma']);
  });

  it('entfernt Zeilen- und Blockkommentare', () => {
    expect(stripSqlComments('SELECT 1; -- weg\n/* auch weg */SELECT 2;')).not.toContain('weg');
  });

  it('liest den Ausnahmevermerk aus der Migration', () => {
    const sql = '-- collision-check: allow-existing-table audit_evidence — Ledger-Bruch, CLAUDE.md §3';
    expect([...allowedExistingTables(sql)]).toEqual(['audit_evidence']);
  });
});

describe('duplicateVersions — eigener Baum', () => {
  it('findet zwei Dateien auf derselben Version', () => {
    const d = duplicateVersions([
      '20260826000000_whatsapp_channel.sql',
      '20260826000000_restore_client_function_grants.sql',
    ]);
    expect(d).toHaveLength(1);
    expect(d[0].version).toBe('20260826000000');
  });

  it('meldet nichts bei sauberen Versionen', () => {
    expect(duplicateVersions([
      '20260904000300_a.sql',
      '20260904000400_b.sql',
      '00001_initial_schema.sql',
    ])).toEqual([]);
  });
});

describe('collide — gegen Basis und gegen fremde PRs', () => {
  it('#1121: Version ist auf main schon vergeben', () => {
    const f = collide(
      [mig('20260904000300_siteos_workflow_vocabulary.sql')],
      idx({ '20260904000300': '20260904000300_canonical_plan_catalog.sql' }),
      'origin/main',
    );
    expect(f).toHaveLength(1);
    expect(f[0].kind).toBe('version');
    expect(f[0].detail).toContain('canonical_plan_catalog');
  });

  it('#1121 ↔ #1214: Version kollidiert zwischen zwei offenen PRs', () => {
    // Der Fall, den weder GitHub noch die PR-CI sieht: Beide Baeume sind je
    // fuer sich widerspruchsfrei.
    const f = collide(
      [mig('20260904000400_align_agency_partner_quota_entitlements.sql')],
      idx({ '20260904000400': '#1121: 20260904000400_agent_profiles_tenant_isolation.sql' }),
      'ein anderer offener PR',
    );
    expect(f).toHaveLength(1);
    expect(f[0].kind).toBe('version');
    expect(f[0].detail).toContain('#1121');
  });

  it('#1202: Tabelle wird ein zweites Mal angelegt', () => {
    const f = collide(
      [mig('20260905000200_org_units.sql', ['org_units'])],
      idx({}, { org_units: '20260824120000_org_subject_model_approval_gates.sql' }),
      'origin/main',
    );
    expect(f).toHaveLength(1);
    expect(f[0].kind).toBe('table');
  });

  it('#1221: dieselbe Doppelung, aber mit Vermerk — kein Befund', () => {
    const f = collide(
      [mig('20260906000000_reconcile_audit_evidence.sql', ['audit_evidence'], ['audit_evidence'])],
      idx({}, { audit_evidence: '20260507100000_audit_evidence.sql' }),
      'origin/main',
    );
    expect(f).toEqual([]);
  });

  it('der Vermerk gilt genau der genannten Tabelle, nicht der ganzen Datei', () => {
    // Sonst waere eine einzelne Ausnahme ein Freibrief fuer alles Weitere in
    // derselben Migration.
    const f = collide(
      [mig('20260906000000_x.sql', ['audit_evidence', 'org_units'], ['audit_evidence'])],
      idx({}, { audit_evidence: 'a.sql', org_units: 'b.sql' }),
      'origin/main',
    );
    expect(f).toHaveLength(1);
    expect(f[0].detail).toContain('org_units');
  });

  it('meldet die eigene Datei nicht gegen sich selbst', () => {
    const f = collide(
      [mig('20260904000300_x.sql')],
      idx({ '20260904000300': '20260904000300_x.sql' }),
      'origin/main',
    );
    expect(f).toEqual([]);
  });

  it('schweigt, wenn nichts kollidiert', () => {
    expect(collide(
      [mig('20260907000000_neu.sql', ['ganz_neue_tabelle'])],
      idx({ '20260904000300': 'alt.sql' }, { org_units: 'alt.sql' }),
      'origin/main',
    )).toEqual([]);
  });
});
