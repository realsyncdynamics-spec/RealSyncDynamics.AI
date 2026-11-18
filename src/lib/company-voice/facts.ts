/**
 * Kuratierte öffentliche Fakten.
 *
 * Identität: Impressum (`src/features/legal/Impressum.tsx`) — Sitz und
 * Inhaber, ohne Straße und ohne Telefonnummer.
 * Preise: nur `shared/pricing.ts` (Self-Service-Pläne).
 * Diese Datei hat kein `import.meta`, damit die Pages-Function sie laden kann.
 */
import { formatPriceEur, monthlyPriceText, planByKey, PLANS, type Plan } from '../../../shared/pricing';
import { COMPANY_VOICE_DISCLAIMER, type PublicFact, type PublicFactId } from './types';

/** Self-Service-Pläne, deren Monatspreis die Demo nennen darf. */
export const QUOTED_PLAN_KEYS = ['free_audit', 'starter', 'growth', 'agency', 'enterprise'] as const;

export function quotedPlans(): Plan[] {
  const plans: Plan[] = [];
  for (const key of QUOTED_PLAN_KEYS) {
    const plan = planByKey(key);
    if (plan && plan.availability === 'self_service') plans.push(plan);
  }
  return plans;
}

export function catalogEuroAmounts(): ReadonlySet<number> {
  const amounts = new Set<number>();
  for (const plan of PLANS) {
    if (plan.availability !== 'self_service') continue;
    amounts.add(plan.price.monthlyEur);
    if (plan.price.yearlyEur != null) amounts.add(plan.price.yearlyEur);
    if (plan.price.oneTimeEur != null) amounts.add(plan.price.oneTimeEur);
  }
  return amounts;
}

function requireQuoted(key: (typeof QUOTED_PLAN_KEYS)[number]): Plan {
  const plan = quotedPlans().find((item) => item.planKey === key);
  if (!plan) throw new Error(`quoted plan missing: ${key}`);
  return plan;
}

function priceLine(plan: Plan): string {
  if (plan.price.monthlyEur === 0) {
    return `${plan.name} kostet ${formatPriceEur(0)}.`;
  }
  return `${plan.name}: ${monthlyPriceText(plan)} laut Preisliste.`;
}

export function curatedFacts(): PublicFact[] {
  const starter = requireQuoted('starter');
  const free = requireQuoted('free_audit');
  const facts: Array<{ id: PublicFactId; text: string }> = [
    {
      id: 'company.founder',
      text: 'Solo-Founder und Inhaber ist Dominik Steiner.',
    },
    {
      id: 'company.legalForm',
      text: 'Rechtsform: Einzelunternehmen, nicht im Handelsregister eingetragen.',
    },
    {
      id: 'company.tradeRegisteredOn',
      text: 'Gewerbe angemeldet am 13.05.2026.',
    },
    {
      id: 'company.seat',
      text: 'Sitz: Neuhaus am Rennweg, Thüringen, Deutschland.',
    },
    {
      id: 'product.summary',
      text: 'RealSyncDynamics.AI ist eine SaaS-Plattform für DSGVO- und EU-AI-Act-Kontrollen: Governance OS, verkettete Nachweise (Evidence) und AI Agents für regulierte Unternehmen. Agenten- und Bot-Funktionen sind teilweise Preview. Telefonie ist Coming Soon und nicht Teil dieser Demo.',
    },
    {
      id: 'product.boundaries',
      text: COMPANY_VOICE_DISCLAIMER,
    },
    {
      id: 'pricing.selfService',
      text: `Self-Service startet mit ${priceLine(starter)}`,
    },
    {
      id: 'pricing.freeAudit',
      text: `Kostenloser Audit-Tarif: ${priceLine(free)}`,
    },
    {
      id: 'service.webdesign',
      text: 'Webdesign ist eine Erweiterung als individuelle Leistung. Einen Preis nennt diese Demo nicht; er steht nicht in der Software-Preisliste.',
    },
  ];
  return facts.map((fact) => ({ ...fact, origin: 'curated' as const }));
}

export function factById(facts: readonly PublicFact[], id: PublicFactId): PublicFact | undefined {
  return facts.find((fact) => fact.id === id);
}
