import { BETA, betaSignupHref, isBetaPlan } from '../../../config/beta';
import { COMPANY } from '../../../config/company';
import { tierById, tierPriceLabel, type PricingTier } from '../../../config/pricing';
import { CTA } from '../../../content/runtimeVocab';
import {
  getImplementation,
  PLATFORM_LIVE_ITEMS,
  ROADMAP_COMING_SOON_ITEMS,
  ROADMAP_LIVE_ITEMS,
  ROADMAP_PREVIEW_ITEMS,
  STATUS_LABEL,
  type ImplementationStatus,
} from '../../../product/implementation-status';
import { checkoutHrefForPlan, formatPriceEur, pricingTaxNote, type Plan } from '@/shared/pricing';
import { CHANNEL_TOOLS } from '../LandingChannelTools';
import { POLICY_PACKS, POLICY_PACKS_NEXT } from '../policy-packs';

/**
 * Inhalte für Landing v7 (Design-Artefakt „AI Compliance Operations OS for
 * Europe“, Titan/Nacht).
 *
 * Bewusste Abweichungen vom Artefakt (Claims vs. Runtime):
 *  - Preise, Testphase und Beta-Angebot aus `shared/pricing.ts` + `config/beta.ts`
 *    statt fester Beträge und „14 Tage kostenlos“ aus dem Artefakt.
 *  - Enterprise „Auf Anfrage“ über `tierPriceLabel` — das Artefakt nannte
 *    den internen Listenpreis für einen Plan, der nur per Vertrag zu haben ist.
 *  - TISAX/DORA als Coming Soon (`policy-packs.ts`), nicht als aktive Packs.
 *  - Plattform-, Tool- und Roadmap-Status aus `implementation-status.ts`;
 *    die Listen im Artefakt waren ein älterer Stand des Registers.
 *  - Interne Links statt absoluter URLs auf die Live-Domain.
 */

export const SOURCE = 'landing-v7';

export type Lv7Status = ImplementationStatus | 'demo';

export const STATUS_TEXT: Record<Lv7Status, string> = { ...STATUS_LABEL, demo: 'DEMO / SIMULATED' };

export const HREF = {
  audit: `/audit?source=${SOURCE}`,
  login: '/login',
  dashboard: '/app/dashboard',
  runtime: '/governance-runtime',
  pricing: '/pricing',
  enterprise: `/contact-sales?tier=enterprise&source=${SOURCE}`,
} as const;

/** Kreislauf aus dem Hero: Discover → Classify → Enforce → Prove. */
export const FLOW = ['DISCOVER', 'CLASSIFY', 'ENFORCE', 'PROVE'] as const;

export const STACK = [
  ['EU-Hosted Runtime', 'Supabase Frankfurt', 'Evidence Vault'],
  ['Hash-Chain', 'Ollama local', 'Multi-Tenant RLS'],
] as const;

/** Beispielwerte — im UI ausdrücklich als Demo gekennzeichnet. */
export const DEMO_KPIS = [
  { l: 'DSGVO', v: 'BESTANDEN' },
  { l: 'RISK SCORE', v: '87/100' },
  { l: 'EVIDENCE VAULT', v: '1.248' },
  { l: 'EU AI ACT', v: 'BEREIT' },
] as const;

export const LOOP = [
  'Asset Discovery',
  'Risk Signals',
  'Policy Control',
  'Enforcement',
  'Evidence Vault',
  'Audit Ready',
  'Continuous Monitor',
  'Remediation',
] as const;

const statusOf = (id: string): ImplementationStatus => getImplementation(id)?.status ?? 'coming-soon';

export const TOOLS = CHANNEL_TOOLS.map((t) => {
  const status = statusOf(t.registryId);
  return {
    eyebrow: t.eyebrow,
    title: t.title,
    text: t.text,
    bullets: t.bullets,
    href: t.href,
    cta: status === 'live' ? t.cta : `${t.cta} (${STATUS_LABEL[status].toLowerCase()})`,
    status,
  };
});

export const PLATFORM = PLATFORM_LIVE_ITEMS.map((i) => ({ id: i.id, name: i.name, text: i.description, route: i.route }));

export const ROADMAP = [
  { status: 'live' as const, eyebrow: 'SHIPPED · REACHABLE', items: ROADMAP_LIVE_ITEMS },
  { status: 'preview' as const, eyebrow: 'NOT PRODUCTION-COMPLETE', items: ROADMAP_PREVIEW_ITEMS },
  { status: 'coming-soon' as const, eyebrow: 'NEXT', items: ROADMAP_COMING_SOON_ITEMS },
].map((col) => ({
  ...col,
  items: col.items.map((i) => ({ id: i.id, name: i.name, hint: i.route ?? i.description })),
}));

export const EVIDENCE = [
  { t: 'DSGVO', d: 'Verarbeitung, Risiko, Policy und Nachweis im laufenden Governance-Prozess.' },
  { t: 'EU AI Act', d: 'Risikoklassifikation, Transparenz und Dokumentation für KI-Systeme.' },
  { t: 'Nachweis-Export', d: 'Prüfungen und Entscheidungen als auditfähiger Export — für interne Kontrollen und externe Prüfer.' },
  { t: 'Code Compliance', d: 'Claude Code prüft und unterstützt konkrete technische Remediation.' },
] as const;

export const STEPS = [
  { k: 'DISCOVER', d: 'KI-Systeme, Anwendungen, Datenflüsse und relevante Verarbeitungsvorgänge erfassen.' },
  { k: 'ASSESS', d: 'Risiken bewerten und Systeme gegen Governance-, DSGVO- und EU-AI-Act-Kriterien prüfen.' },
  { k: 'GOVERN', d: 'Verbindliche Policies, Verantwortlichkeiten und Kontrollanforderungen zentral definieren.' },
  { k: 'ENFORCE', d: 'Governance-Regeln operativ durchsetzen und Abweichungen kontrolliert behandeln.' },
  { k: 'EVIDENCE', d: 'Prüfungen, Entscheidungen, Änderungen und Kontrollen nachvollziehbar dokumentieren.' },
  { k: 'AUDIT', d: 'Eine konsistente Governance-Historie für Management, interne Kontrollen und Audits bereitstellen.' },
] as const;

/** Öffentliches Beta-Angebot („kostenlos bis …“), wie auf `/`. */
const BETA_OFFER = BETA.active && BETA.publicOffer;

function planHref(plan: Plan, source: string): string {
  if (BETA_OFFER && isBetaPlan(plan.id)) return betaSignupHref(plan.id, source);
  return checkoutHrefForPlan(plan, { interval: 'month', source });
}

export interface Lv7Plan {
  id: string;
  name: string;
  featured: boolean;
  price: string;
  listPrice: string | null;
  note: string;
  claim: string;
  features: string[];
  cta: string;
  href: string;
  heroHref: string;
}

function toPlan(tier: PricingTier): Lv7Plan {
  const { plan } = tier;
  const beta = BETA_OFFER && isBetaPlan(plan.id);
  return {
    id: plan.id,
    name: plan.name,
    featured: plan.highlight,
    price: beta ? formatPriceEur(0) : formatPriceEur(plan.price.monthlyEur),
    listPrice: beta ? formatPriceEur(plan.price.monthlyEur) : null,
    note: beta
      ? `kostenlos bis ${BETA.endsLabel}`
      : plan.trialDays > 0
        ? `${plan.trialDays} Tage kostenlos testen · monatlich kündbar`
        : 'monatlich kündbar',
    claim: plan.outcomeHeadline,
    features: tier.bullets.filter((b) => b.trim().length > 0).slice(0, 4),
    cta: beta ? 'Kostenlos testen' : plan.ctaLabel,
    href: planHref(plan, `${SOURCE}-pricing`),
    heroHref: planHref(plan, `${SOURCE}-hero`),
  };
}

export const PLANS: Lv7Plan[] = (['starter', 'growth', 'agency'] as const)
  .map((id) => tierById(id))
  .filter((t): t is PricingTier => Boolean(t))
  .map(toPlan);

const taxNote = pricingTaxNote(COMPANY.taxMode);
export const PRICING_INTRO = BETA_OFFER
  ? `Offene Beta bis ${BETA.endsLabel}: ${PLANS.map((p) => p.name).join(', ')} kostenlos testen – keine Kreditkarte, kein Abo.`
  : `Monatliche Self-Service-Tarife — ${PLANS.map((p) => `${p.name} ${p.price}`).join(' · ')}.`;
export const PRICING_FOOT = BETA_OFFER
  ? `Danach gelten die durchgestrichenen Listenpreise. Jahresabrechnung: Coming Soon · Enterprise auf Anfrage · ${taxNote}`
  : `Jahresabrechnung: Coming Soon · Enterprise auf Anfrage · ${taxNote}`;

const SUPPORT_LABEL: Record<string, string> = {
  community: 'Community-Support',
  email: 'E-Mail-Support',
  priority: 'Priorisierter Support',
  dedicated: 'Dedizierter Ansprechpartner',
};

const LIVE_PACKS = POLICY_PACKS.filter((p) => !p.next).map((p) => p.label);
const NEXT_PACKS = POLICY_PACKS_NEXT.map((p) => p.label);

/** Enterprise-Kennzahlen aus der SSoT; `null`, wenn der Plan fehlt. */
export function enterpriseContent() {
  const tier = tierById('enterprise');
  if (!tier) return null;
  const { plan } = tier;
  return {
    tagline: tier.tagline,
    subline: tier.subline,
    price: tierPriceLabel(tier),
    suffix: tier.priceOnRequest ? '' : tier.priceSuffix,
    cta: CTA.enterprise,
    detailsHref: `/pricing#plan-${tier.id}`,
    cards: [
      {
        t: SUPPORT_LABEL[plan.support] ?? 'Support nach Vereinbarung',
        d: plan.badges.length > 0 ? `Zugesicherte Reaktion: ${plan.badges.join(' · ')}.` : 'Fester Ansprechpartner statt Ticket-Warteschlange.',
      },
      {
        t: `${plan.limits.tenants} Organisationen`,
        d: `Getrennte Mandanten unter einer Governance-Ebene, ${plan.limits.seats} Benutzerplätze.`,
      },
      {
        t: `${LIVE_PACKS.length} Policy Packs live`,
        d: `${LIVE_PACKS.join(', ')}. ${NEXT_PACKS.join(' und ')}: Coming Soon.`,
      },
      {
        t: 'Single Sign-On',
        d: `Zentrale Rechteverwaltung, ${plan.limits.evidenceStorageGb} GB Nachweisspeicher.`,
      },
    ],
    included: plan.features.multi_tenant_reseller,
  };
}
