import { Link } from 'react-router-dom';
import { ArrowLeft, ArrowRight, BarChart3, Calendar, Euro, AlertTriangle, ShieldCheck, TrendingUp } from 'lucide-react';

export function Marktanalyse() {
  return (
    <div className="min-h-screen bg-obsidian-950 text-titanium-100">
      <header className="h-14 border-b border-titanium-900 bg-obsidian-900 flex items-center px-4">
        <Link to="/" className="p-1.5 rounded-none hover:bg-obsidian-800 text-titanium-400 hover:text-titanium-200 mr-3">
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-none bg-gradient-to-br from-security-500 to-security-700 flex items-center justify-center">
            <BarChart3 className="h-4 w-4 text-white" />
          </div>
          <div className="font-display font-bold text-sm tracking-tight text-titanium-50">Marktanalyse AI Compliance DACH</div>
        </div>
      </header>

      <main className="px-4 sm:px-6 py-12 sm:py-16">
        <div className="max-w-3xl mx-auto space-y-10">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 border border-security-900 bg-security-950/30 text-security-300 text-xs font-bold uppercase tracking-wider rounded-none mb-5">
              <BarChart3 className="h-3 w-3" /> TAM · Treiber · DACH-Spezifika · 2026–2030
            </div>
            <h1 className="text-3xl sm:text-5xl font-display font-bold text-titanium-50 tracking-tight leading-tight mb-4">
              AI Compliance DACH — <span className="text-security-400">Markt 2026 bis 2030</span>
            </h1>
            <p className="text-lg text-titanium-300 leading-relaxed">
              Warum der Markt für KI-Compliance jetzt aufgeht: regulatorische Pflicht-Deadlines,
              hoher Compliance-Aufwand pro AI-System, exponentielles Wachstum.
            </p>
          </div>

          <Section title="Marktgröße + Wachstum" icon={<TrendingUp className="h-5 w-5 text-security-400" />}>
            <div className="grid sm:grid-cols-2 gap-3">
              <Stat label="EU AI Act Compliance" value="€609M → €10,5B" sub="2026 → 2030" />
              <Stat label="Total EU Compliance" value="€4–8B → €17–38B" sub="2026 → 2030" />
              <Stat label="CAGR EU AI Act Compliance" value="37,3 %" sub="2026 → 2030" highlight />
              <Stat label="Ø Compliance-Kosten pro AI-System" value="€29 277" sub="jährlich" />
            </div>
            <p className="text-xs text-titanium-500 mt-3">
              Quellen: IDC, Gartner, Statista (2025/2026); Analystenkonsens für AI-Compliance-Sub-Segment
              innerhalb des breiteren GRC-Marktes.
            </p>
          </Section>

          <Section title="Markttreiber" icon={<Calendar className="h-5 w-5 text-amber-400" />}>
            <ul className="space-y-2 text-sm">
              <li className="flex items-start gap-3">
                <span className="font-mono text-amber-400 text-xs mt-0.5 shrink-0 w-20">Aug 2026</span>
                <span><strong className="text-titanium-50">High-Risk-Enforcement EU AI Act</strong> wird voll wirksam — Conformity Assessment, Risk-Management, Technical Documentation, Human Oversight, Audit-Logging Pflicht.</span>
              </li>
              <li className="flex items-start gap-3">
                <span className="font-mono text-amber-400 text-xs mt-0.5 shrink-0 w-20">Q2–Q3 2026</span>
                <span><strong className="text-titanium-50">Compliance-Rush</strong> durch überlastete Notified Bodies. Frühe Movers haben Wartezeit-Vorteil.</span>
              </li>
              <li className="flex items-start gap-3">
                <span className="font-mono text-amber-400 text-xs mt-0.5 shrink-0 w-20">2026+</span>
                <span><strong className="text-titanium-50">70%+ Enforcement-Actions</strong> werden High-Risk-AI-Systeme treffen.</span>
              </li>
              <li className="flex items-start gap-3">
                <span className="font-mono text-amber-400 text-xs mt-0.5 shrink-0 w-20">Bußgeld</span>
                <span><strong className="text-titanium-50">€35 Mio. oder 7 % Jahresumsatz</strong> (jeweils der höhere Wert) bei AI-Act-Verstößen — höher als DSGVO-Maximum.</span>
              </li>
            </ul>
          </Section>

          <Section title="DACH-Banking-Spezifika" icon={<ShieldCheck className="h-5 w-5 text-security-400" />}>
            <div className="grid sm:grid-cols-2 gap-3">
              {[
                { t: 'BAIT (BaFin)', d: 'Audit-Trails · Revisionssicherheit · Nachvollziehbarkeit aller automatisierter Entscheidungen' },
                { t: 'MaRisk', d: 'KI als operationelles Risiko im Risk-Management-Framework' },
                { t: 'KWG § 25a', d: 'Organisationspflichten für Banken — Wirksamkeit + Angemessenheit nachweisen' },
                { t: 'Zero Trust + Least Privilege', d: 'Granulare Berechtigungen, keine impliziten Vertrauensannahmen zwischen Komponenten' },
              ].map((s) => (
                <div key={s.t} className="p-3 bg-obsidian-900 border border-titanium-900 rounded-none">
                  <div className="font-display font-bold text-titanium-50 text-sm mb-1">{s.t}</div>
                  <div className="text-xs text-titanium-400 leading-relaxed">{s.d}</div>
                </div>
              ))}
            </div>
            <p className="mt-3">
              Konkrete Compliance-Tools für Banken & Versicherungen:{' '}
              <Link to="/fintech" className="text-security-400 hover:text-security-300">/fintech</Link> ·{' '}
              <Link to="/versicherungen" className="text-security-400 hover:text-security-300">/versicherungen</Link> ·{' '}
              <Link to="/bait-marisk-compliance-guide" className="text-security-400 hover:text-security-300">BAIT/MaRisk-Guide</Link>.
            </p>
          </Section>

          <Section title="Wer ist betroffen" icon={<AlertTriangle className="h-5 w-5 text-amber-400" />}>
            <p>
              Nach Annex III des AI Acts gelten KI-Systeme als <em>High-Risk</em>, wenn sie in folgenden Bereichen
              eingesetzt werden:
            </p>
            <ul className="space-y-1.5 text-sm mt-2">
              <li className="flex items-start gap-2"><span className="text-amber-400 mt-1">•</span><span>Medizinprodukte + Patienten-Triage (HealthTech)</span></li>
              <li className="flex items-start gap-2"><span className="text-amber-400 mt-1">•</span><span>Recht: Justiz-Unterstützung, Anwalts-Tooling mit § 203 StGB-Daten</span></li>
              <li className="flex items-start gap-2"><span className="text-amber-400 mt-1">•</span><span>Kredit-Scoring + Underwriting (Banken, Versicherer)</span></li>
              <li className="flex items-start gap-2"><span className="text-amber-400 mt-1">•</span><span>HR-Selektion, Performance-Bewertung</span></li>
              <li className="flex items-start gap-2"><span className="text-amber-400 mt-1">•</span><span>Behörden-Entscheidungen (OZG-Workflows, BFSG/BITV)</span></li>
              <li className="flex items-start gap-2"><span className="text-amber-400 mt-1">•</span><span>Bildungseinrichtungen — Auswahl, Bewertung, Prüfungs-Aufsicht</span></li>
              <li className="flex items-start gap-2"><span className="text-amber-400 mt-1">•</span><span>Kritische Infrastruktur, Energie, Verkehr</span></li>
            </ul>
            <p className="mt-3">
              Eigene Klassifikation in 60 Sekunden:{' '}
              <Link to="/ai-act-klassifikator" className="text-security-400 hover:text-security-300">/ai-act-klassifikator</Link>.
            </p>
          </Section>

          <Section title="Was das für deutsche Mittelständler bedeutet" icon={<Euro className="h-5 w-5 text-emerald-400" />}>
            <ul className="space-y-1.5 text-sm">
              <li className="flex items-start gap-2"><span className="text-emerald-400 mt-1">→</span><span>Wer KI 2026 produktiv einsetzt, braucht <strong className="text-titanium-50">vor August 2026</strong> die Klassifikation, Dokumentation und das Audit-Setup.</span></li>
              <li className="flex items-start gap-2"><span className="text-emerald-400 mt-1">→</span><span>€29 277 Compliance-Kosten pro AI-System sind der Grund, warum Self-Service-Tools (€29–299/M) gegen Beratungs-Pakete (4–15k €/Jahr) gewinnen.</span></li>
              <li className="flex items-start gap-2"><span className="text-emerald-400 mt-1">→</span><span>EU-Datenresidenz ist nicht-verhandelbar bei Behörden, Healthcare und stark reguliertem FinTech — US-Cloud-Default-Pfade fallen aus.</span></li>
              <li className="flex items-start gap-2"><span className="text-emerald-400 mt-1">→</span><span>Notified-Bodies-Engpass: wer im Q4 2025 / Q1 2026 mit Klassifikation und Dokumentation startet, vermeidet die Q3-Wartezeit.</span></li>
            </ul>
          </Section>

          <div className="mt-12 p-6 sm:p-8 bg-obsidian-900 border border-security-700 rounded-none">
            <h2 className="font-display font-bold text-titanium-50 text-xl mb-2">
              Klassifikation + Vor-Audit in einem Tag
            </h2>
            <p className="text-titanium-300 text-sm mb-4">
              Acht kostenlose Self-Service-Tools (AVV / VVT / DSFA / TOM / AI-Act-Klassifikator /
              Bußgeld-Rechner / Meldepflicht-Timer / Datenschutz-Generator) liefern den Stand
              ohne Anmeldung, ohne Beratungs-Tagessatz.
            </p>
            <div className="flex flex-col sm:flex-row gap-2">
              <Link to="/ai-act-klassifikator" className="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-security-500 hover:bg-security-600 text-white text-sm font-bold rounded-none">
                AI-Act-Klassifikation starten <ArrowRight className="h-4 w-4" />
              </Link>
              <Link to="/audit" className="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-obsidian-950 border border-titanium-700 hover:border-security-500 text-titanium-200 text-sm font-bold rounded-none">
                Website-Audit (kostenlos)
              </Link>
              <Link to="/contact-sales?source=marktanalyse" className="inline-flex items-center justify-center gap-2 px-5 py-2.5 text-titanium-400 hover:text-titanium-200 text-sm rounded-none">
                Strategie-Call buchen
              </Link>
            </div>
          </div>

          <p className="text-xs text-titanium-500 leading-relaxed">
            Diese Marktanalyse fasst öffentlich verfügbare Daten und regulatorische Eckpfeiler zusammen.
            Detaillierte Szenario-Modelle, Marktanteils-Annahmen und Pricing-Strategie auf Anfrage
            für Investoren und Strategie-Partner.
          </p>
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

function Section({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <section>
      <div className="flex items-center gap-2 mb-3">
        {icon}
        <h2 className="text-xl sm:text-2xl font-display font-bold text-titanium-50">{title}</h2>
      </div>
      <div className="prose prose-invert max-w-none text-titanium-300 text-sm sm:text-base leading-relaxed space-y-3">
        {children}
      </div>
    </section>
  );
}

function Stat({ label, value, sub, highlight }: { label: string; value: string; sub: string; highlight?: boolean }) {
  return (
    <div className={`p-3 border rounded-none ${highlight ? 'border-emerald-700 bg-emerald-950/20' : 'border-titanium-900 bg-obsidian-900'}`}>
      <div className="text-[11px] uppercase tracking-wider text-titanium-500 font-bold">{label}</div>
      <div className={`font-display font-bold text-xl mt-1 ${highlight ? 'text-emerald-300' : 'text-titanium-50'}`}>{value}</div>
      <div className="text-xs text-titanium-500 mt-0.5">{sub}</div>
    </div>
  );
}
