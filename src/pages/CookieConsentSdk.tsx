import { Link } from 'react-router-dom';
import {
  ArrowLeft, ShieldCheck, Cookie, ArrowRight, Check, Code, Copy,
} from 'lucide-react';
import { useState } from 'react';

const SNIPPET = `<script src="https://RealSyncDynamicsAI.de/sdk/cookie-consent.js"
        data-rsd-key="rsd_DEIN_API_KEY"
        defer></script>`;

export function CookieConsentSdk() {
  const [copied, setCopied] = useState(false);

  function copy() {
    navigator.clipboard?.writeText(SNIPPET).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  return (
    <div className="min-h-screen bg-obsidian-950 text-titanium-100">
      <header className="h-14 border-b border-titanium-900 bg-obsidian-900 flex items-center px-4">
        <Link to="/" className="p-1.5 rounded-none hover:bg-obsidian-800 text-titanium-400 hover:text-titanium-200 mr-3">
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-none bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center">
            <Cookie className="h-4 w-4 text-white" />
          </div>
          <div className="font-display font-bold text-sm tracking-tight text-titanium-50">Cookie-Consent SDK</div>
        </div>
      </header>

      <main className="px-4 sm:px-6 py-12 sm:py-16">
        <div className="max-w-3xl mx-auto space-y-12">
          <div className="text-center">
            <div className="inline-flex items-center gap-2 px-3 py-1 border border-amber-900 bg-amber-950/30 text-amber-300 text-xs font-bold uppercase tracking-wider rounded-none mb-5">
              <ShieldCheck className="h-3 w-3" /> BfDI-Leitlinie 2024 · § 25 TTDSG · BGH-Urteil "Cookie II"
            </div>
            <h1 className="text-3xl sm:text-5xl font-display font-bold text-titanium-50 tracking-tight leading-tight mb-4">
              Cookie-Banner. <span className="text-amber-400">DSGVO-konform.</span> 1 Zeile Code.
            </h1>
            <p className="text-lg text-titanium-300 max-w-xl mx-auto leading-relaxed">
              Drei gleichberechtigte Buttons (Accept · Reject · Customize). Kein Dark-Pattern.
              Kein Cookie vor Consent. Open-Source-kompatibel.
            </p>
          </div>

          <div className="bg-obsidian-900 border border-titanium-900 p-5 rounded-none">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2 text-xs font-bold text-titanium-400 uppercase tracking-wider">
                <Code className="h-3.5 w-3.5" /> Embed-Snippet
              </div>
              <button onClick={copy} className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-obsidian-950 border border-titanium-700 hover:border-security-500 text-titanium-200 text-xs rounded-none">
                {copied ? <><Check className="h-3 w-3 text-emerald-400" /> kopiert</> : <><Copy className="h-3 w-3" /> Kopieren</>}
              </button>
            </div>
            <pre className="bg-obsidian-950 p-3 text-xs text-emerald-300 font-mono overflow-x-auto whitespace-pre-wrap break-all">{SNIPPET}</pre>
            <p className="text-[11px] text-titanium-500 mt-2">
              Snippet vor <code className="text-titanium-300 font-mono">{'</body>'}</code> einfügen. Async laden, kein Render-Block.
            </p>
          </div>

          <div className="grid sm:grid-cols-3 gap-3">
            {[
              { title: '3 gleichberechtigte Buttons', desc: 'BfDI-Leitlinie 2024: Accept + Reject + Customize visuell gleich groß. Keine Dark-Pattern.' },
              { title: 'i18n: DE + EN', desc: 'Auto-Detect via <html lang>. Mehr Sprachen auf Anfrage.' },
              { title: 'Event-Hook', desc: 'window-event "rsd-consent-updated" für GA/Meta-Loader-Logik.' },
              { title: 'Hard-Edge Industrial Design', desc: 'Schwarz/Weiß-Standard, keine Branding-Sticker. Optional Custom-CSS.' },
              { title: 'Local Storage', desc: 'Kein Cookie. Kein Server-Roundtrip pro Visitor. DSGVO-Default-Deny.' },
              { title: 'Telemetry-zurück', desc: '/api/cookie-consent-event aggregiert anonym Consent-Rates für Audit-Trail.' },
            ].map((f) => (
              <div key={f.title} className="p-4 bg-obsidian-900 border border-titanium-900 rounded-none">
                <Check className="h-4 w-4 text-emerald-400 mb-2" />
                <div className="font-display font-bold text-titanium-50 text-sm mb-1">{f.title}</div>
                <div className="text-xs text-titanium-400 leading-relaxed">{f.desc}</div>
              </div>
            ))}
          </div>

          <div className="bg-obsidian-900 border border-amber-700 p-6 rounded-none">
            <h2 className="font-display font-bold text-titanium-50 text-xl mb-2">Pricing</h2>
            <div className="grid sm:grid-cols-2 gap-4 mt-4">
              <div className="p-4 bg-obsidian-950 border border-titanium-700 rounded-none">
                <div className="text-xs text-titanium-500 uppercase tracking-wider mb-1">Free</div>
                <div className="font-display text-3xl font-bold text-titanium-50 mb-2">0 €</div>
                <ul className="text-xs text-titanium-300 space-y-1 mb-4">
                  <li>· "Powered by RSD" Footer</li>
                  <li>· Default Theme</li>
                  <li>· 100k Visitors/M</li>
                </ul>
                <Link to="/contact-sales?source=cookie-sdk-free" className="text-xs text-amber-400 hover:underline">→ Free starten</Link>
              </div>
              <div className="p-4 bg-amber-950/20 border border-amber-700 rounded-none">
                <div className="text-xs text-amber-400 uppercase tracking-wider mb-1 font-bold">Pro</div>
                <div className="font-display text-3xl font-bold text-titanium-50 mb-2">49 € <span className="text-sm font-normal text-titanium-400">/M</span></div>
                <ul className="text-xs text-titanium-300 space-y-1 mb-4">
                  <li>· White-Label (kein RSD-Footer)</li>
                  <li>· Custom Theme + Logo</li>
                  <li>· Unlimited Visitors</li>
                  <li>· Consent-Audit-Log + CSV-Export</li>
                </ul>
                <a
                  href="https://buy.stripe.com/5kQ6oGeQK44L3Uv3PD8og0f"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold rounded-none"
                >
                  Jetzt buchen <ArrowRight className="h-3 w-3" />
                </a>
              </div>
            </div>
            <p className="text-[11px] text-titanium-500 mt-4">
              Vergleich: OneTrust ab ~600 €/M · Usercentrics ab ~150 €/M. Wir 49 €/M, transparent, ohne Lock-in.
            </p>
          </div>
        </div>
      </main>

      <footer className="border-t border-titanium-900 mt-12 py-6 px-4">
        <div className="max-w-3xl mx-auto flex flex-col sm:flex-row gap-3 sm:justify-between text-xs text-titanium-500">
          <div>© 2026 RealSync Dynamics · Made in Germany · EU-Hosted</div>
          <div className="flex flex-wrap gap-3">
            <Link to="/legal/privacy" className="hover:text-titanium-300">Datenschutz</Link>
            <Link to="/legal/avv" className="hover:text-titanium-300">AVV</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
