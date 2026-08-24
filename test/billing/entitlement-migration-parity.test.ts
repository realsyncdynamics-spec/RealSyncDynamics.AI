import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

import { PLANS } from '../../shared/pricing';

/**
 * Hält die Scan-Kontingente in der Migration und in `shared/pricing.ts`
 * zusammen.
 *
 * Warum das nötig ist: Die Zahlen stehen zwangsläufig doppelt — einmal als
 * `limits.auditReportsPerMonth` in der Preis-Quelle, einmal als
 * `website.scan_monthly_limit` in `product_entitlements`, weil die Runtime
 * gegen Entitlements autorisiert und nicht gegen eine TypeScript-Datei.
 * Doppelte Wahrheiten laufen auseinander, sobald sie niemand aneinander
 * bindet. Dieselbe Vorsichtsmaßnahme wie bei RFC-003
 * (test/governance/rfc003-sql-parity.test.ts).
 *
 * Bricht dieser Test, ist **nicht** der Test falsch: Dann wurde ein Preis
 * geändert, ohne die Berechtigung nachzuziehen — und der Kunde bekäme ein
 * anderes Kontingent, als die Preisseite ihm zusagt.
 */

const MIGRATION = 'supabase/migrations/20260826000000_entitlement_base_keys_paid_plans.sql';

/** Liest die VALUES-Paare (plan_key, wert) aus dem Kontingent-Block. */
function kontingenteAusMigration(): Map<string, number> {
  const sql = readFileSync(MIGRATION, 'utf8');
  const block = sql.slice(sql.indexOf('website.scan_monthly_limit') - 1200);
  const paare = new Map<string, number>();
  for (const m of block.matchAll(/\('([a-z_]+)',\s*(\d+)\)/g)) {
    paare.set(m[1], Number(m[2]));
  }
  return paare;
}

describe('Scan-Kontingente: Migration gegen shared/pricing.ts', () => {
  const ausMigration = kontingenteAusMigration();

  it('liest überhaupt Kontingente aus der Migration', () => {
    // Ohne diese Zusicherung wäre ein leeres Ergebnis stillschweigend grün —
    // genau die Sorte Test, die nichts prüft.
    expect(ausMigration.size).toBe(5);
  });

  it.each(['starter', 'growth', 'agency', 'enterprise', 'partner'])(
    'stimmt für %s mit auditReportsPerMonth überein',
    (planKey) => {
      const tier = PLANS.find((t) => t.planKey === planKey);
      expect(tier, `Plan ${planKey} fehlt in shared/pricing.ts`).toBeDefined();
      expect(ausMigration.get(planKey)).toBe(tier!.limits.auditReportsPerMonth);
    },
  );

  it('vergibt die Basis-Keys an alle fünf bezahlten Pläne', () => {
    // `dashboard.access` war der eigentliche Befund: Ohne diesen Key schickt
    // AdaptiveGovernanceNav einen zahlenden Kunden auf die Upgrade-Seite.
    const sql = readFileSync(MIGRATION, 'utf8');
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
