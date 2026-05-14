import React from 'react';
import { Link, NavLink } from 'react-router-dom';
import { ArrowLeft, Boxes, LayoutDashboard, Package, Truck, Building2, MapPin, QrCode, ScrollText } from 'lucide-react';
import { useTenant } from '../../core/access/TenantProvider';
import { AuthGate } from '../kodee/connections/AuthGate';

interface NavItem {
  to: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}

const NAV: NavItem[] = [
  { to: '/operations',                  label: 'Übersicht',     icon: LayoutDashboard },
  { to: '/operations/items',            label: 'Artikel',       icon: Package },
  { to: '/operations/stock-movements',  label: 'Bewegungen',    icon: Truck },
  { to: '/operations/locations',        label: 'Lagerorte',     icon: MapPin },
  { to: '/operations/suppliers',        label: 'Lieferanten',   icon: Building2 },
  { to: '/operations/barcodes',         label: 'Barcodes',      icon: QrCode },
  { to: '/operations/reports',          label: 'Reports',       icon: ScrollText },
];

/**
 * Auth-gated chrome for the Operations Runtime module. Sub-views render
 * inside this wrapper. NOT linked from the public navbar — tenant members
 * navigate here from the authenticated dashboard or directly.
 */
export function OperationsShell({
  title,
  subtitle,
  children,
  actions,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  actions?: React.ReactNode;
}) {
  return (
    <AuthGate>
      {() => (
        <ShellInner title={title} subtitle={subtitle} actions={actions}>
          {children}
        </ShellInner>
      )}
    </AuthGate>
  );
}

function ShellInner({
  title,
  subtitle,
  children,
  actions,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  actions?: React.ReactNode;
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
            <div className="w-8 h-8 rounded-none bg-gradient-to-br from-cyan-500 to-blue-700 flex items-center justify-center shadow-sm">
              <Boxes className="h-4 w-4 text-white" />
            </div>
            <div className="leading-tight">
              <div className="font-display font-bold text-sm tracking-tight text-titanium-50">{title}</div>
              {subtitle && <div className="text-[11px] text-titanium-400 font-medium">{subtitle}</div>}
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
                end={to === '/operations'}
                className={({ isActive }) =>
                  `inline-flex items-center gap-1.5 px-3 py-2.5 border-b-2 whitespace-nowrap transition-colors ${
                    isActive
                      ? 'border-cyan-400 text-titanium-50'
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

      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-6">{children}</main>
    </div>
  );
}

export function useOperationsTenant() {
  return useTenant();
}
