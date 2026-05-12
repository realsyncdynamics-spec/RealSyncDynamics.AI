import { Link } from 'react-router-dom';
import { ArrowLeft, ArrowRight, Check, X, Minus, Cookie, Globe, Code } from 'lucide-react';

export function CookiebotAlternative() {
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
          <div className="font-display font-bold text-sm tracking-tight text-titanium-50">Cookiebot-Alternative</div>
        </div>
      </header>

      <main className="px-4 sm:px-6 py-12 sm:py-16">
        <div className="max-w-4xl mx-auto space-y-10">
          <div className="text-center">
            <div className="inline-flex items-center gap-2 px-3 py-1 border border-amber-900 bg-amber-950/30 text-amber-300 text-xs font-bold uppercase tracking-wider rounded-none mb-5">
              <Globe className="h-3 w-3" /> Schrems-II-fest · EU-Hosted · DACH-Pricing
            </div>
            <h1 className="text-3xl sm:text-5xl font-display font-bold text-titanium-50 tracking-tight leading-tight mb-4">
              Cookiebot-Alternative — <span className="text-security-400">EU-souverän statt US-Cloud</span>
            </h1>
            <p className="text-lg text-titanium-300 max-w-2xl mx-auto leading-relaxed">
              Cookiebot (Cybot A/S, gehört zu Usercentrics) ist beliebt — wurde aber 2022 vom VG Wiesbaden
              wegen US-Datentransfer (Akamai-CDN) <strong className="text-titanium-50">untersagt</strong>.
              Wir liefern dasselbe — EU-hosted, ohne US-CDN, ab 49 €/Monat.
            </p>
          </div>

          <div className="p-4 bg-amber-950/20 border border-amber-900 rounded-none">
            <p className="text-sm text-amber-200 leading-relaxed">
              <strong className="text-amber-100">Wichtig zur Schrems-II-Lage:</strong> Das VG-Wiesbaden-Urteil
              (6 L 738/21.WI) wurde im OVG-Verfahren später eingeschränkt. Cookiebot hat zwischenzeitlich
              EU-Hosting-Optionen ergänzt. Der Punkt: Du musst bei Cookiebot aktiv darauf achten, EU-only zu konfigurieren —
              bei uns ist EU-Hosting Default ohne Wahl.
            </p>
          </div>

          <div className="bg-obsidian-900 border border-titanium-900 rounded-none overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-obsidian-950 text-[11px] font-bold text-titanium-400 uppercase tracking-wider">
                <tr>
                  <th className="text-left px-4 py-3">Feature</th>
                  <th className="text-center px-4 py-3 w-32">Cookiebot</th>
                  <th className="text-center px-4 py-3 w-32 text-emerald-300">RealSync</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-titanium-900">
                {[
                  { f: 'Pricing ab', o: '~110 €/M (Premium)', r: '49 €/M Cookie-SDK Pro · 29 €/M Full-Suite' },
                  { f: 'EU-Hosting Default', o: 'partial', r: 'yes' },
                  { f: 'BfDI 2024 konform', o: 'yes', r: 'yes' },
                  { f: 'Auto-Cookie-Scan (Crawler)', o: 'yes', r: 'partial' },
                  { f: 'i18n (40+ Sprachen)', o: 'yes', r: 'partial' },
                  { f: '3 gleichberechtigte Buttons', o: 'yes', r: 'yes' },
                  { f: '1-Zeile-Embed', o: 'yes', r: 'yes' },
                  { f: 'Consent-Audit-Log + Export', o: 'yes', r: 'yes' },
                  { f: 'Google Consent Mode v2', o: 'yes', r: 'yes' },
                  { f: 'IAB TCF v2.2', o: 'yes', r: 'partial' },
                  { f: 'AVV-Generator', o: 'no', r: 'yes' },
                  { f: 'VVT-Wizard (Art. 30)', o: 'no', r: 'yes' },
                  { f: 'AI-Act-Klassifikator', o: 'no', r: 'yes' },
                  { f: 'AI-Audit-Log (pro KI-Call)', o: 'no', r: 'yes' },
                  { f: '72h-Meldepflicht-Timer', o: 'no', r: 'yes' },
                  { f: 'Bußgeld-Rechner', o: 'no', r: 'yes' },
                  { f: 'Made-in-Germany', o: 'no (DK)', r: 'yes' },
                ].map((r) => (
                  <tr key={r.f} className="hover:bg-obsidian-950">
                    <td className="px-4 py-3 text-titanium-200">{r.f}</td>
                    <td className="px-4 py-3 text-center">{cell(r.o)}</td>
                    <td className="px-4 py-3 text-center">{cell(r.r)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <Section title="Wann Cookiebot die richtige Wahl ist">
            <ul className="space-y-2 text-sm">
              <li className="flex items-start gap-2"><Check className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" /><span>Du brauchst <strong className="text-titanium-50">automatischen Cookie-Crawler</strong> mit Wartung über Web-Backend.</span></li>
              <li className="flex items-start gap-2"><Check className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" /><span>Du brauchst <strong className="text-titanium-50">vollständigen IAB TCF v2.2</strong> für AdTech-Stack.</span></li>
              <li className="flex items-start gap-2"><Check className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" /><span>Du brauchst <strong className="text-titanium-50">40+ Sprachen out-of-the-box</strong> (international).</span></li>
            </ul>
          </Section>

          <Section title="Wann RealSync die richtige Wahl ist">
            <ul className="space-y-2 text-sm">
              <li className="flex items-start gap-2"><Check className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" /><span>Du willst <strong className="text-titanium-50">EU-Hosting ohne Konfigurations-Aufwand</strong> — bei uns Default, nicht Option.</span></li>
              <li className="flex items-start gap-2"><Check className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" /><span>Du willst <strong className="text-titanium-50">DACH-Pricing</strong> (49 € statt 110 €/M).</span></li>
              <li className="flex items-start gap-2"><Check className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" /><span>Du nutzt <strong className="text-titanium-50">KI</strong> und brauchst zusätzlich AI-Act-Klassifikator + Audit-Log.</span></li>
              <li className="flex items-start gap-2"><Check className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" /><span>Du willst <strong className="text-titanium-50">eine Plattform</strong> für AVV, VVT, Cookie und KI — statt 3 Anbietern.</span></li>
            </ul>
          </Section>

          <Section title="Migration in unter einer Stunde">
            <p>Cookiebot-Snippet entfernen, RealSync-Snippet einfügen. Bestehende Consent-Cookies bleiben kompatibel.</p>
            <div className="p-3 bg-obsidian-950 border border-titanium-700 rounded-none flex items-start gap-3">
              <Code className="h-4 w-4 text-emerald-400 shrink-0 mt-1" />
              <code className="text-emerald-300 text-xs font-mono break-all leading-relaxed">
                {'<script src="https://RealSyncDynamicsAI.de/sdk/cookie-consent.js" data-rsd-key="YOUR_KEY"></script>'}
              </code>
            </div>
          </Section>

          <div className="mt-12 p-6 sm:p-8 bg-obsidian-900 border border-security-700 rounded-none">
            <h2 className="font-display font-bold text-titanium-50 text-xl mb-2">
              EU-Hosting als Default. 49 €/M statt 110 €/M.
            </h2>
            <div className="flex flex-col sm:flex-row gap-2 mt-4">
              <Link to="/cookie-consent-sdk" className="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-security-500 hover:bg-security-600 text-white text-sm font-bold rounded-none">
                SDK-Snippet ansehen <ArrowRight className="h-4 w-4" />
              </Link>
              <Link to="/contact-sales?source=cookiebot-alt" className="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-obsidian-950 border border-titanium-700 hover:border-security-500 text-titanium-200 text-sm font-bold rounded-none">
                Migration-Call buchen
              </Link>
              <Link to="/dsgvo-tool-vergleich" className="inline-flex items-center justify-center gap-2 px-5 py-2.5 text-titanium-400 hover:text-titanium-200 text-sm rounded-none">
                Voller Tool-Vergleich
              </Link>
            </div>
          </div>
        </div>
      </main>

      <footer className="border-t border-titanium-900 mt-12 py-6 px-4">
        <div className="max-w-4xl mx-auto flex flex-col sm:flex-row gap-3 sm:justify-between text-xs text-titanium-500">
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

function cell(v: string): React.ReactNode {
  if (v === 'yes') return <Check className="h-4 w-4 text-emerald-400 inline" />;
  if (v === 'no') return <X className="h-4 w-4 text-red-400 inline" />;
  if (v === 'partial') return <Minus className="h-4 w-4 text-amber-400 inline" />;
  return <span className="text-xs text-titanium-300">{v}</span>;
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="text-xl sm:text-2xl font-display font-bold text-titanium-50 mb-3">{title}</h2>
      <div className="prose prose-invert max-w-none text-titanium-300 text-sm sm:text-base leading-relaxed space-y-3">
        {children}
      </div>
    </section>
  );
}
