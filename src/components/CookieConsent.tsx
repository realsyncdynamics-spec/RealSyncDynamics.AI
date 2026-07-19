import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Cookie, X } from 'lucide-react';
import { emitConsentChanged } from '../lib/pixels';

const STORAGE_KEY = 'realsync.cookie-consent.v1';
const OPEN_SETTINGS_EVENT = 'realsync:open-cookie-settings';

/**
 * Öffnet den Cookie-Banner erneut — DSGVO Art. 7(3) Widerruf.
 * Kann aus Footer, Datenschutzseite usw. aufgerufen werden.
 */
export function openCookieSettings(): void {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(OPEN_SETTINGS_EVENT));
  }
}

type Consent = {
  decided_at: string;
  necessary: true;          // immer true (technisch zwingend)
  analytics: boolean;
  marketing: boolean;
};

/**
 * Cookie-Consent-Banner gemäß TDDDG / DSGVO Art. 7.
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

  // DSGVO Art. 7(3): Widerruf jederzeit ermöglichen — Banner auf Event wieder einblenden.
  useEffect(() => {
    const handler = () => setDecided(false);
    window.addEventListener(OPEN_SETTINGS_EVENT, handler);
    return () => window.removeEventListener(OPEN_SETTINGS_EVENT, handler);
  }, []);

  function save(consent: Consent) {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(consent)); } catch { /* ignore */ }
    setDecided(true);
    emitConsentChanged();
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
    <div className="fixed inset-x-0 bottom-12 lg:bottom-4 lg:inset-x-auto lg:right-4 z-50 p-2 sm:p-4 lg:p-0">
      <div className="max-w-3xl lg:max-w-sm mx-auto lg:mx-0 bg-obsidian-900 border border-titanium-700 shadow-2xl rounded-none max-h-[60vh] sm:max-h-[75vh] overflow-y-auto">
        <div className="flex items-start gap-2.5 p-3 sm:p-5">
          <div className="hidden sm:flex shrink-0 w-9 h-9 bg-gradient-to-br from-amber-500 to-orange-600 rounded-none items-center justify-center">
            <Cookie className="h-4 w-4 text-white" />
          </div>
          <div className="flex-1 min-w-0">
            {!showCustom ? (
              <>
                <h2 className="font-display font-bold text-sm sm:text-base text-titanium-50 mb-1">Datenschutz auf RealSyncDynamicsAI.de</h2>
                <p className="text-[11px] sm:text-xs text-titanium-300 leading-snug sm:leading-relaxed mb-2 sm:mb-3">
                  Technisch notwendige Cookies für Login + Session. Optional:
                  Statistik- und Marketing-Cookies mit Deiner Einwilligung. Mehr
                  in der <Link to="/legal/privacy" className="text-security-400 hover:underline">Datenschutzerklärung</Link>.
                </p>
                {/* BfDI-Leitlinie + DSGVO Art. 7 III + TDDDG §25: Accept und Reject
                    in eigenem flex-Container, je flex-1 → garantiert gleiche Breite.
                    Einstellungen separat darunter. */}
                <div className="flex gap-1.5 sm:gap-2 mb-1.5 sm:mb-2">
                  <button onClick={acceptAll}
                    className="flex-1 px-3 py-1.5 bg-titanium-700 hover:bg-titanium-600 text-white text-[11px] sm:text-xs font-bold rounded-none border border-titanium-600"
                    data-testid="consent-accept-all">
                    Alles akzeptieren
                  </button>
                  <button onClick={acceptNecessary}
                    className="flex-1 px-3 py-1.5 bg-titanium-700 hover:bg-titanium-600 text-white text-[11px] sm:text-xs font-bold rounded-none border border-titanium-600"
                    data-testid="consent-reject-all">
                    Alle ablehnen
                  </button>
                </div>
                <div>
                  <button onClick={() => setShowCustom(true)}
                    className="px-3 py-1.5 bg-obsidian-950 border border-titanium-700 hover:border-titanium-500 text-titanium-200 text-[11px] sm:text-xs font-bold rounded-none"
                    data-testid="consent-settings">
                    Einstellungen
                  </button>
                </div>
              </>
            ) : (
              <>
                <h2 className="font-display font-bold text-sm sm:text-base text-titanium-50 mb-2">Cookie-Auswahl</h2>
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
