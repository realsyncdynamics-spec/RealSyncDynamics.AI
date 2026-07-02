/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * SEITE 2 — /optimizer/scan  (URL-Eingabe)
 * Typ: ACTION. Ein CTA → /optimizer/scanning. Zurück → /optimizer.
 */

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Globe, ArrowRight, AlertTriangle, Search, FileText, ShieldCheck } from 'lucide-react';

import { OptimizerLayout } from './OptimizerLayout';
import { normalizeUrl, setTargetUrl, clearOptimizerState } from '../../lib/optimizer/state';

const AFTER_SCAN = [
  { icon: Search, text: 'Wir prüfen die öffentlich erreichbaren Seiten deiner Domain.' },
  { icon: ShieldCheck, text: 'Du erhältst einen Score und eine nach Schwere sortierte Übersicht.' },
  { icon: FileText, text: 'Den vollständigen Bericht schaltest du danach optional frei.' },
];

/** Grobe Plausibilitätsprüfung — echte Validierung macht das Backend. */
function isPlausibleUrl(raw: string): boolean {
  try {
    const u = new URL(normalizeUrl(raw));
    // Host muss mindestens einen Punkt enthalten (irgendwas.tld).
    return u.hostname.includes('.') && u.hostname.length >= 4;
  } catch {
    return false;
  }
}

export function OptimizerScan() {
  const navigate = useNavigate();
  const [url, setUrl] = useState('');
  const [error, setError] = useState<string | null>(null);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!isPlausibleUrl(url)) {
      setError('Bitte gib eine gültige Website-Adresse ein, z. B. deine-website.de');
      return;
    }
    setError(null);
    // Frischer Flow: alten Report verwerfen, neue Ziel-URL ablegen.
    clearOptimizerState();
    setTargetUrl(normalizeUrl(url));
    navigate('/optimizer/scanning');
  }

  return (
    <OptimizerLayout
      step={2}
      pageType="action"
      backTo="/optimizer"
      metaTitle="Website-URL eingeben — Cloud Code Optimizer"
      metaDescription="Gib deine Website-URL ein und starte den kostenlosen Scan."
    >
      <h1 className="text-3xl sm:text-4xl font-display font-bold text-titanium-50 tracking-tight leading-tight mb-4">
        Gib deine Website-URL ein
      </h1>
      <p className="text-titanium-300 leading-relaxed mb-8 max-w-2xl">
        Der Scan analysiert nur öffentlich zugängliche Seiten. Für den ersten Scan ist
        keine Anmeldung erforderlich.
      </p>

      <form onSubmit={handleSubmit} className="bg-obsidian-900 border border-titanium-900 rounded-none p-6 sm:p-8 mb-8">
        <label htmlFor="optimizer-url" className="block font-mono text-[11px] uppercase tracking-wider text-titanium-400 mb-2">
          <span className="inline-flex items-center gap-1.5">
            <Globe className="h-3.5 w-3.5" /> Website-URL
          </span>
        </label>
        <input
          id="optimizer-url"
          type="text"
          inputMode="url"
          autoFocus
          value={url}
          onChange={(e) => { setUrl(e.target.value); if (error) setError(null); }}
          placeholder="https://deine-website.de"
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? 'optimizer-url-error' : undefined}
          className="w-full bg-obsidian-950 border border-titanium-700 focus:border-security-500 focus:outline-none rounded-none px-4 py-3 text-titanium-50 placeholder:text-titanium-600 font-mono"
        />

        {error && (
          <div
            id="optimizer-url-error"
            role="alert"
            className="mt-3 flex items-start gap-2 text-sm text-red-300 bg-red-950/40 border border-red-900 rounded-none p-3"
          >
            <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" aria-hidden />
            <span>{error}</span>
          </div>
        )}

        <button
          type="submit"
          className="mt-5 inline-flex items-center gap-2 bg-security-500 hover:bg-security-400 text-white font-bold px-6 py-3 rounded-none transition-colors"
        >
          Scan starten <ArrowRight className="h-4 w-4" />
        </button>
      </form>

      {/* Was nach dem Scan passiert */}
      <h2 className="font-display font-bold text-titanium-100 mb-3">Was danach passiert</h2>
      <ol className="space-y-3">
        {AFTER_SCAN.map(({ icon: Icon, text }, idx) => (
          <li key={text} className="flex items-start gap-3 text-sm text-titanium-300">
            <span className="flex items-center gap-2 shrink-0">
              <span className="font-mono text-xs text-titanium-500 w-4">{idx + 1}</span>
              <Icon className="h-4 w-4 text-security-400" aria-hidden />
            </span>
            {text}
          </li>
        ))}
      </ol>
    </OptimizerLayout>
  );
}
