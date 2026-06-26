import { Link } from 'react-router-dom';
import { ArrowLeft, ArrowRight, Cpu, Layers, Workflow, ShieldCheck, Database, Sparkles, Users2 } from 'lucide-react';
import { usePageMeta } from '../lib/usePageMeta';

/**
 * /manifest — Strategische Standortbestimmung: "Das KI-Betriebssystem".
 *
 * Kernthese: Die Zukunft gehört nicht denen, die das beste Tool nutzen,
 * sondern denen, die ein System bauen. Diese Seite ordnet die bestehenden
 * Bausteine der Plattform (Governance, Workflows, AI-Gateway, Multi-Tenancy)
 * dieser These zu — keine neue Erzählung, sondern eine Landkarte.
 */

const LAYERS = [
  {
    icon: ShieldCheck,
    title: 'Governance Layer',
    status: 'Im Einsatz',
    desc: 'AI/Human-Entscheidungsgrenzen, Risiko-Bewertung, Prüfpfad über jeden KI-Call. Jede Anfrage landet in ai_tool_runs und workflow_runs — nachvollziehbar, mandantengetrennt.',
  },
  {
    icon: Workflow,
    title: 'Automation Runtime',
    status: 'Im Einsatz',
    desc: 'n8n-Workflow-Engine via Edge Functions: workflow-trigger startet, workflow-callback meldet Ergebnis. Fehlerbehandlung, Kosten- und Laufzeit-Tracking pro Run.',
  },
  {
    icon: Database,
    title: 'Daten-Architektur',
    status: 'Im Einsatz',
    desc: 'Postgres mit RLS auf jeder Tabelle, EU-Hosting in Frankfurt. Ein Datenmodell für alle Tenants — keine Datensilos pro Tool.',
  },
  {
    icon: Cpu,
    title: 'Intelligence Layer',
    status: 'Im Aufbau',
    desc: 'AI-Gateway routet zwischen Anthropic, Google, OpenAI (Cloud) und Ollama gemma3:4b (EU-lokal) — je nach Datenklasse und Kosten. Modellwahl ist Konfiguration, kein Re-Write.',
  },
  {
    icon: Sparkles,
    title: 'User Experience',
    status: 'Im Aufbau',
    desc: 'Governance-Dashboards, Discovery-Flows und Self-Service-Tools laufen auf derselben Plattform — ein Login, ein Audit-Trail, eine Rechnung.',
  },
  {
    icon: Users2,
    title: 'Enterprise Features',
    status: 'Geplant',
    desc: 'Multi-Tenancy, rollenbasierte Zugriffe und Quoten existieren bereits pro Plan (Free → Enterprise). Nächster Schritt: SLA-Garantien und Custom-Integrationen.',
  },
];

export function Manifest() {
  usePageMeta({
    title: 'Das KI-Betriebssystem — RealSyncDynamics.AI',
    description:
      'Warum die Zukunft der Arbeit nicht denen gehört, die das beste KI-Tool nutzen, sondern denen, die ein System daraus bauen.',
    url: 'https://RealSyncDynamicsAI.de/manifest',
  });

  return (
    <div className="min-h-screen bg-obsidian-950 text-titanium-100">
      <header className="h-14 border-b border-titanium-900 bg-obsidian-900 flex items-center px-4">
        <Link
          to="/"
          className="p-1.5 rounded-none hover:bg-obsidian-800 text-titanium-400 hover:text-titanium-200 mr-3"
          aria-label="Zur Startseite"
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-none bg-gradient-to-br from-security-500 to-security-700 flex items-center justify-center">
            <Layers className="h-4 w-4 text-white" />
          </div>
          <div className="font-display font-bold text-sm tracking-tight text-titanium-50">Manifest</div>
        </div>
      </header>

      <main className="px-4 sm:px-6 py-12 sm:py-16">
        <div className="max-w-3xl mx-auto space-y-10">
          <div>
            <div className="text-[11px] font-mono uppercase tracking-[0.25em] text-gold-400 mb-3">
              Strategische Standortbestimmung
            </div>
            <h1 className="text-3xl sm:text-5xl font-display font-bold text-titanium-50 tracking-tight leading-tight mb-4">
              Das KI-Betriebssystem — die Zukunft der Arbeit
            </h1>
            <p className="text-lg text-titanium-300 leading-relaxed">
              Die Zukunft gehört nicht denen, die das beste Tool nutzen — sondern denen,
              die ein System bauen, in dem viele Tools ersetzbar sind.
            </p>
          </div>

          <Section title="Das Problem mit „Tools“">
            <p>
              Ein einzelnes KI-Tool — ein Chatbot, ein Bildgenerator, ein Automatisierungs-Skript —
              ist schnell beeindruckend und genauso schnell ersetzt. Wer sein Geschäft auf <em>einem</em> Tool
              aufbaut, ist von dessen Anbieter, Preisgestaltung und Roadmap abhängig.
            </p>
            <p>
              Ein <strong className="text-titanium-50">Betriebssystem</strong> dagegen definiert, wie Tools
              zusammenspielen: wer entscheiden darf (Mensch oder KI), wie Entscheidungen protokolliert werden,
              wie Daten fließen und wie neue Modelle oder Anbieter ausgetauscht werden — ohne dass Workflows
              oder Mandanten-Trennung neu gebaut werden müssen.
            </p>
          </Section>

          <Section title="Sechs Bausteine, ein System">
            <p className="mb-4">
              RealSyncDynamics.AI ist kein einzelnes Tool, sondern die Summe dieser sechs Schichten —
              jede einzeln nutzbar, gemeinsam ein Betriebssystem:
            </p>
            <div className="grid sm:grid-cols-2 gap-3">
              {LAYERS.map((l) => (
                <div key={l.title} className="p-4 bg-obsidian-900 border border-titanium-900 rounded-none">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <l.icon className="h-4 w-4 text-security-400 shrink-0" strokeWidth={1.5} />
                      <div className="font-display font-bold text-titanium-50 text-sm">{l.title}</div>
                    </div>
                    <span className="text-[10px] font-mono uppercase tracking-[0.15em] border border-silver-500 text-silver-300 px-2 py-0.5 rounded-none shrink-0">
                      {l.status}
                    </span>
                  </div>
                  <p className="text-xs text-titanium-400 leading-relaxed">{l.desc}</p>
                </div>
              ))}
            </div>
          </Section>

          <Section title="Was das konkret bedeutet">
            <ul className="space-y-3 text-sm">
              <li className="flex items-start gap-3">
                <Workflow className="h-5 w-5 text-security-400 shrink-0 mt-0.5" />
                <div>
                  <strong className="text-titanium-50">Workflows statt Skripte.</strong> Ein n8n-Workflow,
                  einmal gebaut, läuft für jeden Mandanten — mit eigenem Prüfpfad, eigener Quote, eigenem Budget.
                </div>
              </li>
              <li className="flex items-start gap-3">
                <Cpu className="h-5 w-5 text-security-400 shrink-0 mt-0.5" />
                <div>
                  <strong className="text-titanium-50">Modelle als Konfiguration.</strong> Anthropic heute,
                  Ollama morgen, ein anderer Anbieter übermorgen — das System merkt es kaum, weil der
                  AI-Gateway die Anbieter abstrahiert.
                </div>
              </li>
              <li className="flex items-start gap-3">
                <ShieldCheck className="h-5 w-5 text-security-400 shrink-0 mt-0.5" />
                <div>
                  <strong className="text-titanium-50">Herkunftsnachweis statt Vertrauen.</strong> Jeder
                  KI-Aufruf, jeder Workflow-Lauf wird protokolliert — Voraussetzung für EU AI Act und DSGVO,
                  nicht nachträglich aufgesetzt.
                </div>
              </li>
            </ul>
          </Section>

          <Section title="Phasen">
            <ul className="space-y-1.5 text-sm">
              <li className="flex items-start gap-2">
                <span className="text-emerald-400 font-mono text-xs mt-0.5">✓</span>
                <span className="text-titanium-300">
                  <strong className="text-titanium-50">Governance &amp; Fundament</strong> — Prüfpfad, RLS,
                  Multi-Tenancy, AI-Gateway, erste Workflows live.
                </span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-amber-400 font-mono text-xs mt-0.5">→</span>
                <span className="text-titanium-300">
                  <strong className="text-titanium-50">AI-Integration ausbauen</strong> — mehr n8n-Rezepte,
                  automation_runs als Self-Service-Dashboard, Edge-Function-Ausführung für eigene Workflows.
                </span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-titanium-500 font-mono text-xs mt-0.5"> </span>
                <span className="text-titanium-400">
                  <strong className="text-titanium-300">Enterprise</strong> — SLAs, Custom-Integrationen,
                  erweiterte Rollen- und Budgetsteuerung pro Team.
                </span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-titanium-500 font-mono text-xs mt-0.5"> </span>
                <span className="text-titanium-400">
                  <strong className="text-titanium-300">Selbstlernende Systeme</strong> — Workflows, die sich
                  anhand von Audit-Daten selbst optimieren, mit Mensch-im-Loop für kritische Entscheidungen.
                </span>
              </li>
            </ul>
          </Section>

          <div className="mt-12 p-6 sm:p-8 bg-obsidian-900 border border-security-700 rounded-none">
            <div className="flex items-center gap-2 mb-2">
              <Users2 className="h-5 w-5 text-security-400" />
              <h2 className="font-display font-bold text-titanium-50 text-xl">System statt Tool</h2>
            </div>
            <p className="text-titanium-300 text-sm mb-4">
              Wer heute nur ein Tool kauft, hat morgen ein neues Tool zu evaluieren. Wer ein System aufbaut,
              tauscht Bausteine aus, ohne das Ganze neu zu denken.
            </p>
            <div className="flex flex-col sm:flex-row gap-2">
              <Link to="/contact-sales?source=manifest" className="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-security-500 hover:bg-security-600 text-white text-sm font-bold rounded-none">
                Gespräch vereinbaren <ArrowRight className="h-4 w-4" />
              </Link>
              <Link to="/about" className="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-obsidian-950 border border-titanium-700 hover:border-security-500 text-titanium-200 text-sm font-bold rounded-none">
                Über RealSync Dynamics
              </Link>
            </div>
          </div>
        </div>
      </main>

      <footer className="border-t border-titanium-900 mt-12 py-6 px-4">
        <div className="max-w-3xl mx-auto flex flex-col sm:flex-row gap-3 sm:justify-between text-xs text-titanium-500">
          <div>© 2026 RealSync Dynamics · Made in Germany · EU-Hosted</div>
          <div className="flex flex-wrap gap-3">
            <Link to="/about" className="hover:text-titanium-300">Über uns</Link>
            <Link to="/blog" className="hover:text-titanium-300">Blog</Link>
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
