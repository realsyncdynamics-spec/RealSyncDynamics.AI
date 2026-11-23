import type { MouseEvent } from 'react';
import { Link } from 'react-router-dom';
import { Sparkles } from 'lucide-react';
import { ASSISTANT_FALLBACK_HREF, openAssistant } from '../features/assistant/openAssistant';

// „KI fragen“-Pill (Hostinger-Pattern Phase 1). Öffnet den vorhandenen
// öffentlichen Assistenten (AssistentChip → AgentWidget mode="anon").
// Ohne JavaScript oder ohne montierten Assistenten führt der Link auf den
// Website-Check — kein toter Klick.

interface AskAiPillProps {
  className?: string;
  /** Optional: z. B. Menü schließen, nachdem die Pill geklickt wurde. */
  onActivate?: () => void;
}

export function AskAiPill({ className = '', onActivate }: AskAiPillProps) {
  const handleClick = (e: MouseEvent<HTMLAnchorElement>) => {
    onActivate?.();
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
    if (openAssistant()) e.preventDefault();
  };

  return (
    <Link
      to={ASSISTANT_FALLBACK_HREF}
      onClick={handleClick}
      aria-haspopup="dialog"
      data-testid="ask-ai-pill"
      className={className}
    >
      <Sparkles aria-hidden="true" className="h-4 w-4 shrink-0" />
      <span>KI fragen</span>
    </Link>
  );
}
