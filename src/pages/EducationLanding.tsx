import { Link } from 'react-router-dom';
import { ArrowLeft, ArrowRight, GraduationCap, AlertTriangle, CheckCircle2 } from 'lucide-react';

export function EducationLanding() {
  return (
    <div className="min-h-screen bg-obsidian-950 text-titanium-100">
      <header className="h-14 border-b border-titanium-900 bg-obsidian-900 flex items-center px-4">
        <Link to="/" className="p-1.5 rounded-none hover:bg-obsidian-800 text-titanium-400 hover:text-titanium-200 mr-3">
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-none bg-gradient-to-br from-violet-500 to-purple-700 flex items-center justify-center">
            <GraduationCap className="h-4 w-4 text-white" />
          </div>
          <div className="font-display font-bold text-sm tracking-tight text-titanium-50">Bildungseinrichtungen</div>
        </div>
      </header>

      <main className="px-4 sm:px-6 py-12 sm:py-16">
        <div className="max-w-3xl mx-auto space-y-10">
          <div className="text-center">
            <div className="inline-flex items-center gap-2 px-3 py-1 border border-violet-900 bg-violet-950/30 text-violet-300 text-xs font-bold uppercase tracking-wider rounded-none mb-5">
              <GraduationCap className="h-3 w-3" /> Schulen · Hochschulen · EdTech · AI Act High-Risk
            </div>
            <h1 className="text-3xl sm:text-5xl font-display font-bold text-titanium-50 tracking-tight leading-tight mb-4">
              KI im Bildungswesen — <span className="text-security-400">High-Risk nach AI Act Annex III</span>
            </h1>
            <p className="text-lg text-titanium-300 max-w-xl mx-auto leading-relaxed">
              KI für Auswahl, Bewertung, Prüfungs-Aufsicht oder Lernpfad-Empfehlung
              ist nach Annex III (3) <strong className="text-titanium-50">High-Risk</strong>.
              Heißt: Conformity Assessment, Audit-Trail, Human Oversight Pflicht.
            </p>
          </div>

          <Section title="Regulatorische Lage">
            <ul className="space-y-1.5 text-sm">
              <li className="flex items-start gap-2"><AlertTriangle className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" />AI Act Annex III (3): Bildungseinrichtungen mit KI-Auswahl/Bewertung = High-Risk → Conformity Assessment</li>
              <li className="flex items-start gap-2"><AlertTriangle className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" />DSGVO Art. 8: Daten von Minderjährigen — verschärfte Schutzanforderungen, Eltern-Einwilligung &lt; 16</li>
              <li className="flex items-start gap-2"><AlertTriangle className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" />KMK-Beschlüsse + Landes-Schulgesetze: KI-Nutzung in Schulen erfordert pädagogisches Konzept + Datenschutz-Folgenabschätzung</li>
              <li className="flex items-start gap-2"><AlertTriangle className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" />DSK-Position: US-Cloud-KI-Tools (ChatGPT-Direkt, Microsoft 365) im Schulkontext kritisch — EU-Souveränität gefordert</li>
              <li className="flex items-start gap-2"><AlertTriangle className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" />BFSG/BITV 2.0: Barrierefreiheit aller digitalen Lernplattformen Pflicht</li>
            </ul>
          </Section>

          <Section title="Was wir liefern">
            <ul className="space-y-2 text-sm">
              <li className="flex items-start gap-2"><CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" /><span><strong className="text-titanium-50">EU-souveräner KI-Stack</strong> mit Frankfurt-Hosting + Ollama-Self-Hosting (kein US-Cloud-Default-Pfad)</span></li>
              <li className="flex items-start gap-2"><CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" /><span><strong className="text-titanium-50">DSFA-Wizard</strong> mit Vorlagen für Bildungs-Use-Cases (Auswahl, Bewertung, Prüfung)</span></li>
              <li className="flex items-start gap-2"><CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" /><span><strong className="text-titanium-50">Conformity-Assessment-Vorlage</strong> für AI-Act-Annex-III(3) High-Risk-Klassifikation</span></li>
              <li className="flex items-start gap-2"><CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" /><span><strong className="text-titanium-50">Eltern-Einwilligungs-Workflows</strong> — Double-Opt-In, dokumentiert, widerrufbar</span></li>
              <li className="flex items-start gap-2"><CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" /><span><strong className="text-titanium-50">Human-in-the-Loop für Bewertungen</strong> — KI-Vorschlag, Lehrkraft entscheidet</span></li>
              <li className="flex items-start gap-2"><CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" /><span><strong className="text-titanium-50">BFSG/BITV-konforme UI</strong> — Screenreader-tested, Tastatur-Navigation</span></li>
              <li className="flex items-start gap-2"><CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" /><span><strong className="text-titanium-50">Pricing für Bildung</strong>: Sonderkonditionen für Schulen, Hochschulen, gemeinnützige Träger auf Anfrage</span></li>
            </ul>
          </Section>

          <Section title="Use-Cases">
            <div className="grid sm:grid-cols-2 gap-3">
              {[
                { t: 'Lernpfad-Empfehlung', d: 'Adaptive Lernsequenzen — Lehrkraft validiert, Schüler:in akzeptiert' },
                { t: 'Aufgaben-Generierung', d: 'Differenzierte Übungen je Niveau · pädagogisch geprüft' },
                { t: 'Plagiats-Indikator', d: 'KI-Score + transparente Begründung · finale Entscheidung Lehrkraft' },
                { t: 'Bewerbungsvorauswahl (Hochschule)', d: 'Vollständigkeits-Check + Diversity-faire Sortierung · keine Auto-Rejects' },
                { t: 'Prüfungs-Aufsicht (Online)', d: 'Auffälligkeits-Erkennung mit Audit-Trail · Datenschutz-Mode &lt; 16 J.' },
                { t: 'Übersetzung in Leichte Sprache', d: 'Behörden-Schreiben für Schüler:innen / Eltern barrierefrei aufbereitet' },
              ].map((u) => (
                <div key={u.t} className="p-3 bg-obsidian-900 border border-titanium-900 rounded-none">
                  <div className="font-display font-bold text-titanium-50 text-sm mb-1">{u.t}</div>
                  <div className="text-xs text-titanium-400 leading-relaxed">{u.d}</div>
                </div>
              ))}
            </div>
          </Section>

          <Section title="Beschaffung">
            <p>
              Pricing nach EVB-IT- oder vergleichbarem Bildungs-Vertrag möglich. Enterprise-Tier
              auf Anfrage mit SLA, On-Premise (Docker-Compose), Lehrer:innen-Schulungen, gemeinsamer DSFA-Workshop.
            </p>
          </Section>

          <div className="mt-12 p-6 sm:p-8 bg-obsidian-900 border border-security-700 rounded-none">
            <h2 className="font-display font-bold text-titanium-50 text-xl mb-2">
              KI in der Schule — pädagogisch sicher, rechtlich auditierbar
            </h2>
            <div className="flex flex-col sm:flex-row gap-2 mt-4">
              <Link to="/contact-sales?source=education" className="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-security-500 hover:bg-security-600 text-white text-sm font-bold rounded-none">
                Bildungs-Demo buchen <ArrowRight className="h-4 w-4" />
              </Link>
              <Link to="/ai-act-klassifikator?source=education" className="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-obsidian-950 border border-titanium-700 hover:border-security-500 text-titanium-200 text-sm font-bold rounded-none">
                AI-Act-Klassifikation
              </Link>
              <Link to="/dsfa-wizard?source=education" className="inline-flex items-center justify-center gap-2 px-5 py-2.5 text-titanium-400 hover:text-titanium-200 text-sm rounded-none">
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
