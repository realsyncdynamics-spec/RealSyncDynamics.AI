import { Link } from 'react-router-dom';
import { ArrowLeft, ArrowRight, Workflow, CheckCircle2 } from 'lucide-react';
import { usePageMeta } from '../lib/usePageMeta';
import { AUTOMATION_SKILLS, AUTOMATION_SKILL_CATEGORIES } from '../content/automationSkills';
import { AutomationSkillStatusBadge } from '../features/automations/AutomationSkillCard';

/** /automations — öffentlicher Teaser für das Self-Service-Modul "Automatisierungs-Skills". */
export function AutomationsLanding() {
  usePageMeta({
    title: 'Automatisierungs-Skills — sofort nutzbare Workflows',
    description:
      'Vordefinierte Compliance- und Vertriebs-Workflows zum Aktivieren: DSGVO-Audit, Dokumenten-Generator, Meeting-Compliance, Feedback-Tickets, Lead-Risk-Scan und Support.',
    url: 'https://RealSyncDynamicsAI.de/automations',
  });

  return (
    <div className="min-h-screen bg-obsidian-950 text-titanium-100">
      <header className="h-14 border-b border-titanium-900 bg-obsidian-900 flex items-center px-4">
        <Link to="/" className="p-1.5 hover:bg-obsidian-800 text-titanium-400 hover:text-titanium-200 mr-3">
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 bg-gradient-to-br from-indigo-500 to-blue-600 flex items-center justify-center">
            <Workflow className="h-4 w-4 text-white" />
          </div>
          <div className="font-display font-bold text-sm tracking-tight text-titanium-50">Automatisierungs-Skills</div>
        </div>
      </header>

      <main className="px-4 sm:px-6 py-12 sm:py-16">
        <div className="max-w-3xl mx-auto space-y-10">
          <div className="text-center">
            <div className="inline-flex items-center gap-2 px-3 py-1 border border-security-700 bg-security-900/20 text-security-300 text-xs font-bold uppercase tracking-wider mb-5">
              <Workflow className="h-3 w-3" /> Self-Service · Sofort aktivierbar
            </div>
            <h1 className="text-3xl sm:text-5xl font-display font-bold text-titanium-50 tracking-tight leading-tight mb-4">
              Wählen. Aktivieren. <span className="text-security-400">Nutzen.</span>
            </h1>
            <p className="text-lg text-titanium-300 max-w-xl mx-auto leading-relaxed">
              Automatisierungs-Skills sind vordefinierte Workflows, die Sie direkt in RealSyncDynamics.AI
              aktivieren — ohne Beratungsgespräch, ohne individuelles Setup.
            </p>
          </div>

          <Section title="Nicht: Wir bauen Ihnen eine Automatisierung.">
            <ul className="space-y-2 text-sm">
              <li className="flex items-start gap-2">
                <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />
                <span>Sondern: <strong className="text-titanium-50">Skill auswählen, aktivieren, Ergebnis erhalten</strong> — als Teil Ihres Workspaces.</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />
                <span>Jeder Skill liefert ein klares Ergebnis: Report, Dokument, Protokoll oder Ticket.</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />
                <span>Läuft auf der bestehenden EU-souveränen Infrastruktur — Prüfpfad inklusive.</span>
              </li>
            </ul>
          </Section>

          <Section title="Die ersten 6 Skills">
            <div className="grid sm:grid-cols-2 gap-4">
              {AUTOMATION_SKILLS.map((skill) => (
                <div key={skill.id} className="border border-titanium-800 bg-obsidian-900 p-4 flex flex-col gap-2">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="font-display font-bold text-titanium-50 text-sm">{skill.title}</h3>
                    <AutomationSkillStatusBadge status={skill.status} />
                  </div>
                  <p className="font-mono text-[10px] uppercase tracking-wider text-titanium-500">
                    {AUTOMATION_SKILL_CATEGORIES[skill.category]}
                  </p>
                  <p className="text-xs text-titanium-300 leading-relaxed flex-1">{skill.shortDescription}</p>
                  <Link
                    to={skill.cta.href}
                    className="inline-flex items-center gap-1.5 self-start border border-security-500 bg-security-500 hover:bg-security-600 text-white text-xs font-bold px-3 py-1.5 mt-1"
                  >
                    {skill.cta.label} <ArrowRight className="h-3 w-3" />
                  </Link>
                </div>
              ))}
            </div>
          </Section>

          <div className="mt-12 p-6 sm:p-8 bg-obsidian-900 border border-security-700">
            <h2 className="font-display font-bold text-titanium-50 text-xl mb-2">
              Alle Skills im Dashboard verwalten
            </h2>
            <p className="text-sm text-titanium-300 mb-4">
              Im Workspace sehen Sie alle Automatisierungs-Skills mit Status, benötigtem Plan und Workflow —
              gefiltert nach Compliance, Vertrieb, Support, Dokumenten und Meetings.
            </p>
            <div className="flex flex-col sm:flex-row gap-2">
              <Link to="/app/automations" className="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-security-500 hover:bg-security-600 text-white text-sm font-bold">
                Im Dashboard öffnen <ArrowRight className="h-4 w-4" />
              </Link>
              <Link to="/audit" className="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-obsidian-950 border border-titanium-700 hover:border-security-500 text-titanium-200 text-sm font-bold">
                DSGVO Audit Skill aktivieren
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
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="text-xl sm:text-2xl font-display font-bold text-titanium-50 mb-3">{title}</h2>
      <div className="text-titanium-300 text-sm sm:text-base leading-relaxed space-y-3">
        {children}
      </div>
    </section>
  );
}
