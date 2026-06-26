// WorkspaceShell — der persistente App-Shell des Governance OS (P0).
//
// Ziel (docs/strategy/governance-os-product-architecture.md): EIN Ort statt
// 222 Einzelseiten. Sidebar + Topbar bleiben stehen, nur der Inhalt (children)
// wechselt. Bestehende Auth-Views koennen schrittweise hier eingehaengt werden;
// in P0 rahmt der Shell das neue Status-Home (/app) und verlinkt in die
// vorhandenen Governance-Routen.
import React, { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  Home, Globe, Bot, AlertTriangle, ClipboardCheck, FileCheck2,
  Activity, Users, Settings, Menu, X, Search, Sparkles, ChevronDown, Building2,
} from 'lucide-react';
import { useTenant } from '../../core/access/TenantProvider';
import { getActivePlanForTenant } from '../../lib/billing/planAccess';

interface NavItem { to: string; label: string; icon: typeof Home }

// KMU-Tarife sehen die „Mein Unternehmen"-Sicht; Agency/Scale/Enterprise nicht.
const KMU_PLANS = new Set(['free', 'starter', 'growth']);

// Nav-Gruppen (Governance-OS-Finalisierung): START / GOVERNANCE / COMPLIANCE /
// ADMIN. Bewusst KEINE technischen Begriffe (Runtime, Agent Registry, Event
// Stream, Evidence Chain) in der Hauptnav — die bleiben interne /governance/*-
// Routen. „Unternehmen" ist tarif-gated (nur Free/Starter/Growth).
const START_BASE: NavItem[] = [
  { to: '/app',         label: 'Übersicht',   icon: Home },
];
const START_COMPANY: NavItem = { to: '/app/company', label: 'Unternehmen', icon: Building2 };

const GOVERNANCE: NavItem[] = [
  { to: '/app/websites',   label: 'Websites',   icon: Globe },
  { to: '/app/ai-systems', label: 'AI Registry',   icon: Bot },
  { to: '/app/risks',      label: 'Risk Register', icon: AlertTriangle },
];
const COMPLIANCE: NavItem[] = [
  { to: '/app/compliance', label: 'Compliance', icon: ClipboardCheck },
  { to: '/app/evidence',   label: 'Evidence',   icon: FileCheck2 },
  { to: '/app/monitoring', label: 'Monitoring', icon: Activity },
];
const ADMIN: NavItem[] = [
  { to: '/app/team',     label: 'Team',          icon: Users },
  { to: '/app/settings', label: 'Einstellungen', icon: Settings },
];

export function WorkspaceShell({ children, title }: { children: React.ReactNode; title?: string }) {
  const { pathname } = useLocation();
  const { tenants, activeTenantId, setActiveTenant } = useTenant();
  const [open, setOpen] = useState(false);
  const activeTenant = tenants.find((t) => t.tenantId === activeTenantId) ?? null;

  // Tarif-gesteuerte KMU-Sicht: nur Free/Starter/Growth sehen „Mein Unternehmen".
  // Liest den autoritativen plan_key (subscriptions) — kein DB-Schema-Eingriff.
  const [isKmu, setIsKmu] = useState(false);
  useEffect(() => {
    let active = true;
    if (!activeTenantId) { setIsKmu(false); return; }
    getActivePlanForTenant(activeTenantId)
      .then((plan) => { if (active) setIsKmu(KMU_PLANS.has(plan ?? 'free')); })
      .catch(() => { if (active) setIsKmu(false); });
    return () => { active = false; };
  }, [activeTenantId]);

  const isActive = (to: string) => pathname === to || pathname.startsWith(to + '/');

  const NavList = ({ items }: { items: NavItem[] }) => (
    <ul className="space-y-0.5">
      {items.map(({ to, label, icon: Icon }) => (
        <li key={to}>
          <Link
            to={to}
            onClick={() => setOpen(false)}
            className={`flex items-center gap-2.5 px-3 py-2 text-sm font-medium rounded-none transition-colors ${
              isActive(to)
                ? 'bg-titanium-900 text-titanium-50'
                : 'text-titanium-400 hover:bg-obsidian-800 hover:text-titanium-100'
            }`}
          >
            <Icon className={`h-4 w-4 ${isActive(to) ? 'text-cyan-300' : ''}`} /> {label}
          </Link>
        </li>
      ))}
    </ul>
  );

  const NavGroup = ({ label, items }: { label: string; items: NavItem[] }) => (
    <div>
      <div className="px-3 mb-1.5 font-mono text-[10px] uppercase tracking-wider text-titanium-600">{label}</div>
      <NavList items={items} />
    </div>
  );

  const Sidebar = (
    <aside className="w-60 shrink-0 bg-obsidian-900 border-r border-titanium-900 flex flex-col">
      <Link to="/app" className="h-14 flex items-center gap-2 px-4 border-b border-titanium-900">
        <div className="w-7 h-7 bg-gradient-to-br from-cyan-400 to-security-600 flex items-center justify-center">
          <Sparkles className="h-4 w-4 text-obsidian-950" />
        </div>
        <span className="font-display font-bold text-sm text-titanium-50 tracking-tight">Governance OS</span>
      </Link>
      <nav className="flex-1 overflow-y-auto p-3 space-y-5">
        <NavGroup label="Start" items={isKmu ? [...START_BASE, START_COMPANY] : START_BASE} />
        <NavGroup label="Governance" items={GOVERNANCE} />
        <NavGroup label="Compliance" items={COMPLIANCE} />
        <NavGroup label="Admin" items={ADMIN} />
      </nav>
    </aside>
  );

  return (
    <div className="h-screen flex bg-obsidian-950 text-titanium-100 overflow-hidden">
      {/* Desktop-Sidebar */}
      <div className="hidden lg:flex">{Sidebar}</div>

      {/* Mobile-Drawer */}
      {open && (
        <div className="lg:hidden fixed inset-0 z-50 flex">
          <div className="absolute inset-0 bg-obsidian-950/70" onClick={() => setOpen(false)} />
          <div className="relative z-10">{Sidebar}</div>
        </div>
      )}

      <div className="flex-1 flex flex-col min-w-0">
        {/* Topbar — bleibt persistent */}
        <header className="h-14 shrink-0 border-b border-titanium-900 bg-obsidian-900 flex items-center justify-between px-3 sm:px-4 gap-3">
          <div className="flex items-center gap-2 min-w-0">
            <button onClick={() => setOpen(!open)} className="lg:hidden text-titanium-300 hover:text-titanium-100" aria-label="Menü">
              {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
            {title && <h1 className="font-display font-bold text-titanium-50 text-sm sm:text-base truncate">{title}</h1>}
          </div>

          <div className="flex items-center gap-2">
            {/* Command/Suche — P2 verdrahtet die ⌘K-Palette; hier Einstieg */}
            <Link to="/app" className="hidden sm:flex items-center gap-2 px-3 py-1.5 bg-obsidian-950 border border-titanium-800 text-titanium-500 text-xs rounded-none hover:border-titanium-600">
              <Search className="h-3.5 w-3.5" /> Suchen… <span className="font-mono text-[10px] text-titanium-700">⌘K</span>
            </Link>
            {tenants.length > 1 && (
              <div className="relative">
                <select
                  value={activeTenantId ?? ''}
                  onChange={(e) => setActiveTenant(e.target.value)}
                  className="appearance-none bg-obsidian-950 border border-titanium-800 text-titanium-200 text-xs rounded-none pl-2.5 pr-7 py-1.5 outline-none cursor-pointer max-w-[160px]"
                >
                  {tenants.map((t) => <option key={t.tenantId} value={t.tenantId}>{t.name}</option>)}
                </select>
                <ChevronDown className="h-3.5 w-3.5 text-titanium-500 absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>
            )}
            {activeTenant && tenants.length <= 1 && (
              <span className="hidden sm:inline text-xs text-titanium-400 font-medium max-w-[140px] truncate">{activeTenant.name}</span>
            )}
            <Link to="/assistant" title="Assistent" className="p-1.5 text-titanium-400 hover:text-titanium-100 hover:bg-obsidian-800 rounded-none">
              <Sparkles className="h-4 w-4" />
            </Link>
          </div>
        </header>

        {/* Panel */}
        <main className="flex-1 overflow-y-auto">{children}</main>
      </div>
    </div>
  );
}
