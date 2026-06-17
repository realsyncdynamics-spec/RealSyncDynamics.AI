// AppSidebar.tsx — Linke vertikale Navigation des Browser-OS-Shells
import React, { useState } from 'react';
import { NavLink } from 'react-router-dom';
import {
  Home, Globe, ShieldCheck, Cpu, FileCheck2, Activity,
  Zap, FolderOpen, Users, Settings, ChevronLeft, ChevronRight,
  AlertTriangle, ClipboardCheck, FileText, BarChart3, Building2,
  MoreHorizontal,
} from 'lucide-react';

interface NavItem {
  id: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  route: string;
  exact?: boolean;
}

const PRIMARY: NavItem[] = [
  { id: 'dashboard',   label: 'Dashboard',   icon: Home,        route: '/app',            exact: true },
  { id: 'websites',    label: 'Websites',    icon: Globe,       route: '/app/websites' },
  { id: 'gdpr',        label: 'DSGVO',       icon: ShieldCheck, route: '/app/gdpr' },
  { id: 'ai-act',      label: 'KI-Systeme',  icon: Cpu,         route: '/app/ai-act' },
  { id: 'evidence',    label: 'Evidence',    icon: FileCheck2,  route: '/app/evidence' },
  { id: 'monitoring',  label: 'Monitoring',  icon: Activity,    route: '/app/monitoring' },
  { id: 'automations', label: 'Automations', icon: Zap,         route: '/app/automations' },
  { id: 'office',      label: 'Office',      icon: FolderOpen,  route: '/app/office' },
];

const SECONDARY: NavItem[] = [
  { id: 'risks',     label: 'Risiken',    icon: AlertTriangle,  route: '/app/risks' },
  { id: 'audit',     label: 'Audit',      icon: ClipboardCheck, route: '/app/audit' },
  { id: 'documents', label: 'Dokumente',  icon: FileText,       route: '/app/documents' },
  { id: 'reports',   label: 'Reports',    icon: BarChart3,      route: '/app/reports' },
  { id: 'vendors',   label: 'Vendors',    icon: Building2,      route: '/app/vendors' },
];

const BOTTOM: NavItem[] = [
  { id: 'team',     label: 'Team',          icon: Users,    route: '/app/team' },
  { id: 'settings', label: 'Einstellungen', icon: Settings, route: '/app/settings' },
];

function SidebarItem({ item, collapsed }: { item: NavItem; collapsed: boolean }) {
  const Icon = item.icon;
  return (
    <NavLink
      to={item.route}
      end={item.exact}
      className={({ isActive }) =>
        `flex items-center gap-3 px-3 py-2 text-xs font-mono transition-colors ${
          isActive
            ? 'bg-obsidian-700 text-teal-400 border-l-2 border-teal-400'
            : 'text-titanium-400 hover:text-titanium-100 hover:bg-obsidian-800 border-l-2 border-transparent'
        } ${collapsed ? 'justify-center' : ''}`
      }
      title={collapsed ? item.label : undefined}
    >
      <Icon className="h-4 w-4 shrink-0" />
      {!collapsed && <span className="truncate">{item.label}</span>}
    </NavLink>
  );
}

interface AppSidebarProps {
  collapsed: boolean;
  onToggleCollapse: () => void;
}

export function AppSidebar({ collapsed, onToggleCollapse }: AppSidebarProps) {
  const [moreExpanded, setMoreExpanded] = useState(false);

  return (
    <aside
      className={`${collapsed ? 'w-12' : 'w-52'} shrink-0 hidden lg:flex flex-col bg-obsidian-900 border-r border-titanium-900 overflow-hidden transition-all duration-150`}
    >
      {/* Primary nav */}
      <nav className="flex-1 py-2 overflow-y-auto space-y-0.5">
        {PRIMARY.map((item) => (
          <SidebarItem key={item.id} item={item} collapsed={collapsed} />
        ))}

        {/* Secondary nav */}
        <div className="border-t border-titanium-900 pt-2 mt-2">
          {!collapsed && (
            <button
              onClick={() => setMoreExpanded((v) => !v)}
              className="flex items-center gap-2 px-3 py-1.5 w-full text-[10px] font-mono text-titanium-600 hover:text-titanium-400 transition-colors"
            >
              <MoreHorizontal className="h-3.5 w-3.5" />
              {moreExpanded ? 'Weniger' : 'Mehr'}
            </button>
          )}
          {(moreExpanded || collapsed) && (
            <div className="space-y-0.5 mt-0.5">
              {SECONDARY.map((item) => (
                <SidebarItem key={item.id} item={item} collapsed={collapsed} />
              ))}
            </div>
          )}
        </div>
      </nav>

      {/* Bottom nav */}
      <div className="border-t border-titanium-900 py-2 space-y-0.5">
        {BOTTOM.map((item) => (
          <SidebarItem key={item.id} item={item} collapsed={collapsed} />
        ))}
        <button
          onClick={onToggleCollapse}
          className={`flex items-center gap-3 px-3 py-2 w-full text-xs font-mono text-titanium-600 hover:text-titanium-300 hover:bg-obsidian-800 transition-colors ${collapsed ? 'justify-center' : ''}`}
          title={collapsed ? 'Sidebar ausklappen' : 'Sidebar einklappen'}
        >
          {collapsed ? (
            <ChevronRight className="h-4 w-4 shrink-0" />
          ) : (
            <>
              <ChevronLeft className="h-4 w-4 shrink-0" />
              <span>Einklappen</span>
            </>
          )}
        </button>
      </div>
    </aside>
  );
}
