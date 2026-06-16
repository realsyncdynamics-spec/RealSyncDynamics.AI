// GovernanceBrowserShell — browserartiger Governance-OS-Rahmen für alle /app/* Routen.
//
// Layout: TopBar → Tabs → [Canvas + GovernanceChatSidebar] → MobileBottomNav → StatusBar
// Embedded Browser: Address-Bar-Eingabe einer echten URL öffnet EmbeddedBrowserCanvas
// über dem Canvas; Chat-Sidebar bleibt seitlich sichtbar.
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { BrowserTopBar } from './BrowserTopBar';
import { GovernanceTabs } from './GovernanceTabs';
import { GovernanceCanvas } from './GovernanceCanvas';
import { GovernanceStatusBar } from './GovernanceStatusBar';
import { MobileBottomNavigation } from './MobileBottomNavigation';
import { EmbeddedBrowserCanvas } from './EmbeddedBrowserCanvas';
import { GovernanceChatSidebar } from './GovernanceChatSidebar';

interface GovernanceBrowserShellProps {
  children: React.ReactNode;
}

export function GovernanceBrowserShell({ children }: GovernanceBrowserShellProps) {
  const navigate = useNavigate();
  const [assistantOpen, setAssistantOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [embeddedUrl, setEmbeddedUrl] = useState<string | null>(null);

  const handleLoadUrl = (url: string) => setEmbeddedUrl(url);
  const handleCloseEmbed = () => setEmbeddedUrl(null);
  const handleScan = (url: string) => {
    navigate(`/audit?target=${encodeURIComponent(url)}`);
    setEmbeddedUrl(null);
  };

  return (
    <div className="h-screen flex flex-col bg-obsidian-950 text-titanium-100 overflow-hidden">
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

        {/* Claude.ai-style Agent Sidebar: 380px open, 32px collapsed strip */}
        <GovernanceChatSidebar
          open={assistantOpen}
          onClose={() => setAssistantOpen((v) => !v)}
        />
      </div>

      <MobileBottomNavigation />

      <div className="hidden lg:block">
        <GovernanceStatusBar />
      </div>
    </div>
  );
}
