import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { BETA } from '../../config/beta';
import { useBetaEnrollment } from '../../features/billing/useBetaEnrollment';
import { useAccountStatus } from '../../features/billing/useAccountStatus';
import { betaBannerText, enrollmentNotice } from '../../features/billing/betaNotice';

const KEY = 'rsd-beta-banner-dismissed';

/**
 * Beta-Hinweis im Dashboard (alle /app/*-Flächen). Zeigt Testphase, Ende
 * und den Feedback-Weg. Ausblendbar pro Browser (nur Komfort, kein State
 * mit Bedeutung). Der allgemeine Text erscheint nur für Beta-Mandanten
 * (`subscriptions.source = 'beta'`), nicht für Stripe- oder Testkunden.
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
  const { kind } = useAccountStatus();
  const { pathname } = useLocation();
  const onDashboard = pathname === '/app/dashboard';
  const [hidden, setHidden] = useState(() => {
    try {
      return localStorage.getItem(KEY) === '1';
    } catch {
      return false;
    }
  });
  const notice = enrollmentNotice(enrollment, BETA.endsLabel);
  if ((hidden || onDashboard) && !notice) return null;
  const text = betaBannerText({ kind, notice, endsLabel: BETA.endsLabel });
  if (!text) return null;
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
        {text}
      </span>
      <Link to="/kontakt?topic=beta-feedback" className="underline" style={{ color: '#d6ae52' }}>
        Feedback geben
      </Link>
      <button type="button" onClick={dismiss} className="ml-auto opacity-70 hover:opacity-100" aria-label="Beta-Hinweis ausblenden">
        ✕
      </button>
    </div>
  );
}
