import React from 'react';
import { Link, NavLink } from 'react-router-dom';
import {
  ArrowLeft, LayoutDashboard, FolderOpen, FileStack,
  Package, Bell, Receipt, Stamp,
} from 'lucide-react';
import { useTenant } from '../../core/access/TenantProvider';
import { AuthGate } from '../kodee/connections/AuthGate';
import { TaxDisclaimer } from './TaxDisclaimer';

interface NavItem {
  to: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}

const NAV: NavItem[] = [
  { to: '/finance',               label: 'Übersicht',       icon: LayoutDashboard },
  { to: '/finance/tax-evidence',  label: 'Jahresordner',    icon: FolderOpen },
  { to: '/finance/documents',     label: 'Dokumente',       icon: FileStack },
  { to: '/finance/exports',       label: 'Exporte',         icon: Package },
  { to: '/finance/reminders',     label: 'Erinnerungen',    icon: Bell },
  { to: '/finance/reviews',       label: 'Reviews',         icon: Stamp },
];

/**
 * Auth-gated chrome for the Tax Evidence Runtime. Wraps every
 * /finance/* sub-view. Disclaimer renders inside every page; this
 * shell renders a compact version in the header so it is always
 * visible regardless of scroll position.
 */
export function FinanceShell({
  title,
  subtitle,
  children,
  actions,
  hideDisclaimer = false,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  actions?: React.ReactNode;
  hideDisclaimer?: boolean;
}) {
  return (
    <AuthGate>
      {() => (
        <ShellInner title={title} subtitle={subtitle} actions={actions} hideDisclaimer={hideDisclaimer}>
          {children}
        </ShellInner>
      )}
    </AuthGate>
  );
}

function ShellInner({
  title, subtitle, children, actions, hideDisclaimer,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  actions?: React.ReactNode;
  hideDisclaimer: boolean;
}) {
  const { tenants, activeTenantId, setActiveTenant } = useTenant();

  return (
    <div className="min-h-screen bg-obsidian-950 text-titanium-100">
      <header className="h-14 border-b border-titanium-900 bg-obsidian-900 flex items-center justify-between px-4">
        <div className="flex items-center gap-3">
          <Link to="/dashboard" className="p-1.5 rounded-none hover:bg-obsidian-800 text-titanium-400 hover:text-titanium-200">
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-none bg-gradient-to-br from-emerald-500 to-teal-700 flex items-center justify-center shadow-sm">
              <Receipt className="h-4 w-4 text-white" />
            </div>
            <div className="leading-tight">
              <div className="font-display font-bold text-sm tracking-tight text-titanium-50">{title}</div>
              <div className="text-[11px] text-titanium-400 font-medium">
                {subtitle ?? 'Technische Steuer-Vorbereitung · keine Steuerberatung'}
              </div>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {tenants.length > 1 && (
            <select
              value={activeTenantId ?? ''}
              onChange={(e) => setActiveTenant(e.target.value)}
              className="bg-obsidian-950 border border-titanium-900 text-titanium-200 text-xs rounded-none px-2 py-1.5 outline-none cursor-pointer font-medium hover:bg-obsidian-800 max-w-[200px]"
            >
              {tenants.map((t) => (
                <option key={t.tenantId} value={t.tenantId}>{t.name}</option>
              ))}
            </select>
          )}
          {actions}
        </div>
      </header>

      <nav className="border-b border-titanium-900 bg-obsidian-900 px-4 overflow-x-auto">
        <ul className="flex gap-1 text-xs">
          {NAV.map(({ to, label, icon: Icon }) => (
            <li key={to}>
              <NavLink
                to={to}
                end={to === '/finance'}
                className={({ isActive }) =>
                  `inline-flex items-center gap-1.5 px-3 py-2.5 border-b-2 whitespace-nowrap transition-colors ${
                    isActive
                      ? 'border-emerald-400 text-titanium-50'
                      : 'border-transparent text-titanium-400 hover:text-titanium-200'
                  }`
                }
              >
                <Icon className="h-3.5 w-3.5" />
                {label}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>

      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-6 space-y-6">
        {!hideDisclaimer && <TaxDisclaimer />}
        {children}
      </main>
    </div>
  );
}

export function useFinanceTenant() {
  return useTenant();
}
