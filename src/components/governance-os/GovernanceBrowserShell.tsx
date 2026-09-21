// GovernanceBrowserShell — browserartiger Governance-OS-Rahmen für alle /app/* Routen.
//
// Layout ab `lg`: TopBar → [Sidebar + Canvas + GovernanceChatSidebar] → StatusBar
// Darunter: TopBar → (Burger-Menü mit GovernanceTabs) → Canvas → MobileBottomNav
// Embedded Browser: Address-Bar-Eingabe einer echten URL öffnet EmbeddedBrowserCanvas
// über dem Canvas; Chat-Sidebar bleibt seitlich sichtbar.
// Command Center: Ctrl/Cmd+K öffnet die Befehlspalette über dem Shell-Chrome.
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { BrowserTopBar } from './BrowserTopBar';
import { GovernanceTabs } from './GovernanceTabs';
import { GovernanceSidebar } from './GovernanceSidebar';
import { GovernanceCanvas } from './GovernanceCanvas';
import { GovernanceStatusBar } from './GovernanceStatusBar';
import { MobileBottomNavigation } from './MobileBottomNavigation';
import { EmbeddedBrowserCanvas } from './EmbeddedBrowserCanvas';
import { GovernanceChatSidebar } from './GovernanceChatSidebar';
import { PaymentGraceBanner } from './PaymentGraceBanner';
import { CommandCenter } from './CommandCenter';
import {
  buildCommandCatalog,
  isCommandRunnable,
  type CommandDefinition,
} from './commandCenterCatalog';
import { RouteEntitlementGate } from '../../core/access/RouteEntitlementGate';
import { AppGate } from '../../features/auth/AppGate';

interface GovernanceBrowserShellProps {
  children: React.ReactNode;
}

/**
 * Browser shell for /app/* — always behind AppGate so ungated sibling
 * routes cannot render an anonymous empty shell that looks broken.
 * Routes that already wrap AppGate outside are double-gated (harmless).
 */
export function GovernanceBrowserShell({ children }: GovernanceBrowserShellProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const [assistantOpen, setAssistantOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [embeddedUrl, setEmbeddedUrl] = useState<string | null>(null);
  const [commandCenterOpen, setCommandCenterOpen] = useState(false);

  const commandItems = useMemo(() => buildCommandCatalog(), []);

  // An embedded page belongs to the current navigation entry. It must not
  // cover the next module, including a new visit to the same dashboard URL.
  useEffect(() => {
    setEmbeddedUrl(null);
    setMobileMenuOpen(false);
  }, [location.key]);

  const handleLoadUrl = (url: string) => setEmbeddedUrl(url);
  const handleCloseEmbed = () => setEmbeddedUrl(null);
  const handleScan = (url: string) => {
    navigate(`/audit?target=${encodeURIComponent(url)}`);
    setEmbeddedUrl(null);
  };

  const handleRunCommand = useCallback(
    (item: CommandDefinition) => {
      if (!isCommandRunnable(item)) return;
      if (item.actionId === 'open-assistant') {
        setAssistantOpen(true);
        return;
      }
      if (item.path) {
        navigate(item.path);
      }
    },
    [navigate],
  );

  const handleSubmitIntent = useCallback(
    (text: string) => {
      const trimmed = text.trim();
      if (!trimmed) return;
      navigate('/app/dashboard', { state: { agentOsIntent: trimmed } });
    },
    [navigate],
  );

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        setMobileMenuOpen(false);
        return;
      }
      if (!(e.metaKey || e.ctrlKey)) return;
      if (e.key.toLowerCase() !== 'k') return;
      // Ignore when the event is already handled by a nested editor that
      // legitimately wants Ctrl+K (none today in the shell chrome).
      e.preventDefault();
      setCommandCenterOpen((open) => !open);
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  return (
    <AppGate>
      <div className="os-chrome dashboard-context h-screen h-dvh flex flex-col bg-obsidian-950 text-titanium-100 overflow-hidden">
        <BrowserTopBar
          mobileMenuOpen={mobileMenuOpen}
          onToggleMobile={() => setMobileMenuOpen((v) => !v)}
          onOpenAssistant={() => setAssistantOpen((v) => !v)}
          onOpenCommandCenter={() => setCommandCenterOpen(true)}
          onLoadUrl={handleLoadUrl}
          activeEmbedUrl={embeddedUrl ?? undefined}
        />

        {/* Zahlungshinweis über den Tabs: Während der Grace Period ändert sich
            sonst nichts, und der Kunde stünde am achten Tag ohne Vorwarnung vor
            einem eingeschränkten Konto. Rendert sich selbst weg, wenn kein
            Zahlungsverzug vorliegt. */}
        <PaymentGraceBanner />

        {mobileMenuOpen && (
          <nav
            id="governance-mobile-menu"
            aria-label="Systemmenü"
            className="lg:hidden max-h-[50dvh] overflow-y-auto shrink-0 border-b border-titanium-800"
            onClick={(event) => {
              if ((event.target as HTMLElement).closest('a')) setMobileMenuOpen(false);
            }}
          >
            <GovernanceTabs />
            <button
              type="button"
              className="w-full px-4 py-3 text-left text-sm text-titanium-200 bg-obsidian-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#e4cfa2]"
              onClick={() => {
                setMobileMenuOpen(false);
                setCommandCenterOpen(true);
              }}
            >
              Module und Aktionen suchen
            </button>
          </nav>
        )}

        {/* Ein Gate für jede Route der Shell: RouteEntitlementGate liest das
            Zugriffsregister (core/access/featureAccess.ts) gegen die wirksamen
            Entitlements — dieselbe Quelle wie der Server, inklusive Grace
            Period und Add-on-Grants. Freie Flächen passieren unverändert. */}
        <div className="flex flex-1 overflow-hidden min-h-0">
          {/* Modulnavigation ab `lg` links statt oben — Entwurfs-Layout.
              Auf schmalen Geraeten bleibt es beim Burger-Menue oben und der
              Tab-Bar unten; die Sidebar blendet sich dort selbst aus. */}
          <GovernanceSidebar />

          {embeddedUrl ? (
            <EmbeddedBrowserCanvas
              url={embeddedUrl}
              onClose={handleCloseEmbed}
              onScan={handleScan}
            />
          ) : (
            <GovernanceCanvas>
              <RouteEntitlementGate>{children}</RouteEntitlementGate>
            </GovernanceCanvas>
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

        <CommandCenter
          open={commandCenterOpen}
          onClose={() => setCommandCenterOpen(false)}
          items={commandItems}
          onRun={handleRunCommand}
          onSubmitIntent={handleSubmitIntent}
        />
      </div>
    </AppGate>
  );
}
