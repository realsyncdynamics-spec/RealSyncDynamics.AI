import { Link } from 'react-router-dom';
import { ArrowRight, Globe, Users2, Code2 } from 'lucide-react';

/**
 * TargetAudience — „Für wen?"-Section direkt unter ServiceLaunchpad.
 *
 * Pre-#G war die Landing implizit Developer-only („Compliance-Decision-
 * Layer für Developer-Teams"). Die Plattform bedient aber drei Audiences,
 * die sich hier wiedererkennen müssen, BEVOR sie zur Tech-Tiefe scrollen:
 *   1. Webseiten-Betreiber (Solo, Praxis, Verein, KMU)
 *   2. Agenturen (Multi-Site)
 *   3. Teams & Enterprises (CI/CD, API, Audit)
 *
 * Layout: 3-Karten-Grid mit Icon, Headline, Beschreibung, Verlinkung.
 * Bewusst alltagssprachlich für Audience 1, technische Schlagworte
 * gehören in Audience 3.
 */
type Profile = {
  icon: React.ReactNode;
  title: string;
  body: string;
  to: string;
  cta: string;
};

const PROFILES: Profile[] = [
  {
    icon: <Globe className="h-5 w-5 text-ai-cyan-400" />,
    title: 'Webseiten-Betreiber',
    body: 'Ob Arztpraxis, Online-Shop oder Verein — prüfen Sie Ihre Website auf DSGVO-Risiken, ohne Jurastudium. Ergebnis in Klartext, mit konkreten Empfehlungen.',
    to: '/audit?source=audience-betreiber',
    cta: 'Website prüfen',
  },
  {
    icon: <Users2 className="h-5 w-5 text-brass-400" />,
    title: 'Agenturen',
    body: 'Scannen Sie alle Kundenseiten automatisch und liefern Sie messbare Compliance-Reports. Multi-Tenant-Workspace, Per-Tenant-API-Keys, signierte PDFs.',
    to: '/agencies',
    cta: 'Für Agenturen',
  },
  {
    icon: <Code2 className="h-5 w-5 text-security-400" />,
    title: 'Teams & Enterprises',
    body: 'Integrieren Sie Compliance-Checks in CI/CD, API und Monitoring. Webhooks, BYOK, Procurement-tauglich, ISO-anbindbar.',
    to: '/pricing?tier=team',
    cta: 'Für Teams',
  },
];

export function TargetAudience() {
  return (
    <section
      aria-label="Für wen ist RealSyncDynamics"
      className="px-4 sm:px-6 lg:px-8 py-16 sm:py-20 border-t border-titanium-900 bg-obsidian-900/20"
    >
      <div className="max-w-5xl mx-auto">
        <div className="text-center mb-10">
          <div className="text-[10px] font-mono uppercase tracking-[0.2em] text-titanium-500 mb-3">
            Für wen?
          </div>
          <h2 className="text-2xl sm:text-3xl font-display font-bold text-titanium-50 tracking-tight">
            Drei Wege, einen Compliance-Check zu nutzen.
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-px bg-titanium-900">
          {PROFILES.map((p) => (
            <div key={p.title} className="flex flex-col bg-obsidian-950 p-6 sm:p-7">
              <div className="mb-3">{p.icon}</div>
              <h3 className="font-display font-bold text-titanium-50 text-lg tracking-tight mb-2">
                {p.title}
              </h3>
              <p className="text-sm text-titanium-400 leading-relaxed flex-1 mb-5">
                {p.body}
              </p>
              <Link
                to={p.to}
                className="inline-flex items-center gap-1.5 text-sm font-semibold text-titanium-200 hover:text-titanium-50 self-start"
              >
                {p.cta} <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
