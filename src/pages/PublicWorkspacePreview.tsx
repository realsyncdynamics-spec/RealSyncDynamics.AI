/**
 * PublicWorkspacePreview
 *
 * Öffentliche, Read-only Vorschau der Governance-OS-Oberfläche.
 * Zeigt die echte WorkspaceShell (Sidebar + Topbar) ohne AuthGate.
 * Alle Aktionen führen entweder zu /app, /audit oder Checkout.
 *
 * Kein echter Tenant-Request, keine Supabase-Abfrage.
 */
import { useNavigate } from 'react-router-dom';
import {
  Globe,
  Bot,
  ShieldAlert,
  ClipboardCheck,
  FolderLock,
  Activity,
  Users,
  Settings,
  ArrowRight,
  Lock,
} from 'lucide-react';

// ─── Tile-Daten ────────────────────────────────────────────────────────────
const TILES = [
  {
    id: 'websites',
    label: 'Websites',
    icon: Globe,
    badge: '3 aktiv',
    desc: 'Cookie-Consent, Scan-Status, DSGVO-Konformität',
    href: '/app/websites',
  },
  {
    id: 'ai-systems',
    label: 'KI-Systeme',
    icon: Bot,
    badge: '2 registriert',
    desc: 'EU AI Act Klassifikation, Risikoklassen, Dokumentation',
    href: '/app/ai-systems',
  },
  {
    id: 'risks',
    label: 'Risiken',
    icon: ShieldAlert,
    badge: '1 offen',
    desc: 'Incidents, Schwachstellen, Behebungspläne',
    href: '/app/risks',
  },
  {
    id: 'compliance',
    label: 'Compliance',
    icon: ClipboardCheck,
    badge: '94 %',
    desc: 'DSGVO, EU AI Act, BAIT/MaRisk Scorecard',
    href: '/app/compliance',
  },
  {
    id: 'evidence',
    label: 'Evidence',
    icon: FolderLock,
    badge: '12 Belege',
    desc: 'Audit-Trail, Nachweise, Export-Pakete',
    href: '/app/evidence',
  },
  {
    id: 'monitoring',
    label: 'Monitoring',
    icon: Activity,
    badge: 'Live',
    desc: 'Laufzeit-Events, Anomalieerkennung, Alerts',
    href: '/app/monitoring',
  },
  {
    id: 'team',
    label: 'Team',
    icon: Users,
    badge: '1 Mitglied',
    desc: 'Rollen, Einladungen, MFA-Status',
    href: '/app/team',
  },
  {
    id: 'settings',
    label: 'Einstellungen',
    icon: Settings,
    badge: '',
    desc: 'KI-Residenz, API-Keys, Integrationen',
    href: '/app/settings',
  },
] as const;

// ─── Sidebar-Items (spiegeln echte WorkspaceShell wider) ───────────────────
const NAV_ITEMS = [
  { label: 'Websites',      icon: Globe,          path: '/app/websites' },
  { label: 'KI-Systeme',    icon: Bot,            path: '/app/ai-systems' },
  { label: 'Risiken',       icon: ShieldAlert,    path: '/app/risks' },
  { label: 'Compliance',    icon: ClipboardCheck, path: '/app/compliance' },
  { label: 'Evidence',      icon: FolderLock,     path: '/app/evidence' },
  { label: 'Monitoring',    icon: Activity,       path: '/app/monitoring' },
  { label: 'Team',          icon: Users,          path: '/app/team' },
  { label: 'Einstellungen', icon: Settings,       path: '/app/settings' },
];

// ─── Komponente ────────────────────────────────────────────────────────────
export function PublicWorkspacePreview() {
  const navigate = useNavigate();

  const handleLockedAction = (path: string) => {
    navigate('/app');
  };

  return (
    <div className="min-h-screen flex flex-col bg-obsidian-950 text-titanium-100 font-sans">
      {/* ── Topbar ──────────────────────────────────────────────────── */}
      <header className="h-14 border-b border-obsidian-800 flex items-center justify-between px-4 shrink-0 bg-obsidian-950/90 backdrop-blur-sm sticky top-0 z-30">
        {/* Logo */}
        <a href="/" className="flex items-center gap-2 select-none">
          <svg width="28" height="28" viewBox="0 0 28 28" fill="none" aria-label="RealSyncDynamics.AI" className="shrink-0">
            <rect width="28" height="28" rx="6" fill="#0ea5e9" />
            <path d="M7 14h14M14 7v14" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" />
          </svg>
          <span className="font-semibold text-sm tracking-tight text-titanium-50">
            RealSync<span className="text-sky-400">Dynamics</span>
          </span>
        </a>

        {/* Workspace-Name + Preview-Badge */}
        <div className="hidden sm:flex items-center gap-2 text-xs text-titanium-400">
          <span className="px-2 py-0.5 rounded-full bg-sky-500/10 text-sky-400 border border-sky-500/20 font-medium">
            Read-only Vorschau
          </span>
          <span>Demo-Workspace</span>
        </div>

        {/* CTAs */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => navigate('/audit?source=public-workspace')}
            className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-sky-500/30 text-sky-400 hover:bg-sky-500/10 transition-colors text-xs font-medium"
          >
            Audit starten
          </button>
          <button
            onClick={() => navigate('/app')}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-sky-500 hover:bg-sky-400 text-white transition-colors text-xs font-semibold"
          >
            Dashboard öffnen <ArrowRight size={12} />
          </button>
        </div>
      </header>

      {/* ── Layout: Sidebar + Main ───────────────────────────────────── */}
      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <aside className="hidden md:flex flex-col w-56 shrink-0 border-r border-obsidian-800 bg-obsidian-950 pt-4 pb-6 overflow-y-auto">
          <nav className="flex-1 px-2 space-y-0.5">
            {NAV_ITEMS.map(({ label, icon: Icon, path }) => (
              <button
                key={label}
                onClick={() => handleLockedAction(path)}
                className="w-full flex items-center gap-2.5 px-3 py-2 rounded-md text-sm text-titanium-300 hover:bg-obsidian-800 hover:text-titanium-50 transition-colors group"
              >
                <Icon size={15} className="shrink-0 text-titanium-500 group-hover:text-sky-400 transition-colors" />
                <span className="truncate">{label}</span>
                <Lock size={10} className="ml-auto text-titanium-600 shrink-0" />
              </button>
            ))}
          </nav>

          {/* Upgrade CTA at bottom */}
          <div className="mt-auto px-3">
            <button
              onClick={() => navigate('/pricing')}
              className="w-full rounded-lg bg-sky-500/10 border border-sky-500/20 px-3 py-3 text-left hover:bg-sky-500/15 transition-colors"
            >
              <p className="text-xs font-semibold text-sky-400 mb-0.5">Zugang freischalten</p>
              <p className="text-xs text-titanium-500 leading-snug">Alle Module, echter Tenant, DSGVO-Konform.</p>
            </button>
          </div>
        </aside>

        {/* Main content */}
        <main className="flex-1 overflow-y-auto">
          {/* Page header */}
          <div className="px-6 pt-8 pb-4">
            <p className="text-xs text-titanium-500 mb-1 uppercase tracking-widest font-medium">Workspace</p>
            <h1 className="text-xl font-semibold text-titanium-50">Governance OS</h1>
            <p className="text-sm text-titanium-400 mt-1 max-w-xl">
              Alle Compliance-Module auf einen Blick — DSGVO, EU AI Act, Evidence, Monitoring.
              Dies ist eine öffentliche Vorschau. Für echte Daten{' '}
              <button onClick={() => navigate('/app')} className="text-sky-400 hover:underline">
                Dashboard öffnen
              </button>
              .
            </p>
          </div>

          {/* Tiles grid */}
          <div className="px-6 pb-12 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {TILES.map(({ id, label, icon: Icon, badge, desc, href }) => (
              <button
                key={id}
                onClick={() => handleLockedAction(href)}
                className="group text-left rounded-xl border border-obsidian-800 bg-obsidian-900 p-5 hover:border-sky-500/30 hover:bg-obsidian-800 transition-all duration-150 focus-visible:outline focus-visible:outline-2 focus-visible:outline-sky-500"
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="p-2 rounded-lg bg-obsidian-800 group-hover:bg-sky-500/10 transition-colors">
                    <Icon size={18} className="text-titanium-400 group-hover:text-sky-400 transition-colors" />
                  </div>
                  {badge && (
                    <span className="text-xs px-2 py-0.5 rounded-full bg-obsidian-800 text-titanium-400 border border-obsidian-700">
                      {badge}
                    </span>
                  )}
                </div>
                <h2 className="text-sm font-semibold text-titanium-100 mb-1">{label}</h2>
                <p className="text-xs text-titanium-500 leading-relaxed">{desc}</p>
                <div className="mt-3 flex items-center gap-1 text-xs text-titanium-600 group-hover:text-sky-400 transition-colors">
                  <Lock size={10} />
                  <span>Login erforderlich</span>
                </div>
              </button>
            ))}
          </div>

          {/* Bottom CTA banner */}
          <div className="mx-6 mb-12 rounded-xl border border-sky-500/20 bg-sky-500/5 px-6 py-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <h3 className="text-sm font-semibold text-titanium-50 mb-1">Governance OS jetzt freischalten</h3>
              <p className="text-xs text-titanium-400 max-w-md">
                DSGVO, EU AI Act & Evidence in einem Workspace — für SaaS-Anbieter, Agenturen und Unternehmen ab 30 €/Monat.
              </p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={() => navigate('/audit?source=public-workspace')}
                className="px-4 py-2 rounded-lg border border-sky-500/30 text-sky-400 hover:bg-sky-500/10 transition-colors text-sm font-medium"
              >
                Audit starten
              </button>
              <button
                onClick={() => navigate('/app')}
                className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-sky-500 hover:bg-sky-400 text-white transition-colors text-sm font-semibold"
              >
                Dashboard öffnen <ArrowRight size={14} />
              </button>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
