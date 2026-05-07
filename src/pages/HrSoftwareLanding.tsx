import { Link } from 'react-router-dom';
import { ArrowLeft, ArrowRight, Users, AlertTriangle, CheckCircle2 } from 'lucide-react';

export function HrSoftwareLanding() {
  return (
    <div className="min-h-screen bg-obsidian-950 text-titanium-100">
      <header className="h-14 border-b border-titanium-900 bg-obsidian-900 flex items-center px-4">
        <Link to="/" className="p-1.5 rounded-none hover:bg-obsidian-800 text-titanium-400 hover:text-titanium-200 mr-3">
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-none bg-gradient-to-br from-rose-500 to-pink-700 flex items-center justify-center">
            <Users className="h-4 w-4 text-white" />
          </div>
          <div className="font-display font-bold text-sm tracking-tight text-titanium-50">HR-Software &amp; Personal</div>
        </div>
      </header>

      <main className="px-4 sm:px-6 py-12 sm:py-16">
        <div className="max-w-3xl mx-auto space-y-10">
          <div className="text-center">
            <div className="inline-flex items-center gap-2 px-3 py-1 border border-rose-900 bg-rose-950/30 text-rose-300 text-xs font-bold uppercase tracking-wider rounded-none mb-5">
              <Users className="h-3 w-3" /> Recruiting · Performance · Mitarbeiter:innen-Daten · AI Act High-Risk
            </div>
            <h1 className="text-3xl sm:text-5xl font-display font-bold text-titanium-50 tracking-tight leading-tight mb-4">
              HR-KI ist <span className="text-security-400">High-Risk</span>. Deine Tools auch?
            </h1>
            <p className="text-lg text-titanium-300 max-w-xl mx-auto leading-relaxed">
              KI-gestützte Bewerber:innen-Auswahl, Performance-Bewertung und Beschäftigungs-Entscheidungen
              sind nach AI Act Annex III (4) <strong className="text-titanium-50">High-Risk</strong>. Das gilt auch
              für Personalverantwortliche, die fertige HR-SaaS einsetzen.
            </p>
          </div>

          <Section title="Regulatorische Lage">
            <ul className="space-y-1.5 text-sm">
              <li className="flex items-start gap-2"><AlertTriangle className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" />AI Act Annex III (4): Beschäftigung, Workforce-Management, Selbstständige-Vermittlung = High-Risk</li>
              <li className="flex items-start gap-2"><AlertTriangle className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" />DSGVO Art. 22: Automatisierte Einzelentscheidungen — Auskunfts-, Erklärungs- und Anfechtungsrecht</li>
              <li className="flex items-start gap-2"><AlertTriangle className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" />§ 26 BDSG: Beschäftigtendatenschutz — strenger als Art. 6 DSGVO im Arbeitsverhältnis</li>
              <li className="flex items-start gap-2"><AlertTriangle className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" />AGG: Diskriminierungsverbot — KI darf nicht systematisch nach geschützten Merkmalen sortieren</li>
              <li className="flex items-start gap-2"><AlertTriangle className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" />BetrVG § 87: Mitbestimmungsrecht des Betriebsrats bei Einführung von KI-Tools</li>
            </ul>
          </Section>

          <Section title="Was wir liefern">
            <ul className="space-y-2 text-sm">
              <li className="flex items-start gap-2"><CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" /><span><strong className="text-titanium-50">DSFA-Wizard mit HR-Use-Cases</strong> — Recruiting, Performance, Workforce-Planning vorinstalliert</span></li>
              <li className="flex items-start gap-2"><CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" /><span><strong className="text-titanium-50">AI-Act-Klassifikator</strong> mit Annex-III(4)-Mapping + Conformity-Assessment-Vorlage</span></li>
              <li className="flex items-start gap-2"><CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" /><span><strong className="text-titanium-50">Audit-Trail pro Bewerber:in / Mitarbeiter:in</strong> — welche Modelle, welche Daten, welche Empfehlung</span></li>
              <li className="flex items-start gap-2"><CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" /><span><strong className="text-titanium-50">Human-in-the-Loop-Workflows</strong> — KI darf vorschlagen, Mensch entscheidet final (Art. 22 DSGVO konform)</span></li>
              <li className="flex items-start gap-2"><CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" /><span><strong className="text-titanium-50">Bias-Auditing-Vorlagen</strong> — geschützte Merkmale aus Trainingsdaten + Output-Statistiken</span></li>
              <li className="flex items-start gap-2"><CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" /><span><strong className="text-titanium-50">Betriebsrat-Dokumentation</strong> — Vorlagen für BetrVG § 87 Vereinbarungen</span></li>
              <li className="flex items-start gap-2"><CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" /><span><strong className="text-titanium-50">EU-Hosting</strong> — keine Übertragung von Mitarbeiter:innen-Daten in Drittländer</span></li>
            </ul>
          </Section>

          <Section title="Use-Cases">
            <div className="grid sm:grid-cols-2 gap-3">
              {[
                { t: 'Bewerbungs-Triage', d: 'Vollständigkeits-Check + Skill-Match — finale Auswahl Recruiter:in' },
                { t: 'Stellenanzeigen-Optimierung', d: 'AGG-konforme Wording-Vorschläge · Diversity-Hinweise' },
                { t: 'Onboarding-Assistent', d: 'Personalisierte Lernpfade · DSFA-konform · keine Daten-Übertragung an Vendor' },
                { t: 'Performance-Voranalyse', d: 'KI-Indikatoren + Quellen — Personalverantwortliche entscheidet' },
                { t: 'Workforce-Planning', d: 'Kapazitäts-Modellierung anonymisiert · keine Einzel-Vorhersagen' },
                { t: 'Mitarbeiter:innen-Self-Service', d: 'Datenschutz Art. 15 / 17 Selfservice · DSGVO-konform' },
              ].map((u) => (
                <div key={u.t} className="p-3 bg-obsidian-900 border border-titanium-900 rounded-none">
                  <div className="font-display font-bold text-titanium-50 text-sm mb-1">{u.t}</div>
                  <div className="text-xs text-titanium-400 leading-relaxed">{u.d}</div>
                </div>
              ))}
            </div>
          </Section>

          <Section title="Für HR-Software-Hersteller">
            <p>
              Wenn du selber HR-SaaS baust und KI integrierst: AI-Act-Konformität ist 2026 Verkaufsargument.
              Unsere AVV-Vorlagen + Sub-Processors-Liste + Audit-Trail-API liefern, was deine Enterprise-Käufer
              im Procurement abfragen. Mehr unter <Link to="/saas-anbieter" className="text-security-400">/saas-anbieter</Link>.
            </p>
          </Section>

          <div className="mt-12 p-6 sm:p-8 bg-obsidian-900 border border-security-700 rounded-none">
            <h2 className="font-display font-bold text-titanium-50 text-xl mb-2">
              HR-KI nutzen ohne BetrVG-Streit und AGG-Klage
            </h2>
            <div className="flex flex-col sm:flex-row gap-2 mt-4">
              <Link to="/contact-sales?source=hr" className="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-security-500 hover:bg-security-600 text-white text-sm font-bold rounded-none">
                HR-Demo buchen <ArrowRight className="h-4 w-4" />
              </Link>
              <Link to="/ai-act-klassifikator?source=hr" className="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-obsidian-950 border border-titanium-700 hover:border-security-500 text-titanium-200 text-sm font-bold rounded-none">
                AI-Act-Klassifikation
              </Link>
              <Link to="/dsfa-wizard?source=hr" className="inline-flex items-center justify-center gap-2 px-5 py-2.5 text-titanium-400 hover:text-titanium-200 text-sm rounded-none">
                DSFA-Wizard
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
