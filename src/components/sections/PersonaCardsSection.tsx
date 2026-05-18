import { Link } from 'react-router-dom';
import { Shield, Code2, Building2, ArrowRight } from 'lucide-react';

// PersonaCardsSection — drei klar getrennte Lesegruppen: DPO, CTO, Agency.
// Jede Karte liefert 2-3 Sätze konkret-rollenbezogen + einen Drill-Down-CTA
// in die jeweilige Detail-Page. Adressiert: „Klarere Persona-Segmente"
// aus dem Analyse-Punkt 1.

interface Persona {
  id:        'dpo' | 'cto' | 'agency';
  icon:      React.ReactNode;
  eyebrow:   string;
  title:     string;
  bullets:   string[];
  cta:       { label: string; to: string };
  accent:    string;     // tailwind text-color class
}

const PERSONAS: readonly Persona[] = [
  {
    id:      'dpo',
    icon:    <Shield className="h-5 w-5" />,
    eyebrow: 'für Datenschutzbeauftragte',
    title:   'Audit-Ordner füllt sich selbst.',
    bullets: [
      'Pre-Consent-Tracker, Drittland-Transfers und §13-TTDSG-Risiken werden mit Paragraphenbezug erkannt — kein Excel-Pflegen mehr.',
      'AVV-Deltas und Datenschutzhinweis-Updates entstehen als Diff auf Knopfdruck.',
      'Bei einer DSB-Anfrage exportieren Sie ein signiertes Evidence-Bundle in 60 s.',
    ],
    cta:     { label: 'AI-Act + DSGVO im Detail', to: '/ai-act' },
    accent:  'text-cyan-300',
  },
  {
    id:      'cto',
    icon:    <Code2 className="h-5 w-5" />,
    eyebrow: 'für CTO / Engineering',
    title:   'Compliance als CI-Gate, nicht als Meeting.',
    bullets: [
      'Drift-Detection läuft als Telemetry-Stream — neue Tracker oder Header-Regressions öffnen automatisch Incidents.',
      'AI-Endpunkte werden gegen AI-Act-Annex-III klassifiziert; Sie sehen jeden neuen Modell-Call vor dem Release.',
      'API + Webhooks geben Sie als Build-Gate in Ihre Pipeline — „fail build bei neuem Pre-Consent-Tracker".',
    ],
    cta:     { label: 'Runtime + API-Architektur', to: '/runtime' },
    accent:  'text-violet-300',
  },
  {
    id:      'agency',
    icon:    <Building2 className="h-5 w-5" />,
    eyebrow: 'für Agenturen',
    title:   'White-Label-Compliance für jeden Endkunden.',
    bullets: [
      'Multi-Tenant-Dashboard für bis zu 10 Kundenseiten parallel.',
      'White-Label-Reports im eigenen Branding, eigene Domain.',
      'Stripe-Subscription für Euch; Eure Endkunden buchen über Euch — eu_local-Toggle pro Tenant.',
    ],
    cta:     { label: 'Agency-Tier ab 499 €/Mo', to: '/agencies' },
    accent:  'text-emerald-300',
  },
];

export function PersonaCardsSection() {
  return (
    <section
      aria-label="Personas"
      className="bg-obsidian-900 border-b border-titanium-900 py-20 sm:py-24 px-4 sm:px-6"
    >
      <div className="max-w-7xl mx-auto">
        <div className="max-w-3xl mb-12">
          <div className="text-[11px] font-mono uppercase tracking-[0.18em] text-titanium-500 mb-3">
            02 · wen die Runtime entlastet
          </div>
          <h2 className="text-3xl sm:text-4xl font-display font-semibold tracking-tight text-titanium-50 mb-3">
            Drei Rollen, drei klare Pfade.
          </h2>
          <p className="text-titanium-300 text-base sm:text-lg leading-relaxed max-w-2xl">
            Eine Runtime, drei Sichten — der DPO sieht Paragraphen, der CTO sieht Telemetry,
            die Agency sieht Tenants. Gleiche Daten, gleiche Evidence-Chain.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-px bg-titanium-900">
          {PERSONAS.map((p) => (
            <article
              key={p.id}
              className="bg-obsidian-950 p-6 sm:p-7 flex flex-col"
            >
              <header className="flex items-center gap-2.5 mb-5">
                <span className={`inline-flex w-9 h-9 items-center justify-center bg-obsidian-900 border border-titanium-800 ${p.accent}`}>
                  {p.icon}
                </span>
                <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-titanium-500">
                  {p.eyebrow}
                </div>
              </header>

              <h3 className="font-display font-semibold text-xl text-titanium-50 mb-4 leading-snug">
                {p.title}
              </h3>

              <ul className="space-y-3 mb-6 flex-1">
                {p.bullets.map((b, i) => (
                  <li key={i} className="flex gap-2.5 text-sm text-titanium-300 leading-relaxed">
                    <span className={`font-mono text-[10px] mt-1.5 shrink-0 ${p.accent}`}>▸</span>
                    <span>{b}</span>
                  </li>
                ))}
              </ul>

              <Link
                to={p.cta.to}
                className="inline-flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-wider text-titanium-300 hover:text-titanium-50 transition-colors group"
              >
                {p.cta.label}
                <ArrowRight className="h-3 w-3 group-hover:translate-x-0.5 transition-transform" />
              </Link>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
