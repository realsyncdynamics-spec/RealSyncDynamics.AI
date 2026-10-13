import { useState } from 'react';
import { Link } from 'react-router-dom';
import { BETA } from '../../config/beta';

const KEY = 'rsd-beta-banner-dismissed';

/**
 * Beta-Hinweis im Dashboard (alle /app/*-Flächen). Zeigt Testphase, Ende
 * und den Feedback-Weg. Ausblendbar pro Browser (nur Komfort, kein State
 * mit Bedeutung). Verschwindet mit `VITE_BETA_PHASE=off` überall.
 */
export function BetaAppBanner() {
  const [hidden, setHidden] = useState(() => {
    try {
      return localStorage.getItem(KEY) === '1';
    } catch {
      return false;
    }
  });
  if (!BETA.active || hidden) return null;
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
        Kostenlose Testphase bis {BETA.endsLabel}. Einige Module sind als BETA markiert und können sich noch ändern.
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
