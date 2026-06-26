import { useState } from 'react';

type SuggestionSeverity = 'critical' | 'high' | 'medium' | 'low' | 'info';
type SuggestionStatus = 'new' | 'accepted' | 'rejected';

interface AutomationSuggestion {
  id: string;
  title: string;
  description: string | null;
  priority: string | null;
  status: SuggestionStatus;
}

interface AutomationSuggestionCardProps {
  suggestion: AutomationSuggestion;
}

const SEVERITY_DOT: Record<SuggestionSeverity, string> = {
  critical: 'bg-rose-500',
  high: 'bg-amber-500',
  medium: 'bg-yellow-500',
  low: 'bg-green-500',
  info: 'bg-titanium-500',
};

const STATUS_CLASS: Record<SuggestionStatus, string> = {
  new: 'border-titanium-700 text-titanium-400',
  accepted: 'border-security-blue-700 text-blue-400',
  rejected: 'border-rose-900 text-rose-400',
};

const STATUS_LABEL: Record<SuggestionStatus, string> = {
  new: 'Neu',
  accepted: 'Angenommen',
  rejected: 'Abgelehnt',
};

function priorityToSeverity(priority: string | null): SuggestionSeverity {
  switch (priority) {
    case 'critical': return 'critical';
    case 'high': return 'high';
    case 'medium': return 'medium';
    case 'low': return 'low';
    default: return 'info';
  }
}

export function AutomationSuggestionCard({ suggestion }: AutomationSuggestionCardProps) {
  const [localStatus, setLocalStatus] = useState<SuggestionStatus>(suggestion.status);

  const severity = priorityToSeverity(suggestion.priority);
  const dotClass = SEVERITY_DOT[severity];
  const statusClass = STATUS_CLASS[localStatus];
  const statusLabel = STATUS_LABEL[localStatus];

  return (
    <div className="border border-titanium-800 bg-obsidian-950 p-4 flex flex-col gap-3">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-2">
          <span className={`mt-1 h-2 w-2 shrink-0 ${dotClass}`} />
          <h3 className="text-sm font-semibold text-titanium-50 leading-snug">{suggestion.title}</h3>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          {suggestion.priority && (
            <span className="font-mono text-[10px] uppercase tracking-widest px-2 py-0.5 border border-titanium-800 text-titanium-400">
              {suggestion.priority}
            </span>
          )}
          <span className={`font-mono text-[10px] uppercase tracking-widest px-2 py-0.5 border ${statusClass}`}>
            {statusLabel}
          </span>
        </div>
      </div>

      {suggestion.description && (
        <p className="text-sm text-titanium-400 leading-relaxed">{suggestion.description}</p>
      )}

      {localStatus === 'new' && (
        <div className="flex gap-2 mt-1">
          <button
            type="button"
            onClick={() => setLocalStatus('accepted')}
            className="px-3 py-1.5 text-xs font-medium border border-blue-700 text-blue-400 hover:bg-blue-950 transition-colors"
          >
            Annehmen
          </button>
          <button
            type="button"
            onClick={() => setLocalStatus('rejected')}
            className="px-3 py-1.5 text-xs font-medium border border-titanium-800 text-titanium-400 hover:bg-obsidian-900 transition-colors"
          >
            Ablehnen
          </button>
        </div>
      )}

      {localStatus !== 'new' && (
        <div className="flex gap-2 mt-1">
          <button
            type="button"
            onClick={() => setLocalStatus('new')}
            className="px-3 py-1.5 text-xs font-medium border border-titanium-800 text-titanium-500 hover:bg-obsidian-900 transition-colors"
          >
            Zurücksetzen
          </button>
        </div>
      )}
    </div>
  );
}
