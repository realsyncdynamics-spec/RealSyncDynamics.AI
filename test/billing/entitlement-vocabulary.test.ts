import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

import {
  BOOKABLE_MODULES,
  ENTITLEMENT_KEYS,
  PLANS,
  PLAN_ENTITLEMENTS,
  planEntitlementValue,
  planGrants,
} from '../../shared/pricing';
import { isModuleActive, cheapestPlanFor } from '../../src/features/market/moduleCatalog';

/**
 * Das kanonische Entitlement-Vokabular (AP1).
 *
 * Der Zweck dieser Datei ist, dass es bei **einem** Vokabular bleibt. Vorher
 * standen drei nebeneinander, und keines war maßgeblich: autorisiert wurde
 * über die Entitlement-Keys der Datenbank, angezeigt über `plan.modules`.
 * Genau dort gingen sie auseinander.
 *
 * Geprüft wird gegen die Migrationen — nicht gegen eine Live-Datenbank, die
 * CI nicht erreichen kann.
 */

const MIGRATIONEN = join('supabase', 'migrations');

/** Alle Keys, die irgendeine Migration in `entitlements` anlegt. */
function keysAusMigrationen(): Set<string> {
  const gefunden = new Set<string>();
  for (const datei of readdirSync(MIGRATIONEN)) {
    if (!datei.endsWith('.sql')) continue;
    const sql = readFileSync(join(MIGRATIONEN, datei), 'utf8');
    if (!sql.includes('public.entitlements') && !sql.includes('into entitlements')) continue;
    // Keys stehen als erstes Element einer VALUES-Zeile: ('key', 'text', 'kind')
    for (const m of sql.matchAll(/\(\s*'([a-z][a-z0-9_.-]*\.[a-z0-9_.-]+)'\s*,/gi)) {
      gefunden.add(m[1]);
    }
  }
  return gefunden;
}

describe('Ein Vokabular — keine Dubletten, keine Erfindungen', () => {
  it('führt jeden Key genau einmal', () => {
    const gesehen = new Set(ENTITLEMENT_KEYS);
    expect(gesehen.size).toBe(ENTITLEMENT_KEYS.length);
  });

  it('hält die Liste alphabetisch, damit Diffs klein bleiben', () => {
    const sortiert = [...ENTITLEMENT_KEYS].sort();
    expect([...ENTITLEMENT_KEYS]).toEqual(sortiert);
  });

  it('kennt jeden in PLAN_ENTITLEMENTS verwendeten Key', () => {
    const bekannt = new Set<string>(ENTITLEMENT_KEYS);
    for (const [plan, satz] of Object.entries(PLAN_ENTITLEMENTS)) {
      for (const key of Object.keys(satz)) {
        expect(bekannt.has(key), `${plan} nennt unbekannten Key ${key}`).toBe(true);
      }
    }
  });

  it('erfindet keinen Key, den keine Migration anlegt', () => {
    // Das ist die Bindung an die Datenbank: Ein Key in der Preis-Quelle, den
    // keine Migration erzeugt, existiert zur Laufzeit nicht — die Oberfläche
    // würde etwas anzeigen, das der Server nie gewährt.
    const ausMigrationen = keysAusMigrationen();
    const fehlend = ENTITLEMENT_KEYS.filter((k) => !ausMigrationen.has(k));
    expect(fehlend, `Keys ohne Migration: ${fehlend.join(', ')}`).toEqual([]);
  });
});

describe('Die fünf neuen Keys sind wirklich neu', () => {
  const NEU = [
    'bots.human_handoff',
    'bots.multi_channel',
    'policy.nis2',
    'policy.iso27001',
    'governance.risk_register',
  ] as const;

  const migration = readFileSync(
    join(MIGRATIONEN, '20260830000000_canonical_entitlement_vocabulary.sql'),
    'utf8',
  );

  it.each(NEU)('%s wird angelegt und zugeordnet', (key) => {
    expect(migration).toContain(`'${key}'`);
  });

  /**
   * Die Gegenprobe zur Dublettengefahr: Drei Keys, die der Plan als „neu"
   * geführt hatte, existierten längst. `channel.whatsapp` wäre eine Dublette
   * zu `bots.whatsapp` geworden, `bots.website_chat` eine zu `bots.chat`,
   * `booking.enabled` eine zu `bots.appointments`.
   */
  it.each([
    ['channel.whatsapp', 'bots.whatsapp'],
    ['bots.website_chat', 'bots.chat'],
    ['booking.enabled', 'bots.appointments'],
  ])('legt %s nicht an — %s deckt es ab', (dublette, vorhanden) => {
    expect(ENTITLEMENT_KEYS).not.toContain(dublette);
    expect(ENTITLEMENT_KEYS).toContain(vorhanden);
  });
});

describe('unlocks sprechen dasselbe Vokabular', () => {
  it('nennt in jedem Modul nur bekannte Entitlement-Keys', () => {
    const bekannt = new Set<string>(ENTITLEMENT_KEYS);
    for (const modul of BOOKABLE_MODULES) {
      for (const key of modul.unlocks) {
        expect(bekannt.has(key), `${modul.id} nennt unbekannten Key ${key}`).toBe(true);
      }
    }
  });

  it('nennt keine ModuleId mehr', () => {
    // Ein zurückkehrendes `audit_center` oder `ai_bots` wäre der Rückfall in
    // das zweite Vokabular. Entitlement-Keys tragen immer einen Punkt.
    for (const modul of BOOKABLE_MODULES) {
      for (const key of modul.unlocks) {
        expect(key, `${modul.id}: ${key} sieht nach ModuleId aus`).toContain('.');
      }
    }
  });
});

describe('planGrants — dieselbe Regel wie der serverseitige Wächter', () => {
  it('wertet -1 als gewährt', () => {
    // `website.scan_monthly_limit` steht seit 20260828000000 auf -1.
    expect(planEntitlementValue('starter', 'website.scan_monthly_limit')).toBe(-1);
    expect(planGrants('starter', 'website.scan_monthly_limit')).toBe(true);
  });

  it('wertet 0 als nicht gewährt', () => {
    expect(planEntitlementValue('free_audit', 'reports.export')).toBe(0);
    expect(planGrants('free_audit', 'reports.export')).toBe(false);
  });

  it('unterscheidet „nicht enthalten" von „auf null gesetzt"', () => {
    expect(planEntitlementValue('starter', 'sso.enabled')).toBeNull();
    expect(planEntitlementValue('free_audit', 'reports.export')).toBe(0);
  });

  it('beantwortet PlanId und planKey gleich', () => {
    // Die Oberfläche übergibt `free`, die Datenbank `free_audit`. Ein
    // Unterschied hier hieße: derselbe Kunde sieht je nach Aufrufweg etwas
    // anderes.
    for (const key of ['dashboard.access', 'website.scan'] as const) {
      expect(planGrants('free', key)).toBe(planGrants('free_audit', key));
    }
  });

  it('führt Jahresvarianten auf ihren Basisplan zurück', () => {
    expect(planGrants('growth_yearly', 'monitoring.daily')).toBe(
      planGrants('growth', 'monitoring.daily'),
    );
  });

  it('gibt für unbekannte Pläne null statt zu raten', () => {
    expect(planEntitlementValue('gibt-es-nicht', 'website.scan')).toBeNull();
    expect(planGrants(null, 'website.scan')).toBe(false);
  });
});

describe('Der Marketplace bleibt nachvollziehbar', () => {
  /**
   * Das gemessene Verhalten nach der Umstellung. Drei Einträge haben sich
   * gegenüber vorher geändert — alle drei sind Korrekturen, weil die alte
   * Antwort aus `plan.modules` kam und die Datenbank etwas anderes sagte:
   *
   *   governance_core  ab Growth  → ab Agency  (`policy.packs` fehlt Growth)
   *   website_chat     ab Starter → ab Growth  (`bots.enabled` fehlt Starter)
   *   booking          nie        → ab Growth  (hatte gar keine `unlocks`)
   */
  it.each([
    ['governance_core', 'agency'],
    ['website_chat', 'growth'],
    ['voice_bot', 'agency'],
    ['whatsapp_bot', 'growth'],
    ['booking', 'growth'],
    ['advanced_ai_governance', 'agency'],
    ['additional_company', 'growth'],
    ['ai_frontend', null],
    ['additional_domain', null],
  ])('%s wird ab %s freigeschaltet', (modulId, erwartet) => {
    const modul = BOOKABLE_MODULES.find((m) => m.id === modulId)!;
    expect(cheapestPlanFor(modul)).toBe(erwartet);
  });

  it('hält ein Modul ohne Keys nie für aktiv', () => {
    const ohne = BOOKABLE_MODULES.find((m) => m.unlocks.length === 0)!;
    for (const plan of PLANS) {
      expect(isModuleActive(plan.planKey, ohne)).toBe(false);
    }
  });
});
