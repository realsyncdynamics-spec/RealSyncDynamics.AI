/**
 * WP-3 — `beta-enroll`: Beta-Zugang serverseitig (docs/claude/BETA_V5_WORKPLAN.md).
 *
 * Zwei Ebenen:
 *  1. Die Entscheidungslogik (`logic.ts`) ist Deno-frei und wird direkt geprüft:
 *     Wann darf die Beta über ein bestehendes Abo gelegt werden?
 *  2. Die Function selbst ist in vitest nicht ausführbar; geprüft wird am
 *     Quelltext, was die Mandantentrennung trägt (wie onboarding-setup-functions).
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  BETA_ENDS_AT,
  BETA_PLAN_KEY,
  betaOpen,
  decideEnrollment,
  newEnrollmentOpen,
  sanitizeSource,
} from '../../supabase/functions/beta-enroll/logic';
import { BETA } from '../../src/config/beta';

const root = (p: string) => resolve(__dirname, '../..', p);
const CODE = readFileSync(root('supabase/functions/beta-enroll/index.ts'), 'utf8');
const MIGRATION = readFileSync(root('supabase/migrations/20261013090000_beta_enrollments.sql'), 'utf8');
const CONFIG = readFileSync(root('supabase/config.toml'), 'utf8');

const NOW = new Date('2026-10-13T10:00:00Z');
const FUTURE = '2026-10-27T10:00:00Z';
const PAST = '2026-10-01T10:00:00Z';

describe('decideEnrollment', () => {
  it('meldet einen Mandanten ohne Abo-Zeile an', () => {
    expect(decideEnrollment(null, NOW)).toEqual({ kind: 'enroll' });
  });

  it.each(['free_tier', 'free_audit', 'free'])('überschreibt die freie Stufe %s', (plan) => {
    expect(decideEnrollment({ status: 'active', plan_key: plan }, NOW)).toEqual({ kind: 'enroll' });
  });

  it('ist idempotent: ein Beta-Abo wird nicht erneut geschrieben', () => {
    expect(
      decideEnrollment({ status: 'trialing', plan_key: 'growth', source: 'beta', trial_end: BETA_ENDS_AT }, NOW),
    ).toEqual({ kind: 'already' });
  });

  it('fasst kein Stripe-Abo an — auch kein gekündigtes', () => {
    for (const status of ['active', 'trialing', 'past_due', 'canceled']) {
      expect(
        decideEnrollment({ status, plan_key: 'starter', stripe_subscription_id: 'sub_123' }, NOW),
      ).toEqual({ kind: 'skip', reason: 'STRIPE_SUBSCRIPTION' });
    }
  });

  it('fasst kein laufendes, nicht-freies Abo ohne Stripe an (Pilot, manuell)', () => {
    expect(decideEnrollment({ status: 'active', plan_key: 'agency' }, NOW)).toEqual({
      kind: 'skip',
      reason: 'ACTIVE_SUBSCRIPTION',
    });
    expect(decideEnrollment({ status: 'past_due', plan_key: 'enterprise' }, NOW)).toEqual({
      kind: 'skip',
      reason: 'ACTIVE_SUBSCRIPTION',
    });
    expect(
      decideEnrollment({ status: 'trialing', plan_key: 'agency', trial_end: FUTURE }, NOW),
    ).toEqual({ kind: 'skip', reason: 'ACTIVE_SUBSCRIPTION' });
  });

  it('verlängert einen kartenlosen Growth-Test auf das Beta-Ende', () => {
    expect(
      decideEnrollment({ status: 'trialing', plan_key: 'growth', trial_end: FUTURE }, NOW),
    ).toEqual({ kind: 'enroll' });
  });

  it('meldet nach einem abgelaufenen Test an (zählt ohnehin als frei)', () => {
    expect(
      decideEnrollment({ status: 'trialing', plan_key: 'agency', trial_end: PAST }, NOW),
    ).toEqual({ kind: 'enroll' });
    expect(
      decideEnrollment({ status: 'trialing', plan_key: 'agency', trial_ends_at: PAST }, NOW),
    ).toEqual({ kind: 'enroll' });
  });
});

describe('Neuaufnahme geschlossen (BETA_NEW_ENROLLMENT=off)', () => {
  const closed = { acceptNew: false };

  it('bestätigt bestehende Beta-Zugänge unverändert (kein rückwirkender Entzug)', () => {
    expect(
      decideEnrollment({ status: 'trialing', plan_key: 'growth', source: 'beta', trial_end: BETA_ENDS_AT }, NOW, closed),
    ).toEqual({ kind: 'already' });
  });

  it('nimmt neue Mandanten nicht mehr auf', () => {
    expect(decideEnrollment(null, NOW, closed)).toEqual({ kind: 'skip', reason: 'NEW_ENROLLMENT_CLOSED' });
    expect(decideEnrollment({ status: 'active', plan_key: 'free_audit' }, NOW, closed)).toEqual({
      kind: 'skip',
      reason: 'NEW_ENROLLMENT_CLOSED',
    });
    // Kartenloser Growth-Test wird nicht mehr auf das Beta-Ende verlängert.
    expect(decideEnrollment({ status: 'trialing', plan_key: 'growth', trial_end: FUTURE }, NOW, closed)).toEqual({
      kind: 'skip',
      reason: 'NEW_ENROLLMENT_CLOSED',
    });
  });

  it('lässt Stripe- und laufende Abos weiter mit ihrem eigenen Grund unberührt', () => {
    expect(decideEnrollment({ status: 'active', plan_key: 'starter', stripe_subscription_id: 'sub_1' }, NOW, closed))
      .toEqual({ kind: 'skip', reason: 'STRIPE_SUBSCRIPTION' });
    expect(decideEnrollment({ status: 'active', plan_key: 'agency' }, NOW, closed))
      .toEqual({ kind: 'skip', reason: 'ACTIVE_SUBSCRIPTION' });
  });

  it('Default bleibt offen — Produktion unverändert, bis das Secret gesetzt wird', () => {
    expect(newEnrollmentOpen(undefined)).toBe(true);
    expect(newEnrollmentOpen('on')).toBe(true);
    for (const f of ['off', 'OFF', 'false', '0']) expect(newEnrollmentOpen(f)).toBe(false);
    expect(decideEnrollment(null, NOW)).toEqual({ kind: 'enroll' });
  });
});

describe('betaOpen / Beta-Ende', () => {
  it('ist offen bis zum Beta-Ende und danach zu', () => {
    expect(betaOpen(undefined, NOW)).toBe(true);
    expect(betaOpen(undefined, new Date(BETA_ENDS_AT))).toBe(false);
  });

  it.each(['off', 'false', '0', 'OFF'])('schließt mit BETA_PHASE=%s', (flag) => {
    expect(betaOpen(flag, NOW)).toBe(false);
  });

  it('endet am 31.01.2027 um 24:00 Berlin (Winterzeit, UTC+1)', () => {
    expect(BETA_ENDS_AT).toBe('2027-01-31T23:00:00.000Z');
    expect(BETA.endsLabel).toBe('31. Januar 2027');
  });

  it('vergibt dieselbe Planstufe, die das Frontend verspricht', () => {
    expect(BETA_PLAN_KEY).toBe(BETA.testPlan);
  });
});

describe('sanitizeSource', () => {
  it('lässt kurze Slugs durch und ersetzt alles andere', () => {
    expect(sanitizeSource('checkout-beta-redirect')).toBe('checkout-beta-redirect');
    expect(sanitizeSource('<script>')).toBe('beta');
    expect(sanitizeSource(42)).toBe('beta');
    expect(sanitizeSource('x'.repeat(80))).toBe('beta');
  });
});

describe('beta-enroll — Quelltext', () => {
  it('löst den Mandanten über memberships des Principals auf, nie ungeprüft aus dem Body', () => {
    expect(CODE).toContain("from('memberships')");
    expect(CODE).toMatch(/\.eq\('user_id', user\.id\)/);
    expect(CODE).toContain("'not a member of this tenant'");
    expect(CODE).toContain('Multiple tenants');
    expect(CODE).not.toContain('active_tenant_id');
  });

  it('erlaubt die Anmeldung nur owner/admin', () => {
    expect(CODE).toMatch(/ENROLL_ROLES = new Set\(\['owner', 'admin'\]\)/);
  });

  it('prüft den JWT und braucht keinen config.toml-Eintrag (verify_jwt-Default)', () => {
    expect(CODE).toContain('auth.getUser(token)');
    expect(CONFIG).not.toMatch(/\[functions\.beta-enroll\]/);
  });

  it('schreibt trial_end — der Auflöser liest current_period_end nicht', () => {
    expect(CODE).toMatch(/trial_end: BETA_ENDS_AT/);
    expect(CODE).toMatch(/trial_ends_at: BETA_ENDS_AT/);
    expect(CODE).toMatch(/onConflict: 'tenant_id'/);
  });

  it('entscheidet vor dem Schreiben und liefert ok:true auch bei skip', () => {
    expect(CODE).toContain('decideEnrollment(current, now, {');
    expect(CODE).toContain("acceptNew: newEnrollmentOpen(Deno.env.get('BETA_NEW_ENROLLMENT'))");
    expect(CODE).toMatch(/ok: true, enrolled: false, reason: decision\.reason/);
  });

  it('kennt kein Stripe', () => {
    expect(CODE.toLowerCase()).not.toContain('stripe.');
    expect(CODE).not.toMatch(/STRIPE_SECRET/);
  });
});

describe('Migration 20261013090000_beta_enrollments', () => {
  it('ist additiv', () => {
    expect(MIGRATION).toMatch(/ADD COLUMN IF NOT EXISTS source text/);
    expect(MIGRATION).toMatch(/CREATE TABLE IF NOT EXISTS public\.beta_enrollments/);
    expect(MIGRATION).not.toMatch(/\bDROP (TABLE|COLUMN)\b/i);
    expect(MIGRATION).not.toMatch(/\bDELETE FROM\b/i);
    expect(MIGRATION).not.toMatch(/\bUPDATE public\.subscriptions\b/i);
  });

  it('schützt beta_enrollments per RLS: lesen Mitglieder, schreiben nur service_role', () => {
    expect(MIGRATION).toMatch(/beta_enrollments ENABLE ROW LEVEL SECURITY/);
    expect(MIGRATION).toMatch(/FOR SELECT TO authenticated\s+USING \(public\.is_tenant_member\(tenant_id\)\)/);
    expect(MIGRATION).toMatch(/REVOKE ALL ON public\.beta_enrollments FROM anon, authenticated/);
    expect(MIGRATION).toMatch(/GRANT SELECT ON public\.beta_enrollments TO authenticated/);
  });
});
