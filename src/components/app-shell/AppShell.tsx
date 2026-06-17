// AppShell.tsx — Browser-OS-Shell für alle /app/* Routen
// Layout: BrowserTopBar → [AppSidebar | GovernanceCanvas | AgentSidebar]
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { BrowserTopBar } from '../governance-os/BrowserTopBar';
import { AppSidebar } from './AppSidebar';
import { GovernanceCanvas } from '../governance-os/GovernanceCanvas';
import { GovernanceStatusBar } from '../governance-os/GovernanceStatusBar';
import { MobileBottomNavigation } from '../governance-os/MobileBottomNavigation';
import { EmbeddedBrowserCanvas } from '../governance-os/EmbeddedBrowserCanvas';
import { GovernanceCommandPalette } from '../governance-os/GovernanceCommandPalette';
import { AgentSidebar } from '../../features/agent/AgentSidebar';

export function AppShell({ children }: { children: React.ReactNode }) {
  const navigate = useNavigate();
  const [agentOpen, setAgentOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [embeddedUrl, setEmbeddedUrl] = useState<string | null>(null);
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setCommandPaletteOpen((v) => !v);
      }
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  const handleLoadUrl = (url: string) => setEmbeddedUrl(url);
  const handleCloseEmbed = () => setEmbeddedUrl(null);
  const handleScan = (url: string) => {
    navigate(`/audit?target=${encodeURIComponent(url)}`);
    setEmbeddedUrl(null);
  };

  return (
    <div className="h-screen flex flex-col bg-obsidian-950 text-titanium-100 overflow-hidden">
      <BrowserTopBar
        mobileMenuOpen={sidebarCollapsed}
        onToggleMobile={() => setSidebarCollapsed((v) => !v)}
        onOpenAssistant={() => setAgentOpen((v) => !v)}
        onLoadUrl={handleLoadUrl}
        activeEmbedUrl={embeddedUrl ?? undefined}
        onOpenCommandPalette={() => setCommandPaletteOpen(true)}
      />

      <div className="flex flex-1 overflow-hidden min-h-0">
        <AppSidebar
          collapsed={sidebarCollapsed}
          onToggleCollapse={() => setSidebarCollapsed((v) => !v)}
        />

        {embeddedUrl ? (
          <EmbeddedBrowserCanvas
            url={embeddedUrl}
            onClose={handleCloseEmbed}
            onScan={handleScan}
          />
        ) : (
          <GovernanceCanvas>{children}</GovernanceCanvas>
        )}

        <AgentSidebar open={agentOpen} onClose={() => setAgentOpen((v) => !v)} />
      </div>

      <MobileBottomNavigation />

      <div className="hidden lg:block">
        <GovernanceStatusBar />
      </div>

      <GovernanceCommandPalette
        open={commandPaletteOpen}
        onClose={() => setCommandPaletteOpen(false)}
      />
    </div>
  );
}
