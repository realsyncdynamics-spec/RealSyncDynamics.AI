import { useState } from 'react';
import { useLocation } from 'react-router-dom';
import { BETA } from '../../config/beta';
import { useBetaEnrollment, type BetaEnrollState } from '../../features/billing/useBetaEnrollment';
import { BetaFeedback } from './BetaFeedback';

const KEY = 'rsd-beta-banner-dismissed';

/**
 * Beta-Hinweis im Dashboard (alle /app/*-Flächen). Zeigt Testphase, Ende
 * und das Feedback-Formular (`BetaFeedback`, WP-4). Ausblendbar pro Browser
 * (nur Komfort, kein State mit Bedeutung). Verschwindet mit `VITE_BETA_PHASE=off` überall.
 *
 * Löst außerdem die serverseitige Beta-Anmeldung aus (`useBetaEnrollment`,
 * WP-3) und meldet das Ergebnis — auch wenn der Hinweis ausgeblendet ist.
 *
 * Auf /app/dashboard entfällt der allgemeine Beta-Text: Die Kunden-Startansicht
 * zeigt Testphase und Zahlungsstatus dort als eine Zeile im Fortschritt —
 * sonst stünden Beta-, Trial- und Zahlungshinweis gleichrangig übereinander.
 * Anmelde-Meldungen mit Neuigkeitswert erscheinen weiterhin.
 */
export function BetaAppBanner() {
  const enrollment = useBetaEnrollment();
  const { pathname } = useLocation();
  const onDashboard = pathname === '/app/dashboard';
  const [hidden, setHidden] = useState(() => {
    try {
      return localStorage.getItem(KEY) === '1';
    } catch {
      return false;
    }
  });
  if (!BETA.active) return null;
  const notice = enrollmentNotice(enrollment);
  if ((hidden || onDashboard) && !notice) return null;
  const dismiss = () => {
    try {
      localStorage.setItem(KEY, '1');
    } catch {
      /* Privatmodus: nur für diese Sitzung ausblenden */
    }
    setHidden(true);
  };
  return (
    <div
      role="note"
      className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2 text-xs border-b"
      style={{ background: 'rgba(214,174,82,0.12)', borderColor: 'rgba(214,174,82,0.35)', color: '#f4f4f2' }}
    >
      <span className="font-semibold tracking-widest" style={{ color: '#d6ae52' }}>
        {BETA.badge}
      </span>
      <span>
        {notice ??
          `Kostenlose Testphase bis ${BETA.endsLabel}. Einige Module sind als BETA markiert und können sich noch ändern.`}
      </span>
      <BetaFeedback toggleClassName="cursor-pointer border-0 bg-transparent p-0 underline text-[#d6ae52]" />
      <button type="button" onClick={dismiss} className="ml-auto opacity-70 hover:opacity-100" aria-label="Beta-Hinweis ausblenden">
        ✕
      </button>
    </div>
  );
}

/** Nur Zustände mit Neuigkeitswert; sonst gilt der allgemeine Beta-Hinweis. */
function enrollmentNotice(state: BetaEnrollState): string | null {
  switch (state.status) {
    case 'pending':
      return 'Beta-Zugang wird eingerichtet …';
    case 'enrolled':
      return state.fresh
        ? `Beta aktiv: Sie testen den vollen Growth-Umfang kostenlos bis ${BETA.endsLabel}.`
        : null;
    case 'skipped':
      return 'Ihr bestehendes Abo bleibt unverändert — die Beta-Freischaltung ist dafür nicht nötig.';
    case 'error':
      return state.retryable
        ? 'Der Beta-Zugang konnte noch nicht eingerichtet werden. Wir versuchen es beim nächsten Öffnen erneut.'
        : `Der Beta-Zugang konnte nicht eingerichtet werden: ${state.message}`;
    default:
      return null;
  }
}
