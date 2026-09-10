import { Link, useNavigate } from 'react-router-dom';
import { Sparkles, Menu, X, FileCheck2, FileBarChart2, Search } from 'lucide-react';
import { GovernanceAddressBar } from './GovernanceAddressBar';

interface BrowserTopBarProps {
  mobileMenuOpen: boolean;
  onToggleMobile: () => void;
  onOpenAssistant: () => void;
  onOpenCommandCenter: () => void;
  onLoadUrl: (url: string) => void;
  activeEmbedUrl?: string;
}

export function BrowserTopBar({
  mobileMenuOpen,
  onToggleMobile,
  onOpenAssistant,
  onOpenCommandCenter,
  onLoadUrl,
  activeEmbedUrl,
}: BrowserTopBarProps) {
  const navigate = useNavigate();

  return (
    <header className="h-14 shrink-0 bg-obsidian-900/95 border-b border-titanium-900/80 backdrop-blur-md flex items-center gap-3 px-3 sm:px-4">
      {/* Mobile-Menü Toggle — system drawer entry */}
      <button
        onClick={onToggleMobile}
        className="lg:hidden text-titanium-400 hover:text-titanium-100 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#e8c98a]/50"
        aria-label={mobileMenuOpen ? 'Systemmenü schließen' : 'Systemmenü öffnen'}
        aria-expanded={mobileMenuOpen}
      >
        {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
      </button>

      {/* Logo + Produktname — OS system-bar identity */}
      <Link to="/app" className="flex items-center gap-2 shrink-0">
        <div className="w-7 h-7 bg-gradient-to-br from-[#e8c98a] to-[#b8955a] flex items-center justify-center">
          <Sparkles className="h-4 w-4 text-obsidian-950" />
        </div>
        <div className="hidden sm:flex flex-col leading-none">
          <span className="font-display font-bold text-[11px] text-titanium-50 tracking-tight">
            Governance OS
          </span>
          <span className="font-mono text-[9px] text-[#e8c98a]/70 tracking-wide">
            SYSTEM · DSGVO · EU AI Act
          </span>
        </div>
      </Link>

      {/* Address Bar — onLoadUrl für echte URLs, sonst Audit-Navigation */}
      <GovernanceAddressBar onLoadUrl={onLoadUrl} activeUrl={activeEmbedUrl} />

      {/* Rechte CTA-Buttons */}
      <div className="flex items-center gap-1.5 shrink-0">
        <button
          type="button"
          onClick={onOpenCommandCenter}
          className="hidden sm:flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-titanium-300 bg-obsidian-800 border border-titanium-800 hover:border-[#e8c98a]/40 hover:text-titanium-50 transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#e8c98a]/50"
          aria-label="Command Center öffnen"
        >
          <Search className="h-3.5 w-3.5 text-[#e8c98a]/80" />
          <span className="hidden lg:inline">Suchen</span>
          <kbd className="ml-0.5 hidden md:inline font-mono text-[9px] text-titanium-600 border border-titanium-800 px-1 py-0.5">
            ⌘K
          </kbd>
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
          Bericht
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
