import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import {
  ADDONS,
  BOOKABLE_MODULES,
  LEGACY_PLANS,
  MODULE_ADDON_PRICE_DIVERGENCE,
  PLANS,
  PLAN_ENTITLEMENTS,
  PLAN_ORDER,
  SALES_PLANS,
  SELF_SERVICE_PLANS,
  addonsFor,
  isPlanSelectable,
  planById,
  planGrants,
} from '../../shared/pricing';

/**
 * AP2 — Paketumbau auf drei Self-Service-Stufen.
 *
 * Die teuerste Art, ein Paketmodell umzubauen, ist, dabei unbemerkt etwas
 * wegzunehmen. Diese Datei prüft deshalb vor allem, was **nicht** passiert
 * sein darf: Kein Plan verliert eine Berechtigung, kein Bestandskunde
 * verliert ein Add-on, und die stillgelegten Pläne bleiben vollständig
 * funktionsfähig.
 */

/**
 * Der gemessene Stand **vor** AP2, aus der Datenbank nach allen Migrationen
 * bis 20260830000000. Er ist die Referenz für „nichts geht verloren".
 *
 * Bewusst als vollständige Liste und nicht als Anzahl: Eine Anzahl bliebe
 * gleich, wenn ein Key gegen einen anderen getauscht würde.
 */
const VOR_AP2: Readonly<Record<string, readonly string[]>> = {
  starter: [
    'ai.tool.automations', 'alerts.email', 'asset.verify', 'compliance.export',
    'dashboard.access', 'dse.generator', 'evidence.basic_vault',
    'governance.ai_register', 'governance.dsgvo_directory',
    'limit.agent_runs_monthly', 'limit.automation_runs_monthly',
    'limit.compliance_exports_monthly', 'limit.domains',
    'limit.llm_queries_monthly', 'limit.team_seats', 'monitoring.monthly',
    'website.scan', 'website.scan_monthly_limit',
  ],
  growth: [
    'ai.tool.automations', 'ai.tool.bot_reply', 'alerts.email', 'asset.register',
    'asset.verify', 'bots.appointments', 'bots.chat', 'bots.enabled',
    'bots.multi_channel', 'bots.orders', 'bots.whatsapp', 'compliance.export',
    'dashboard.access', 'dse.generator', 'evidence.basic_vault', 'fix.snippets',
    'governance.ai_register', 'governance.dsgvo_directory',
    'governance.risk_register', 'limit.ai_calls_monthly',
    'limit.ai_cost_monthly_cents', 'limit.ai_tokens_monthly',
    'limit.api_calls_monthly', 'limit.automation_runs_monthly',
    'limit.bot_messages_monthly', 'limit.bots',
    'limit.compliance_exports_monthly', 'limit.domains',
    'limit.llm_queries_monthly', 'limit.team_seats',
    'limit.whatsapp_conversations_monthly', 'monitoring.daily',
    'monitoring.drift', 'monitoring.monthly', 'policy.iso27001', 'team.members',
    'website.scan', 'website.scan_monthly_limit',
  ],
};

/** Was AP2 hinzufügt — und nur das. */
const NEU_DURCH_AP2: Readonly<Record<string, readonly string[]>> = {
  starter: [
    'bots.chat', 'bots.enabled', 'limit.bot_messages_monthly', 'limit.bots',
    'policy.packs',
  ],
  growth: [
    'api.access', 'bulk.jobs', 'c2pa.export', 'evidence.advanced',
    'limit.bulk_jobs_monthly', 'policy.packs', 'provenance.advanced',
    'scheduler.enabled', 'webhooks.enabled',
  ],
};

describe('AP2 nimmt keinem Plan etwas weg', () => {
  it.each(Object.keys(VOR_AP2))('%s behält jeden Key von vorher', (plan) => {
    const jetzt = new Set(Object.keys(PLAN_ENTITLEMENTS[plan]));
    const verloren = VOR_AP2[plan].filter((key) => !jetzt.has(key));
    expect(verloren, `${plan} hat verloren: ${verloren.join(', ')}`).toEqual([]);
  });

  it.each(Object.keys(VOR_AP2))('%s bekommt genau die geplanten Keys dazu', (plan) => {
    const vorher = new Set(VOR_AP2[plan]);
    const dazu = Object.keys(PLAN_ENTITLEMENTS[plan]).filter((k) => !vorher.has(k)).sort();
    expect(dazu).toEqual([...NEU_DURCH_AP2[plan]].sort());
  });

  it('lässt Agency, Enterprise und Partner unangetastet', () => {
    // AP2 hängt nur um, es hängt nichts ab. Die oberen Pläne trugen alle
    // betroffenen Keys bereits — hier darf sich deshalb nichts bewegt haben.
    for (const plan of ['agency', 'enterprise', 'partner']) {
      for (const key of [...NEU_DURCH_AP2.starter, ...NEU_DURCH_AP2.growth]) {
        if (key.startsWith('limit.')) continue; // Kontingente sind planabhängig
        expect(
          planGrants(plan, key as never),
          `${plan} sollte ${key} weiterhin tragen`,
        ).toBe(true);
      }
    }
  });
});

describe('Die beiden Widersprüche aus AP1 sind an der Wurzel behoben', () => {
  it('gewährt policy.packs jedem bezahlten Plan', () => {
    // Der Befund aus zielzustand-paketmodell.md §1.2: Eine
    // Governance-Plattform, deren Kern die Policy Packs sind, gewährte sie
    // erst ab der vierten Stufe.
    for (const plan of ['starter', 'growth', 'agency', 'enterprise', 'partner']) {
      expect(planGrants(plan, 'policy.packs'), plan).toBe(true);
    }
    // Free bleibt außen vor — dort gibt es keine Überwachung und keine Packs.
    expect(planGrants('free_audit', 'policy.packs')).toBe(false);
  });

  it('gibt Starter den Bot, den sein Plan seit jeher verspricht', () => {
    const starter = planById('starter');
    expect(starter.limits.bots).toBe(1);
    expect(starter.limits.answersPerMonth).toBe(500);
    expect(starter.channels).toContain('website');

    expect(planGrants('starter', 'bots.enabled')).toBe(true);
    expect(planGrants('starter', 'bots.chat')).toBe(true);
    // Die Kontingente sind nicht neu gewählt, sondern aus `plan.limits`
    // übernommen — sonst entstünde genau die Lücke wieder, die AP1 fand.
    expect(PLAN_ENTITLEMENTS.starter['limit.bots']).toBe(starter.limits.bots);
    expect(PLAN_ENTITLEMENTS.starter['limit.bot_messages_monthly']).toBe(
      starter.limits.answersPerMonth,
    );
  });
});

describe('Berechtigungen und Entitlements sagen dasselbe', () => {
  /**
   * Der Fehler, den AP1 gefunden hat, war eine zweite Definition dessen,
   * was ein Plan enthält. `plan.permissions` ist die dritte. Solange es sie
   * gibt, muss sie mit den Entitlements übereinstimmen — sonst zeigt die
   * Oberfläche wieder etwas anderes an, als der Server zulässt.
   */
  const PAARE = [
    ['api', 'api.access'],
    ['webhooks', 'webhooks.enabled'],
    ['scheduler', 'scheduler.enabled'],
    ['bulkOperations', 'bulk.jobs'],
    ['provenanceSigning', 'provenance.advanced'],
    ['whiteLabelReports', 'whitelabel.reports'],
    ['whiteLabelDashboard', 'whitelabel.dashboard'],
    ['sso', 'sso.enabled'],
  ] as const;

  it.each(PAARE)('%s deckt sich mit %s über alle verkauften Pläne', (permission, key) => {
    for (const plan of PLANS) {
      // `governance_launch` ist ein Einmalprodukt und steht nicht auf der
      // Leiter; sein Berechtigungssatz wird separat gepflegt.
      if (plan.id === 'governance_launch') continue;
      // Stillgelegte Pläne sind eingefroren — siehe den Befund unten.
      if (plan.availability === 'legacy') continue;
      expect(
        planGrants(plan.planKey, key),
        `${plan.id}: permissions.${permission}=${plan.permissions[permission]}, ${key}=${planGrants(plan.planKey, key)}`,
      ).toBe(plan.permissions[permission]);
    }
  });

  /**
   * Ein Befund, den diese Prüfung ans Licht gebracht hat — festgehalten,
   * statt stillschweigend behoben.
   *
   * **Partner verspricht SSO, bekommt es aber nicht.** `permissions.sso` ist
   * dort `true`, `sso.enabled` liegt in der Datenbank nur auf Enterprise.
   * Das ist älter als AP2 und liegt außerhalb des freigegebenen Umfangs;
   * Partner ist seit AP2 zudem stillgelegt. Der Fall steht hier, damit die
   * nächste Sitzung ihn als bekannt und nicht als neu erkennt.
   *
   * Fällt dieser Test, ist die Lücke geschlossen worden — dann gehört der
   * Block hier weg und `partner` zurück in die Prüfung oben.
   */
  it('hält den bekannten SSO-Widerspruch auf Partner fest', () => {
    expect(planById('partner').permissions.sso).toBe(true);
    expect(planGrants('partner', 'sso.enabled')).toBe(false);
  });
});

describe('Agency und Partner sind stillgelegt, nicht gelöscht', () => {
  it('führt genau zwei stillgelegte Pläne', () => {
    expect(LEGACY_PLANS.map((p) => p.id)).toEqual(['agency', 'partner']);
  });

  it('behält sie in PLAN_ORDER, damit Ränge für Bestandskunden stimmen', () => {
    // Ein Agency-Kunde muss weiterhin als „höher als Growth" gelten.
    // Verschwände Agency aus der Leiter, ergäbe jeder Rangvergleich für ihn
    // eine falsche Antwort.
    expect(PLAN_ORDER).toContain('agency');
    expect(PLAN_ORDER).toContain('partner');
  });

  it('lässt ihre Add-on-Listen unverändert', () => {
    // `addonsFor()` liest `plan.addons`. Ein Bestandskunde darf kein Add-on
    // verlieren, nur weil sein Plan nicht mehr verkauft wird.
    for (const plan of LEGACY_PLANS) {
      expect(addonsFor(plan.id).length, plan.id).toBeGreaterThan(0);
    }
  });

  it('nimmt sie aus jedem Verkaufs-Listing heraus', () => {
    for (const plan of [...SALES_PLANS, ...SELF_SERVICE_PLANS]) {
      expect(plan.availability, plan.id).not.toBe('legacy');
    }
    expect(isPlanSelectable('agency')).toBe(false);
    expect(isPlanSelectable('partner')).toBe(false);
  });

  it('lässt Enterprise sichtbar, aber nur über den Vertrieb', () => {
    const enterprise = planById('enterprise');
    expect(enterprise.availability).toBe('contract');
    expect(enterprise.purchaseMode).toBe('inquiry');
    expect(SALES_PLANS.map((p) => p.id)).toContain('enterprise');
    expect(SELF_SERVICE_PLANS.map((p) => p.id)).not.toContain('enterprise');
  });

  it('lässt genau drei Stufen im Self-Service', () => {
    expect(SELF_SERVICE_PLANS.map((p) => p.id)).toEqual(['free', 'starter', 'growth']);
  });

  /**
   * Die Stilllegung muss eine Regel sein, keine Anzeigeentscheidung.
   *
   * Agency behält `purchaseMode: 'checkout'` — seine laufenden Abos rechnen
   * unverändert ab. Genau deshalb wäre der Plan über eine getippte URL oder
   * einen selbst gebauten Request weiterhin käuflich, wenn ihn nur die
   * Oberfläche versteckte. `stripe-checkout` weist ihn deshalb serverseitig
   * ab (`PLAN_RETIRED`), und `CheckoutPage` leitet vorher um.
   */
  it('hält den Kaufmodus stillgelegter Pläne, sperrt aber den Neukauf', () => {
    const agency = planById('agency');
    expect(agency.purchaseMode).toBe('checkout');
    expect(agency.availability).toBe('legacy');

    const wächter = readFileSync(
      join('supabase', 'functions', 'stripe-checkout', 'index.ts'),
      'utf8',
    );
    expect(wächter).toContain("plan.availability === 'legacy'");
    expect(wächter).toContain('PLAN_RETIRED');

    const seite = readFileSync(
      join('src', 'features', 'billing', 'CheckoutPage.tsx'),
      'utf8',
    );
    expect(seite).toContain("plan.availability === 'legacy'");
  });
});

describe('WhatsApp — ein Preis, und für den richtigen Plan', () => {
  const whatsapp = ADDONS.find((a) => a.id === 'whatsapp')!;

  it('kostet 99 € und ist für Starter buchbar', () => {
    expect(whatsapp.priceEur).toBe(99);
    expect(whatsapp.availableFor).toEqual(['starter']);
    expect(addonsFor('starter').map((a) => a.id)).toContain('whatsapp');
  });

  it('wird Plänen, die den Kanal enthalten, nicht mehr verkauft', () => {
    // Der Widerspruch aus §3.2: Growth *enthält* WhatsApp und bekam das
    // Add-on trotzdem angeboten.
    for (const plan of ['growth', 'enterprise']) {
      expect(planById(plan as never).channels).toContain('whatsapp');
      expect(addonsFor(plan).map((a) => a.id), plan).not.toContain('whatsapp');
    }
  });

  it('nennt im Marketplace denselben Betrag wie das Add-on', () => {
    // Vor AP2 standen 39 € im Marketplace gegen 99 € im Add-on. Zwei Preise
    // für denselben Kanal — die Abweichung war benannt, aber nicht behoben.
    const modul = BOOKABLE_MODULES.find((m) => m.id === 'whatsapp_bot')!;
    expect(modul.priceEur).toBe(whatsapp.priceEur);
    expect(MODULE_ADDON_PRICE_DIVERGENCE).not.toContain('whatsapp_bot');
  });
});

describe('Die Migration deckt sich mit der Quelle', () => {
  const migration = readFileSync(
    join('supabase', 'migrations', '20260831000000_ap2_package_model.sql'),
    'utf8',
  );

  it.each([...NEU_DURCH_AP2.starter, ...NEU_DURCH_AP2.growth])(
    'vergibt %s auch in SQL',
    (key) => {
      expect(migration).toContain(`'${key}'`);
    },
  );

  it('legt keinen neuen Entitlement-Key an', () => {
    // AP2 verteilt um. Entstünde hier ein Key, wäre das eine
    // Leistungserweiterung unter falscher Flagge.
    expect(migration).not.toMatch(/INSERT INTO public\.entitlements/i);
  });

  it('löscht nichts', () => {
    // Nur Anweisungen zählen, nicht das Wort im Kommentar — die Migration
    // erklärt selbst, warum sie kein DELETE enthält.
    const anweisungen = migration
      .split('\n')
      .filter((zeile) => !zeile.trimStart().startsWith('--'))
      .join('\n');
    expect(anweisungen).not.toMatch(/\bDELETE\s+FROM\b/i);
    expect(anweisungen).not.toMatch(/\bDROP\s+(TABLE|COLUMN|FUNCTION|POLICY)\b/i);
  });

  it('legt Agency und Partner still, statt sie zu entfernen', () => {
    expect(migration).toContain("SET active = false");
    expect(migration).toContain("'agency'");
    expect(migration).toContain("'partner'");
  });
});
