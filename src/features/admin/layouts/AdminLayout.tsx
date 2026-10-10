import { ReactNode } from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  Settings, Users, CreditCard, Key, ScrollText, Home, LogOut
} from 'lucide-react';
import { useTenant } from '../../../core/access/TenantProvider';

const NAV_ITEMS = [
  { href: '/app/admin', icon: Home, label: 'Dashboard', id: 'dashboard' },
  { href: '/app/admin/members', icon: Users, label: 'Team', id: 'members' },
  { href: '/app/admin/settings', icon: Settings, label: 'Einstellungen', id: 'settings' },
  { href: '/app/admin/billing', icon: CreditCard, label: 'Abrechnung', id: 'billing' },
  { href: '/app/admin/api-keys', icon: Key, label: 'API-Schlüssel', id: 'api-keys' },
  { href: '/app/admin/audit', icon: ScrollText, label: 'Prüfprotokoll', id: 'audit' },
];

interface AdminLayoutProps {
  children: ReactNode;
}

export function AdminLayout({ children }: AdminLayoutProps) {
  const location = useLocation();
  const { tenants, activeTenantId, setActiveTenant } = useTenant();
  const activeTenant = tenants.find(t => t.tenantId === activeTenantId);

  const isActive = (href: string) => {
    if (href === '/app/admin') return location.pathname === '/app/admin';
    return location.pathname.startsWith(href);
  };

  // Rendert innerhalb der GovernanceBrowserShell (App.tsx) — deshalb keine
  // eigene Seitenleiste mehr: ein Rahmen, Admin-Navigation als Tab-Leiste.
  // Zugriffsprüfungen liegen unverändert an der Route (AppGate) bzw. in den Seiten.
  return (
    <div className="text-[var(--brand-paper)]" data-testid="admin-layout">
      <header className="border-b border-[var(--brand-line-dark)] bg-[var(--brand-bg-2)]">
        <div className="px-4 sm:px-8 pt-5 pb-3 flex flex-wrap items-end justify-between gap-3">
          <div className="min-w-0">
            <h1 className="font-[family-name:var(--brand-serif)] font-semibold text-2xl text-[var(--brand-paper)]">Admin</h1>
            <p className="text-xs text-[var(--brand-titan)] mt-1">
              Tenant-Verwaltung · <span className="font-mono">{activeTenant?.name || 'Workspace'}</span>
              {activeTenant?.role && <span className="font-mono"> · {activeTenant.role.toUpperCase()}</span>}
            </p>
          </div>
          {tenants.length > 1 && (
            <label className="flex items-center gap-2 text-xs font-mono text-[var(--brand-titan)]">
              WORKSPACE
              <select
                value={activeTenantId ?? ''}
                onChange={(e) => setActiveTenant(e.target.value)}
                className="bg-[var(--brand-bg-1)] border border-[var(--brand-line-dark-strong)] text-[var(--brand-paper)] text-sm rounded-[var(--brand-radius-md)] px-3 py-1.5 outline-none focus:border-[var(--brand-champ)]"
              >
                {tenants.map(t => (
                  <option key={t.tenantId} value={t.tenantId}>{t.name}</option>
                ))}
              </select>
            </label>
          )}
        </div>
        <nav aria-label="Admin" className="px-2 sm:px-6 flex gap-1 overflow-x-auto">
          {NAV_ITEMS.map(item => {
            const Icon = item.icon;
            const active = isActive(item.href);
            return (
              <Link
                key={item.id}
                to={item.href}
                aria-current={active ? 'page' : undefined}
                className={`flex shrink-0 items-center gap-2 px-3 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                  active
                    ? 'border-[var(--brand-champ)] text-[var(--brand-champ)]'
                    : 'border-transparent text-[var(--brand-titan)] hover:text-[var(--brand-paper)]'
                }`}
              >
                <Icon className="h-4 w-4" />
                {item.label}
              </Link>
            );
          })}
          <Link
            to="/app"
            className="ml-auto flex shrink-0 items-center gap-2 px-3 py-2.5 text-sm text-[var(--brand-titan)] hover:text-[var(--brand-paper)]"
          >
            <LogOut className="h-4 w-4" />
            Zurück zur App
          </Link>
        </nav>
      </header>
      <div className="p-4 sm:p-8">
        {children}
      </div>
    </div>
  );
}
