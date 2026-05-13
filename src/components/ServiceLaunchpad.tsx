import { Link } from 'react-router-dom';
import { ArrowRight, ShieldCheck, Globe, Tag, BookOpen } from 'lucide-react';

/**
 * ServiceLaunchpad — direkt unter dem Hero. Kernfunktionen als große
 * Button-Cards, statt langer Erklärtexte. Wer genau weiß was er will,
 * springt sofort dahin; wer Tiefe will, scrollt weiter zu Showcase /
 * ExampleReport / AuditEngine.
 *
 * 2×2-Grid auf Desktop, 1-Spalte auf Mobile. Jede Card ist als ganzes
 * <Link> klickbar (große Trefferfläche), Pfeil-Icon nur als visuelles
 * Affordance.
 */
type Service = {
  icon: React.ReactNode;
  eyebrow: string;
  title: string;
  body: string;
  to: string;
  cta: string;
  primary?: boolean;
};

const SERVICES: Service[] = [
  {
    icon: <ShieldCheck className="h-5 w-5 text-ai-cyan-400" />,
    eyebrow: 'Quick-Scan',
    title: 'Audit starten',
    body: 'Domain eingeben, in 30 Sekunden Score + Befundliste.',
    to: '/audit',
    cta: 'Kostenlos scannen',
    primary: true,
  },
  {
    icon: <Globe className="h-5 w-5 text-brass-400" />,
    eyebrow: 'Website-Service',
    title: 'DSGVO-Rebuild + Managed',
    body: 'Audit, Neuaufbau, EU-Hosting — Managed-Betrieb nach Angebot.',
    to: '/dsgvo-website',
    cta: '3-Paket-Angebot',
  },
  {
    icon: <Tag className="h-5 w-5 text-titanium-300" />,
    eyebrow: 'Pricing',
    title: 'Pläne im Detail',
    body: 'Free, Team, Managed, Enterprise — Features, Limits, Quotas.',
    to: '/pricing',
    cta: 'Pricing ansehen',
  },
  {
    icon: <BookOpen className="h-5 w-5 text-titanium-300" />,
    eyebrow: 'Methodology',
    title: 'Wie wir prüfen',
    body: 'DSGVO/TTDSG/BSI-Header-Mapping mit Paragraph-Bezug, kein LLM.',
    to: '/legal/methodology',
    cta: 'Methodik einsehen',
  },
];

export function ServiceLaunchpad() {
  return (
    <section
      aria-label="Service-Launchpad"
      className="px-4 sm:px-6 lg:px-8 py-16 sm:py-20 border-t border-titanium-900"
    >
      <div className="max-w-5xl mx-auto">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-px bg-titanium-900">
          {SERVICES.map((s) => (
            <Link
              key={s.to}
              to={s.to}
              className={`group relative flex flex-col p-6 sm:p-7 transition-colors ${
                s.primary
                  ? 'bg-obsidian-900 hover:bg-obsidian-800/70 ring-1 ring-ai-cyan-500/30'
                  : 'bg-obsidian-950 hover:bg-obsidian-900'
              }`}
            >
              <div className="flex items-center gap-2 mb-2">
                {s.icon}
                <span className="text-[10px] font-mono uppercase tracking-[0.2em] text-titanium-500">
                  {s.eyebrow}
                </span>
              </div>
              <h3 className="font-display font-bold text-titanium-50 text-xl tracking-tight mb-1.5">
                {s.title}
              </h3>
              <p className="text-sm text-titanium-400 leading-relaxed mb-5 flex-1">
                {s.body}
              </p>
              <span
                className={`inline-flex items-center gap-1.5 text-sm font-semibold tracking-tight ${
                  s.primary ? 'text-ai-cyan-300' : 'text-titanium-200 group-hover:text-titanium-50'
                }`}
              >
                {s.cta}
                <ArrowRight className="h-3.5 w-3.5 group-hover:translate-x-0.5 transition-transform" />
              </span>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
