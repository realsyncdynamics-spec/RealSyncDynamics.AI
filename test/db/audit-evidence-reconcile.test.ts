/**
 * Reconcile-Migration für `audit_evidence` — Form statt Wirkung.
 *
 * ## Warum ein Test auf der SQL-Datei und nicht auf der Datenbank
 *
 * Die Wirkung ist bereits gemessen: Die Migration wurde am 2026-09-06 gegen
 * das Live-Schema in einer Transaktion ausgeführt und zurückgerollt — 2
 * Policies, 3 Trigger, RLS an, Bucket angelegt, Produktion unverändert. Was
 * ein Test hinzufügt, ist die **Haltbarkeit** der beiden Eigenschaften, an
 * denen diese Klasse Migration erfahrungsgemäß scheitert.
 *
 * ### 1. Idempotenz
 *
 * Reconcile-Migrationen laufen zweimal gegen unterschiedliche Wirklichkeiten:
 * in Produktion auf ein fehlendes Objekt, in CI (`db reset`) auf ein bereits
 * vorhandenes. Ein einziges `CREATE` ohne Wächter bricht den zweiten Fall —
 * und weil alles in einer Transaktion läuft, nimmt es die ganze Migration mit.
 *
 * ### 2. Kein Zugriff auf `audit_findings`
 *
 * Das ist der Fehler, der beim Schreiben dieser Migration fast passiert wäre.
 * Die Ursprungsmigration `20260507100000` legt eine View über
 * `audit_findings.audit_id` und `.rule_id` an. Produktion führt eine **andere**
 * `audit_findings`: dort heißen die Spalten `audit_report_id` und
 * `control_reference` (gemessen 2026-09-06). Ein Replay wäre mit 42703
 * abgebrochen und hätte `supabase db push` blockiert — für jede nachfolgende
 * Migration mit, siehe CLAUDE.md §5.
 *
 * Der Test hält die Entscheidung fest, die View wegzulassen, damit sie nicht
 * versehentlich zurückkommt.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const PFAD = resolve(
  __dirname,
  '../../supabase/migrations/20260906000000_reconcile_audit_evidence.sql',
);
const sql = readFileSync(PFAD, 'utf8');
// Kommentare tragen die Begründung und nennen dabei genau die Namen, gegen die
// hier geprüft wird — sie müssen raus, sonst prüft der Test seine eigene Doku.
const code = sql
  .split('\n')
  .filter((z) => !/^\s*--/.test(z))
  .join('\n');

describe('Die Migration ist auf zweimaliges Laufen ausgelegt', () => {
  it('legt Tabelle und Indizes nur an, wenn sie fehlen', () => {
    for (const treffer of code.match(/CREATE (TABLE|INDEX)[^(]*/gi) ?? []) {
      expect(treffer, `${treffer.trim()} braucht IF NOT EXISTS`).toMatch(/IF NOT EXISTS/i);
    }
    expect(code).toMatch(/CREATE TABLE IF NOT EXISTS public\.audit_evidence/i);
  });

  it('löscht jede Policy, bevor sie sie anlegt', () => {
    const angelegt = [...code.matchAll(/CREATE POLICY\s+"?([a-z_]+)"?/gi)].map((m) => m[1]);
    expect(angelegt.length).toBeGreaterThan(0);
    for (const name of angelegt) {
      expect(code, `DROP POLICY IF EXISTS fehlt für ${name}`).toMatch(
        new RegExp(`DROP POLICY IF EXISTS\\s+"?${name}"?`, 'i'),
      );
    }
  });

  it('löscht jeden Trigger, bevor er ihn anlegt', () => {
    const angelegt = [...code.matchAll(/CREATE TRIGGER\s+([a-z_]+)/gi)].map((m) => m[1]);
    expect(angelegt.length).toBe(3);
    for (const name of angelegt) {
      expect(code, `DROP TRIGGER IF EXISTS fehlt für ${name}`).toMatch(
        new RegExp(`DROP TRIGGER IF EXISTS\\s+${name}`, 'i'),
      );
    }
  });

  it('fügt den Bucket konfliktfrei ein', () => {
    expect(code).toMatch(/INSERT INTO storage\.buckets[\s\S]*ON CONFLICT \(id\) DO NOTHING/i);
  });

  it('ergänzt den Fremdschlüssel nur, wenn er fehlt', () => {
    // ALTER TABLE ... ADD CONSTRAINT kennt kein IF NOT EXISTS.
    expect(code).toMatch(/pg_constraint[\s\S]*ADD CONSTRAINT audit_evidence_tenant_id_fkey/i);
  });
});

describe('Die Migration rührt audit_findings nicht an', () => {
  it('legt keine View über audit_findings an', () => {
    expect(code).not.toMatch(/audit_findings/i);
    expect(code).not.toMatch(/v_findings_with_evidence/i);
  });

  it('benennt den Grund im Kommentar, damit die Auslassung eine Entscheidung bleibt', () => {
    expect(sql).toMatch(/BEWUSST NICHT UEBERNOMMEN/);
    expect(sql).toMatch(/audit_report_id/);
  });
});

describe('Die Migration erfüllt die harten Regeln aus CLAUDE.md', () => {
  it('aktiviert RLS und gibt Lesezugriff nur Mitgliedern des Mandanten (§3, §4)', () => {
    expect(code).toMatch(/ALTER TABLE public\.audit_evidence ENABLE ROW LEVEL SECURITY/i);
    expect(code).toMatch(/USING \(public\.is_tenant_member\(tenant_id\)\)/i);
  });

  it('bindet tenant_id an tenants (§3)', () => {
    expect(code).toMatch(/FOREIGN KEY \(tenant_id\) REFERENCES public\.tenants\(id\)/i);
  });

  it('nutzt is_tenant_member statt einer memberships-Unterabfrage auf der Tabelle', () => {
    // 20260723000001 hat genau diese Policy auf is_tenant_member umgestellt,
    // um RLS-Rekursion abzuschaffen — in Produktion aber übersprungen, weil
    // die Tabelle fehlte. Die alte Form hier zurückzuschreiben, würde die
    // Rekursion auf frischem Postgres wieder einführen.
    const tabellenPolicy = code.slice(
      code.indexOf('CREATE POLICY audit_evidence_tenant_read'),
      code.indexOf('CREATE POLICY audit_evidence_service_write'),
    );
    expect(tabellenPolicy).not.toMatch(/FROM public\.memberships/i);
  });

  it('bleibt additiv — kein DROP TABLE, kein TRUNCATE, kein DELETE', () => {
    expect(code).not.toMatch(/\bDROP TABLE\b/i);
    expect(code).not.toMatch(/\bTRUNCATE\b/i);
    expect(code).not.toMatch(/\bDELETE FROM\b/i);
  });

  it('hält audit_evidence append-only (Prüfpfad)', () => {
    expect(code).toMatch(/BEFORE UPDATE ON public\.audit_evidence/i);
    expect(code).toMatch(/BEFORE DELETE ON public\.audit_evidence/i);
  });
});
