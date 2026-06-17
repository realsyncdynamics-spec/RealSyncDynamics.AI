import { Link, useNavigate } from 'react-router-dom';
import { Sparkles, Menu, X, FileCheck2, FileBarChart2, Command } from 'lucide-react';
import { GovernanceAddressBar } from './GovernanceAddressBar';
import { GovernanceTenantSwitcher } from './GovernanceTenantSwitcher';

interface BrowserTopBarProps {
  mobileMenuOpen: boolean;
  onToggleMobile: () => void;
  onOpenAssistant: () => void;
  onLoadUrl: (url: string) => void;
  activeEmbedUrl?: string;
  onOpenCommandPalette: () => void;
}

export function BrowserTopBar({
  mobileMenuOpen,
  onToggleMobile,
  onOpenAssistant,
  onLoadUrl,
  activeEmbedUrl,
  onOpenCommandPalette,
}: BrowserTopBarProps) {
  const navigate = useNavigate();

  return (
    <header className="h-14 shrink-0 bg-obsidian-900 border-b border-titanium-900 flex items-center gap-3 px-3 sm:px-4">
      {/* Mobile-Menü Toggle */}
      <button
        onClick={onToggleMobile}
        className="lg:hidden text-titanium-400 hover:text-titanium-100"
        aria-label="Menü"
      >
        {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
      </button>

      {/* Logo + Produktname */}
      <Link to="/app" className="flex items-center gap-2 shrink-0">
        <div className="w-7 h-7 bg-gradient-to-br from-cyan-400 to-security-600 flex items-center justify-center">
          <Sparkles className="h-4 w-4 text-obsidian-950" />
        </div>
        <div className="hidden sm:flex flex-col leading-none">
          <span className="font-display font-bold text-[11px] text-titanium-50 tracking-tight">
            Governance OS Browser
          </span>
          <span className="font-mono text-[9px] text-titanium-500 tracking-wide">
            DSGVO • EU AI Act • Evidence
          </span>
        </div>
      </Link>

      {/* Tenant Switcher */}
      <GovernanceTenantSwitcher />

      {/* Address Bar — onLoadUrl für echte URLs, sonst Audit-Navigation */}
      <GovernanceAddressBar onLoadUrl={onLoadUrl} activeUrl={activeEmbedUrl} />

      {/* Rechte CTA-Buttons */}
      <div className="flex items-center gap-1.5 shrink-0">
        {/* ⌘K Command Palette */}
        <button
          onClick={onOpenCommandPalette}
          title="Befehlspalette öffnen (⌘K)"
          className="hidden sm:flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-mono text-titanium-400 bg-obsidian-800 border border-titanium-800 hover:border-titanium-600 hover:text-titanium-200 transition-colors"
        >
          <Command className="h-3 w-3" />
          <span className="hidden lg:inline text-[10px]">⌘K</span>
        </button>
        <button
          onClick={() => navigate('/audit')}
          className="hidden md:flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-titanium-200 bg-obsidian-800 border border-titanium-800 hover:border-titanium-600 hover:text-titanium-50 transition-colors"
        >
          Audit starten
        </button>
        <button
          onClick={() => navigate('/app/evidence')}
          className="hidden md:flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-titanium-200 bg-obsidian-800 border border-titanium-800 hover:border-titanium-600 hover:text-titanium-50 transition-colors"
        >
          <FileCheck2 className="h-3.5 w-3.5" />
          Evidence
        </button>
        <button
          onClick={() => navigate('/app/reports')}
          className="hidden lg:flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-titanium-200 bg-obsidian-800 border border-titanium-800 hover:border-titanium-600 hover:text-titanium-50 transition-colors"
        >
          <FileBarChart2 className="h-3.5 w-3.5" />
          Report
        </button>
        <button
          onClick={onOpenAssistant}
          className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-cyan-300 bg-obsidian-800 border border-cyan-900 hover:border-cyan-700 hover:bg-obsidian-700 transition-colors"
        >
          <Sparkles className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">Assistent</span>
        </button>
      </div>
    </header>
  );
}
