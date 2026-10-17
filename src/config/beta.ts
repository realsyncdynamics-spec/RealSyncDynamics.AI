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

const flag = (import.meta.env?.VITE_BETA_PHASE ?? 'on').toString().toLowerCase();

export const BETA = {
  active: flag !== 'off' && flag !== 'false' && flag !== '0',
  /** Anzeige-Ende der Beta (nur Text, keine Logik). */
  endsLabel: '31. Januar 2027',
  endsLabelEn: '31 January 2027',
  /** Planstufe, deren Umfang Beta-Tester testen dürfen. */
  testPlan: 'growth' as const,
  badge: 'BETA',
  headline: 'Offene Beta: alle Funktionen kostenlos testen',
  sub: 'Bis zum Ende der Beta zahlen Sie nichts — keine Kreditkarte, keine automatische Verlängerung. Ihr Feedback entscheidet, was wir als Nächstes bauen.',
  promises: [
    'Kostenlos bis zum Ende der Beta',
    'Keine Kreditkarte, kein Abo',
    'EU-Hosting (Supabase Frankfurt)',
    'Daten jederzeit exportier- und löschbar',
  ],
} as const;

export interface BetaMilestone {
  id: 'start' | 'feedback' | 'end' | 'prices';
  when: string;
  title: string;
  body: string;
}

/**
 * Beta-Fahrplan für /roadmap. Nur Termine, die feststehen — Feedback-Runden
 * haben bewusst kein Datum. Das Ende spiegelt `trial_end` aus `beta-enroll`.
 */
export const BETA_MILESTONES: readonly BetaMilestone[] = [
  {
    id: 'start',
    when: 'Oktober 2026',
    title: 'Offene Beta startet',
    body: 'Starter, Growth und Agency kostenlos testen — keine Kreditkarte, kein Abo.',
  },
  {
    id: 'feedback',
    when: 'Laufend',
    title: 'Feedback-Runden',
    body: 'Ihre Rückmeldungen bestimmen, was wir als Nächstes bauen. Feedback geht direkt aus der App oder über das Kontaktformular an uns.',
  },
  {
    id: 'end',
    when: BETA.endsLabel,
    title: 'Beta endet',
    body: 'Die kostenlosen Testzugänge laufen aus. Es verlängert sich nichts automatisch, Ihre Daten bleiben exportier- und löschbar.',
  },
  {
    id: 'prices',
    when: 'Ab Februar 2027',
    title: 'Listenpreise gelten',
    body: 'Wer weitermachen möchte, bucht einen Plan zu den Preisen auf der Preisseite.',
  },
];

/** Meilenstein, in dem wir gerade stehen (nur Anzeige). */
export function currentBetaMilestone(): BetaMilestone['id'] {
  return BETA.active ? 'feedback' : 'prices';
}

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
