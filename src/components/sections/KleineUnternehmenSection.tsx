import { Link } from 'react-router-dom';
import { ArrowRight, CheckCircle2 } from 'lucide-react';

const BULLETS = [
  'Keine Installation für den Erstscan',
  'Klare Ampelbewertung (rot · gelb · grün)',
  'Verständliche Empfehlungen — keine juristische Fachsprache',
  'Monatlich kündbar',
  'EU-gehostet · keine Tracker-Weitergabe an US-Anbieter',
  'Keine Rechtsberatung — technische Compliance-Härtung',
];

const GLOSSARY: Array<{ term: string; plain: string }> = [
  { term: 'Drift-Detection',         plain: 'erkennt, wenn sich nachträglich neue Tracker, Cookies oder Risiken einschleichen' },
  { term: 'Evidence Vault',          plain: 'sammelt technische Nachweise für interne Prüfung oder Datenschutzbeauftragte' },
  { term: 'Consent-Timing-Analyse',  plain: 'prüft, ob Tracking schon vor der Zustimmung startet' },
  { term: 'Governance Graph',        plain: 'zeigt, welche Tools, Anbieter, Datenflüsse und Pflichten zusammenhängen' },
];

export function KleineUnternehmenSection() {
  return (
    <section
      id="auch-fuer-kleine"
      className="border-t border-silver-700/30 px-4 sm:px-6 lg:px-8 py-16 sm:py-20"
    >
      <div className="max-w-5xl mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-[1.1fr_1fr] gap-8 lg:gap-12">
          {/* Linke Spalte: Hauptaussage */}
          <div>
            <div className="text-[11px] font-mono uppercase tracking-[0.25em] text-gold-400 mb-3">
              Auch für kleine Unternehmen verständlich
            </div>
            <h2 className="font-display font-bold text-2xl sm:text-4xl text-titanium-50 tracking-tight leading-tight mb-5">
              Sie brauchen keine eigene IT- oder Rechtsabteilung.
            </h2>
            <p className="text-base text-silver-300 leading-relaxed mb-6">
              RealSyncDynamics.AI übersetzt technische DSGVO-Risiken in klare Prioritäten: was ist
              kritisch, was sollte behoben werden und welches Paket passt zu Ihrer Website. Eine Praxis,
              ein Restaurant oder ein Handwerksbetrieb braucht nichts anderes als ein lokaler Onlineshop
              oder ein wachsendes Mittelstandsunternehmen.
            </p>
            <ul className="space-y-2 mb-7">
              {BULLETS.map((b) => (
                <li key={b} className="flex items-start gap-2.5 text-sm text-silver-300 leading-relaxed">
                  <CheckCircle2 className="h-4 w-4 text-emerald-400 mt-0.5 shrink-0" />
                  <span>{b}</span>
                </li>
              ))}
            </ul>
            <div className="flex flex-col sm:flex-row gap-3">
              <Link
                to="/audit?source=kleine-unternehmen"
                className="surface-gold inline-flex items-center justify-center gap-2 px-5 py-2.5 text-sm font-bold rounded-none"
              >
                Kostenlosen Website-Check starten <ArrowRight className="h-3.5 w-3.5" />
              </Link>
              <Link
                to="/pricing"
                className="inline-flex items-center justify-center gap-2 px-5 py-2.5 border border-silver-500 hover:border-gold-400 text-silver-100 hover:text-titanium-50 text-sm font-semibold rounded-none transition-colors"
              >
                Pakete ansehen
              </Link>
            </div>
          </div>

          {/* Rechte Spalte: Klartext-Glossar */}
          <aside className="bg-obsidian-900/60 border border-silver-700/30 p-5 sm:p-6">
            <div className="font-mono text-[11px] uppercase tracking-[0.22em] text-titanium-100 mb-4">
              Technik-Begriffe in Klartext
            </div>
            <dl className="space-y-3">
              {GLOSSARY.map((g) => (
                <div key={g.term} className="border-t border-silver-700/30 pt-3 first:border-0 first:pt-0">
                  <dt className="font-display font-semibold text-sm text-titanium-50">
                    {g.term}
                  </dt>
                  <dd className="mt-1 text-sm text-silver-300 leading-relaxed">{g.plain}</dd>
                </div>
              ))}
            </dl>
            <p className="mt-5 pt-4 border-t border-silver-700/30 text-xs text-silver-500 leading-relaxed">
              Sie sehen jeden Befund mit verständlicher Erklärung — der technische Begriff steht
              daneben für IT oder Datenschutzbeauftragte.
            </p>
          </aside>
        </div>
      </div>
    </section>
  );
}
