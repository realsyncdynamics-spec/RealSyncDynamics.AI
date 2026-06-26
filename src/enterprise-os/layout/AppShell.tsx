import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { MobileNav } from './MobileNav';
import { Topbar } from './Topbar';
import { CommandPalette, type CommandItem } from '../components/CommandPalette';
import { AgentChatPanel } from '../components/AgentChatPanel';
import { AGENT_MESSAGES, NAV_GROUPS } from '../mock/data';

interface AppShellProps {
  title: string;
  breadcrumb?: string[];
  children: React.ReactNode;
}

export function AppShell({ title, breadcrumb, children }: AppShellProps) {
  const navigate = useNavigate();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [agentOpen, setAgentOpen] = useState(false);
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setPaletteOpen((o) => !o);
      }
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  const commandItems: CommandItem[] = NAV_GROUPS.flatMap((group) =>
    group.items.map((item) => ({
      id: item.id,
      label: item.label,
      group: 'Navigation',
      onSelect: () => navigate(item.to),
    }))
  );
  commandItems.push({
    id: 'toggle-agent',
    label: 'AI Agent öffnen',
    group: 'Aktionen',
    shortcut: '⌘J',
    onSelect: () => setAgentOpen(true),
  });
  commandItems.push({
    id: 'toggle-theme',
    label: theme === 'dark' ? 'Light Mode aktivieren' : 'Dark Mode aktivieren',
    group: 'Aktionen',
    onSelect: () => setTheme((t) => (t === 'dark' ? 'light' : 'dark')),
  });

  return (
    <div className={`flex h-screen overflow-hidden bg-obsidian-950 text-titanium-100 ${theme === 'light' ? 'eos-light' : ''}`}>
      <Sidebar collapsed={collapsed} onToggle={() => setCollapsed((c) => !c)} />
      <MobileNav open={mobileNavOpen} onClose={() => setMobileNavOpen(false)} />

      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar
          title={title}
          breadcrumb={breadcrumb}
          onOpenCommandPalette={() => setPaletteOpen(true)}
          onToggleAgent={() => setAgentOpen((o) => !o)}
          onToggleMobileNav={() => setMobileNavOpen(true)}
          theme={theme}
          onToggleTheme={() => setTheme((t) => (t === 'dark' ? 'light' : 'dark'))}
        />
        <main className="flex-1 overflow-y-auto bg-obsidian-950">
          <div className="mx-auto max-w-[1400px] px-4 py-6 sm:px-6 lg:px-8">{children}</div>
        </main>
      </div>

      <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} items={commandItems} />
      <AgentChatPanel open={agentOpen} onClose={() => setAgentOpen(false)} messages={AGENT_MESSAGES} />
    </div>
  );
}
