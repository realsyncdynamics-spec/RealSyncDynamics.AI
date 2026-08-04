import React, { useState } from 'react';
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
  ChevronDown,
  Zap,
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
  const [expandedGroup, setExpandedGroup] = useState<string | null>('Übersicht');

  const toggleGroup = (label: string) => {
    setExpandedGroup(expandedGroup === label ? null : label);
  };

  return (
    <div className="flex flex-col gap-1">
      {NAV_GROUPS.map((group) => {
        const isExpanded = expandedGroup === group.label || collapsed;
        return (
          <div key={group.label} className="mb-3 overflow-hidden">
            {/* Group Header */}
            {!collapsed && (
              <button
                onClick={() => toggleGroup(group.label)}
                className="mb-2 flex w-full items-center justify-between px-2 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-titanium-600 transition-colors hover:text-titanium-400"
              >
                <span className="flex items-center gap-1.5">
                  <div className="h-1.5 w-1.5 rounded-full bg-titanium-600" />
                  {group.label}
                </span>
                <ChevronDown
                  className={`h-3 w-3 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                />
              </button>
            )}

            {/* Nav Items */}
            {isExpanded && (
              <ul className={`space-y-1 transition-all duration-200 ${!collapsed ? 'ml-2 border-l border-titanium-800 pl-3' : ''}`}>
                {group.items.map((item) => {
                  const Icon = NAV_ICONS[item.id] ?? LayoutGrid;
                  const isAgent = item.id === 'agents';

                  return (
                    <li key={item.id}>
                      <NavLink
                        to={item.to}
                        end={item.to === '/os/app'}
                        onClick={onNavigate}
                        className={({ isActive }) =>
                          `group flex items-center gap-2 rounded border px-2.5 py-2 text-xs font-medium transition-all ${
                            isActive
                              ? 'border-security-500/40 bg-security-500/15 text-titanium-50 shadow-sm shadow-security-500/10'
                              : 'border-titanium-800/50 text-titanium-400 hover:border-titanium-700 hover:bg-titanium-800/20 hover:text-titanium-100'
                          } ${collapsed ? 'justify-center px-2' : 'gap-3'}`
                        }
                        title={collapsed ? item.label : undefined}
                      >
                        <div className="relative">
                          <Icon className="h-4 w-4 shrink-0" />
                          {isAgent && (
                            <div className="absolute -bottom-1 -right-1 h-2 w-2 rounded-full bg-security-400 animate-pulse" />
                          )}
                        </div>
                        {!collapsed && (
                          <div className="flex flex-1 items-center justify-between">
                            <span>{item.label}</span>
                            {isAgent && (
                              <span className="text-[9px] font-mono text-security-400">LIVE</span>
                            )}
                          </div>
                        )}
                      </NavLink>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        );
      })}

      {/* Agent Control Panel Quick Access */}
      {!collapsed && (
        <div className="border-t border-titanium-800 pt-4 mt-4">
          <button
            className="flex w-full items-center gap-2 rounded border border-security-500/30 bg-security-500/10 px-2.5 py-2.5 text-xs font-semibold text-security-400 transition-all hover:border-security-500/50 hover:bg-security-500/15"
            title="Chromium Browser für Agentenkontrolle starten"
          >
            <Zap className="h-3.5 w-3.5 shrink-0" />
            <span>Agent Browser</span>
          </button>
          <p className="mt-2 px-2 text-[10px] text-titanium-600">
            Kontrolliere Agenten live über Chromium-Browser
          </p>
        </div>
      )}
    </div>
  );
}
