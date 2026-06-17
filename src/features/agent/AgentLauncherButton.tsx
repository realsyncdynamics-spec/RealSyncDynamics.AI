// AgentLauncherButton.tsx — Mobile Floating-Trigger für den Agent-Panel
import { Sparkles } from 'lucide-react';

interface AgentLauncherButtonProps {
  onClick: () => void;
  open?: boolean;
}

export function AgentLauncherButton({ onClick, open }: AgentLauncherButtonProps) {
  if (open) return null;
  return (
    <button
      onClick={onClick}
      className="fixed bottom-20 right-4 z-50 flex items-center gap-2 px-4 py-2.5 bg-teal-600 hover:bg-teal-500 text-white text-sm font-mono shadow-xl transition-colors lg:hidden"
      aria-label="Agent öffnen"
    >
      <Sparkles className="h-4 w-4" />
      Agent
    </button>
  );
}
