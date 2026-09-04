/**
 * ADR 0011, D4 — Parität zwischen `agent_roles` (SQL) und `ALL_AGENT_ROLES` (TS)
 *
 * Der Entscheid vom 2026-09-04 macht `AgentRole` kanonisch und spiegelt es in
 * die Datenbank. Damit steht das Vokabular ab jetzt an zwei Stellen — genau
 * die Lage, die bei RFC-003 schon einmal einen Paritätstest nötig gemacht hat
 * (CLAUDE.md §5).
 *
 * Warum das hier zählt: Ein Wert, den es in TypeScript gibt und in der
 * Datenbank nicht, lässt jeden `INSERT INTO agents` mit dieser Rolle am
 * Fremdschlüssel scheitern — zur Laufzeit, beim Kunden. Ein Wert, den es nur
 * in der Datenbank gibt, ist für die Oberfläche unsichtbar. Beide Richtungen
 * werden deshalb geprüft, nicht nur die Anzahl.
 *
 * Braucht keine Datenbank: Der Test liest die Migrations-SQL als Text.
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { ALL_AGENT_ROLES } from '@/src/core/trainer-agent/types';

const MIGRATION = resolve(
  __dirname,
  '../../supabase/migrations/20260905000300_agent_roles.sql',
);

/** Liest die Schlüssel aus dem INSERT-Block der Migration. */
function rollenAusSql(): string[] {
  const sql = readFileSync(MIGRATION, 'utf8');
  const insert = sql.slice(sql.indexOf('INSERT INTO public.agent_roles'));
  const keys = [...insert.matchAll(/^\s*\('([A-Za-z]+)',/gm)].map((m) => m[1]!);
  return keys;
}

describe('agent_roles — SQL-Parität', () => {
  it('die Migration sät genau die Rollen aus ALL_AGENT_ROLES', () => {
    expect([...rollenAusSql()].sort()).toEqual([...ALL_AGENT_ROLES].sort());
  });

  it('kein Wert nur in TypeScript — sonst bricht der Fremdschlüssel zur Laufzeit', () => {
    const inSql = new Set(rollenAusSql());
    expect(ALL_AGENT_ROLES.filter((r) => !inSql.has(r))).toEqual([]);
  });

  it('kein Wert nur in SQL — sonst ist die Rolle für die Oberfläche unsichtbar', () => {
    const inTs = new Set<string>(ALL_AGENT_ROLES);
    expect(rollenAusSql().filter((r) => !inTs.has(r))).toEqual([]);
  });

  it('die Rollen sind der Primärschlüssel, nicht eine CHECK-Liste', () => {
    // Eine CHECK-Liste müsste bei jeder neuen Rolle per ALTER geändert werden;
    // ein Katalog mit Fremdschlüssel nimmt eine Zeile auf. Der Unterschied ist
    // der zwischen additiver und ändernder Migration (CLAUDE.md §3).
    const sql = readFileSync(MIGRATION, 'utf8');
    expect(sql).toMatch(/key\s+TEXT\s+PRIMARY KEY/);
  });
});
