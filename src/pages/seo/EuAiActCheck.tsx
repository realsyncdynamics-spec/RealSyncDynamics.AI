import { Link } from 'react-router-dom';
import { ArrowLeft, ArrowRight, Cpu, AlertTriangle, CheckCircle2, Calendar } from 'lucide-react';

/**
 * /eu-ai-act-check — fokussierte SEO-Doorway für EU AI Act Pre-Classification.
 * Direct-conversion-Pfad zu /ai-act-klassifikator.
 */
export function EuAiActCheck() {
  return (
    <div className="min-h-screen bg-obsidian-950 text-titanium-100">
      <header className="h-14 border-b border-titanium-900 bg-obsidian-900 flex items-center px-4">
        <Link to="/" className="p-1.5 rounded-none hover:bg-obsidian-800 text-titanium-400 hover:text-titanium-200 mr-3">
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-none bg-gradient-to-br from-amber-500 to-red-700 flex items-center justify-center">
            <Cpu className="h-4 w-4 text-white" />
          </div>
          <div className="font-display font-bold text-sm tracking-tight text-titanium-50">EU AI Act Check</div>
        </div>
      </header>

      <main className="px-4 sm:px-6 py-12 sm:py-16">
        <div className="max-w-3xl mx-auto space-y-10">
          <div className="text-center">
            <div className="inline-flex items-center gap-2 px-3 py-1 border border-amber-900 bg-amber-950/30 text-amber-300 text-xs font-bold uppercase tracking-wider rounded-none mb-5">
              <Cpu className="h-3 w-3" /> EU 2024/1689 · High-Risk · Annex III
            </div>
            <h1 className="text-3xl sm:text-5xl font-display font-bold text-titanium-50 tracking-tight leading-tight mb-4">
              EU AI Act Check — <span className="text-security-400">in 60 Sekunden klassifizieren</span>
            </h1>
            <p className="text-lg text-titanium-300 max-w-xl mx-auto leading-relaxed">
              Ist dein KI-System Limited-Risk, High-Risk oder verbotene Praktik nach Art. 5?
              12-Fragen-Wizard mit Annex-III-Mapping. Sofort-Indikation plus Pflichtenliste.
            </p>
          </div>

          <Section title="Warum jetzt — Enforcement-Timeline">
            <div className="grid sm:grid-cols-2 gap-3">
              {[
                { d: 'Februar 2025', t: 'Verbotene Praktiken Art. 5', s: 'Wirksam' },
                { d: 'August 2025', t: 'GPAI / Foundation Models Art. 53', s: 'Wirksam' },
                { d: 'August 2026', t: 'High-Risk-Systeme Art. 6+', s: 'Voll wirksam' },
                { d: 'August 2027', t: 'High-Risk in Sicherheitsbauteile', s: 'Voll wirksam' },
              ].map((p) => (
                <div key={p.d} className="p-3 bg-obsidian-900 border border-titanium-900 rounded-none">
                  <div className="flex items-baseline gap-2 mb-1">
                    <Calendar className="h-3.5 w-3.5 text-amber-400" />
                    <span className="font-mono text-xs text-amber-300">{p.d}</span>
                  </div>
                  <div className="font-display font-bold text-titanium-50 text-sm">{p.t}</div>
                  <div className="text-xs text-titanium-500 mt-0.5">{p.s}</div>
                </div>
              ))}
            </div>
            <p className="text-xs text-titanium-500 mt-3">
              Bußgeld-Rahmen: <strong className="text-amber-300">35 Mio. € oder 7 % Jahresumsatz</strong>
              {' '}(jeweils der höhere Wert). Höher als DSGVO-Maximum.
            </p>
          </Section>

          <Section title="Was der Check liefert">
            <ul className="space-y-2 text-sm">
              <li className="flex items-start gap-2"><CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" /><span><strong className="text-titanium-50">Indikative Klassifikation</strong> in eine von 4 Risiko-Stufen (Prohibited / High / Limited / Minimal)</span></li>
              <li className="flex items-start gap-2"><CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" /><span><strong className="text-titanium-50">Annex-III-Mapping</strong> bei High-Risk auf Punkt 1-8 (Biometrie, Kreditscoring, HR, Behörden, …)</span></li>
              <li className="flex items-start gap-2"><CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" /><span><strong className="text-titanium-50">Pflichtenliste pro Stufe</strong> (Risk-Management Art. 9, Technical Doc Art. 11, Human Oversight Art. 14, …)</span></li>
              <li className="flex items-start gap-2"><CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" /><span><strong className="text-titanium-50">Confidence-Score</strong> mit Hinweis auf manuelle Anwalts-/Notified-Body-Prüfung</span></li>
              <li className="flex items-start gap-2"><CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" /><span><strong className="text-titanium-50">Spezial-Warnungen</strong> bei Emotion Recognition (Art. 5(1)(f)), Biometrie (Art. 5(1)(h)), Social Scoring</span></li>
            </ul>
          </Section>

          <Section title="Methodik">
            <p>
              Wir nutzen versionierte JSON-Decision-Trees, kein LLM-Endurteil. Die Klassifikation
              ist deterministisch und reproduzierbar — bei jedem Output zeigt die Plattform die
              Methodology-Version. Final-Klassifikation für High-Risk muss durch Notified Body erfolgen,
              das stellen wir transparent dar.
            </p>
            <p className="text-xs text-titanium-500">
              Mehr unter <Link to="/legal/methodology" className="text-security-400 hover:text-security-300">/legal/methodology</Link> · Grenzen: <Link to="/grenzen" className="text-security-400 hover:text-security-300">/grenzen</Link>
            </p>
          </Section>

          <div className="mt-12 p-6 sm:p-8 bg-obsidian-900 border border-security-700 rounded-none">
            <h2 className="font-display font-bold text-titanium-50 text-xl mb-2">
              60 Sekunden zum AI-Act-Status
            </h2>
            <div className="flex flex-col sm:flex-row gap-2 mt-4">
              <Link to="/ai-act-klassifikator?source=eu-ai-act-check" className="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-security-500 hover:bg-security-600 text-white text-sm font-bold rounded-none">
                Klassifikator starten <ArrowRight className="h-4 w-4" />
              </Link>
              <Link to="/ai-act-faq" className="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-obsidian-950 border border-titanium-700 hover:border-security-500 text-titanium-200 text-sm font-bold rounded-none">
                FAQ zum AI Act
              </Link>
              <Link to="/contact-sales?source=eu-ai-act-check" className="inline-flex items-center justify-center gap-2 px-5 py-2.5 text-titanium-400 hover:text-titanium-200 text-sm rounded-none">
                High-Risk-Beratung
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
