import { Link } from 'react-router-dom';
import { ArrowLeft, ArrowRight, Check, X, Minus, Cookie, Code } from 'lucide-react';

export function IubendaAlternative() {
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
          <div className="font-display font-bold text-sm tracking-tight text-titanium-50">Iubenda-Alternative</div>
        </div>
      </header>

      <main className="px-4 sm:px-6 py-12 sm:py-16">
        <div className="max-w-4xl mx-auto space-y-10">
          <div className="text-center">
            <div className="inline-flex items-center gap-2 px-3 py-1 border border-amber-900 bg-amber-950/30 text-amber-300 text-xs font-bold uppercase tracking-wider rounded-none mb-5">
              DACH-Pricing · Made in Germany · KI-Compliance inklusive
            </div>
            <h1 className="text-3xl sm:text-5xl font-display font-bold text-titanium-50 tracking-tight leading-tight mb-4">
              Iubenda-Alternative — <span className="text-security-400">DACH-fokussiert statt Pan-EU</span>
            </h1>
            <p className="text-lg text-titanium-300 max-w-2xl mx-auto leading-relaxed">
              Iubenda (Mailand, gehört seit 2022 zu team.blue) ist beliebt im SMB-Segment.
              Wir liefern dasselbe — fokussiert auf <strong className="text-titanium-50">DACH-Recht (BfDI 2024, TDDDG, BGH-Rechtsprechung)</strong> und mit
              KI-Compliance-Tools obendrauf.
            </p>
          </div>

          <div className="bg-obsidian-900 border border-titanium-900 rounded-none overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-obsidian-950 text-[11px] font-bold text-titanium-400 uppercase tracking-wider">
                <tr>
                  <th className="text-left px-4 py-3">Feature</th>
                  <th className="text-center px-4 py-3 w-32">Iubenda</th>
                  <th className="text-center px-4 py-3 w-32 text-emerald-300">RealSync</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-titanium-900">
                {[
                  { f: 'Pricing ab', o: '~108 €/Jahr Ultimate', r: '79 €/M (Starter) · Free Audit kostenlos' },
                  { f: 'Cookie-Banner', o: 'yes', r: 'yes' },
                  { f: 'BfDI 2024 / 3 gleichberechtigte Buttons', o: 'partial', r: 'yes' },
                  { f: 'Datenschutzerklärung-Generator', o: 'yes', r: 'yes' },
                  { f: 'Internal Privacy Policy (für Mitarbeiter:innen)', o: 'yes', r: 'partial' },
                  { f: '40+ Sprachen out-of-the-box', o: 'yes', r: 'partial' },
                  { f: 'AVV-Generator (Auftragsverarbeitung)', o: 'partial', r: 'yes' },
                  { f: 'VVT-Wizard (Art. 30)', o: 'no', r: 'yes' },
                  { f: 'DSFA-Wizard (Art. 35)', o: 'no', r: 'yes' },
                  { f: 'TOM-Generator (Art. 32)', o: 'no', r: 'yes' },
                  { f: 'AI-Act-Klassifikator', o: 'no', r: 'yes' },
                  { f: 'AI-Audit-Log (pro KI-Call)', o: 'no', r: 'yes' },
                  { f: '72h-Meldepflicht-Timer', o: 'no', r: 'yes' },
                  { f: 'Bußgeld-Rechner', o: 'no', r: 'yes' },
                  { f: 'Audit-Tool (Website-Scan)', o: 'no', r: 'yes' },
                  { f: 'EU-Hosting Default', o: 'partial', r: 'yes' },
                  { f: 'Made-in-Germany / DACH-Fokus', o: 'no (IT)', r: 'yes' },
                  { f: 'API-Zugriff', o: 'partial', r: 'yes' },
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

          <Section title="Wann Iubenda die richtige Wahl ist">
            <ul className="space-y-2 text-sm">
              <li className="flex items-start gap-2"><Check className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" /><span>Du betreibst eine internationale Site mit <strong className="text-titanium-50">40+ Sprachen</strong>.</span></li>
              <li className="flex items-start gap-2"><Check className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" /><span>Du brauchst eine fertige Internal Privacy Policy für italienisches/spanisches Arbeitsrecht.</span></li>
              <li className="flex items-start gap-2"><Check className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" /><span>Du brauchst <em>nur</em> Cookie-Banner + Datenschutz-Generator und keine weiteren DSGVO-Tools.</span></li>
            </ul>
          </Section>

          <Section title="Wann RealSync die richtige Wahl ist">
            <ul className="space-y-2 text-sm">
              <li className="flex items-start gap-2"><Check className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" /><span>Du fokussierst auf <strong className="text-titanium-50">DACH-Markt</strong> (DE/AT/CH) — BfDI-Konformität, deutsche Aufsichtsbehörden, deutsche Kanzlei-Rechtsprechung.</span></li>
              <li className="flex items-start gap-2"><Check className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" /><span>Du nutzt <strong className="text-titanium-50">KI</strong> und brauchst zusätzlich AI-Act-Klassifikator + Audit-Log.</span></li>
              <li className="flex items-start gap-2"><Check className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" /><span>Du willst <strong className="text-titanium-50">eine Plattform für alles</strong> (AVV, VVT, DSFA, Bußgeld-Rechner, Audit) statt Cookie-Tool + 5 anderen Tools.</span></li>
              <li className="flex items-start gap-2"><Check className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" /><span>Du brauchst <strong className="text-titanium-50">EU-Hosting ohne Konfigurations-Aufwand</strong> — bei uns Default, nicht Premium-Add-on.</span></li>
            </ul>
          </Section>

          <Section title="Migration in unter einer Stunde">
            <p>
              Iubenda-Snippet entfernen, RealSync-Snippet einfügen. Bestehende Consent-Cookies bleiben kompatibel.
              Datenschutz-Generator-Inhalte aus Iubenda kopierst du 1:1 in unseren Generator (oder lässt sie automatisch
              aus deiner Sub-Processor-Liste regenerieren).
            </p>
            <div className="p-3 bg-obsidian-950 border border-titanium-700 rounded-none flex items-start gap-3">
              <Code className="h-4 w-4 text-emerald-400 shrink-0 mt-1" />
              <code className="text-emerald-300 text-xs font-mono break-all leading-relaxed">
                {'<script src="https://RealSyncDynamicsAI.de/sdk/cookie-consent.js" data-rsd-key="YOUR_KEY"></script>'}
              </code>
            </div>
          </Section>

          <div className="mt-12 p-6 sm:p-8 bg-obsidian-900 border border-security-700 rounded-none">
            <h2 className="font-display font-bold text-titanium-50 text-xl mb-2">
              DACH-Compliance auf einer Plattform — ab 79 €/M (Starter)
            </h2>
            <div className="flex flex-col sm:flex-row gap-2 mt-4">
              <Link to="/cookie-consent-sdk" className="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-security-500 hover:bg-security-600 text-white text-sm font-bold rounded-none">
                SDK-Snippet ansehen <ArrowRight className="h-4 w-4" />
              </Link>
              <Link to="/pricing?source=iubenda-alt" className="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-obsidian-950 border border-titanium-700 hover:border-security-500 text-titanium-200 text-sm font-bold rounded-none">
                Tarif starten
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
            <Link to="/impressum" className="hover:text-titanium-300">Impressum</Link>
            <Link to="/legal/privacy" className="hover:text-titanium-300">Datenschutz</Link>
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
