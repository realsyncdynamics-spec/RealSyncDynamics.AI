/**
 * BrowserNav — horizontale Tab-Navigation für Governance Browser.
 *
 * Wechselt zwischen: Agents, Approvals, Evidence, Risks, Workflows, Connectors.
 */
import { Bot, CheckCircle2, AlertTriangle, FileCheck2, GitMerge, Plug } from 'lucide-react';

export type BrowserTab = 'agents' | 'approvals' | 'evidence' | 'risks' | 'workflows' | 'connectors';

interface BrowserNavProps {
  activeTab: BrowserTab;
  onTabChange: (tab: BrowserTab) => void;
}

const TABS: Array<{ id: BrowserTab; label: string; icon: typeof Bot }> = [
  { id: 'agents', label: 'Agenten', icon: Bot },
  { id: 'approvals', label: 'Freigaben', icon: CheckCircle2 },
  { id: 'evidence', label: 'Evidence', icon: FileCheck2 },
  { id: 'risks', label: 'Risiken', icon: AlertTriangle },
  { id: 'workflows', label: 'Workflows', icon: GitMerge },
  { id: 'connectors', label: 'Connectoren', icon: Plug },
];

export function BrowserNav({ activeTab, onTabChange }: BrowserNavProps) {
  return (
    <div className="shrink-0 border-b border-titanium-800 bg-obsidian-900">
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        <nav className="flex gap-0 overflow-x-auto">
          {TABS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => onTabChange(id)}
              className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                activeTab === id
                  ? 'border-cyan-400 text-cyan-300'
                  : 'border-transparent text-titanium-400 hover:text-titanium-200'
              }`}
            >
              <Icon className="h-4 w-4" />
              {label}
            </button>
          ))}
        </nav>
      </div>
    </div>
  );
}
