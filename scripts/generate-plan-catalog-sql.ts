#!/usr/bin/env tsx
/**
 * Erzeugt den SQL-Rumpf des Plan-Katalogs aus der Pricing-SSoT.
 *
 * Warum generiert statt handgeschrieben?
 *   Migrationen sind unveränderlich, sobald sie deployt sind. Der Katalog
 *   muss aber exakt den Werten aus `shared/pricing.ts` entsprechen. Dieses
 *   Skript erzeugt die INSERT-Anweisungen, sodass eine Preisänderung nicht
 *   von Hand nach SQL übertragen werden muss.
 *
 * Verwendung:
 *   npx tsx scripts/generate-plan-catalog-sql.ts          → nach stdout
 *   npx tsx scripts/generate-plan-catalog-sql.ts --check   → vergleicht gegen
 *       die aktuelle Katalog-Migration (wird selbst gefunden — ein fest
 *       verdrahteter Zeitstempel bricht, sobald die Migration umbenannt
 *       werden muss, etwa wegen einer Stempel-Kollision)
 *
 * Der Konsistenztest (`test/config/pricing-ssot.test.ts`) ruft
 * `buildPlanCatalogSql()` auf und prüft, dass die aktuelle Katalog-Migration
 * exakt diesen Block enthält. Weicht sie ab, ist eine neue Migration fällig.
 */

import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ORDERED_PLANS, ADDONS, allPlanKeys, type Plan } from '../shared/pricing';

/** Escaped einen String für ein SQL-Literal. */
function sqlString(value: string): string {
  return `'${value.replace(/'/g, "''")}'`;
}

/** Escaped ein Objekt als jsonb-Literal. */
function sqlJson(value: unknown): string {
  return `${sqlString(JSON.stringify(value))}::jsonb`;
}

function planRow(plan: Plan): string {
  const yearly = plan.price.yearlyEur;
  return `  (
    ${sqlString(plan.planKey)},
    ${sqlString(plan.id)},
    ${sqlString(plan.name)},
    ${sqlString(plan.outcomeHeadline)},
    ${sqlString(plan.technicalSubheadline)},
    ${plan.price.monthlyEur},
    ${yearly === null ? 'NULL' : yearly},
    ${sqlString(plan.currency)},
    ${sqlString(plan.purchaseMode)},
    ${plan.trialDays},
    ${plan.price.monthlyEur > 0},
    ${plan.limits.bots},
    ${plan.limits.answersPerMonth},
    ${sqlJson(plan.limits)},
    ${sqlJson(plan.modules)},
    ${sqlJson(plan.permissions)},
    ${sqlJson(plan.channels)},
    ${sqlJson(plan.addons)},
    ${sqlJson(plan.features)},
    ${sqlString(plan.support)}
  )`;
}

const CATALOG_BEGIN = '-- >>> GENERATED PLAN CATALOG (scripts/generate-plan-catalog-sql.ts) >>>';
const CATALOG_END = '-- <<< GENERATED PLAN CATALOG <<<';

export function buildPlanCatalogSql(): string {
  const lines: string[] = [];
  lines.push(CATALOG_BEGIN);
  lines.push('-- NICHT VON HAND BEARBEITEN. Quelle: shared/pricing.ts');
  lines.push('');
  lines.push('INSERT INTO public.plan_catalog (');
  lines.push('  plan_key, plan_id, name, outcome_headline, technical_subheadline,');
  lines.push('  price_monthly_eur, price_yearly_eur, currency, purchase_mode, trial_days,');
  lines.push('  recurring, max_bots, max_answers_per_month,');
  lines.push('  limits, modules, permissions, channels, addons, features, support');
  lines.push(') VALUES');
  lines.push(ORDERED_PLANS.map(planRow).join(',\n'));
  lines.push('ON CONFLICT (plan_key) DO UPDATE SET');
  for (const column of [
    'plan_id', 'name', 'outcome_headline', 'technical_subheadline',
    'price_monthly_eur', 'price_yearly_eur', 'currency', 'purchase_mode', 'trial_days',
    'recurring', 'max_bots', 'max_answers_per_month',
    'limits', 'modules', 'permissions', 'channels', 'addons', 'features', 'support',
  ]) {
    lines.push(`  ${column} = EXCLUDED.${column},`);
  }
  lines.push('  updated_at = now();');
  lines.push('');

  lines.push('INSERT INTO public.plan_addons (addon_id, name, description, price_eur, price_note, interval, available_for) VALUES');
  lines.push(ADDONS.map((addon) => `  (
    ${sqlString(addon.id)},
    ${sqlString(addon.name)},
    ${sqlString(addon.description)},
    ${addon.priceEur},
    ${sqlString(addon.priceNote)},
    ${sqlString(addon.interval)},
    ${sqlJson(addon.availableFor)}
  )`).join(',\n'));
  lines.push('ON CONFLICT (addon_id) DO UPDATE SET');
  for (const column of ['name', 'description', 'price_eur', 'price_note', 'interval', 'available_for']) {
    lines.push(`  ${column} = EXCLUDED.${column},`);
  }
  lines.push('  updated_at = now();');
  lines.push('');

  // Alles, was nicht mehr im Katalog steht, wird deaktiviert statt gelöscht —
  // bestehende Subscriptions referenzieren die Zeilen unter Umständen noch.
  const keys = allPlanKeys().map(sqlString).join(', ');
  lines.push(`UPDATE public.plan_catalog SET active = false, updated_at = now()`);
  lines.push(`  WHERE plan_key NOT IN (${keys});`);
  lines.push(CATALOG_END);
  return lines.join('\n');
}

/**
 * Findet die aktuelle Katalog-Migration. Bei mehreren gewinnt die mit dem
 * höchsten Zeitstempel — das ist die zuletzt erzeugte.
 */
function findCatalogMigration(): string | null {
  const dir = join(dirname(fileURLToPath(import.meta.url)), '..', 'supabase', 'migrations');
  const match = readdirSync(dir)
    .filter((f) => f.endsWith('_canonical_plan_catalog.sql'))
    .sort()
    .pop();
  return match ? join(dir, match) : null;
}

function main() {
  const checkIndex = process.argv.indexOf('--check');
  const sql = buildPlanCatalogSql();

  if (checkIndex >= 0) {
    const file = process.argv[checkIndex + 1] ?? findCatalogMigration();
    if (!file) {
      console.error('Keine *_canonical_plan_catalog.sql unter supabase/migrations gefunden.');
      process.exit(2);
    }
    const content = readFileSync(file, 'utf8');
    if (!content.includes(sql)) {
      console.error(`✗ ${file} entspricht nicht mehr shared/pricing.ts — neue Katalog-Migration erzeugen.`);
      process.exit(1);
    }
    console.log(`✓ ${file} ist synchron mit shared/pricing.ts`);
    return;
  }

  process.stdout.write(sql + '\n');
}

if (process.argv[1]?.endsWith('generate-plan-catalog-sql.ts')) {
  main();
}
