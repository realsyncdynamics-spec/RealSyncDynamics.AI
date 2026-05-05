import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Cookie, X } from 'lucide-react';

const STORAGE_KEY = 'realsync.cookie-consent.v1';

type Consent = {
  decided_at: string;
  necessary: true;          // immer true (technisch zwingend)
  analytics: boolean;
  marketing: boolean;
};

/**
 * Cookie-Consent-Banner gemäß TTDSG / DSGVO Art. 7.
 *
 * Sichtbar bis User entweder „Alles akzeptieren" / „Nur notwendig" / „Anpassen"
 * gewählt hat. Speichert Wahl in localStorage. Keine 3rd-Party-Tracker
 * geladen bevor Consent erteilt wurde.
 */
export function CookieConsent() {
  const [decided, setDecided] = useState<boolean | null>(null);
  const [showCustom, setShowCustom] = useState(false);
  const [analytics, setAnalytics] = useState(false);
  const [marketing, setMarketing] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      setDecided(!!raw);
    } catch {
      setDecided(false);
    }
  }, []);

  function save(consent: Consent) {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(consent)); } catch { /* ignore */ }
    setDecided(true);
  }

  function acceptAll() {
    save({
      decided_at: new Date().toISOString(),
      necessary: true,
      analytics: true,
      marketing: true,
    });
  }

  function acceptNecessary() {
    save({
      decided_at: new Date().toISOString(),
      necessary: true,
      analytics: false,
      marketing: false,
    });
  }

  function acceptCustom() {
    save({
      decided_at: new Date().toISOString(),
      necessary: true,
      analytics,
      marketing,
    });
  }

  if (decided === null || decided === true) return null;

  return (
    <div className="fixed bottom-0 inset-x-0 z-50 p-4 sm:p-6">
      <div className="max-w-3xl mx-auto bg-obsidian-900 border border-titanium-700 shadow-2xl rounded-none">
        <div className="flex items-start gap-3 p-4 sm:p-5">
          <div className="shrink-0 w-9 h-9 bg-gradient-to-br from-amber-500 to-orange-600 rounded-none flex items-center justify-center">
            <Cookie className="h-4 w-4 text-white" />
          </div>
          <div className="flex-1 min-w-0">
            {!showCustom ? (
              <>
                <h2 className="font-display font-bold text-titanium-50 mb-1.5">Datenschutz auf realsyncdynamicsai.de</h2>
                <p className="text-xs text-titanium-300 leading-relaxed mb-3">
                  Wir setzen technisch notwendige Cookies für Login + Session.
                  Optional können wir mit Deiner Einwilligung anonyme Statistik-
                  und Marketing-Cookies setzen, um die App zu verbessern. Mehr
                  in der <Link to="/legal/privacy" className="text-security-400 hover:underline">Datenschutzerklärung</Link>.
                </p>
                <div className="flex flex-wrap gap-2">
                  <button onClick={acceptAll}
                    className="px-3 py-2 bg-security-500 hover:bg-security-600 text-white text-xs font-bold rounded-none">
                    Alles akzeptieren
                  </button>
                  <button onClick={acceptNecessary}
                    className="px-3 py-2 bg-obsidian-950 border border-titanium-700 hover:bg-obsidian-800 text-titanium-200 text-xs font-semibold rounded-none">
                    Nur notwendige
                  </button>
                  <button onClick={() => setShowCustom(true)}
                    className="px-3 py-2 text-titanium-400 hover:text-titanium-200 text-xs font-medium">
                    Anpassen
                  </button>
                </div>
              </>
            ) : (
              <>
                <h2 className="font-display font-bold text-titanium-50 mb-2">Cookie-Auswahl</h2>
                <div className="space-y-2 mb-3 text-xs">
                  <CookieRow
                    label="Notwendig" desc="Login, Session, CSRF — ohne diese funktioniert die App nicht."
                    checked disabled />
                  <CookieRow
                    label="Statistik" desc="Anonyme Nutzung der Plattform (z.B. welche Tools wie oft)."
                    checked={analytics} onChange={setAnalytics} />
                  <CookieRow
                    label="Marketing" desc="Tracking für Re-Marketing-Pixel der Cloud-Werbenetzwerke."
                    checked={marketing} onChange={setMarketing} />
                </div>
                <div className="flex gap-2">
                  <button onClick={acceptCustom}
                    className="px-3 py-2 bg-security-500 hover:bg-security-600 text-white text-xs font-bold rounded-none">
                    Auswahl speichern
                  </button>
                  <button onClick={() => setShowCustom(false)}
                    className="px-3 py-2 text-titanium-400 hover:text-titanium-200 text-xs font-medium">
                    Zurück
                  </button>
                </div>
              </>
            )}
          </div>
          <button onClick={acceptNecessary}
            title="Schließen — entspricht 'Nur notwendige'"
            className="shrink-0 p-1.5 text-titanium-500 hover:text-titanium-200 rounded-none">
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

function CookieRow({
  label, desc, checked, disabled, onChange,
}: { label: string; desc: string; checked: boolean; disabled?: boolean; onChange?: (v: boolean) => void }) {
  return (
    <label className={`flex items-start gap-3 p-2 border border-titanium-900 ${disabled ? 'opacity-60' : 'hover:bg-obsidian-950 cursor-pointer'} rounded-none`}>
      <input type="checkbox" checked={checked} disabled={disabled}
        onChange={(e) => onChange?.(e.target.checked)}
        className="mt-0.5 accent-security-500" />
      <div className="flex-1">
        <div className="font-bold text-titanium-200">{label}</div>
        <div className="text-[11px] text-titanium-500 mt-0.5">{desc}</div>
      </div>
    </label>
  );
}
