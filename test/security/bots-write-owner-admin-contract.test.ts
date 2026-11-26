/**
 * Schreibrechte auf public.bots (Migration 20261109113141) — Vertrag am Quelltext.
 *
 * Die Durchsetzung prüft test/runtime/db/bots-write-owner-admin.db.test.ts
 * gegen echtes Postgres. Hier stehen die Eigenschaften, die ein späterer
 * Edit leicht verliert:
 *
 *  1. Alle schreibenden Policies werden entfernt, auch unbekannte (Schleife
 *     über pg_policies), denn permissive Policies werden ODER-verknüpft.
 *  2. Neue INSERT/UPDATE/DELETE-Policies nur mit is_tenant_owner_or_admin;
 *     UPDATE prüft USING und WITH CHECK.
 *  3. Der Quota-Trigger prüft für Clients dieselbe Rolle wie die Policy,
 *     vor Lock und Kontingent; der übrige Rumpf bleibt unverändert.
 *  4. Keine Datenänderung in der Migration.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = (p: string) => resolve(__dirname, '../..', p);
const MIG = readFileSync(root('supabase/migrations/20261109113141_bots_write_owner_admin.sql'), 'utf8');
const ALT = readFileSync(root('supabase/migrations/20260920130000_bots_quota_enforcement.sql'), 'utf8');

const norm = (t: string) => t.replace(/--[^\n]*/g, '').replace(/\s+/g, ' ').trim();
const SQL = norm(MIG);

function rumpf(sql: string, name: string): string {
  const kopf = sql.indexOf(`CREATE OR REPLACE FUNCTION public.${name}(`);
  expect(kopf, `${name} nicht gefunden`).toBeGreaterThan(-1);
  const a = sql.indexOf('$function$', kopf) + '$function$'.length;
  const b = sql.indexOf('$function$', a);
  return norm(sql.slice(a, b));
}

describe('Migration 20261109113141 — bots-Schreibrechte', () => {
  it('entfernt jede schreibende Policy auf public.bots, auch unbekannte', () => {
    expect(SQL).toContain("WHERE schemaname = 'public' AND tablename = 'bots' AND cmd IN ('INSERT', 'UPDATE', 'DELETE', 'ALL')");
    expect(SQL).toContain("EXECUTE format('DROP POLICY %I ON public.bots', p.policyname)");
  });

  it('neue Schreib-Policies nur für Owner/Admin', () => {
    expect(SQL).toContain('CREATE POLICY "bots admin-insert" ON public.bots FOR INSERT TO authenticated WITH CHECK (public.is_tenant_owner_or_admin(tenant_id));');
    expect(SQL).toContain('CREATE POLICY "bots admin-update" ON public.bots FOR UPDATE TO authenticated USING (public.is_tenant_owner_or_admin(tenant_id)) WITH CHECK (public.is_tenant_owner_or_admin(tenant_id));');
    expect(SQL).toContain('CREATE POLICY "bots admin-delete" ON public.bots FOR DELETE TO authenticated USING (public.is_tenant_owner_or_admin(tenant_id));');
    // Keine neue Schreib-Policy auf Mitgliedschaft.
    expect(SQL).not.toMatch(/FOR (INSERT|UPDATE|DELETE|ALL)[^;]*is_tenant_member/);
  });

  it('Quota-Trigger: Owner/Admin-Prüfung vor Lock, Rest unverändert', () => {
    const neu = rumpf(MIG, 'bots_enforce_quota');
    const alt = rumpf(ALT, 'bots_enforce_quota');
    const auth = neu.indexOf("IF auth.role() IN ('anon', 'authenticated') AND NOT public.is_tenant_owner_or_admin(NEW.tenant_id) THEN");
    expect(auth, 'Owner/Admin-Prüfung fehlt').toBeGreaterThan(-1);
    expect(auth).toBeLessThan(neu.indexOf('pg_advisory_xact_lock('));
    expect(neu).toBe(alt.replace('NOT public.is_tenant_member(NEW.tenant_id)', 'NOT public.is_tenant_owner_or_admin(NEW.tenant_id)'));
  });

  it('ändert keine Daten', () => {
    expect(SQL).not.toMatch(/\b(INSERT INTO|UPDATE public\.|DELETE FROM|TRUNCATE)\b/);
  });
});
