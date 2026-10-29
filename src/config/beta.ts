/**
 * Beta-Testphase — eine Quelle für Banner, Hero-Buttons, Preis-CTAs und
 * Checkout-Umleitung (Entscheidung Owner 13.10.2026: erst testen lassen,
 * dann Geld verlangen).
 *
 * Schalter: `VITE_BETA_PHASE=off` im Build beendet die Beta-Darstellung
 * überall auf einmal. Default = an.
 *
 * Wichtig (Claims vs. Runtime): Diese Datei steuert nur das Frontend.
 * Dass Beta-Mandanten serverseitig wirklich Growth-Funktionen erhalten,
 * regelt der Entitlement-Pfad (Arbeitspaket WP-3 im Claude-Code-Plan) —
 * bis dahin verspricht die UI ausdrücklich nur „kostenlos testen“.
 */
import { safeInternalPath } from '../lib/safeInternalPath';
import { planById, PRICING_TRUST_NOTE } from '@/shared/pricing';

const flag = (import.meta.env?.VITE_BETA_PHASE ?? 'on').toString().toLowerCase();

export const BETA = {
  active: flag !== 'off' && flag !== 'false' && flag !== '0',
  /**
   * Öffentliches Pauschalangebot „kostenlos bis {endsLabel}“ auf der
   * Website. Entscheidung Owner 21.10.2026: bleibt an, bis das Ende gesondert
   * freigegeben wird. `false` zeigt stattdessen die regulären Preise aus
   * `shared/pricing.ts` (Starter 79 €, Growth 249 €, Agency 699 € pro Monat,
   * Testphase für Tarife mit `trialDays`); die Preise selbst bleiben
   * unverändert. Checkout-Umleitung, `beta-enroll` und App-Hinweise hängen
   * weiter nur an `active`: Bereits gewährte Beta-Zugänge bleiben unberührt.
   */
  publicOffer: true as boolean,
  /** Anzeige-Ende der Beta (nur Text, keine Logik). */
  endsLabel: '31. Januar 2027',
  /** Dasselbe Ende für englische Texte. */
  endsLabelEn: '31 January 2027',
  /** Letzter kostenloser Tag maschinenlesbar (schema.org `priceValidUntil`, llms.txt). */
  endsIso: '2027-01-31',
  /** Planstufe, deren Umfang Beta-Tester testen dürfen. */
  testPlan: 'growth' as const,
  badge: 'BETA',
  headline: 'Offene Beta: kostenlos testen',
  sub: 'Bis zum Ende der Beta zahlen Sie nichts — keine Kreditkarte, keine automatische Verlängerung. Ihr Feedback entscheidet, was wir als Nächstes bauen.',
  promises: [
    'Kostenlos bis zum Ende der Beta',
    'Keine Kreditkarte, kein Abo',
    'EU-Hosting (Supabase Frankfurt)',
    'Daten jederzeit exportier- und löschbar',
  ],
} as const;

/**
 * Öffentliches Beta-Angebot sichtbar: 0 € statt Listenpreis, Anmeldung statt
 * Checkout. Für Seiten mit Preisen (/, /pricing, schema.org-Offers).
 */
export const BETA_PUBLIC_OFFER: boolean = BETA.active && BETA.publicOffer;

/** Testphase nach der Beta — Tage aus der SSoT (`growth.trialDays`), nie hart codiert. */
const TRIAL_DAYS_AFTER_BETA = planById('growth').trialDays;

/**
 * Wiederkehrende Test-Texte für Marketing-Seiten. Während der offenen Beta
 * stehen hier die Beta-Aussagen; ist `BETA_PUBLIC_OFFER` aus, die reguläre
 * Testphase aus `shared/pricing.ts`. Eine Stelle statt einer Zahl je Seite.
 */
export const TRY_FREE = {
  /** Kurzer CTA, z. B. auf Buttons. */
  cta: BETA_PUBLIC_OFFER ? 'Kostenlos testen' : `${TRIAL_DAYS_AFTER_BETA} Tage kostenlos testen`,
  /** Satz für Fließtext und Hinweise unter Buttons. */
  note: BETA_PUBLIC_OFFER
    ? `Offene Beta: kostenlos bis ${BETA.endsLabel}, keine Kreditkarte. Danach Listenpreis, monatlich kündbar.`
    : `${TRIAL_DAYS_AFTER_BETA} Tage kostenlos testen, monatlich kündbar.`,
  /** Satzbaustein klein, z. B. „Diesen Befund {phrase} bearbeiten“. */
  phrase: BETA_PUBLIC_OFFER ? `kostenlos bis ${BETA.endsLabel}` : `${TRIAL_DAYS_AFTER_BETA} Tage kostenlos`,
  /** Kürzester Baustein, z. B. „Starter {short} aktivieren“. */
  short: BETA_PUBLIC_OFFER ? 'kostenlos' : `${TRIAL_DAYS_AFTER_BETA} Tage kostenlos`,
  /** Badges und Pillen. */
  badge: BETA_PUBLIC_OFFER ? `Kostenlos bis ${BETA.endsLabel}` : `${TRIAL_DAYS_AFTER_BETA} Tage kostenlos`,
  /** Tarif-Satz für Preisübersichten. */
  plans: BETA_PUBLIC_OFFER
    ? `Starter, Growth und Agency: kostenlos bis ${BETA.endsLabel}, danach Listenpreis, monatlich kündbar.`
    : `Starter und Growth: ${TRIAL_DAYS_AFTER_BETA} Tage kostenlos testen, monatlich kündbar.`,
  /** Vertrauenszeile unter Preiskarten (statt `PRICING_TRUST_NOTE`). */
  trustNote: BETA_PUBLIC_OFFER
    ? `Free Audit kostenlos · Offene Beta bis ${BETA.endsLabel} · Keine Kreditkarte · Danach monatlich kündbar · Made in Germany`
    : PRICING_TRUST_NOTE,
} as const;

/** Plan-IDs, die während der Beta nicht gekauft, sondern kostenlos getestet werden. */
const BETA_PLANS = new Set(['starter', 'growth', 'agency']);

export function isBetaPlan(planIdOrKey: string | undefined | null): boolean {
  if (!BETA.active || !planIdOrKey) return false;
  const id = planIdOrKey.toLowerCase().replace(/_(monthly|yearly)$/, '');
  return BETA_PLANS.has(id);
}

/**
 * Einstieg in die Beta: Registrierung (/welcome, OTP/OAuth) und danach
 * direkt ins Dashboard. Plan und Quelle wandern als Query mit, damit
 * WP-3 den Beta-Zugang serverseitig vergeben und Marketing messen kann.
 */
export function betaSignupHref(plan: string = BETA.testPlan, source = 'beta'): string {
  const next = safeInternalPath(`/app/dashboard?beta=1&plan=${encodeURIComponent(plan)}`) ?? '/app/dashboard';
  const q = new URLSearchParams({ beta: '1', plan, source, next });
  return `/welcome?${q.toString()}`;
}

/** Ein Meilenstein der Beta-Phase — Datum und Beschriftung. */
export interface BetaMilestone {
  /** Anzeigedatum (kein ISO-Datum, kein Versprechen). */
  date: string;
  label: string;
}

/**
 * Öffentliche Meilensteine der Beta. Kein exaktes Datum, kein Commit.
 * Gelesen von /roadmap — eine Quelle für beide Seiten.
 */
export const BETA_MILESTONES: readonly BetaMilestone[] = [
  {
    date: 'Oktober 2026',
    label: 'Beta-Start: kostenlos testen — keine Kreditkarte.',
  },
  {
    date: 'November 2026',
    label: 'Feedback-Runde 1 — Website-Scan, DSGVO-Audit, Evidence-Kette.',
  },
  {
    date: 'Dezember 2026',
    label: 'Feedback-Runde 2 — AI-OS-Setup, Governance Workspace, Agenten-Register.',
  },
  {
    date: 'Januar 2027',
    label: `Letzter Beta-Monat — Ende ${BETA.endsLabel}.`,
  },
  {
    date: 'Ab Februar 2027',
    label: 'Reguläre Preise: Starter 79 €, Growth 249 €, Agency 699 € / Monat.',
  },
] as const;
