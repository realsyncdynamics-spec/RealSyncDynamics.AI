import React from 'react';
import { NavLink } from 'react-router-dom';
import {
  LayoutGrid,
  Globe2,
  AlertTriangle,
  ShieldCheck,
  Vault,
  Activity,
  Bot,
  Cpu,
  FileBarChart,
  Users,
  CreditCard,
  Settings,
} from 'lucide-react';
import { NAV_GROUPS } from '../mock/data';

export const NAV_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  home: LayoutGrid,
  websites: Globe2,
  risks: AlertTriangle,
  compliance: ShieldCheck,
  evidence: Vault,
  monitoring: Activity,
  'ai-usecases': Cpu,
  agents: Bot,
  reports: FileBarChart,
  team: Users,
  billing: CreditCard,
  settings: Settings,
};

interface NavListProps {
  collapsed?: boolean;
  onNavigate?: () => void;
}

export function NavList({ collapsed = false, onNavigate }: NavListProps) {
  return (
    <>
      {NAV_GROUPS.map((group) => (
        <div key={group.label} className="mb-5">
          {!collapsed && (
            <p className="mb-2 px-2 font-mono text-[10px] font-semibold uppercase tracking-[0.2em] text-titanium-600">
              {group.label}
            </p>
          )}
          <ul className="space-y-0.5">
            {group.items.map((item) => {
              const Icon = NAV_ICONS[item.id] ?? LayoutGrid;
              return (
                <li key={item.id}>
                  <NavLink
                    to={item.to}
                    end={item.to === '/os/app'}
                    onClick={onNavigate}
                    className={({ isActive }) =>
                      `flex items-center gap-3 border px-2.5 py-2 text-xs font-medium transition-colors ${
                        isActive
                          ? 'border-security-500/30 bg-security-500/10 text-titanium-50'
                          : 'border-transparent text-titanium-400 hover:border-titanium-800 hover:bg-titanium-800/30 hover:text-titanium-100'
                      } ${collapsed ? 'justify-center' : ''}`
                    }
                    title={collapsed ? item.label : undefined}
                  >
                    <Icon className="h-4 w-4 shrink-0" />
                    {!collapsed && <span>{item.label}</span>}
                  </NavLink>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </>
  );
}
