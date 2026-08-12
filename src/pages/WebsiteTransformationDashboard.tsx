import { Link } from 'react-router-dom';
import { CheckCircle2, Circle, Clock3, ExternalLink, ShieldCheck, Sparkles } from 'lucide-react';

const STEPS = [
  ['Analyse', 'Website, SEO, Inhalte und Compliance'],
  ['Konzept', 'Blueprint und neue Informationsarchitektur'],
  ['Website-Build', 'Neue Landingpage und Seiten'],
  ['SEO-Optimierung', 'Technische und lokale SEO-Maßnahmen'],
  ['DSGVO-Konfiguration', 'Consent, Datenschutz und Tracking'],
  ['Chatbot', 'Website-Assistent und Wissensbasis'],
  ['Telefonbot', 'Telefonie-Workflow und Übergabe'],
  ['Preview', 'Abnahme der neuen Website'],
  ['Freigabe', 'Änderungen bestätigen'],
  ['Deployment', 'Veröffentlichung auf der Ziel-Domain'],
] as const;

export default function WebsiteTransformationDashboard() {
  const completed = 2;
  const progress = Math.round((completed / STEPS.length) * 100);

  return (
    <main className="min-h-screen bg-[rgb(3,7,18)] px-4 py-8 text-white sm:px-6">
      <div className="mx-auto max-w-5xl">
        <header className="flex items-center justify-between border-b border-white/10 pb-5">
          <Link to="/" className="flex items-center gap-2 text-sm font-semibold">
            <Sparkles className="h-4 w-4 text-cyan-300" /> RealSyncDynamics.AI
          </Link>
          <span className="rounded-full border border-emerald-400/20 bg-emerald-400/5 px-3 py-1 text-[11px] text-emerald-300">
            Projekt freigeschaltet
          </span>
        </header>

        <section className="mt-10 grid gap-5 lg:grid-cols-[1fr_300px]">
          <div className="rounded-2xl border border-white/10 bg-white/[.025] p-6 sm:p-8">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="font-mono text-[10px] uppercase tracking-[.18em] text-cyan-300">Website Transformation</p>
                <h1 className="mt-2 text-2xl font-semibold sm:text-3xl">Deine Website wird neu aufgebaut.</h1>
                <p className="mt-3 max-w-2xl text-sm leading-6 text-white/45">
                  Analyse, SEO, DSGVO, KI-Funktionen und Deployment laufen als nachvollziehbarer Projekt-Workflow.
                </p>
              </div>
              <div className="text-right">
                <div className="text-2xl font-semibold">{progress}%</div>
                <div className="text-[11px] text-white/35">Fortschritt</div>
              </div>
            </div>

            <div className="mt-7 h-1.5 overflow-hidden rounded-full bg-white/10">
              <div className="h-full rounded-full bg-cyan-400" style={{ width: `${progress}%` }} />
            </div>

            <div className="mt-8 space-y-2">
              {STEPS.map(([title, description], index) => {
                const done = index < completed;
                const active = index === completed;
                return (
                  <div key={title} className={`flex items-center gap-4 rounded-xl border p-4 ${active ? 'border-cyan-400/30 bg-cyan-400/[.04]' : 'border-white/5 bg-white/[.015]'}`}>
                    {done ? <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-400" /> : active ? <Clock3 className="h-5 w-5 shrink-0 text-cyan-300" /> : <Circle className="h-5 w-5 shrink-0 text-white/15" />}
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-medium">{title}</div>
                      <div className="mt-0.5 text-xs text-white/35">{description}</div>
                    </div>
                    {active && <span className="text-[10px] uppercase tracking-wider text-cyan-300">in Arbeit</span>}
                  </div>
                );
              })}
            </div>
          </div>

          <aside className="space-y-4">
            <div className="rounded-2xl border border-white/10 bg-white/[.025] p-5">
              <div className="flex items-center gap-2 text-sm font-medium"><ShieldCheck className="h-4 w-4 text-cyan-300" /> Governance</div>
              <p className="mt-3 text-xs leading-5 text-white/40">DSGVO- und EU-AI-Act-relevante Prüfungen werden als Teil des Projekts dokumentiert.</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/[.025] p-5">
              <div className="text-xs text-white/35">Ziel-Website</div>
              <div className="mt-2 truncate text-sm">Deine bestehende Domain</div>
              <button className="mt-4 inline-flex items-center gap-2 text-xs text-cyan-300 hover:text-cyan-200"><ExternalLink className="h-3.5 w-3.5" /> Vorschau öffnen</button>
            </div>
            <Link to="/features" className="block rounded-xl border border-white/10 px-4 py-3 text-center text-xs text-white/50 hover:bg-white/5 hover:text-white">Projekt mit KI bearbeiten</Link>
          </aside>
        </section>
      </div>
    </main>
  );
}
