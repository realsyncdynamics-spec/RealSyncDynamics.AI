import { Link } from 'react-router-dom';
import { ArrowUpRight, type LucideIcon } from 'lucide-react';
import {
  Home,
  Building2,
  Target,
  Factory,
  Wrench,
  Swords,
  Search,
} from 'lucide-react';
import { LandingNavbar } from '../components/LandingNavbar';

/**
 * Interne Übersicht aller öffentlichen Landing-/Marketing-Seiten.
 *
 * Erreichbar unter `/landingpages` (Alias `/landing-uebersicht`). Dient als
 * sichtbares Inhaltsverzeichnis der vorhandenen Landingpages für Redaktion,
 * SEO und QA. Die Liste wird manuell zu den Routen in `App.tsx` konsistent
 * gehalten — reine Präsentation, kein Datenzugriff.
 *
 * Design: „European Enterprise Trust" Light-Theme (Slate-Neutrals + Petrol).
 */

interface LandingEntry {
  /** Primär-Route (die erste, falls mehrere Aliase existieren) */
  path: string;
  /** Anzeigename der Seite */
  title: string;
  /** Kurzbeschreibung / Zielgruppe */
  description: string;
  /** Weitere URL-Aliase, die auf dieselbe Seite zeigen */
  aliases?: string[];
  /** Hinweis-Badge, z. B. „Design-Lock" */
  badge?: string;
}

interface LandingGroup {
  key: string;
  title: string;
  Icon: LucideIcon;
  entries: LandingEntry[];
}

const GROUPS: LandingGroup[] = [
  {
    key: 'haupt',
    title: 'Haupt- & Marketing-Landings',
    Icon: Home,
    entries: [
      { path: '/', title: 'MainLanding', description: 'Unternehmenshauptseite (Earth-at-Night Hero).', badge: 'Design-Lock' },
      { path: '/landing', title: 'Landing', description: 'Klassische Marketing-Landing.' },
      { path: '/aetheros', title: 'AetherOS', description: '3D-Konzept-Landing.' },
      { path: '/realsync-landing', title: 'RealSyncDynamics', description: 'Marken-Landing RealSyncDynamics.AI.' },
      { path: '/demo-landing', title: 'Demo-Landing', description: 'Demo-/Preview-Einstieg.' },
    ],
  },
  {
    key: 'enterprise',
    title: 'Enterprise / OS',
    Icon: Building2,
    entries: [
      { path: '/enterprise', title: 'Enterprise', description: 'Enterprise-Landing.' },
      { path: '/enterprise-ai-os', title: 'Enterprise AI-OS', description: 'AI-Betriebssystem für Unternehmen.' },
      { path: '/enterprise-ai-os/founding-access', title: 'Founding Access', description: 'Founding-Access-Programm.' },
      { path: '/os', title: 'Enterprise-OS Landing', description: 'Landing der Enterprise-OS-Suite.' },
      { path: '/os/audit', title: 'OS Audit', description: 'Audit-Landing im Enterprise-OS.' },
    ],
  },
  {
    key: 'zielgruppen',
    title: 'Zielgruppen / Nischen',
    Icon: Target,
    entries: [
      { path: '/fuer-saas', title: 'Für SaaS', description: 'SaaS-Anbieter.' },
      { path: '/fuer-agenturen', title: 'Für Agenturen', description: 'Agentur-Zielgruppe.' },
      { path: '/fuer-praxen', title: 'Für Praxen', description: 'Praxen-Zielgruppe.' },
      { path: '/agencies', title: 'Agencies', description: 'Agentur-Landing (EN/Conversion).' },
      { path: '/agenturen', title: 'Agenturen (Conversion)', description: 'Conversion-optimierte Agentur-Landing.' },
      { path: '/kanzleien', title: 'Kanzleien', description: 'Rechtsanwaltskanzleien.' },
      { path: '/arztpraxen', title: 'Arztpraxen', description: 'Arztpraxen / Medizin.' },
      { path: '/steuerberater', title: 'Steuerberater', description: 'Steuerberater & Steuerkanzleien.', aliases: ['/steuerkanzlei'] },
    ],
  },
  {
    key: 'branchen',
    title: 'Branchen',
    Icon: Factory,
    entries: [
      { path: '/branchen', title: 'Branchen-Übersicht', description: 'Alle Branchen + Detailseiten (/branchen/:slug).' },
      { path: '/healthtech', title: 'HealthTech', description: 'Gesundheits-Tech.' },
      { path: '/legal-tech', title: 'LegalTech', description: 'Legal-Tech.', aliases: ['/legaltech'] },
      { path: '/fintech', title: 'FinTech', description: 'Finanz-Tech.' },
      { path: '/versicherungen', title: 'Versicherungen', description: 'Versicherungsbranche.', aliases: ['/insurance'] },
      { path: '/ecommerce', title: 'E-Commerce', description: 'Online-Shops.', aliases: ['/online-shops'] },
      { path: '/oeffentliche-verwaltung', title: 'Öffentliche Verwaltung', description: 'Behörden & öffentlicher Sektor.', aliases: ['/behoerden', '/public-sector', '/publicsector'] },
      { path: '/saas-anbieter', title: 'SaaS-Anbieter', description: 'SaaS-Provider.', aliases: ['/saas-providers'] },
      { path: '/bildung', title: 'Bildung', description: 'Schulen & Bildungseinrichtungen.', aliases: ['/education', '/schulen'] },
      { path: '/hr-software', title: 'HR-Software', description: 'Personalwesen & HR.', aliases: ['/personalwesen', '/hr'] },
    ],
  },
  {
    key: 'usecase',
    title: 'Use-Case / Feature',
    Icon: Wrench,
    entries: [
      { path: '/audit', title: 'Audit', description: 'Audit-Use-Case-Landing.' },
      { path: '/automations', title: 'Automations', description: 'Automatisierungs-Landing.' },
    ],
  },
  {
    key: 'alternativen',
    title: 'Wettbewerber-Alternativen',
    Icon: Swords,
    entries: [
      { path: '/onetrust-alternative', title: 'OneTrust-Alternative', description: 'Vergleich vs. OneTrust.' },
      { path: '/usercentrics-alternative', title: 'Usercentrics-Alternative', description: 'Vergleich vs. Usercentrics.' },
      { path: '/dataguard-alternative', title: 'DataGuard-Alternative', description: 'Vergleich vs. DataGuard.' },
      { path: '/borlabs-alternative', title: 'Borlabs-Alternative', description: 'Vergleich vs. Borlabs.' },
      { path: '/cookiebot-alternative', title: 'Cookiebot-Alternative', description: 'Vergleich vs. Cookiebot.' },
      { path: '/proliance-alternative', title: 'Proliance-Alternative', description: 'Vergleich vs. Proliance.' },
      { path: '/iubenda-alternative', title: 'Iubenda-Alternative', description: 'Vergleich vs. Iubenda.' },
    ],
  },
  {
    key: 'seo',
    title: 'SEO-Nischen (Keyword)',
    Icon: Search,
    entries: [
      { path: '/wordpress-dsgvo', title: 'WordPress DSGVO', description: 'WordPress-DSGVO-Keyword-Landing.' },
      { path: '/chatgpt-dsgvo', title: 'ChatGPT DSGVO', description: 'ChatGPT-DSGVO-Keyword-Landing.' },
      { path: '/shopify-dsgvo', title: 'Shopify DSGVO', description: 'Shopify-DSGVO-Keyword-Landing.' },
    ],
  },
];

const TOTAL_PAGES = GROUPS.reduce((sum, g) => sum + g.entries.length, 0);
const TOTAL_ROUTES = GROUPS.reduce(
  (sum, g) => sum + g.entries.reduce((s, e) => s + 1 + (e.aliases?.length ?? 0), 0),
  0,
);

export function LandingPagesOverview() {
  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <LandingNavbar />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-24 pb-20">
        {/* Hero */}
        <header className="max-w-3xl">
          <span className="inline-flex items-center gap-2 rounded-chip border border-petrol-700/20 bg-petrol-700/5 px-3 py-1 text-xs font-medium text-petrol-700">
            Interne Übersicht
          </span>
          <h1 className="mt-4 font-display text-3xl sm:text-4xl font-bold tracking-tight text-slate-900">
            Landingpages-Übersicht
          </h1>
          <p className="mt-3 text-slate-600 leading-relaxed">
            Alle öffentlichen Landing-/Marketing-Seiten auf einen Blick — gruppiert
            nach Kategorie und direkt anklickbar. Als Inhaltsverzeichnis für
            Redaktion, SEO und QA gedacht.
          </p>

          <div className="mt-6 flex flex-wrap gap-3">
            <div className="rounded-card border border-slate-200 bg-white px-4 py-3">
              <div className="font-mono text-2xl font-bold text-slate-900">{TOTAL_PAGES}</div>
              <div className="text-xs text-slate-500">Landing-Seiten</div>
            </div>
            <div className="rounded-card border border-slate-200 bg-white px-4 py-3">
              <div className="font-mono text-2xl font-bold text-slate-900">{TOTAL_ROUTES}</div>
              <div className="text-xs text-slate-500">URL-Routen (inkl. Aliase)</div>
            </div>
            <div className="rounded-card border border-slate-200 bg-white px-4 py-3">
              <div className="font-mono text-2xl font-bold text-slate-900">{GROUPS.length}</div>
              <div className="text-xs text-slate-500">Kategorien</div>
            </div>
          </div>
        </header>

        {/* Gruppen */}
        <div className="mt-12 space-y-12">
          {GROUPS.map((group) => {
            const GroupIcon = group.Icon;
            return (
              <section key={group.key}>
                <div className="flex items-center gap-3 mb-4">
                  <span className="inline-flex h-9 w-9 items-center justify-center rounded-chip bg-petrol-700/10 text-petrol-700">
                    <GroupIcon size={18} />
                  </span>
                  <h2 className="font-display text-lg font-bold text-slate-900">
                    {group.title}
                  </h2>
                  <span className="font-mono text-xs text-slate-400">
                    {group.entries.length}
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {group.entries.map((entry) => (
                    <Link
                      key={entry.path}
                      to={entry.path}
                      className="group flex flex-col rounded-card border border-slate-200 bg-white p-4 transition-all hover:border-petrol-700/40 hover:shadow-sm"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <span className="font-display font-semibold text-slate-900 group-hover:text-petrol-700">
                          {entry.title}
                        </span>
                        <ArrowUpRight
                          size={16}
                          className="mt-0.5 shrink-0 text-slate-300 transition-colors group-hover:text-petrol-700"
                        />
                      </div>
                      <p className="mt-1 text-sm text-slate-600 leading-snug">
                        {entry.description}
                      </p>
                      <div className="mt-3 flex flex-wrap items-center gap-1.5">
                        <code className="rounded-chip bg-slate-100 px-2 py-0.5 font-mono text-xs text-slate-700">
                          {entry.path}
                        </code>
                        {entry.aliases?.map((alias) => (
                          <code
                            key={alias}
                            className="rounded-chip bg-slate-50 px-2 py-0.5 font-mono text-xs text-slate-400"
                          >
                            {alias}
                          </code>
                        ))}
                        {entry.badge && (
                          <span className="rounded-chip bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700">
                            {entry.badge}
                          </span>
                        )}
                      </div>
                    </Link>
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      </main>
    </div>
  );
}

export default LandingPagesOverview;
