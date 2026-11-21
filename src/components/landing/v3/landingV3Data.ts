/**
 * Startseite v3 (`/`) — alle Inhalte, die nicht reiner Fließtext sind,
 * kommen aus den vorhandenen Quellen:
 *   - Produktstatus      → src/product/implementation-status.ts
 *   - Preise, Testphase  → shared/pricing.ts (über config/pricing.ts)
 *   - Beta-Angebot       → src/config/beta.ts
 *   - Steuerhinweis      → pricingTaxNote(COMPANY.taxMode)
 *   - Firma              → src/config/company.ts
 *
 * Nichts hiervon wird im Design-Export gepflegt. Der Export (Claude Design,
 * „RealSync Startseite v3“) liefert nur Gestaltung und Texte.
 */
import { BETA, betaSignupHref, isBetaPlan } from '../../../config/beta';
import { COMPANY } from '../../../config/company';
import { tierById, type PricingTier } from '../../../config/pricing';
import { CTA } from '../../../content/runtimeVocab';
import { IMPLEMENTATION_ITEMS, type ImplementationStatus } from '../../../product/implementation-status';
import { checkoutHrefForPlan, formatPriceEur, monthlyPriceSuffix, pricingTaxNote, type Plan } from '@/shared/pricing';

export const SOURCE = 'landing-v3';

// ── Status ──────────────────────────────────────────────────────────────────

export const STATUS_TEXT: Record<ImplementationStatus, string> = {
  live: 'Live',
  preview: 'Preview',
  'coming-soon': 'In Vorbereitung',
};

export function registryStatus(id: string): ImplementationStatus | null {
  return IMPLEMENTATION_ITEMS.find((i) => i.id === id)?.status ?? null;
}

// ── Produkte ────────────────────────────────────────────────────────────────

export interface V3Product {
  key: string;
  section: 'BUILD' | 'AUTOMATE' | 'GOVERN';
  name: string;
  short: string;
  body: string;
  flow: string;
  href: string;
  /** Registry-Eintrag; null = kein Eintrag → kein Badge (keine erfundene Angabe). */
  registryId: string | null;
  /** Zusatzhinweis aus einem zweiten Registry-Eintrag, z. B. Telefonie. */
  note?: { registryId: string; text: (label: string) => string };
  stageCaption: string;
}

export const PRODUCTS: readonly V3Product[] = [
  {
    key: 'telefonassistent',
    section: 'AUTOMATE',
    name: 'Telefonassistent',
    short: 'Persönlicher KI-Empfang für kleine und mittlere Betriebe',
    body: 'Ein telefonischer Assistent soll Anfragen aufnehmen, Kontakt und Terminwünsche festhalten und an Ihr Team übergeben.',
    flow: 'Anruf → Anliegen → Rückrufwunsch → Team',
    href: `/telefonassistent?source=${SOURCE}`,
    registryId: 'voice-telephony',
    stageCaption: 'Anruf → Anliegen → Mensch',
  },
  {
    key: 'landingpage-builder',
    section: 'BUILD',
    name: 'Landingpage-Builder',
    short: 'Neue Seiten ohne Code planen und gestalten',
    body: 'Geschäftsidee beschreiben, einen Frontend-Entwurf gestalten und Änderungen vor der Freigabe live ansehen.',
    flow: 'Idee → Entwurf → Vorschau → Freigabe',
    href: `/landingpage-builder?source=${SOURCE}`,
    registryId: 'web-builder',
    stageCaption: 'Idee → Landingpage → Vorschau',
  },
  {
    key: 'app-builder',
    section: 'BUILD',
    name: 'App-Builder',
    short: 'Aus einer Idee eine eigene Anwendung machen',
    body: 'Anforderungen beschreiben und den vorhandenen App-Builder als Einstieg für den Anwendungsentwurf öffnen.',
    flow: 'Anforderung → Anwendung → Vorschau',
    href: `/app-builder?source=${SOURCE}`,
    registryId: 'web-builder',
    stageCaption: 'Anforderung → App → Vorschau',
  },
  {
    key: 'governance',
    section: 'GOVERN',
    name: 'Governance OS',
    short: 'Befunde, Maßnahmen, Freigaben und Nachweise verwalten',
    body: 'Risiken, Vorfälle, Betroffenenanfragen, Dienstleister und Freigaben nachvollziehbar bearbeiten.',
    flow: 'Befund → Maßnahme → Freigabe → Nachweis',
    href: `/governance-os?source=${SOURCE}`,
    registryId: 'governance-runtime-core',
    stageCaption: 'Befund → Freigabe → Nachweis',
  },
];

/**
 * AI Receptionist: führendes Produkt (AGENTS.md K4, Owner-Entscheidung 18.11.2026),
 * erster Abschnitt nach dem Hero. Status bleibt Owner-Vorgabe „In Vorbereitung“:
 * Telefonie ist laut Registry `voice-telephony` nicht live. Darum nur der geplante
 * Ablauf, kein Leistungsversprechen. Einstiege: Warteliste (Interesse `bots`) und
 * der erreichbare Chat-Assistent (`channel-bots`, Status aus der Registry).
 */
export const RECEPTIONIST = {
  name: 'AI Receptionist',
  audience: 'Für Betriebe mit Kundenkontakt, zuerst im Handwerk',
  heading: 'Ihr KI-Mitarbeiter am Empfang.',
  body: 'Nimmt Anfragen an, erfasst Kontakt und Terminwunsch und übergibt an einen Menschen.',
  steps: ['Anfrage annehmen', 'Kontakt erfassen', 'Terminwunsch aufnehmen', 'An einen Menschen übergeben'],
  status: 'coming-soon' as ImplementationStatus,
  waitlistHref: `/warteliste?interest=bots&source=${SOURCE}-receptionist`,
  waitlistCta: 'Auf die Warteliste',
  tryHref: `/chatbot/start?source=${SOURCE}-receptionist`,
  tryCta: 'Chat-Assistent ausprobieren',
  tryRegistryId: 'channel-bots',
};

export function productStatus(p: V3Product): { status: ImplementationStatus; label: string } | null {
  if (!p.registryId) return null;
  const s = registryStatus(p.registryId);
  return s ? { status: s, label: STATUS_TEXT[s] } : null;
}

export function productNote(p: V3Product): string | null {
  if (!p.note) return null;
  const s = registryStatus(p.note.registryId);
  return s && s !== 'live' ? p.note.text(STATUS_TEXT[s]) : null;
}

// ── Preise ──────────────────────────────────────────────────────────────────

const PLAN_IDS = ['starter', 'growth', 'agency', 'enterprise'] as const;
export const BETA_OFFER = BETA.active && BETA.publicOffer;

function planHref(plan: Plan, source: string): string {
  if (BETA_OFFER && isBetaPlan(plan.id)) return betaSignupHref(plan.id, source);
  return checkoutHrefForPlan(plan, { interval: 'month', source });
}

export interface V3PlanCard {
  id: string;
  name: string;
  featured: boolean;
  badge: string | null;
  price: string;
  listPrice: string | null;
  unit: string;
  note: string;
  desc: string;
  features: string[];
  cta: string;
  href: string;
}

/** `source` steuert nur das Tracking-Ziel der Links (Standard: Startseite v3). */
export function planCards(source: string = SOURCE): V3PlanCard[] {
  return PLAN_IDS.map((id) => tierById(id))
    .filter((t): t is PricingTier => Boolean(t))
    .map((tier) => {
      const plan = tier.plan;
      const inquiry = tier.priceOnRequest || plan.purchaseMode === 'inquiry';
      const beta = BETA_OFFER && isBetaPlan(plan.id);
      return {
        id: plan.id,
        name: plan.name,
        featured: plan.highlight,
        badge: beta ? BETA.badge : plan.trialDays > 0 ? `${plan.trialDays} Tage Test` : null,
        price: tier.priceOnRequest ? 'Auf Anfrage' : beta ? formatPriceEur(0) : formatPriceEur(plan.price.monthlyEur),
        listPrice: beta && !tier.priceOnRequest ? formatPriceEur(plan.price.monthlyEur) : null,
        unit: tier.priceOnRequest ? tier.priceSuffix : monthlyPriceSuffix(plan),
        note: tier.priceOnRequest
          ? 'SLA nach Vereinbarung'
          : beta
            ? `kostenlos bis ${BETA.endsLabel}`
            : plan.trialDays > 0
              ? `${plan.trialDays} Tage kostenlos testen · monatlich kündbar`
              : 'monatlich kündbar',
        desc: plan.outcomeHeadline,
        features: tier.bullets.filter((b) => b.trim().length > 0).slice(0, 3),
        cta: beta ? 'Kostenlos testen' : inquiry ? CTA.enterprise : plan.ctaLabel,
        href: inquiry ? checkoutHrefForPlan(plan, { source: `${source}-pricing` }) : planHref(plan, `${source}-pricing`),
      };
    });
}

export const TAX_NOTE = pricingTaxNote(COMPANY.taxMode);

export function pricingIntro(): string {
  return BETA_OFFER
    ? `Offene Beta bis ${BETA.endsLabel}: Starter, Growth und Agency kostenlos testen – keine Kreditkarte, kein Abo.`
    : 'Der Website-Scan ist kostenlos. Tarife mit Testphase testen Sie vor der ersten Zahlung.';
}

// ── Häufige Fragen (nur, was der Bestand belegt) ────────────────────────────

export function faqs(): Array<{ q: string; a: string }> {
  const telephony = registryStatus('voice-telephony');
  return [
    {
      q: 'Brauche ich für den Website-Scan ein Konto?',
      a: 'Nein. Sie geben Ihre Website-Adresse und Ihre E-Mail-Adresse ein und erhalten das Ergebnis direkt.',
    },
    {
      q: 'Was kostet der Einstieg?',
      a: `${pricingIntro()} ${TAX_NOTE}`,
    },
    {
      q: 'Handelt die KI auf eigene Faust?',
      a: 'Freigaben laufen über das Governance OS und bleiben dort nachvollziehbar. Die automatische Policy-Prüfung arbeitet derzeit im Beobachtungsmodus.',
    },
    {
      q: 'Kann der Voice Agent schon telefonieren?',
      a:
        telephony === 'live'
          ? 'Ja, die Telefonie ist in Betrieb.'
          : `Noch nicht. Der Assistent beantwortet Anfragen derzeit im Chat. Telefonie: ${telephony ? STATUS_TEXT[telephony] : 'nicht erfasst'}.`,
    },
  ];
}

export const COMPANY_LINE = `© ${new Date().getFullYear()} ${COMPANY.companyName} · ${COMPANY.headquartersAddress.city}`;

export const LEGAL_LINKS: ReadonlyArray<{ to: string; label: string }> = [
  { to: '/impressum', label: 'Impressum' },
  { to: '/datenschutz', label: 'Datenschutz' },
  { to: '/agb', label: 'AGB' },
  { to: '/avv', label: 'AVV' },
  { to: '/widerruf', label: 'Widerruf' },
  { to: '/legal/sub-processors', label: 'Unterauftragsverarbeiter' },
  { to: '/sicherheit', label: 'Sicherheit' },
  { to: '/kontakt', label: 'Kontakt' },
];
