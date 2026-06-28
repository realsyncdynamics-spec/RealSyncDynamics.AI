import { Link } from 'react-router-dom';
import { ShieldCheck, ArrowRight, ArrowLeft, AlertTriangle, Building2 } from 'lucide-react';

export function BaitMaRiskGuide() {
  return (
    <div className="min-h-screen bg-obsidian-950 text-titanium-100">
      <header className="h-14 border-b border-titanium-900 bg-obsidian-900 flex items-center px-4">
        <Link to="/" className="p-1.5 rounded-none hover:bg-obsidian-800 text-titanium-400 hover:text-titanium-200 mr-3">
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-none bg-gradient-to-br from-emerald-500 to-teal-700 flex items-center justify-center">
            <ShieldCheck className="h-4 w-4 text-white" />
          </div>
          <div className="font-display font-bold text-sm tracking-tight text-titanium-50">BAIT &amp; MaRisk Compliance-Guide</div>
        </div>
      </header>

      <main className="px-4 sm:px-6 py-12 sm:py-16">
        <div className="max-w-3xl mx-auto">
          <article className="space-y-8">
            <div className="text-center mb-12">
              <div className="inline-flex items-center gap-2 px-3 py-1 border border-emerald-900 bg-emerald-950/30 text-emerald-300 text-xs font-bold uppercase tracking-wider rounded-none mb-5">
                <Building2 className="h-3 w-3" /> BaFin · Stand 2026
              </div>
              <h1 className="text-3xl sm:text-5xl font-display font-bold text-titanium-50 tracking-tight leading-tight mb-4">
                BAIT &amp; MaRisk — KI-Compliance für <span className="text-security-400">FinTechs</span>
              </h1>
              <p className="text-lg text-titanium-300 max-w-xl mx-auto leading-relaxed">
                Was die Bankaufsichtlichen Anforderungen an die IT (BAIT) + Mindestanforderungen an das Risikomanagement (MaRisk) für KI-Einsatz in Banken &amp; FinTechs bedeuten — konkret und mit Paragraph-Referenzen.
              </p>
            </div>

            <Section title="Wer ist betroffen?">
              <p>
                Alle nach KWG, ZAG, KAGB oder VAG regulierten Institute. Plus FinTechs ohne eigene
                Banklizenz, die als Auslagerungs-Dienstleister für regulierte Häuser arbeiten —
                deren Kunden müssen die BAIT-Anforderungen vertraglich an Dich weiterreichen.
              </p>
            </Section>

            <Section title="BAIT AT 4.5 — Auslagerung an KI-Dienste">
              <p>
                Wenn Du KI-Modelle (OpenAI, Anthropic, Google, etc.) für Geschäftsentscheidungen
                nutzt, gilt das als <em>sonstiger Fremdbezug von IT-Dienstleistungen</em>. Pflichten:
              </p>
              <ul className="space-y-2 mt-3 text-sm">
                <li><strong className="text-titanium-50">Risikoanalyse vor Beauftragung</strong> — was kann schief gehen wenn der Anbieter ausfällt / Bias hat / Daten leakt?</li>
                <li><strong className="text-titanium-50">Vertragliche Mindestinhalte</strong> — Audit-Rechte, Sub-Auftragsverarbeitungs-Klauseln, SLA, Exit-Strategie.</li>
                <li><strong className="text-titanium-50">Laufende Überwachung</strong> — quartalsweise Vendor-Review, Incident-Tracking, Konzentrations­risiko-Analyse.</li>
                <li><strong className="text-titanium-50">Nachweis gegenüber BaFin</strong> — bei Sonderprüfung muss Du innerhalb 14 Tagen die Doku vorlegen.</li>
              </ul>
            </Section>

            <Section title="MaRisk AT 7.2 — IT-Risiken aus KI-Modellen">
              <p>
                MaRisk Modul AT 7.2 verlangt, dass IT-Risiken erkannt, bewertet und gesteuert
                werden. Bei KI-Einsatz heißt das konkret:
              </p>
              <ul className="space-y-2 mt-3 text-sm">
                <li><strong className="text-titanium-50">Modell-Risikomanagement</strong> — wie wird das Modell validiert? Wer überwacht Drift?</li>
                <li><strong className="text-titanium-50">Daten-Lineage</strong> — welche Trainingsdaten haben das Modell geprägt? Bias-Mitigation?</li>
                <li><strong className="text-titanium-50">Logging-Pflicht</strong> — jeder Modell-Aufruf revisionssicher dokumentiert (Prompt, Output, Modell-Version, Zeit, User).</li>
                <li><strong className="text-titanium-50">Notfallplan</strong> — was passiert wenn Modell-API ausfällt? Wer entscheidet manuell?</li>
              </ul>
            </Section>

            <Section title="DORA — was kommt 2026">
              <p>
                Die Digital Operational Resilience Act (Verordnung (EU) 2022/2554) ist seit
                17. Januar 2025 anwendbar. KI-Drittanbieter fallen unter den DORA-ICT-Risk-
                Management-Rahmen. Ab 2027 gibt es das DORA-Register kritischer ICT-Drittanbieter
                — wer dort drin ist, unterliegt direkt EU-weiter Aufsicht.
              </p>
              <p>
                Für FinTechs: Du musst bis Ende 2026 ein <strong>Register</strong> aller ICT-
                Auslagerungen führen, inkl. Kritikalitätsbewertung. Plus quartalsweise Stress-Tests
                der ICT-Dienste.
              </p>
            </Section>

            <Section title="Wie helfen wir bei BAIT/MaRisk-Compliance?">
              <p>
                RealSyncDynamics.AI ist als Compliance-Layer für AT 4.5 + AT 7.2 gebaut:
              </p>
              <ul className="space-y-2 mt-3 text-sm">
                <li className="flex items-start gap-2">
                  <span className="text-emerald-400 mt-1">✓</span>
                  <span><strong className="text-titanium-50">Audit-Log pro AI-Call</strong> — Provider, Modell-Version, Token-Anzahl, Kosten, Datenresidenz, User-ID, Tenant. Revisionssicher (immutable). Direkt für BaFin-Sonderprüfungen exportierbar.</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-emerald-400 mt-1">✓</span>
                  <span><strong className="text-titanium-50">AVV-Generator</strong> — passt vertragliche Mindestinhalte gemäß BAIT AT 4.5 automatisch an Deine Provider-Auswahl an.</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-emerald-400 mt-1">✓</span>
                  <span><strong className="text-titanium-50">Provider-Health-Monitoring</strong> — Vendor-Reviews mit Alert wenn ein Provider eine Datenpanne meldet (Schufa-DDoS-Pattern).</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-emerald-400 mt-1">✓</span>
                  <span><strong className="text-titanium-50">Multi-Provider-Routing</strong> — Anthropic-Ausfall → automatischer Fallback auf Google oder Self-Hosted-Ollama. Kein Single-Point-of-Failure.</span>
                </li>
              </ul>
            </Section>

            <div className="mt-12 p-6 sm:p-8 bg-obsidian-900 border border-security-700 rounded-none">
              <div className="flex items-start gap-3 mb-4">
                <AlertTriangle className="h-6 w-6 text-security-400 shrink-0 mt-0.5" />
                <div>
                  <h2 className="font-display font-bold text-titanium-50 text-xl mb-2">
                    BaFin-ready bis Ende 2026 — wir machen das in 14 Tagen.
                  </h2>
                  <p className="text-sm text-titanium-300 leading-relaxed">
                    Setup + erstes Audit-Log live in 14 Tagen. Pilot 14 Tage kostenlos,
                    danach Growth 249 €/Monat (passt für KMU-FinTechs bis ~50 Mitarbeitende).
                  </p>
                </div>
              </div>
              <div className="flex flex-col sm:flex-row gap-2">
                <Link to="/contact-sales?source=bait-marisk" className="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-security-500 hover:bg-security-600 text-white text-sm font-bold rounded-none">
                  Founding Access starten <ArrowRight className="h-4 w-4" />
                </Link>
                <Link to="/audit" className="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-obsidian-950 border border-titanium-700 hover:border-security-500 text-titanium-200 text-sm font-bold rounded-none">
                  Kostenloser Site-Audit
                </Link>
                <Link to="/legal/compliance-matrix" className="inline-flex items-center justify-center gap-2 px-5 py-2.5 text-titanium-400 hover:text-titanium-200 text-sm rounded-none">
                  Provider-Vergleich
                </Link>
              </div>
            </div>
          </article>
        </div>
      </main>

      <footer className="border-t border-titanium-900 mt-12 py-6 px-4">
        <div className="max-w-3xl mx-auto flex flex-col sm:flex-row gap-3 sm:justify-between text-xs text-titanium-500">
          <div>© 2026 RealSync Dynamics · Made in Germany · EU-Hosted (Frankfurt)</div>
          <div className="flex flex-wrap gap-3">
            <Link to="/legal/privacy" className="hover:text-titanium-300">Datenschutz</Link>
            <Link to="/impressum" className="hover:text-titanium-300">Impressum</Link>
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
            headline: 'BAIT & MaRisk — KI-Compliance für FinTechs',
            description: 'BAIT AT 4.5, MaRisk AT 7.2, DORA — wie regulierte FinTechs KI-Dienste compliant einsetzen. Mit konkreten BaFin-Anforderungen.',
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
