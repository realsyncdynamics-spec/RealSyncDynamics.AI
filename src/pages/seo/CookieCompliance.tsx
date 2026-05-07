import { Link } from 'react-router-dom';
import { ArrowLeft, ArrowRight, Cookie, AlertTriangle, CheckCircle2, Code } from 'lucide-react';

/**
 * /cookie-compliance — fokussierte SEO-Doorway für Cookie-Banner-/TTDSG-/
 * BfDI-2024-Konformität. Direct-conversion zu /audit oder /cookie-consent-sdk.
 */
export function CookieCompliance() {
  return (
    <div className="min-h-screen bg-obsidian-950 text-titanium-100">
      <header className="h-14 border-b border-titanium-900 bg-obsidian-900 flex items-center px-4">
        <Link to="/" className="p-1.5 rounded-none hover:bg-obsidian-800 text-titanium-400 hover:text-titanium-200 mr-3">
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-none bg-gradient-to-br from-amber-500 to-orange-700 flex items-center justify-center">
            <Cookie className="h-4 w-4 text-white" />
          </div>
          <div className="font-display font-bold text-sm tracking-tight text-titanium-50">Cookie-Compliance</div>
        </div>
      </header>

      <main className="px-4 sm:px-6 py-12 sm:py-16">
        <div className="max-w-3xl mx-auto space-y-10">
          <div className="text-center">
            <div className="inline-flex items-center gap-2 px-3 py-1 border border-amber-900 bg-amber-950/30 text-amber-300 text-xs font-bold uppercase tracking-wider rounded-none mb-5">
              <Cookie className="h-3 w-3" /> TTDSG § 25 · BfDI 2024 · DSGVO Art. 6 lit. a
            </div>
            <h1 className="text-3xl sm:text-5xl font-display font-bold text-titanium-50 tracking-tight leading-tight mb-4">
              Cookie-Compliance prüfen — <span className="text-security-400">DACH-rechtssicher</span>
            </h1>
            <p className="text-lg text-titanium-300 max-w-xl mx-auto leading-relaxed">
              Drei gleichberechtigte Buttons. Reject vor Tracking-Load. AVV mit allen Anbietern.
              Wir prüfen alle drei Punkte automatisch und liefern den Fix-Pfad.
            </p>
          </div>

          <Section title="Was BfDI 2024 + LG Düsseldorf konkret fordern">
            <ul className="space-y-1.5 text-sm">
              <li className="flex items-start gap-2"><AlertTriangle className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" /><strong className="text-titanium-50 mr-1">3 gleichberechtigte Buttons:</strong> „Alles akzeptieren" / „Alles ablehnen" / „Anpassen" — same size, same color, same position.</li>
              <li className="flex items-start gap-2"><AlertTriangle className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" /><strong className="text-titanium-50 mr-1">Kein Pre-Check:</strong> non-essential Cookies dürfen NICHT vorausgewählt sein (Art. 7 Abs. 4 DSGVO).</li>
              <li className="flex items-start gap-2"><AlertTriangle className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" /><strong className="text-titanium-50 mr-1">Kein Tracker-Load vor Consent:</strong> Google Analytics, Meta Pixel, Hotjar dürfen erst nach Opt-In ausgeführt werden (TTDSG § 25 Abs. 1).</li>
              <li className="flex items-start gap-2"><AlertTriangle className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" /><strong className="text-titanium-50 mr-1">Widerruf gleich einfach:</strong> ein-Klick-Widerruf (Art. 7 Abs. 3) — kein Cookie-Banner-Re-Open-Pflicht.</li>
              <li className="flex items-start gap-2"><AlertTriangle className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" /><strong className="text-titanium-50 mr-1">Audit-Log:</strong> Consent-Entscheidung muss nachweisbar gespeichert werden (Beweislast beim Verantwortlichen).</li>
            </ul>
          </Section>

          <Section title="Aktuelle Bußgelder bei Verstoß">
            <div className="grid sm:grid-cols-2 gap-3">
              <div className="p-3 bg-obsidian-900 border border-amber-900/40 rounded-none">
                <div className="font-mono text-xs text-amber-300 mb-1">LG München I 2022</div>
                <div className="font-display font-bold text-titanium-50 text-sm">Google Fonts ohne Consent</div>
                <div className="text-xs text-titanium-400 mt-1">€ 100 / Anlassfall · Az. 3 O 17493/20</div>
              </div>
              <div className="p-3 bg-obsidian-900 border border-amber-900/40 rounded-none">
                <div className="font-mono text-xs text-amber-300 mb-1">LfDI BaWü 2023</div>
                <div className="font-display font-bold text-titanium-50 text-sm">Newsletter ohne Double-Opt-In</div>
                <div className="text-xs text-titanium-400 mt-1">€ 50 000</div>
              </div>
              <div className="p-3 bg-obsidian-900 border border-amber-900/40 rounded-none">
                <div className="font-mono text-xs text-amber-300 mb-1">DSB Österreich 2022</div>
                <div className="font-display font-bold text-titanium-50 text-sm">Google Analytics ohne TIA</div>
                <div className="text-xs text-titanium-400 mt-1">Untersagungsverfügung</div>
              </div>
              <div className="p-3 bg-obsidian-900 border border-amber-900/40 rounded-none">
                <div className="font-mono text-xs text-amber-300 mb-1">CNIL 2022</div>
                <div className="font-display font-bold text-titanium-50 text-sm">Reject-Button schwerer auffindbar</div>
                <div className="text-xs text-titanium-400 mt-1">€ 60 Mio. (Google Ireland)</div>
              </div>
            </div>
          </Section>

          <Section title="Was wir liefern">
            <ul className="space-y-2 text-sm">
              <li className="flex items-start gap-2"><CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" /><span><strong className="text-titanium-50">Cookie-Audit-Tool</strong> scannt deine Site auf 7 typische Verstöße (3-Button-Pattern, Pre-Check, Tracker-vor-Consent, Google-Fonts-dynamic, Meta-Pixel, GA4, Hotjar)</span></li>
              <li className="flex items-start gap-2"><CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" /><span><strong className="text-titanium-50">Cookie-Consent-SDK</strong> (1-Zeile-Embed) BfDI-2024-konform, kostet 49 €/Monat — Alternative zu OneTrust 24k €/Jahr</span></li>
              <li className="flex items-start gap-2"><CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" /><span><strong className="text-titanium-50">Audit-Log-Endpoint</strong> für nachweisbare Consent-Speicherung (Beweislast-fähig)</span></li>
              <li className="flex items-start gap-2"><CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" /><span><strong className="text-titanium-50">Datenschutzerklärung-Generator</strong> mit automatischer Tool-Erkennung (GA4 / Pixel / Hotjar)</span></li>
            </ul>
          </Section>

          <Section title="1-Zeile-Embed">
            <div className="p-3 bg-obsidian-950 border border-titanium-700 rounded-none flex items-start gap-3">
              <Code className="h-4 w-4 text-emerald-400 shrink-0 mt-1" />
              <code className="text-emerald-300 text-xs font-mono break-all leading-relaxed">
                {'<script src="https://realsyncdynamicsai.de/sdk/cookie-consent.js" data-rsd-key="YOUR_KEY"></script>'}
              </code>
            </div>
            <p className="text-xs text-titanium-500 mt-2">
              Stack-agnostisch: WordPress, Shopify, React, Vue, Next, Astro, statisch. Ohne Backend-Code.
            </p>
          </Section>

          <div className="mt-12 p-6 sm:p-8 bg-obsidian-900 border border-security-700 rounded-none">
            <h2 className="font-display font-bold text-titanium-50 text-xl mb-2">
              Cookie-Audit + SDK-Migration in einer Stunde
            </h2>
            <div className="flex flex-col sm:flex-row gap-2 mt-4">
              <Link to="/audit?intent=cookies" className="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-security-500 hover:bg-security-600 text-white text-sm font-bold rounded-none">
                Cookie-Audit starten <ArrowRight className="h-4 w-4" />
              </Link>
              <Link to="/cookie-consent-sdk" className="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-obsidian-950 border border-titanium-700 hover:border-security-500 text-titanium-200 text-sm font-bold rounded-none">
                SDK-Snippet ansehen
              </Link>
              <Link to="/dsgvo-tool-vergleich" className="inline-flex items-center justify-center gap-2 px-5 py-2.5 text-titanium-400 hover:text-titanium-200 text-sm rounded-none">
                Anbieter-Vergleich
              </Link>
            </div>
          </div>
        </div>
      </main>

      <footer className="border-t border-titanium-900 mt-12 py-6 px-4">
        <div className="max-w-3xl mx-auto flex flex-col sm:flex-row gap-3 sm:justify-between text-xs text-titanium-500">
          <div>© 2026 RealSync Dynamics · Made in Germany · EU-Hosted</div>
          <div className="flex flex-wrap gap-3">
            <Link to="/impressum" className="hover:text-titanium-300">Impressum</Link>
            <Link to="/legal/privacy" className="hover:text-titanium-300">Datenschutz</Link>
          </div>
        </div>
      </footer>
    </div>
  );
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
