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
  /**
   * Öffentliches Pauschalangebot „kostenlos bis {endsLabel}“ auf der
   * Website. Entscheidung Owner 21.10.2026: bleibt an, bis das Ende gesondert
   * freigegeben wird. `false` zeigt stattdessen die regulären Preise aus
   * `shared/pricing.ts` (Starter 79 €, Growth 249 €, Agency 699 € pro Monat,
   * 14 Tage Test für Tarife mit `trialDays`); die Preise selbst bleiben
   * unverändert. Checkout-Umleitung, `beta-enroll` und App-Hinweise hängen
   * weiter nur an `active`: Bereits gewährte Beta-Zugänge bleiben unberührt.
   */
  publicOffer: true as boolean,
  /** Anzeige-Ende der Beta (nur Text, keine Logik). */
  endsLabel: '31. Januar 2027',
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
