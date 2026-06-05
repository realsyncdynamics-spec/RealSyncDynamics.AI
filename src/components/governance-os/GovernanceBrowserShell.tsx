// GovernanceBrowserShell — browserartiger Governance-OS-Rahmen für alle /app/* Routen.
//
// Layout: TopBar → Tabs → [Canvas + AssistantPanel] → StatusBar
// Ersetzt WorkspaceShell/WorkspaceEmbed für die /app/* Routen.
// Auth Guards bleiben in den eingebetteten View-Komponenten selbst.
import React, { useState } from 'react';
import { BrowserTopBar } from './BrowserTopBar';
import { GovernanceTabs } from './GovernanceTabs';
import { GovernanceCanvas } from './GovernanceCanvas';
import { GovernanceAssistantPanel } from './GovernanceAssistantPanel';
import { GovernanceStatusBar } from './GovernanceStatusBar';

interface GovernanceBrowserShellProps {
  children: React.ReactNode;
}

export function GovernanceBrowserShell({ children }: GovernanceBrowserShellProps) {
  const [assistantOpen, setAssistantOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <div className="h-screen flex flex-col bg-obsidian-950 text-titanium-100 overflow-hidden">
      <BrowserTopBar
        mobileMenuOpen={mobileMenuOpen}
        onToggleMobile={() => setMobileMenuOpen((v) => !v)}
        onOpenAssistant={() => setAssistantOpen((v) => !v)}
      />

      <GovernanceTabs />

      <div className="flex flex-1 overflow-hidden min-h-0">
        <GovernanceCanvas>{children}</GovernanceCanvas>

        <GovernanceAssistantPanel
          open={assistantOpen}
          onClose={() => setAssistantOpen((v) => !v)}
        />
      </div>

      <GovernanceStatusBar />
    </div>
  );
}
