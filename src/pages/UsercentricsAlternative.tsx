import { Link } from 'react-router-dom';
import { ArrowLeft, Cookie, ArrowRight, Check, X, Minus, Euro, Code } from 'lucide-react';

export function UsercentricsAlternative() {
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
          <div className="font-display font-bold text-sm tracking-tight text-titanium-50">Usercentrics-Alternative</div>
        </div>
      </header>

      <main className="px-4 sm:px-6 py-12 sm:py-16">
        <div className="max-w-4xl mx-auto space-y-10">
          <div className="text-center">
            <div className="inline-flex items-center gap-2 px-3 py-1 border border-amber-900 bg-amber-950/30 text-amber-300 text-xs font-bold uppercase tracking-wider rounded-none mb-5">
              <Euro className="h-3 w-3" /> 3× günstiger · KI-Compliance inklusive · 1-Zeile-Embed
            </div>
            <h1 className="text-3xl sm:text-5xl font-display font-bold text-titanium-50 tracking-tight leading-tight mb-4">
              Usercentrics-Alternative — <span className="text-security-400">deutlich mehr als Cookie-Banner</span>
            </h1>
            <p className="text-lg text-titanium-300 max-w-xl mx-auto leading-relaxed">
              Usercentrics ist DACH-Marktführer für Cookie-Consent (~150 €/M). Wir bieten dasselbe ab 49 €/M —
              <strong className="text-titanium-50"> plus AVV, VVT, AI-Act-Tools, Audit-Log</strong>.
            </p>
          </div>

          <div className="bg-obsidian-900 border border-titanium-900 rounded-none overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-obsidian-950 text-[11px] font-bold text-titanium-400 uppercase tracking-wider">
                <tr>
                  <th className="text-left px-4 py-3">Feature</th>
                  <th className="text-center px-4 py-3 w-32">Usercentrics</th>
                  <th className="text-center px-4 py-3 w-32 text-emerald-300">RealSync</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-titanium-900">
                {[
                  { f: 'Pricing ab', o: '~150 €/M', r: '49 €/M (Cookie-SDK Pro) · ab 29€/M (Full-Suite)' },
                  { f: 'Cookie-Consent-Banner BfDI 2024', o: 'yes', r: 'yes' },
                  { f: 'i18n DE/EN', o: 'yes', r: 'yes' },
                  { f: '3 gleichberechtigte Buttons (kein Dark-Pattern)', o: 'yes', r: 'yes' },
                  { f: 'Embedbar via 1-Zeile-Script', o: 'partial', r: 'yes' },
                  { f: 'Consent-Audit-Log + Export', o: 'partial', r: 'yes' },
                  { f: 'AVV-Generator', o: 'no', r: 'yes' },
                  { f: 'VVT-Wizard (Art. 30)', o: 'no', r: 'yes' },
                  { f: 'DSFA-Wizard (Art. 35)', o: 'no', r: 'yes' },
                  { f: 'AI-Act-Risikoklassifikator', o: 'no', r: 'yes' },
                  { f: 'AI-Audit-Log (pro KI-Call)', o: 'no', r: 'yes' },
                  { f: 'EU-Hosted', o: 'yes', r: 'yes' },
                  { f: '72h-Meldepflicht-Timer', o: 'no', r: 'yes' },
                  { f: 'Bußgeld-Rechner', o: 'no', r: 'yes' },
                  { f: 'Setup-Zeit', o: '1-2 Wochen', r: 'Selbe Stunde (Snippet einbetten)' },
                  { f: 'Kostenlose Self-Service-Tools', o: 'no', r: 'yes (8 Stück)' },
                  { f: 'Made-in-Germany', o: 'yes', r: 'yes' },
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

          <Section title="Warum wechseln">
            <ul className="space-y-3 text-sm">
              <li className="flex items-start gap-3">
                <Code className="h-5 w-5 text-emerald-400 shrink-0 mt-0.5" />
                <div>
                  <strong className="text-titanium-50">1-Zeile-Embed statt Konfigurator-Hölle</strong>:
                  <code className="ml-2 px-2 py-0.5 bg-obsidian-950 border border-titanium-700 text-emerald-300 text-[11px] font-mono">
                    {'<script src="…/sdk/cookie-consent.js" data-rsd-key="…">'}
                  </code>
                </div>
              </li>
              <li className="flex items-start gap-3">
                <Euro className="h-5 w-5 text-emerald-400 shrink-0 mt-0.5" />
                <div>
                  <strong className="text-titanium-50">3× günstiger</strong> bei gleichen Features. Plus 8 weitere
                  Compliance-Tools inklusive ab 29 €/M.
                </div>
              </li>
              <li className="flex items-start gap-3">
                <Cookie className="h-5 w-5 text-emerald-400 shrink-0 mt-0.5" />
                <div>
                  <strong className="text-titanium-50">KI-Compliance ist Default</strong>. Usercentrics ist Cookie-only.
                  Wenn du KI nutzt, brauchst du beides — wir haben beides.
                </div>
              </li>
            </ul>
          </Section>

          <Section title="Migration in unter einer Stunde">
            <p>
              Usercentrics-Snippet entfernen, RealSync-Snippet einfügen. Fertig.
              Bestehende Consent-Cookies bleiben erhalten (kein Re-Prompt-Spam für deine User).
              Optional: Custom-Theme via CSS-Override.
            </p>
          </Section>

          <div className="mt-12 p-6 sm:p-8 bg-obsidian-900 border border-security-700 rounded-none">
            <h2 className="font-display font-bold text-titanium-50 text-xl mb-2">
              Test in 5 Minuten — Snippet einfügen, fertig.
            </h2>
            <div className="flex flex-col sm:flex-row gap-2 mt-4">
              <Link to="/cookie-consent-sdk" className="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-security-500 hover:bg-security-600 text-white text-sm font-bold rounded-none">
                SDK-Snippet ansehen <ArrowRight className="h-4 w-4" />
              </Link>
              <Link to="/contact-sales?source=usercentrics-alt" className="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-obsidian-950 border border-titanium-700 hover:border-security-500 text-titanium-200 text-sm font-bold rounded-none">
                Migration-Call buchen
              </Link>
              <Link to="/dsgvo-tool-vergleich" className="inline-flex items-center justify-center gap-2 px-5 py-2.5 text-titanium-400 hover:text-titanium-200 text-sm rounded-none">
                Volles Tool-Vergleich
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
