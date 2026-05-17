import { Link } from 'react-router-dom';
import { Search, Cpu, ScrollText, ShieldCheck, ArrowRight } from 'lucide-react';

// AiActSequenceSection — die 4 Phasen Discover → Classify → Control → Evidence.
// Adressiert: „AI-Act-Modul narrativ entpacken" aus dem Analyse-Punkt 4.
// Kein Diagramm-Library, sondern reine CSS-Sequenz mit Pfeilen zwischen den
// Schritten — passt zum Hard-Edge Industrial Look.

interface Step {
  n:           string;
  icon:        React.ReactNode;
  layer:       string;
  title:       string;
  detail:      string;
  artifact:    string;
  accent:      string;
}

const STEPS: readonly Step[] = [
  {
    n:        '01',
    icon:     <Search className="h-5 w-5" />,
    layer:    'discover',
    title:    'AI-Endpunkte entdecken',
    detail:   'website-drift-agent scannt Frontend + Network-Layer und findet alle Stellen, an denen ein KI-Modell aufgerufen wird — Chat-Widgets, Recommendation-Engines, Empfehlungs-APIs.',
    artifact: 'discovery_log',
    accent:   'text-cyan-300',
  },
  {
    n:        '02',
    icon:     <Cpu className="h-5 w-5" />,
    layer:    'classify',
    title:    'Annex-III-Klassifikation',
    detail:   'ai-risk-agent klassifiziert jeden Endpunkt gegen die AI-Act-Risikoklassen (minimal / limited / high / prohibited). High-Risk-Treffer erzeugen automatisch einen Usecase-Registry-Eintrag.',
    artifact: 'risk_profile.json',
    accent:   'text-violet-300',
  },
  {
    n:        '03',
    icon:     <ScrollText className="h-5 w-5" />,
    layer:    'control',
    title:    'Controls + Human Oversight',
    detail:   'policy-agent entwirft pro Usecase die nötigen Controls — Transparenz-Hinweis, DPIA-Trigger, Logging-Pflichten, Human-Review-Pfade. Diff geht an den Owner via Slack/Email.',
    artifact: 'controls.diff',
    accent:   'text-amber-300',
  },
  {
    n:        '04',
    icon:     <ShieldCheck className="h-5 w-5" />,
    layer:    'evidence',
    title:    'Evidence-Bundle',
    detail:   'evidence-agent hasht + signiert jeden Schritt. Bei Audit-Anfrage exportieren Sie ein vollständiges Bundle mit Discovery → Classification → Controls → Run-Logs in 60 s.',
    artifact: 'audit_bundle.zip',
    accent:   'text-emerald-300',
  },
];

export function AiActSequenceSection() {
  return (
    <section
      aria-label="AI Act Sequenz"
      className="bg-obsidian-950 border-b border-titanium-900 py-20 sm:py-24 px-4 sm:px-6"
    >
      <div className="max-w-7xl mx-auto">
        <div className="max-w-3xl mb-12">
          <div className="text-[11px] font-mono uppercase tracking-[0.18em] text-titanium-500 mb-3">
            04 · AI Act in 4 Schritten
          </div>
          <h2 className="text-3xl sm:text-4xl font-display font-semibold tracking-tight text-titanium-50 mb-3">
            Discover → Classify → Control → Evidence.
          </h2>
          <p className="text-titanium-300 text-base sm:text-lg leading-relaxed max-w-2xl">
            Was die Runtime für einen AI-Act-Stakeholder konkret übernimmt. Vier Phasen,
            vier Agenten, vier Artefakte — alles in der Evidence-Chain dokumentiert.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-px bg-titanium-900 relative">
          {STEPS.map((s, i) => (
            <article
              key={s.n}
              className="bg-obsidian-950 p-6 sm:p-7 flex flex-col relative"
            >
              {/* Connector arrow between steps (desktop only) */}
              {i < STEPS.length - 1 && (
                <span
                  aria-hidden="true"
                  className="hidden lg:flex absolute right-[-12px] top-1/2 -translate-y-1/2 z-10 w-6 h-6 bg-obsidian-950 border border-titanium-800 items-center justify-center"
                >
                  <ArrowRight className="h-3 w-3 text-titanium-500" />
                </span>
              )}

              <header className="flex items-center gap-2.5 mb-4">
                <span className={`inline-flex w-9 h-9 items-center justify-center bg-obsidian-900 border border-titanium-800 ${s.accent}`}>
                  {s.icon}
                </span>
                <div className="flex flex-col">
                  <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-titanium-500">
                    {s.n}
                  </span>
                  <span className={`font-mono text-[10px] uppercase tracking-wider ${s.accent}`}>
                    {s.layer}
                  </span>
                </div>
              </header>

              <h3 className="font-display font-semibold text-base text-titanium-50 mb-3 leading-snug">
                {s.title}
              </h3>

              <p className="text-titanium-400 text-sm leading-relaxed flex-1 mb-4">
                {s.detail}
              </p>

              <div className="pt-3 border-t border-titanium-900">
                <div className="font-mono text-[10px] uppercase tracking-wider text-titanium-500 mb-1">
                  Artefakt
                </div>
                <div className={`font-mono text-xs ${s.accent}`}>
                  {s.artifact}
                </div>
              </div>
            </article>
          ))}
        </div>

        <div className="mt-8 text-center">
          <Link
            to="/ai-act"
            className="inline-flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-wider text-titanium-300 hover:text-titanium-50 transition-colors group"
          >
            AI-Act-Modul im Detail
            <ArrowRight className="h-3 w-3 group-hover:translate-x-0.5 transition-transform" />
          </Link>
        </div>
      </div>
    </section>
  );
}
