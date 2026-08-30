import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

import { PLANS } from '../../shared/pricing';
import { FREE_TIER_FALLBACK } from '../../src/core/billing/useEntitlements';

/**
 * Hält die Berechtigungs-Migration und die Preis-Quelle zusammen.
 *
 * Vorgeschichte, weil sie die Prüfrichtung erklärt: Eine frühere Fassung
 * dieses Tests band `limits.auditReportsPerMonth` an
 * `website.scan_monthly_limit`. Das war eine Verwechslung zweier Größen, die
 * beide nach „Audit" klingen:
 *
 *   - `website.scan_monthly_limit` steuert die Website-Scans
 *     (`src/core/billing/useScanLimits.ts`)
 *   - `limits.auditReportsPerMonth` speist `complianceExportsMonthly`
 *     (`src/core/billing/entitlements.ts`) und meint Compliance-Exporte
 *
 * Der Test prüft deshalb jetzt zwei getrennte Zusagen.
 */

const MIGRATION = 'supabase/migrations/20260828000000_entitlement_base_keys_paid_plans.sql';
const sql = readFileSync(MIGRATION, 'utf8');

describe('Scans sind unbegrenzt und kostenlos', () => {
  /**
   * Produktentscheidung vom 2026-08-24: Der Scan ist der Einstieg in den
   * Trichter, nicht die Ware. Verkauft wird die dauerhafte Überwachung.
   * Ein Kontingent auf Scans würde genau den Weg drosseln, der Kunden bringt.
   */
  it('setzt das Scan-Kontingent in der Migration auf unbegrenzt (-1)', () => {
    expect(sql).toContain("e.key = 'website.scan_monthly_limit'");
    expect(sql).toMatch(/SELECT p\.id, e\.id, -1/);
    // Und hebt bestehende endliche Kontingente an — sonst bliebe die live
    // vorhandene 3 des free_tier stehen.
    expect(sql).toMatch(/UPDATE public\.product_entitlements[\s\S]{0,400}SET value = -1/);
  });

  it('trägt in der Migration kein endliches Scan-Kontingent mehr', () => {
    // Ein zurückkehrendes `('starter', 6)` o. ä. wäre der Rückfall in das
    // abgeschaffte Modell.
    const kontingentZeilen = sql.match(
      /\('(?:free_audit|starter|growth|agency|enterprise|partner)',\s*\d+\)/g,
    );
    expect(kontingentZeilen).toBeNull();
  });

  it('lässt auch den Rückfall im Frontend unbegrenzt', () => {
    // `FREE_TIER_FALLBACK` greift, solange keine aktive Subscription
    // existiert. Stünde hier eine endliche Zahl, hätte der Besucher trotz
    // der Entscheidung ein Kontingent.
    const eintrag = FREE_TIER_FALLBACK.find((e) => e.key === 'website.scan_monthly_limit');
    expect(eintrag, 'website.scan_monthly_limit fehlt im FREE_TIER_FALLBACK').toBeDefined();
    expect(eintrag!.value).toBe(-1);
  });

  it('führt jeden Plan in der Freigabeliste der Migration', () => {
    for (const planKey of [
      'free_audit', 'free', 'free_tier',
      'starter', 'growth', 'agency', 'enterprise', 'partner',
      'starter_yearly', 'growth_yearly', 'agency_yearly', 'partner_yearly',
    ]) {
      expect(sql, `${planKey} fehlt in der Migration`).toContain(`'${planKey}'`);
    }
  });
});

describe('Basis-Keys der bezahlten Pläne', () => {
  it('vergibt die Basis-Keys an alle fünf bezahlten Pläne', () => {
    // `dashboard.access` war der eigentliche Befund: Ohne diesen Key schickt
    // AdaptiveGovernanceNav einen zahlenden Kunden auf die Upgrade-Seite.
    for (const key of [
      'dashboard.access',
      'website.scan',
      'evidence.basic_vault',
      'governance.dsgvo_directory',
      'governance.ai_register',
    ]) {
      expect(sql, `${key} fehlt in der Migration`).toContain(`'${key}'`);
    }
    for (const plan of ['starter', 'growth', 'agency', 'enterprise', 'partner']) {
      expect(sql).toContain(`'${plan}'`);
    }
  });
});

describe('auditReportsPerMonth meint Compliance-Exporte, nicht Scans', () => {
  /**
   * Hält die Verwechslung fest, damit sie nicht wiederkehrt. Kein Bezug zur
   * Migration — die Prüfung sichert die Bedeutung des Feldes.
   */
  it('wird im Usage-Modell auf complianceExportsMonthly abgebildet', () => {
    const quelle = readFileSync('src/core/billing/entitlements.ts', 'utf8');
    expect(quelle).toContain(
      'complianceExportsMonthly: unlimitedAsNull(plan.limits.auditReportsPerMonth)',
    );
  });

  it('bleibt je Plan gestaffelt — der Free-Plan exportiert am wenigsten', () => {
    const wert = (planKey: string) =>
      PLANS.find((p) => p.planKey === planKey)!.limits.auditReportsPerMonth;
    expect(wert('free_audit')).toBeLessThan(wert('starter'));
    expect(wert('starter')).toBeLessThan(wert('growth'));
    expect(wert('growth')).toBeLessThan(wert('agency'));
  });
});
