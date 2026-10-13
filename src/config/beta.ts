/**
 * Beta-Testphase — eine Quelle für Banner, Hero-Buttons, Preis-CTAs und
 * Checkout-Umleitung (Entscheidung Owner 13.10.2026: erst testen lassen,
 * dann Geld verlangen).
 *
 * Schalter: Default = AUS. Die Beta-Darstellung ist nur aktiv, wenn der Build
 * ausdrücklich `VITE_BETA_PHASE=on` (oder `true`) setzt. Grund: Solange WP-3
 * (serverseitiges beta-enroll) fehlt, darf die UI keinen kostenlosen
 * Growth-Zugang versprechen und den normalen Checkout nicht umleiten.
 *
 * Wichtig (Claims vs. Runtime): Diese Datei steuert nur das Frontend.
 * Dass Beta-Mandanten serverseitig wirklich Growth-Funktionen erhalten,
 * regelt der Entitlement-Pfad (Arbeitspaket WP-3 im Claude-Code-Plan) —
 * bis dahin verspricht die UI ausdrücklich nur „kostenlos testen“.
 */
import { safeInternalPath } from '../lib/safeInternalPath';

/** Beta nur bei explizitem Opt-in (`on`/`true`); alles andere = aus. */
export function isBetaFlagOn(raw: unknown): boolean {
  const flag = (raw ?? '').toString().trim().toLowerCase();
  return flag === 'on' || flag === 'true';
}

export const BETA = {
  active: isBetaFlagOn(import.meta.env?.VITE_BETA_PHASE),
  /** Anzeige-Ende der Beta (nur Text, keine Logik). */
  endsLabel: '31. Januar 2027',
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
