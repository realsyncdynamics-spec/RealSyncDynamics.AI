import { Link } from 'react-router-dom';
import type { LucideIcon } from 'lucide-react';

export type AgentStatus = 'live' | 'beta' | 'coming-soon';

const STATUS_LABEL: Record<AgentStatus, string> = {
  live: 'Live',
  beta: 'Beta',
  'coming-soon': 'Bald verfügbar',
};

const STATUS_CLASS: Record<AgentStatus, string> = {
  live: 'text-cyan-400 border-cyan-400',
  beta: 'text-amber-400 border-amber-400',
  'coming-soon': 'text-titanium-500 border-titanium-700',
};

interface AgentCardProps {
  icon: LucideIcon;
  name: string;
  description: string;
  status: AgentStatus;
  to: string;
}

export function AgentCard({ icon: Icon, name, description, status, to }: AgentCardProps) {
  return (
    <div className="flex flex-col gap-3 bg-obsidian-900 border border-titanium-900 p-4">
      <div className="flex items-start justify-between">
        <div className="flex items-center justify-center h-9 w-9 border border-titanium-800 bg-obsidian-950 text-cyan-400">
          <Icon className="h-4.5 w-4.5" />
        </div>
        <span className={`font-mono text-[10px] uppercase tracking-widest px-2 py-1 border ${STATUS_CLASS[status]}`}>
          {STATUS_LABEL[status]}
        </span>
      </div>

      <div>
        <h3 className="text-sm font-semibold text-titanium-50">{name}</h3>
        <p className="mt-1 text-xs text-titanium-400 leading-relaxed">{description}</p>
      </div>

      <Link
        to={to}
        className="mt-auto inline-flex items-center justify-center px-3 py-1.5 border border-titanium-800 text-xs font-medium text-titanium-200 hover:bg-obsidian-800 hover:text-titanium-50 transition-colors"
      >
        Öffnen
      </Link>
    </div>
  );
}
