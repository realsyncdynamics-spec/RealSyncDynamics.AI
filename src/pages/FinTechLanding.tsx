import { Link } from 'react-router-dom';
import { ArrowLeft, Briefcase, ArrowRight, AlertTriangle, CheckCircle2, Building2 } from 'lucide-react';

export function FinTechLanding() {
  return (
    <div className="min-h-screen bg-obsidian-950 text-titanium-100">
      <header className="h-14 border-b border-titanium-900 bg-obsidian-900 flex items-center px-4">
        <Link to="/" className="p-1.5 rounded-none hover:bg-obsidian-800 text-titanium-400 hover:text-titanium-200 mr-3">
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-none bg-gradient-to-br from-amber-500 to-orange-700 flex items-center justify-center">
            <Briefcase className="h-4 w-4 text-white" />
          </div>
          <div className="font-display font-bold text-sm tracking-tight text-titanium-50">FinTech-Compliance</div>
        </div>
      </header>

      <main className="px-4 sm:px-6 py-12 sm:py-16">
        <div className="max-w-3xl mx-auto space-y-10">
          <div className="text-center">
            <div className="inline-flex items-center gap-2 px-3 py-1 border border-amber-900 bg-amber-950/30 text-amber-300 text-xs font-bold uppercase tracking-wider rounded-none mb-5">
              <Briefcase className="h-3 w-3" /> FinTech · BAIT · MaRisk · DORA · BaFin-ready
            </div>
            <h1 className="text-3xl sm:text-5xl font-display font-bold text-titanium-50 tracking-tight leading-tight mb-4">
              KI für FinTechs — <span className="text-security-400">BaFin-tauglich</span> in 14 Tagen
            </h1>
            <p className="text-lg text-titanium-300 max-w-xl mx-auto leading-relaxed">
              Bonitätsprüfung mit GPT, Fraud-Detection mit Claude, AML-Dokumentation mit Gemini.
              BAIT AT 4.5 + MaRisk AT 7.2 + DORA + AI Act = stapelt sich bis Q1 2027 auf.
            </p>
          </div>

          <Section title="Stack der regulatorischen Pflichten">
            <ul className="space-y-2 text-sm">
              <li className="flex items-start gap-2"><AlertTriangle className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" /><strong className="text-titanium-50">BAIT AT 4.5</strong> — KI-Anbieter sind „sonstiger Fremdbezug von IT-Dienstleistungen". Risikoanalyse + AVV + laufende Überwachung Pflicht.</li>
              <li className="flex items-start gap-2"><AlertTriangle className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" /><strong className="text-titanium-50">MaRisk AT 7.2</strong> — IT-Risiken aus KI-Modellen: Modell-Risikomanagement, Daten-Lineage, Logging.</li>
              <li className="flex items-start gap-2"><AlertTriangle className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" /><strong className="text-titanium-50">AI Act ab 8/2026</strong> — Bonitätsprüfung + Kreditscoring = High-Risk → Conformity Assessment + Tech-Doku + Human Oversight.</li>
              <li className="flex items-start gap-2"><AlertTriangle className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" /><strong className="text-titanium-50">DORA seit 1/2025</strong> — Register kritischer ICT-Drittanbieter, quartalsweise Stresstests.</li>
            </ul>
          </Section>

          <Section title="Was wir liefern">
            <ul className="space-y-2 text-sm">
              <li className="flex items-start gap-2"><CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" /><span><strong className="text-titanium-50">Audit-Log pro AI-Call</strong> — Provider, Modell-Version, Tokens, Kosten, Datenresidenz, User. Direkt für BaFin-Sonderprüfungen exportierbar (CSV + signed PDF).</span></li>
              <li className="flex items-start gap-2"><CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" /><span><strong className="text-titanium-50">AVV-Generator BAIT-tauglich</strong> — vertragliche Mindestinhalte gemäß BAIT AT 4.5 + Sub-Auftragsverarbeiter-Liste + Audit-Rechte gegenüber Provider.</span></li>
              <li className="flex items-start gap-2"><CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" /><span><strong className="text-titanium-50">Multi-Provider-Routing mit Fallback</strong> — Anthropic-Ausfall → automatischer Fallback auf Google oder Self-Hosted-Ollama. Kein Single-Point-of-Failure.</span></li>
              <li className="flex items-start gap-2"><CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" /><span><strong className="text-titanium-50">Provider-Health-Monitoring</strong> mit Alert wenn Anbieter Datenpanne meldet.</span></li>
              <li className="flex items-start gap-2"><CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" /><span><strong className="text-titanium-50">Human-Oversight-Workflow</strong> mit Override + Audit-Trail für High-Risk-Entscheidungen.</span></li>
            </ul>
          </Section>

          <Section title="Use-Cases">
            <div className="grid sm:grid-cols-2 gap-3">
              {[
                { t: 'Bonitätsprüfung mit AI', d: 'Scoring-Modell mit Audit-Log + Erklärbarkeit-Layer + Human-Override' },
                { t: 'Fraud-Detection', d: 'Real-time-Klassifikation mit signiertem PDF-Trail für jeden Alert' },
                { t: 'AML / Anti-Money-Laundering', d: 'Pattern-Erkennung mit Aufsichts-tauglicher Doku' },
                { t: 'Kunden-Email-Klassifikation', d: 'Routing in Service-Queues, redacted vor AI-Aufruf' },
                { t: 'Compliance-Doku-Automation', d: 'Auto-generierte Reports für interne Audits + BaFin' },
                { t: 'Vertrags-Klauseln-Review', d: 'Kreditverträge / B2B-Verträge mit Risk-Scoring' },
              ].map((u) => (
                <div key={u.t} className="p-3 bg-obsidian-900 border border-titanium-900 rounded-none">
                  <div className="font-display font-bold text-titanium-50 text-sm mb-1">{u.t}</div>
                  <div className="text-xs text-titanium-400 leading-relaxed">{u.d}</div>
                </div>
              ))}
            </div>
          </Section>

          <div className="mt-12 p-6 sm:p-8 bg-obsidian-900 border border-security-700 rounded-none">
            <h2 className="font-display font-bold text-titanium-50 text-xl mb-2">
              BaFin-ready bis Ende 2026 — wir machen es in 14 Tagen.
            </h2>
            <div className="flex flex-col sm:flex-row gap-2 mt-4">
              <Link to="/contact-sales?source=fintech" className="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-security-500 hover:bg-security-600 text-white text-sm font-bold rounded-none">
                Demo buchen <ArrowRight className="h-4 w-4" />
              </Link>
              <Link to="/bait-marisk-compliance-guide" className="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-obsidian-950 border border-titanium-700 hover:border-security-500 text-titanium-200 text-sm font-bold rounded-none">
                BAIT-Guide
              </Link>
              <Link to="/audit" className="inline-flex items-center justify-center gap-2 px-5 py-2.5 text-titanium-400 hover:text-titanium-200 text-sm rounded-none">
                Site-Scan
              </Link>
            </div>
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
