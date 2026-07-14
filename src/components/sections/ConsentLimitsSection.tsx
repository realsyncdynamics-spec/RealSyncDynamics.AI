import { Cookie, Eye, Activity, FileText, Brain } from 'lucide-react';

/**
 * ConsentLimitsSection — Positionierungs-Section auf den Alternative-Pages.
 *
 * Argument: Cookie-Banner sind ein Compliance-BAUSTEIN, nicht das ganze
 * Compliance-Problem. RealSyncDynamicsAI positioniert sich nicht als
 * besseres Cookie-CMP, sondern als automatisierte Compliance-Infrastruktur:
 * Detection -> Monitoring -> Auditability -> AI-Governance.
 *
 * Wichtig: kein direktes Bashing der Wettbewerber. Die Section adressiert
 * die Kategorie "Cookie-CMP" als Ganzes — und macht klar, was ueber Consent
 * hinaus gebraucht wird.
 */

interface LimitItem {
  icon: typeof Cookie;
  scope: 'Cookie-Banner allein' | 'Compliance-Infrastruktur';
  label: string;
  detail: string;
}

const LIMITS: LimitItem[] = [
  {
    icon: Cookie,
    scope: 'Cookie-Banner allein',
    label: 'Consent-Einholung am UI',
    detail:
      'Banner zeigen, Cookies erst nach Zustimmung setzen — ja, das ist die Pflicht aus § 25 TDDDG. Aber damit ist nur die SICHTBARE Schicht erschlagen.',
  },
  {
    icon: Eye,
    scope: 'Compliance-Infrastruktur',
    label: 'Pre-Consent-Tracker-Detection',
    detail:
      'Was feuert tatsächlich VOR dem ersten Klick? Echte Network-Trace mit Headless-Browser deckt auf, was zwischen <head> und User-Action passiert — der Kern-Verstoss bei DSGVO-Audits.',
  },
  {
    icon: Activity,
    scope: 'Compliance-Infrastruktur',
    label: 'Continuous Monitoring',
    detail:
      'Compliance ist kein einmaliger Zustand. Websites ändern sich, Marketing fügt Tags hinzu, Vendors rollen Updates aus. Tägliches Monitoring + Drift-Alerts statt einmaliger Banner-Setup.',
  },
  {
    icon: FileText,
    scope: 'Compliance-Infrastruktur',
    label: 'Audit-Trail + Evidence Vault',
    detail:
      'Wer fragt, was war wann compliant? Kryptografisch signierte Snapshots, Methodik-Versionen, reproduzierbare Reports — Aufsichtsbehörden-tauglich, auch nach 6+ Monaten.',
  },
  {
    icon: Brain,
    scope: 'Compliance-Infrastruktur',
    label: 'AI-Governance (EU AI Act)',
    detail:
      'Ab 2026 müssen Hochrisiko-KI-Systeme klassifiziert, dokumentiert und auditiert werden. Cookie-Banner adressieren das nicht. Wir liefern Annex-III-Klassifikator + Pflichten-Mapping.',
  },
];

export interface ConsentLimitsSectionProps {
  eyebrow?: string;
  headline?: string;
  subline?: string;
}

export function ConsentLimitsSection({
  eyebrow = 'Positionierung · Compliance-Stack',
  headline = 'Cookie Banner lösen nur einen Teil des Problems.',
  subline = 'Consent-Einholung ist Pflicht — aber sie ist nur einer von fünf Bausteinen einer belastbaren DSGVO- und AI-Act-Compliance. RealSyncDynamicsAI ist nicht das nächste Cookie-CMP, sondern die Infrastruktur dahinter.',
}: ConsentLimitsSectionProps = {}) {
  return (
    <section
      id="consent-limits"
      className="border-t border-silver-700/30 px-4 sm:px-6 lg:px-8 py-16 sm:py-20 bg-obsidian-950/50"
    >
      <div className="max-w-5xl mx-auto">
        <div className="text-center mb-10 sm:mb-12">
          <div className="text-[11px] font-mono uppercase tracking-[0.25em] text-gold-400 mb-3">
            {eyebrow}
          </div>
          <h2 className="font-display font-bold text-2xl sm:text-4xl text-titanium-50 tracking-tight leading-tight max-w-3xl mx-auto">
            {headline}
          </h2>
          <p className="mt-4 text-sm sm:text-base text-silver-300 leading-relaxed max-w-2xl mx-auto">
            {subline}
          </p>
        </div>

        <ol className="space-y-3">
          {LIMITS.map((item, idx) => {
            const Icon = item.icon;
            const isCookieOnly = item.scope === 'Cookie-Banner allein';
            return (
              <li
                key={item.label}
                className={`relative pl-12 sm:pl-14 p-5 sm:p-6 bg-obsidian-900/60 border-l-2 ${
                  isCookieOnly
                    ? 'border-l-amber-500/60 border border-silver-700/30'
                    : 'border-l-emerald-400/70 border border-silver-700/30'
                } rounded-none`}
              >
                <div className="absolute top-5 sm:top-6 left-4 flex items-center justify-center w-6 h-6 bg-obsidian-950 border border-silver-700/40 font-mono text-[11px] text-silver-400 tabular-nums">
                  {idx + 1}
                </div>
                <div className="flex flex-col sm:flex-row sm:items-start sm:gap-4">
                  <div className="flex items-center gap-2 mb-2 sm:mb-0 sm:w-56 shrink-0">
                    <Icon
                      className={`h-4 w-4 shrink-0 ${
                        isCookieOnly ? 'text-amber-400' : 'text-emerald-400'
                      }`}
                    />
                    <span className="font-display font-bold text-titanium-50 text-sm sm:text-base">
                      {item.label}
                    </span>
                  </div>
                  <div className="flex-1">
                    <div
                      className={`text-[10px] font-mono uppercase tracking-wider mb-1.5 ${
                        isCookieOnly ? 'text-amber-400' : 'text-emerald-400'
                      }`}
                    >
                      {item.scope}
                    </div>
                    <p className="text-sm text-silver-300 leading-relaxed">{item.detail}</p>
                  </div>
                </div>
              </li>
            );
          })}
        </ol>

        <div className="mt-8 p-5 bg-obsidian-900/80 border border-silver-700/40 rounded-none">
          <p className="text-sm sm:text-base text-titanium-100 leading-relaxed">
            <strong className="text-titanium-50">Position von RealSyncDynamicsAI:</strong>{' '}
            wir sind kein reines Consent-Tool, sondern eine{' '}
            <strong className="text-gold-400">automatisierte Compliance-Infrastruktur</strong>{' '}
            mit Detection, Monitoring, Auditability und AI-Governance. Cookie-Banner sind ein
            Output-Modul davon — nicht der ganze Stack.
          </p>
        </div>
      </div>
    </section>
  );
}
