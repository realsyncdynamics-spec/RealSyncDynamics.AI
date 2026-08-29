/**
 * Frontend-Sicht auf die Pricing-SSoT.
 *
 * ⚠️  Diese Datei enthält KEINE eigenen Preise, Limits oder Feature-Listen.
 *     Sie leitet alles aus `shared/pricing.ts` ab und ergänzt ausschließlich
 *     darstellungsbezogene Dinge (Tailwind-Klassen, Anzeige-Strings).
 *
 *     Neue Konsumenten sollten direkt aus `@/shared/pricing` importieren.
 *     Die Typen `PricingTier` / `TierId` bestehen als Adapter für die
 *     bestehenden Oberflächen fort — sie sind Projektionen, keine Quelle.
 *
 * Konsumenten: PricingPage, PricingTeaserSection, PlanSelector, BillingView,
 * CheckoutPage, GovernanceTierGate, CostCalculator, index.html JSON-LD.
 */

import {
  PLANS,
  ORDERED_PLANS,
  ONE_TIME_PLANS,
  PLAN_ORDER,
  planById,
  planByKey,
  normalizePlanKey,
  planKeyFor,
  checkoutHrefForPlan,
  formatPriceEur,
  formatLimit,
  addonsFor,
  ADDONS,
  type Plan,
  type PlanId,
  type PlanKey,
  type ChannelId,
  type AddOn,
  type AddOnId,
  type FeatureGroupId,
  type PlanFeatureMatrix,
} from '@/shared/pricing';

// Alles aus der SSoT bleibt über diese Datei erreichbar, damit Oberflächen
// nicht zwischen zwei Import-Pfaden wählen müssen.
export * from '@/shared/pricing';

// ─────────────────────────────────────────────────────────────────────────
//  Adapter-Typen für bestehende Oberflächen
// ─────────────────────────────────────────────────────────────────────────

/**
 * Tier-ID inklusive Jahresvarianten.
 *
 * Hinweis: `scale` existiert nicht mehr. Der Plan heißt `partner`.
 * Eingehende Altdaten werden über `normalizePlanKey()` abgebildet.
 */
export type TierId =
  | PlanId
  | 'starter_yearly'
  | 'growth_yearly'
  | 'agency_yearly'
  | 'enterprise_yearly'
  | 'partner_yearly';

/** Kanal-Typ — Alias auf die SSoT, damit alte Importe weiter funktionieren. */
export type BotChannelType = ChannelId;

export interface GovernanceBotsQuota {
  maxBots: number;
  maxAnswersPerMonth: number;
  channels: BotChannelType[];
  capabilities: string[];
}

/**
 * Projektion eines Plans auf das Karten-Format der Pricing-Oberflächen.
 * Jedes Feld wird aus der SSoT berechnet — nichts davon ist eigenständig
 * gepflegt.
 */
export interface PricingTier {
  id: TierId;
  name: string;
  planKey: PlanKey;
  /** Referenz auf den zugrundeliegenden Plan der SSoT */
  plan: Plan;
  priceEur: number;
  /** Formatierter Betrag ohne Währungszeichen, z.B. "1.999" */
  priceString: string;
  /** "/ Monat", "/ Jahr" oder "einmalig · kein Account" */
  priceSuffix: string;
  recurring: boolean;
  /** Ergebnis-orientierte Headline */
  tagline: string;
  /** Technische Subheadline */
  subline: string;
  /** Flache Feature-Liste (aus den vier Gruppen zusammengeführt) */
  bullets: string[];
  /** Features nach den vier verbindlichen Gruppen */
  featureGroups: PlanFeatureMatrix;
  badges: string[];
  highlight: boolean;
  cta: { label: string; href: string };
  botsQuota: GovernanceBotsQuota;
  isYearly: boolean;
}

// ─────────────────────────────────────────────────────────────────────────
//  Projektion
// ─────────────────────────────────────────────────────────────────────────

/**
 * Bot-Fähigkeiten aus Modulen und Berechtigungen ableiten, statt sie je
 * Plan erneut aufzuschreiben. So kann die Liste nicht von den tatsächlich
 * freigeschalteten Modulen abweichen.
 */
function capabilitiesFor(plan: Plan): string[] {
  if (plan.limits.bots === 0) return [];
  const caps = ['AI-Act-Transparenzhinweis', 'Antwort-Logging'];
  if (plan.modules.includes('risk_register')) caps.push('Risiko-Tags & Compliance-Flags');
  if (plan.modules.includes('workflows')) caps.push('Terminbuchung & Fallbearbeitung');
  if (plan.modules.includes('human_handoff')) caps.push('Human Handoff mit Eskalation');
  if (plan.permissions.auditExport) caps.push('Evidence-Export');
  if (plan.permissions.whiteLabelReports) caps.push('Bot-White-Label');
  if (plan.permissions.multiTenant) caps.push('Mandanten-Isolation & Unterkonten');
  return caps;
}

function flattenFeatures(matrix: PlanFeatureMatrix): string[] {
  return [
    ...matrix.audit_evidence,
    ...matrix.ai_governance,
    ...matrix.automation_ops,
    ...matrix.multi_tenant_reseller,
  ];
}

function toTier(plan: Plan, interval: 'month' | 'year'): PricingTier {
  const isYearly = interval === 'year';
  const isOneTime = plan.purchaseMode === 'one_time';
  // Einmalprodukte führen ihren Betrag in `price.oneTimeEur`; `monthlyEur`
  // ist dort 0, weil nichts wiederkehrend abgerechnet wird. Der Betrag wird
  // hier aus der SSoT gelesen und NICHT als Literal gepflegt.
  const priceEur = isOneTime
    ? (plan.price.oneTimeEur ?? 0)
    : isYearly ? (plan.price.yearlyEur ?? 0) : plan.price.monthlyEur;
  const id = (isYearly ? `${plan.id}_yearly` : plan.id) as TierId;

  const priceSuffix = isOneTime
    ? 'einmalig'
    : plan.price.monthlyEur === 0
      ? 'einmalig · kein Account'
      : isYearly ? '/ Jahr' : '/ Monat';

  return {
    id,
    name: isYearly ? `${plan.name} (Jährlich)` : plan.name,
    planKey: planKeyFor(plan.id, interval),
    plan,
    priceEur,
    priceString: new Intl.NumberFormat('de-DE').format(priceEur),
    priceSuffix,
    // Free (0 €) und Einmalprodukte (Betrag in `oneTimeEur`) sind beide
    // nicht wiederkehrend. Abo-Oberflächen unterscheiden hierüber, ob ein
    // Tier ein laufendes Abo darstellt.
    recurring: plan.price.monthlyEur > 0,
    tagline: plan.outcomeHeadline,
    subline: plan.technicalSubheadline,
    bullets: flattenFeatures(plan.features),
    featureGroups: plan.features,
    badges: isYearly ? [...plan.badges, 'Zwei Monate sparen'] : [...plan.badges],
    highlight: plan.highlight,
    cta: {
      label: isYearly ? `${plan.ctaLabel} (jährlich)` : plan.ctaLabel,
      href: checkoutHrefForPlan(plan, { interval, source: 'pricing' }),
    },
    botsQuota: {
      maxBots: plan.limits.bots,
      maxAnswersPerMonth: plan.limits.answersPerMonth,
      channels: [...plan.channels],
      capabilities: capabilitiesFor(plan),
    },
    isYearly,
  };
}

/**
 * Alle Tiers: erst die sechs Monatspläne in kanonischer Reihenfolge, dann
 * die Einmalprodukte, danach die Jahresvarianten in derselben Reihenfolge.
 *
 * Einmalprodukte haben keine Jahresvariante — `interval` ist für sie
 * bedeutungslos und wird auf `'month'` gesetzt, weil `toTier()` den Betrag
 * ohnehin aus `price.oneTimeEur` liest.
 */
export const PRICING_TIERS: PricingTier[] = [
  ...ORDERED_PLANS.map((plan) => toTier(plan, 'month')),
  ...ONE_TIME_PLANS.map((plan) => toTier(plan, 'month')),
  ...ORDERED_PLANS.filter((plan) => plan.yearlyPlanKey !== null).map((plan) => toTier(plan, 'year')),
];

/**
 * Die fünf buchbaren Monats-ABOS (Starter … Partner) für Pricing-Grids.
 *
 * Bewusst OHNE Einmalprodukte. Diese Liste ist an vielen Stellen implizit
 * die Abo-Leiter: `PlanUpgradeModal` leitet Upgrade/Downgrade aus dem
 * `findIndex()` in dieser Reihenfolge ab, und mehrere Grids sind auf genau
 * fünf Karten ausgelegt. Ein Einmalprodukt hier hätte beides still
 * verfälscht — es wäre als „höher als Partner" gewertet worden.
 * Einmalprodukte stehen in `ONE_TIME_PRICING_TIERS`.
 */
export const PUBLIC_PRICING_TIERS: PricingTier[] = PRICING_TIERS.filter(
  (tier) => !tier.isYearly && tier.priceEur > 0 && tier.recurring,
);

/**
 * Die Monats-Abos, die einem Neukunden **angeboten** werden: Starter,
 * Growth und Enterprise.
 *
 * Der Unterschied zu `PUBLIC_PRICING_TIERS` ist keine Doppelung, sondern
 * eine Trennung von zwei Fragen, die seit AP2 verschiedene Antworten haben:
 *
 *   PUBLIC_PRICING_TIERS    „welche Ränge gibt es?"   — Rangvergleiche,
 *                            Upgrade/Downgrade, Nachschlagen des eigenen
 *                            Plans. Muss Agency und Partner enthalten,
 *                            sonst bekommt ein Bestandskunde dort falsche
 *                            Antworten.
 *   SELLABLE_PRICING_TIERS  „was kann man heute kaufen?" — jede Anzeige,
 *                            jede Auswahl, jedes Raster.
 *
 * Wer ein Raster rendert, nimmt diese Liste. Agency und Partner sind seit
 * AP2 stillgelegt; sie anzubieten hieße, in eine Sackgasse zu führen
 * (`CLAUDE.md` §14).
 */
export const SELLABLE_PRICING_TIERS: PricingTier[] = PUBLIC_PRICING_TIERS.filter(
  (tier) => tier.plan.availability !== 'legacy',
);

/**
 * Die Einmalprodukte (z.B. Governance Launch) — Käufe ohne Verlängerung.
 * Getrennt von der Abo-Leiter, damit Oberflächen bewusst entscheiden, ob
 * sie sie anzeigen, statt sie versehentlich als Abo-Rang zu behandeln.
 */
export const ONE_TIME_PRICING_TIERS: PricingTier[] = PRICING_TIERS.filter(
  (tier) => tier.plan.purchaseMode === 'one_time',
);

/** Alle Monats-Tiers inklusive Free — für Vergleichstabellen. */
export const MONTHLY_PRICING_TIERS: PricingTier[] = PRICING_TIERS.filter((tier) => !tier.isYearly);

/** Die Jahresvarianten. */
export const YEARLY_PRICING_TIERS: PricingTier[] = PRICING_TIERS.filter((tier) => tier.isYearly);

/** Lookup nach Tier-ID. */
export function tierById(id: TierId): PricingTier | undefined {
  return PRICING_TIERS.find((tier) => tier.id === id);
}

/**
 * Lookup nach beliebigem Plan-Key — inklusive Altdaten wie `scale`.
 * Liefert die Monatsvariante, sofern der Key keine Jahresvariante ist.
 */
export function tierByPlanKey(rawKey: string | null | undefined): PricingTier | undefined {
  // Erst normalisieren: `scale_yearly` muss auf die JAHRES-Variante von
  // Partner zeigen, nicht auf die Monatsvariante. Ein Vergleich gegen den
  // Rohwert würde die Jahresvariante verfehlen und still auf den Monatsplan
  // zurückfallen.
  const key = normalizePlanKey(rawKey);
  if (!key) return undefined;
  const plan = planByKey(key);
  if (!plan) return undefined;
  return PRICING_TIERS.find((tier) => tier.planKey === key)
    ?? PRICING_TIERS.find((tier) => tier.id === plan.id);
}

// ─────────────────────────────────────────────────────────────────────────
//  Darstellung
// ─────────────────────────────────────────────────────────────────────────

/**
 * Akzentfarbe je Plan. Klassen sind vollständige Literale, damit Tailwinds
 * Content-Scanner sie erkennt — dynamisch zusammengesetzte Klassennamen
 * werden NICHT erkannt.
 */
const PLAN_ACCENT: Record<PlanId, { border: string; text: string; ring: string }> = {
  free:       { border: 'border-t-silver-400',   text: 'text-silver-400',   ring: 'ring-silver-400/30' },
  starter:    { border: 'border-t-ai-cyan-400',  text: 'text-ai-cyan-400',  ring: 'ring-ai-cyan-400/30' },
  growth:     { border: 'border-t-security-500', text: 'text-security-500', ring: 'ring-security-500/30' },
  agency:     { border: 'border-t-violet-400',   text: 'text-violet-400',   ring: 'ring-violet-400/30' },
  enterprise: { border: 'border-t-emerald-400',  text: 'text-emerald-400',  ring: 'ring-emerald-400/30' },
  partner:    { border: 'border-t-gold-400',     text: 'text-gold-400',     ring: 'ring-gold-400/30' },
  // Einmalprodukt: `petrol` ist der bestehende Landing-Akzent aus
  // tailwind.config.ts — kein neues Design-Token, keine neue Variante.
  governance_launch: { border: 'border-t-petrol', text: 'text-petrol', ring: 'ring-petrol/30' },
};

/** Akzentfarbe je Tier — Jahresvarianten erben die Farbe ihres Basisplans. */
export const TIER_ACCENT: Record<TierId, { border: string; text: string; ring: string }> = (() => {
  const map = {} as Record<TierId, { border: string; text: string; ring: string }>;
  for (const plan of PLANS) {
    map[plan.id] = PLAN_ACCENT[plan.id];
    if (plan.yearlyPlanKey) {
      map[`${plan.id}_yearly` as TierId] = PLAN_ACCENT[plan.id];
    }
  }
  return map;
})();

/** Akzentfarbe je Produktbereich — einheitlich über alle Oberflächen. */
export const AREA_ACCENT = {
  govern:   { text: 'text-security-500',  border: 'border-security-500/40',  bg: 'bg-security-500/10' },
  automate: { text: 'text-ai-cyan-400',   border: 'border-ai-cyan-400/40',   bg: 'bg-ai-cyan-400/10' },
  engage:   { text: 'text-violet-400',    border: 'border-violet-400/40',    bg: 'bg-violet-400/10' },
} as const;

// ─────────────────────────────────────────────────────────────────────────
//  Add-on-Adapter
// ─────────────────────────────────────────────────────────────────────────

export interface BotAddOn {
  id: AddOnId;
  name: string;
  description: string;
  bullets: string[];
  priceEur: number;
  priceSuffix: string;
}

function toBotAddOn(addon: AddOn): BotAddOn {
  return {
    id: addon.id,
    name: addon.name,
    description: addon.description,
    bullets: addon.bullets,
    priceEur: addon.priceEur,
    priceSuffix: addon.priceNote,
  };
}

export const BOT_ADDONS: BotAddOn[] = ADDONS.map(toBotAddOn);

export function botAddonsByTier(tierId: TierId): BotAddOn[] {
  const tier = tierById(tierId);
  if (!tier) return [];
  return addonsFor(tier.plan).map(toBotAddOn);
}

// Hinweis: `PLANS`, `planById`, `formatPriceEur`, `PRICING_TRUST_NOTE` &c.
// sind bereits über `export * from '@/shared/pricing'` (oben) verfügbar.
// Sie werden hier bewusst NICHT erneut exportiert — ein zweiter Export
// desselben Symbols wäre exakt die Duplizierung, die diese Datei verhindert.
