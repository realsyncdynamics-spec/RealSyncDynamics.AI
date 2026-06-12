import React from 'react';
import { Search, Bot, Sun, Moon, Menu, ChevronRight } from 'lucide-react';

interface TopbarProps {
  title: string;
  breadcrumb?: string[];
  onOpenCommandPalette: () => void;
  onToggleAgent: () => void;
  onToggleMobileNav: () => void;
  theme: 'dark' | 'light';
  onToggleTheme: () => void;
}

export function Topbar({
  title,
  breadcrumb = [],
  onOpenCommandPalette,
  onToggleAgent,
  onToggleMobileNav,
  theme,
  onToggleTheme,
}: TopbarProps) {
  return (
    <header className="flex h-14 items-center justify-between gap-3 border-b border-titanium-800 bg-obsidian-900/80 px-4 backdrop-blur-sm">
      <div className="flex items-center gap-3 min-w-0">
        <button
          type="button"
          onClick={onToggleMobileNav}
          className="flex h-8 w-8 items-center justify-center text-titanium-400 hover:text-titanium-100 lg:hidden"
          aria-label="Navigation öffnen"
        >
          <Menu className="h-4 w-4" />
        </button>
        <div className="flex min-w-0 items-center gap-1.5 font-mono text-[11px] uppercase tracking-wider text-titanium-500">
          {breadcrumb.map((crumb) => (
            <React.Fragment key={crumb}>
              <span className="truncate text-titanium-600">{crumb}</span>
              <ChevronRight className="h-3 w-3 shrink-0" />
            </React.Fragment>
          ))}
          <span className="truncate font-semibold text-titanium-100">{title}</span>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onOpenCommandPalette}
          className="hidden items-center gap-2 border border-titanium-800 px-3 py-1.5 text-titanium-500 transition-colors hover:border-titanium-600 hover:text-titanium-200 sm:flex"
        >
          <Search className="h-3.5 w-3.5" />
          <span className="text-xs">Suchen…</span>
          <kbd className="ml-2 border border-titanium-700 px-1.5 py-0.5 font-mono text-[10px]">⌘K</kbd>
        </button>
        <button
          type="button"
          onClick={onOpenCommandPalette}
          className="flex h-8 w-8 items-center justify-center text-titanium-400 hover:text-titanium-100 sm:hidden"
          aria-label="Suche öffnen"
        >
          <Search className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={onToggleTheme}
          className="flex h-8 w-8 items-center justify-center border border-titanium-800 text-titanium-400 transition-colors hover:border-titanium-600 hover:text-titanium-100"
          aria-label="Theme wechseln"
        >
          {theme === 'dark' ? <Sun className="h-3.5 w-3.5" /> : <Moon className="h-3.5 w-3.5" />}
        </button>
        <button
          type="button"
          onClick={onToggleAgent}
          className="flex h-8 w-8 items-center justify-center border border-security-500/40 bg-security-500/10 text-security-400 transition-colors hover:bg-security-500/20"
          aria-label="AI Agent öffnen"
        >
          <Bot className="h-4 w-4" />
        </button>
        <div className="flex h-8 w-8 items-center justify-center border border-titanium-700 bg-titanium-800 font-mono text-[11px] font-semibold text-titanium-100">
          MB
        </div>
      </div>
    </header>
  );
}
