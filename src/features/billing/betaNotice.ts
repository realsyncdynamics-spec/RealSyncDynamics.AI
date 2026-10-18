import type { BillingAccountKind } from '../../core/billing/billingAccount';
import type { BetaEnrollState } from './useBetaEnrollment';

/** Nur Zustände mit Neuigkeitswert; sonst gilt der allgemeine Beta-Hinweis. */
export function enrollmentNotice(state: BetaEnrollState, endsLabel: string): string | null {
  switch (state.status) {
    case 'pending':
      return 'Beta-Zugang wird eingerichtet …';
    case 'enrolled':
      return state.fresh
        ? `Beta aktiv: Sie testen den vollen Growth-Umfang kostenlos bis ${endsLabel}.`
        : null;
    case 'skipped':
      return state.reason === 'NEW_ENROLLMENT_CLOSED'
        ? 'Die offene Beta nimmt keine neuen Arbeitsbereiche mehr auf. Die Tarife finden Sie auf der Preisseite.'
        : 'Ihr bestehendes Abo bleibt unverändert — die Beta-Freischaltung ist dafür nicht nötig.';
    case 'error':
      return state.retryable
        ? 'Der Beta-Zugang konnte noch nicht eingerichtet werden. Wir versuchen es beim nächsten Öffnen erneut.'
        : `Der Beta-Zugang konnte nicht eingerichtet werden: ${state.message}`;
    default:
      return null;
  }
}

/**
 * Text des Beta-Hinweises in der App-Shell — oder `null`.
 *
 * Der allgemeine Text („Kostenlose Testphase bis …“) erscheint nur für
 * Mandanten, die der Server in die Beta aufgenommen hat. Ein Stripe-Kunde
 * oder ein regulärer Testkunde bekäme sonst Konditionen angezeigt, die für
 * ihn nicht gelten. Bestehende Beta-Mandanten sehen ihn weiter, auch wenn
 * die Beta keine Neukunden mehr aufnimmt.
 */
export function betaBannerText({
  kind,
  notice,
  endsLabel,
}: {
  kind: BillingAccountKind | null;
  notice: string | null;
  endsLabel: string;
}): string | null {
  if (notice) return notice;
  if (kind !== 'beta') return null;
  return `Kostenlose Testphase bis ${endsLabel}. Einige Module sind als BETA markiert und können sich noch ändern.`;
}
