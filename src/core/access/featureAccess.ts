/**
 * Das Zugriffsregister des Dashboards — eine Quelle für „welche Route
 * braucht welchen Entitlement-Key".
 *
 * ## Warum es diese Datei gibt
 *
 * Gemessen am 2026-09-01: 122 Routen unter `/app`, davon 10 mit einem
 * Entitlement-Gate in der View, ~110 ohne — und vier Vokabulare, die
 * gleichzeitig über Zugriff entschieden (`plan.modules` in der Navigation,
 * Entitlement-Keys in einigen Views, `FeatureKey` in zwei Übersetzungs-
 * tabellen, `bot.capabilities` als Kundenflag). Dieselbe Fläche war an
 * verschiedenen Stellen auf verschiedene Keys gegated: `/app/workflows`
 * in der Navigation über das Modul `workflows`, in der View über
 * `ai.tool.workflows`.
 *
 * Seit AP1 ist der Entitlement-Key das einzige Vokabular, das zur Laufzeit
 * autorisiert. Dieses Register bindet die Routen daran. Gelesen wird es von
 * `RouteEntitlementGate` in der `GovernanceBrowserShell` — damit greift ein
 * Gate für jede Route, die die Shell rendert, ohne dass jede View selbst
 * daran denken muss.
 *
 * ## Regeln
 *
 * - Ein Key hier muss in `ENTITLEMENT_KEYS` stehen und von mindestens einem
 *   wählbaren Plan gewährt werden (`test/core/feature-access.test.ts`) —
 *   sonst sperrt das Register etwas, das niemand kaufen kann.
 * - Kein Gate gegen ein Kontingent, das zwischen `plan.limits` und
 *   `PLAN_ENTITLEMENTS` divergiert (CLAUDE.md §7, `check:limits`). Hier
 *   stehen deshalb nur boolesche Keys.
 * - Freie Flächen (Free Audit) stehen NICHT hier: Übersicht, Websites,
 *   Evidence (Basis), Berichte, KI-Register, Marketplace, Billing, Team,
 *   Einstellungen. Was der Free-Plan enthält, wird nicht gegated.
 * - Das Gate ist eine UX-Affordance mit Upgrade-Pfad. Die Durchsetzung
 *   bleibt serverseitig (`_shared/entitlements.ts`).
 */
import {
  ADDONS,
  ENTITLEMENT_KEYS,
  PLAN_ORDER,
  addonGrantedKeys,
  isPlanSelectable,
  planGrants,
  type AddOn,
  type EntitlementKey,
  type PlanId,
} from '@/shared/pricing';

export interface FeatureRequirement {
  /** Routen-Präfix unter `/app`; gilt für alle Unterpfade auf Segmentgrenze. */
  route: string;
  /** Name der Fläche für den Sperrhinweis. */
  label: string;
  /** Jeder dieser Keys muss gewährt sein. */
  allOf: readonly EntitlementKey[];
}

/**
 * Speziellere Präfixe gewinnen (`/app/bots/whatsapp` vor `/app/bots`) —
 * die Reihenfolge hier ist deshalb unerheblich, `requirementForPath()`
 * wählt den längsten Treffer.
 */
export const APP_FEATURE_ACCESS: readonly FeatureRequirement[] = [
  // ── Engage ──────────────────────────────────────────────────────────────
  { route: '/app/bots', label: 'Governance-Bots', allOf: ['bots.enabled'] },
  { route: '/app/bots/whatsapp', label: 'WhatsApp-Kanal', allOf: ['bots.whatsapp'] },
  { route: '/app/agents/susi', label: 'Telefon-Agent', allOf: ['bots.voice'] },
  { route: '/app/webhooks', label: 'Webhooks', allOf: ['webhooks.enabled'] },
  { route: '/app/governance/api-keys', label: 'API-Schlüssel', allOf: ['api.access'] },

  // ── Automate ────────────────────────────────────────────────────────────
  { route: '/app/workflows', label: 'Workflows', allOf: ['ai.tool.workflows'] },
  { route: '/app/automations', label: 'Automationen', allOf: ['ai.tool.automations'] },
  { route: '/app/scheduler', label: 'Scheduler', allOf: ['scheduler.enabled'] },
  { route: '/app/bulk', label: 'Bulk-Jobs', allOf: ['bulk.jobs'] },
  { route: '/app/governance/bulk-operations', label: 'Bulk-Operationen', allOf: ['bulk.jobs'] },
  { route: '/app/alerts', label: 'Alerts', allOf: ['alerts.email'] },
  { route: '/app/remediation', label: 'Behebungspläne', allOf: ['fix.snippets'] },
  { route: '/app/governance/remediation-plans', label: 'Behebungspläne', allOf: ['fix.snippets'] },
  { route: '/app/terminal', label: 'Kodee', allOf: ['ai.tool.vps_status'] },

  // ── Govern ──────────────────────────────────────────────────────────────
  { route: '/app/monitoring', label: 'Monitoring', allOf: ['monitoring.monthly'] },
  { route: '/app/security-signals', label: 'Security Signals', allOf: ['monitoring.monthly'] },
  { route: '/app/risks', label: 'Risikoregister', allOf: ['governance.risk_register'] },
  { route: '/app/risk-inventory', label: 'Risikoinventar', allOf: ['governance.risk_register'] },
  { route: '/app/policy-packs', label: 'Policy Packs', allOf: ['policy.packs'] },
  { route: '/app/vendors', label: 'Dienstleister', allOf: ['policy.packs'] },
  { route: '/app/dpia', label: 'Datenschutz-Folgenabschätzung', allOf: ['policy.packs'] },
  { route: '/app/evidence-vault', label: 'Evidence Vault (erweitert)', allOf: ['evidence.advanced'] },
  { route: '/app/governance/evidence-vault-advanced', label: 'Evidence Vault (erweitert)', allOf: ['evidence.advanced'] },
  { route: '/app/governance/nis2-incidents', label: 'NIS2-Meldungen', allOf: ['policy.nis2'] },
  { route: '/app/governance/iso27001', label: 'ISO 27001', allOf: ['policy.iso27001'] },
  { route: '/app/governance/iso-control-library', label: 'ISO-Kontrollbibliothek', allOf: ['policy.iso27001'] },
];

function matchesPrefix(pathname: string, route: string): boolean {
  return pathname === route || pathname.startsWith(`${route}/`);
}

/** Längster passender Präfix — oder `null`, wenn die Route frei ist. */
export function requirementForPath(pathname: string): FeatureRequirement | null {
  let best: FeatureRequirement | null = null;
  for (const req of APP_FEATURE_ACCESS) {
    if (!matchesPrefix(pathname, req.route)) continue;
    if (!best || req.route.length > best.route.length) best = req;
  }
  return best;
}

export interface AccessDecision {
  allowed: boolean;
  missing: EntitlementKey[];
}

/** Entscheidung gegen die wirksamen Entitlements des Mandanten. */
export function decideAccess(
  requirement: FeatureRequirement,
  hasFeature: (key: string) => boolean,
): AccessDecision {
  const missing = requirement.allOf.filter((key) => !hasFeature(key));
  return { allowed: missing.length === 0, missing };
}

/** Günstigster wählbarer Plan, der alle Keys gewährt — `null`, wenn keiner. */
export function cheapestPlanForKeys(keys: readonly EntitlementKey[]): PlanId | null {
  for (const planId of PLAN_ORDER) {
    if (!isPlanSelectable(planId)) continue;
    if (keys.every((key) => planGrants(planId, key))) return planId;
  }
  return null;
}

/** Add-ons, die alle fehlenden Keys mitbringen — der zweite Weg neben dem Plan. */
export function addonsCovering(keys: readonly EntitlementKey[]): AddOn[] {
  if (keys.length === 0) return [];
  return ADDONS.filter((addon) => {
    const bringt = new Set<string>(addonGrantedKeys(addon));
    return keys.every((key) => bringt.has(key));
  });
}

/** Jeder Key des Registers ist bekannt — Sicherung für den Test. */
export function unknownRegistryKeys(): string[] {
  const bekannt = new Set<string>(ENTITLEMENT_KEYS);
  const unbekannt: string[] = [];
  for (const req of APP_FEATURE_ACCESS) {
    for (const key of req.allOf) if (!bekannt.has(key)) unbekannt.push(key);
  }
  return unbekannt;
}
