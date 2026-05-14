import { Link } from 'react-router-dom';
import { ArrowLeft, Scale, ArrowRight, AlertTriangle, CheckCircle2 } from 'lucide-react';

export function LegalTechLanding() {
  return (
    <div className="min-h-screen bg-obsidian-950 text-titanium-100">
      <header className="h-14 border-b border-titanium-900 bg-obsidian-900 flex items-center px-4">
        <Link to="/" className="p-1.5 rounded-none hover:bg-obsidian-800 text-titanium-400 hover:text-titanium-200 mr-3">
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-none bg-gradient-to-br from-blue-500 to-indigo-700 flex items-center justify-center">
            <Scale className="h-4 w-4 text-white" />
          </div>
          <div className="font-display font-bold text-sm tracking-tight text-titanium-50">Legal-Tech-Compliance</div>
        </div>
      </header>

      <main className="px-4 sm:px-6 py-12 sm:py-16">
        <div className="max-w-3xl mx-auto space-y-10">
          <div className="text-center">
            <div className="inline-flex items-center gap-2 px-3 py-1 border border-blue-900 bg-blue-950/30 text-blue-300 text-xs font-bold uppercase tracking-wider rounded-none mb-5">
              <Scale className="h-3 w-3" /> Kanzleien · Mandantengeheimnis · § 203 StGB
            </div>
            <h1 className="text-3xl sm:text-5xl font-display font-bold text-titanium-50 tracking-tight leading-tight mb-4">
              KI für Anwälte — <span className="text-security-400">ohne § 203 StGB-Risiko</span>.
            </h1>
            <p className="text-lg text-titanium-300 max-w-xl mx-auto leading-relaxed">
              Mandanten-Recherche mit ChatGPT. Vertrags-Analyse via Claude. Schriftsatz-Drafts mit Gemini.
              Alles legal — wenn die Compliance-Schicht stimmt.
            </p>
          </div>

          <Section title="Das Problem">
            <p>
              Mandanten-Daten in einem ChatGPT-Prompt = Offenbarung an OpenAI L.L.C., USA. Konsequenz:
            </p>
            <ul className="space-y-1.5 mt-3 text-sm">
              <li className="flex items-start gap-2"><AlertTriangle className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" /><strong className="text-titanium-50">§ 203 StGB</strong> — Verletzung von Privatgeheimnissen, bis 1 Jahr Freiheitsstrafe</li>
              <li className="flex items-start gap-2"><AlertTriangle className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" /><strong className="text-titanium-50">DSGVO Art. 32</strong> + Schrems-II — Drittlandtransfer ohne SCCs + IP-Anonymisierung</li>
              <li className="flex items-start gap-2"><AlertTriangle className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" /><strong className="text-titanium-50">BRAO § 43a</strong> — Verschwiegenheitspflicht-Bruch</li>
              <li className="flex items-start gap-2"><AlertTriangle className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" /><strong className="text-titanium-50">Anwaltskammer-Reklamation</strong> bis Berufsverbot</li>
            </ul>
          </Section>

          <Section title="Was wir liefern">
            <ul className="space-y-2 text-sm">
              <li className="flex items-start gap-2"><CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" /><span><strong className="text-titanium-50">EU-Datenresidenz erzwingbar pro Mandant</strong> — sensible Cases gehen via Frankfurt-Hosted Ollama, Routine-Recherche ggf. via Cloud (mit AVV+SCCs)</span></li>
              <li className="flex items-start gap-2"><CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" /><span><strong className="text-titanium-50">Audit-Log pro AI-Call</strong> — wer hat welchen Mandanten-Bezug an welche AI geschickt</span></li>
              <li className="flex items-start gap-2"><CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" /><span><strong className="text-titanium-50">AVV-Generator pro Mandant</strong> — anwendbar als Anhang im Mandatsvertrag, Sub-Auftragsverarbeiter-Liste inkl.</span></li>
              <li className="flex items-start gap-2"><CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" /><span><strong className="text-titanium-50">Auto-Pseudonymisierung</strong> — Klartext-Namen werden vor jedem AI-Prompt durch Aliase ersetzt, Reverse-Mapping nur intern</span></li>
              <li className="flex items-start gap-2"><CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" /><span><strong className="text-titanium-50">Compliance-Reports als Mandanten-Asset</strong> — Du kannst dem Mandanten zeigen, wie seine Daten genau verarbeitet werden</span></li>
            </ul>
          </Section>

          <Section title="Use-Cases">
            <div className="grid sm:grid-cols-2 gap-3">
              {[
                { t: 'Mandanten-Recherche', d: 'Kontextualisierung mit GPT-4 / Claude · Auto-Pseudonymisierung pre-prompt' },
                { t: 'Vertrags-Klauseln-Analyse', d: 'Risk-Scoring via Claude · Audit-Log fürs Mandat' },
                { t: 'Schriftsatz-Draft', d: 'Erstentwurf via Claude · Final-Review human-only' },
                { t: 'Discovery-Volltextsuche', d: 'RAG-Pipeline auf eigene Document-DB, EU-local-only' },
                { t: 'Prozess-Risiko-Estimate', d: 'Historische Urteile-Analyse · keine personenbez. Daten in Prompts' },
                { t: 'Mandantenkommunikation-Templates', d: 'Standard-Briefe + Mahnungen · Mandanten-Daten redacted' },
              ].map((u) => (
                <div key={u.t} className="p-3 bg-obsidian-900 border border-titanium-900 rounded-none">
                  <div className="font-display font-bold text-titanium-50 text-sm mb-1">{u.t}</div>
                  <div className="text-xs text-titanium-400 leading-relaxed">{u.d}</div>
                </div>
              ))}
            </div>
          </Section>

          <Section title="Pricing für Kanzleien">
            <p>
              <strong className="text-titanium-50">Starter 79 €/M</strong> für Solo-Anwälte ·
              <strong className="text-titanium-50"> Growth 249 €/M</strong> für Teams (Multi-Tenant + API) ·
              <strong className="text-titanium-50"> Agency 699 €/M</strong> für mittelgroße Kanzleien (10 Mandanten-Sites + White-Label-Reports).
              14 Tage Pilot kostenlos · Mandanten-Setup AI-geführt in einem Schritt.
            </p>
          </Section>

          <div className="mt-12 p-6 sm:p-8 bg-obsidian-900 border border-security-700 rounded-none">
            <h2 className="font-display font-bold text-titanium-50 text-xl mb-2">
              Mandanten-Geheimnis bleibt geheim. KI-Vorteil bleibt erhalten.
            </h2>
            <div className="flex flex-col sm:flex-row gap-2 mt-4">
              <Link to="/contact-sales?source=legaltech" className="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-security-500 hover:bg-security-600 text-white text-sm font-bold rounded-none">
                Founding Access starten <ArrowRight className="h-4 w-4" />
              </Link>
              <Link to="/audit" className="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-obsidian-950 border border-titanium-700 hover:border-security-500 text-titanium-200 text-sm font-bold rounded-none">
                Kanzlei-Site auditieren
              </Link>
              <Link to="/avv-generator" className="inline-flex items-center justify-center gap-2 px-5 py-2.5 text-titanium-400 hover:text-titanium-200 text-sm rounded-none">
                AVV-Template
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

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'Article',
            headline: 'KI für Anwälte — DSGVO + § 203 StGB konform',
            description: 'Mandanten-Daten in ChatGPT? Wie Kanzleien KI compliant einsetzen ohne Verschwiegenheitsbruch.',
            datePublished: '2026-05-06',
            inLanguage: 'de-DE',
            author: { '@type': 'Organization', name: 'RealSync Dynamics' },
          }),
        }}
      />
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
