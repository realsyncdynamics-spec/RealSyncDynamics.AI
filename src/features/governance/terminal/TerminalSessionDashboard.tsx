import { useState } from 'react';
import { TerminalInterface } from './TerminalInterface';
import { TeamCollaborationPanel } from './TeamCollaborationPanel';
import { ApprovalQueuePanel } from './ApprovalQueuePanel';
import { useAgenticTerminal } from './useAgenticTerminal';
import { ChevronLeft, ChevronRight } from 'lucide-react';

export function TerminalSessionDashboard() {
  const { sessionId } = useAgenticTerminal();
  const [rightPanelOpen, setRightPanelOpen] = useState<'collaboration' | 'approvals' | null>(
    'collaboration'
  );

  return (
    <div className="flex h-full gap-4 bg-obsidian-900">
      {/* Main Terminal */}
      <div className="flex-1 flex flex-col min-w-0">
        <TerminalInterface />
      </div>

      {/* Right Sidebar Panel Toggle */}
      <div className="relative flex items-center">
        <button
          onClick={() =>
            setRightPanelOpen(
              rightPanelOpen === null
                ? 'collaboration'
                : rightPanelOpen === 'collaboration'
                  ? 'approvals'
                  : null
            )
          }
          className="p-2 text-titanium-600 hover:text-titanium-300 hover:bg-obsidian-800 rounded transition-colors"
          title={
            rightPanelOpen === null
              ? 'Show panels'
              : rightPanelOpen === 'collaboration'
                ? 'Switch to approvals'
                : 'Close panels'
          }
        >
          {rightPanelOpen === null ? <ChevronLeft size={18} /> : <ChevronRight size={18} />}
        </button>
      </div>

      {/* Right Sidebar */}
      {rightPanelOpen === 'collaboration' && (
        <div className="w-sm border-l border-titanium-700 overflow-y-auto">
          <TeamCollaborationPanel sessionId={sessionId} />
        </div>
      )}
      {rightPanelOpen === 'approvals' && (
        <div className="w-sm border-l border-titanium-700 overflow-y-auto">
          <ApprovalQueuePanel sessionId={sessionId} />
        </div>
      )}

      {/* Tab Indicator when closed */}
      {rightPanelOpen === null && (
        <div className="flex flex-col items-center gap-2 pr-2">
          <button
            onClick={() => setRightPanelOpen('collaboration')}
            className="text-xs font-mono text-titanium-600 hover:text-titanium-300 transition-colors py-2 px-1 hover:bg-obsidian-800 rounded writing-vertical text-left"
            title="Show team collaboration"
          >
            TEAM
          </button>
          <div className="flex-1" />
          <button
            onClick={() => setRightPanelOpen('approvals')}
            className="text-xs font-mono text-titanium-600 hover:text-titanium-300 transition-colors py-2 px-1 hover:bg-obsidian-800 rounded writing-vertical text-left"
            title="Show approval queue"
          >
            APPS
          </button>
        </div>
      )}
    </div>
  );
}
