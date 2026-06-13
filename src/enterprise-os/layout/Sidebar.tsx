import React from 'react';
import { ChevronsLeft, ChevronsRight } from 'lucide-react';
import { Logo } from '../../components/Logo';
import { ORG } from '../mock/data';
import { NavList } from './NavList';

interface SidebarProps {
  collapsed: boolean;
  onToggle: () => void;
}

export function Sidebar({ collapsed, onToggle }: SidebarProps) {
  return (
    <aside
      className={`hidden shrink-0 flex-col border-r border-titanium-800 bg-obsidian-900 transition-[width] duration-150 lg:flex ${
        collapsed ? 'w-16' : 'w-64'
      }`}
    >
      <div className="flex h-14 items-center border-b border-titanium-800 px-4">
        {collapsed ? <Logo size={26} iconOnly /> : <Logo size={26} />}
      </div>

      <nav className="flex-1 overflow-y-auto px-2 py-4">
        <NavList collapsed={collapsed} />
      </nav>

      <div className="border-t border-titanium-800 p-2">
        {!collapsed && (
          <div className="mb-2 border border-titanium-800 bg-obsidian-800/60 px-3 py-2">
            <p className="truncate text-xs font-semibold text-titanium-100">{ORG.name}</p>
            <p className="font-mono text-[10px] uppercase tracking-wider text-titanium-500">
              {ORG.plan} · {ORG.seats} Seats
            </p>
          </div>
        )}
        <button
          type="button"
          onClick={onToggle}
          className="flex w-full items-center justify-center gap-2 border border-titanium-800 px-2.5 py-2 text-titanium-400 transition-colors hover:border-titanium-600 hover:text-titanium-100"
          aria-label={collapsed ? 'Sidebar erweitern' : 'Sidebar einklappen'}
        >
          {collapsed ? <ChevronsRight className="h-4 w-4" /> : <ChevronsLeft className="h-4 w-4" />}
        </button>
      </div>
    </aside>
  );
}
