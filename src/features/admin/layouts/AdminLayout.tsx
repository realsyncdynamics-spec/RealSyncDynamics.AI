import { ReactNode } from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  Settings, Users, CreditCard, Key, ScrollText, Home, ChevronRight, LogOut
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

  return (
    <div className="min-h-screen bg-obsidian text-titanium flex">
      {/* Sidebar */}
      <aside className="w-64 border-r border-titanium/20 bg-obsidian-900 flex flex-col">
        {/* Header */}
        <div className="p-6 border-b border-titanium/20">
          <h1 className="font-display font-bold text-lg text-titanium-50">Admin</h1>
          <p className="text-xs text-titanium-400 mt-1">Tenant-Verwaltung</p>
        </div>

        {/* Tenant Selector */}
        {tenants.length > 1 && (
          <div className="px-6 py-4 border-b border-titanium/20">
            <label className="block text-xs font-mono text-titanium-400 mb-2">WORKSPACE</label>
            <select
              value={activeTenantId ?? ''}
              onChange={(e) => setActiveTenant(e.target.value)}
              className="w-full bg-obsidian border border-titanium/20 text-titanium-100 text-sm rounded-sm px-3 py-2 outline-none focus:border-security-blue focus:ring-1 focus:ring-security-blue/30"
            >
              {tenants.map(t => (
                <option key={t.tenantId} value={t.tenantId}>{t.name}</option>
              ))}
            </select>
          </div>
        )}

        {/* Navigation */}
        <nav className="flex-1 px-3 py-6 space-y-1">
          {NAV_ITEMS.map(item => {
            const Icon = item.icon;
            const active = isActive(item.href);
            return (
              <Link
                key={item.id}
                to={item.href}
                className={`flex items-center gap-3 px-3 py-2 rounded-sm text-sm font-medium transition-colors ${
                  active
                    ? 'bg-security-blue/10 text-security-blue border-l-2 border-security-blue'
                    : 'text-titanium-400 hover:text-titanium-200 hover:bg-obsidian-800'
                }`}
              >
                <Icon className="h-4 w-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>

        {/* Footer */}
        <div className="px-3 py-4 border-t border-titanium/20">
          <Link
            to="/app"
            className="flex items-center gap-2 px-3 py-2 rounded-sm text-sm text-titanium-400 hover:text-titanium-200 hover:bg-obsidian-800 transition-colors"
          >
            <LogOut className="h-4 w-4" />
            Zurück zur App
          </Link>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-auto">
        <div className="h-14 border-b border-titanium/20 bg-obsidian-900 px-8 flex items-center justify-between sticky top-0 z-10">
          <h2 className="font-display font-bold text-titanium-50">
            {activeTenant?.name || 'Workspace'}
          </h2>
          <p className="text-xs text-titanium-500 font-mono">
            {activeTenant?.role && `${activeTenant.role.toUpperCase()}`}
          </p>
        </div>
        <div className="p-8">
          {children}
        </div>
      </main>
    </div>
  );
}
