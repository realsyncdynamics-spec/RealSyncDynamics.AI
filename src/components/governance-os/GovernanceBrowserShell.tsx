// GovernanceBrowserShell — browserartiger Governance-OS-Rahmen für alle /app/* Routen.
//
// Layout: TopBar → Tabs → [Canvas + AssistantPanel + AgentSidebar] → MobileBottomNav → [ToggleBar] → StatusBar
// Embedded Browser: Address-Bar-Eingabe einer echten URL öffnet EmbeddedBrowserCanvas
// über dem Canvas; Governance-Panel bleibt seitlich sichtbar.
// AgentSidebar: Desktop inline w-80, Mobile slide-over von rechts.
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bot, X, ArrowRight, ExternalLink, MessageSquare } from 'lucide-react';
import { BrowserTopBar } from './BrowserTopBar';
import { GovernanceTabs } from './GovernanceTabs';
import { GovernanceCanvas } from './GovernanceCanvas';
import { GovernanceAssistantPanel } from './GovernanceAssistantPanel';
import { GovernanceStatusBar } from './GovernanceStatusBar';
import { MobileBottomNavigation } from './MobileBottomNavigation';
import { EmbeddedBrowserCanvas } from './EmbeddedBrowserCanvas';

const QUICK_COMMANDS = [
  { label: 'Websites öffnen',           route: '/app/websites' },
  { label: 'Evidence anzeigen',         route: '/app/evidence' },
  { label: 'Risiken erklären',          route: '/app/risks' },
  { label: 'Monitoring öffnen',         route: '/app/monitoring' },
  { label: 'Report vorbereiten',        route: '/app/compliance' },
  { label: 'Kostenlosen Audit starten', route: '/audit' },
];

interface GovernanceBrowserShellProps {
  children: React.ReactNode;
}

export function GovernanceBrowserShell({ children }: GovernanceBrowserShellProps) {
  const navigate = useNavigate();
  const [assistantOpen, setAssistantOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [embeddedUrl, setEmbeddedUrl] = useState<string | null>(null);
  const [agentOpen, setAgentOpen] = useState(false);
  const [agentInput, setAgentInput] = useState('');

  const handleLoadUrl = (url: string) => setEmbeddedUrl(url);
  const handleCloseEmbed = () => setEmbeddedUrl(null);
  const handleScan = (url: string) => {
    navigate(`/audit?target=${encodeURIComponent(url)}`);
    setEmbeddedUrl(null);
  };

  const handleAgentCommand = (route: string) => {
    navigate(route);
    setAgentOpen(false);
  };

  const handleAgentSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!agentInput.trim()) return;
    navigate(`/audit?q=${encodeURIComponent(agentInput.trim())}`);
    setAgentInput('');
    setAgentOpen(false);
  };

  // Sidebar content shared between desktop inline + mobile slide-over
  const AgentSidebarContent = (
    <>
      {/* Header */}
      <div className="h-12 shrink-0 flex items-center justify-between px-4 border-b border-titanium-900">
        <div className="flex items-center gap-2">
          <Bot className="h-4 w-4 text-cyan-400" />
          <span className="font-display font-semibold text-sm text-titanium-50">
            Governance Guide Agent
          </span>
        </div>
        <button
          onClick={() => setAgentOpen(false)}
          className="text-titanium-600 hover:text-titanium-200 transition-colors"
          aria-label="Schließen"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Quick Commands */}
      <div className="p-4 border-b border-titanium-900">
        <p className="font-mono text-[9px] uppercase tracking-widest text-titanium-600 mb-3">
          Schnellzugriff
        </p>
        <ul className="space-y-1">
          {QUICK_COMMANDS.map(({ label, route }) => (
            <li key={route}>
              <button
                onClick={() => handleAgentCommand(route)}
                className="w-full flex items-center justify-between px-3 py-2 text-sm text-titanium-200 hover:bg-obsidian-800 hover:text-titanium-50 transition-colors text-left"
              >
                <span className="flex items-center gap-2">
                  <ArrowRight className="h-3.5 w-3.5 text-cyan-400 shrink-0" />
                  {label}
                </span>
                <ExternalLink className="h-3 w-3 text-titanium-700 shrink-0" />
              </button>
            </li>
          ))}
        </ul>
      </div>

      {/* Textarea */}
      <div className="p-4 flex-1">
        <form onSubmit={handleAgentSubmit} className="flex flex-col gap-3">
          <textarea
            value={agentInput}
            onChange={(e) => setAgentInput(e.target.value)}
            placeholder="Was möchten Sie tun?"
            rows={4}
            className="w-full bg-obsidian-950 border border-titanium-800 text-sm text-titanium-100 placeholder-titanium-600 px-3 py-2 resize-none outline-none focus:border-cyan-700 transition-colors font-mono"
          />
          <button
            type="submit"
            disabled={!agentInput.trim()}
            className="flex items-center justify-center gap-2 bg-cyan-400 text-obsidian-950 px-4 py-2 text-sm font-semibold hover:bg-cyan-300 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Bot className="h-4 w-4" />
            Anfrage starten
          </button>
        </form>
      </div>

      {/* Hinweis */}
      <div className="px-4 pb-5 shrink-0">
        <p className="font-mono text-[9px] text-titanium-600 leading-relaxed">
          Der Governance Agent führt Sie durch DSGVO-, EU-AI-Act- und Evidence-Prozesse.
          Antworten sind keine Rechtsberatung.
        </p>
      </div>
    </>
  );

  return (
    <div className="h-screen h-dvh flex flex-col bg-obsidian-950 text-titanium-100 overflow-hidden">
      <BrowserTopBar
        mobileMenuOpen={mobileMenuOpen}
        onToggleMobile={() => setMobileMenuOpen((v) => !v)}
        onOpenAssistant={() => setAssistantOpen((v) => !v)}
        onLoadUrl={handleLoadUrl}
        activeEmbedUrl={embeddedUrl ?? undefined}
      />

      <div className="hidden lg:block">
        <GovernanceTabs />
      </div>

      <div className="flex flex-1 overflow-hidden min-h-0">
        {embeddedUrl ? (
          <EmbeddedBrowserCanvas
            url={embeddedUrl}
            onClose={handleCloseEmbed}
            onScan={handleScan}
          />
        ) : (
          <GovernanceCanvas>{children}</GovernanceCanvas>
        )}

        <GovernanceAssistantPanel
          open={assistantOpen}
          onClose={() => setAssistantOpen((v) => !v)}
        />

        {/* Desktop: inline right sidebar */}
        {agentOpen && (
          <aside className="hidden lg:flex w-80 shrink-0 flex-col bg-slate-900 border-l border-titanium-900 overflow-y-auto">
            {AgentSidebarContent}
          </aside>
        )}
      </div>

      <MobileBottomNavigation />

      {/* Toggle bar — before StatusBar, desktop only */}
      <div className="hidden lg:flex h-8 shrink-0 items-center justify-end px-3 bg-obsidian-950 border-t border-titanium-900">
        <button
          onClick={() => setAgentOpen((v) => !v)}
          className={`flex items-center gap-1.5 px-3 py-1 text-xs font-mono transition-colors ${
            agentOpen
              ? 'text-cyan-300 bg-obsidian-800 border border-cyan-900'
              : 'text-titanium-500 hover:text-titanium-200 hover:bg-obsidian-800 border border-transparent'
          }`}
          aria-label="Governance Guide Agent umschalten"
        >
          <MessageSquare className="h-3.5 w-3.5" />
          Governance Agent
        </button>
      </div>

      <div className="hidden lg:block">
        <GovernanceStatusBar />
      </div>

      {/* Mobile: backdrop + slide-over from right */}
      {agentOpen && (
        <div
          className="lg:hidden fixed inset-0 z-40 bg-obsidian-950/60"
          onClick={() => setAgentOpen(false)}
        />
      )}
      <aside
        className={`lg:hidden fixed top-0 right-0 z-50 h-full w-80 bg-slate-900 border-l border-titanium-900 flex flex-col shadow-2xl transition-transform duration-200 ${
          agentOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        {AgentSidebarContent}
      </aside>
    </div>
  );
}
