import { useLocation } from 'react-router-dom';
import { X, Sparkles, Bot, ChevronRight } from 'lucide-react';
import { lazy, Suspense } from 'react';

const AgentWidget = lazy(() =>
  import('../../features/governance/AgentWidget/AgentWidget').then((m) => ({ default: m.AgentWidget }))
);

const CONTEXT_MAP: Record<string, { title: string; hint: string }> = {
  '/app/websites':    { title: 'Website-Assistent',    hint: 'Scan-Ergebnisse erklären, kritische Findings priorisieren, Report vorbereiten.' },
  '/app/ai-systems':  { title: 'KI-Risiko-Assistent',  hint: 'EU-AI-Act-Risiko prüfen, High-Risk-Indikatoren bewerten, Dokumentationspflichten anzeigen.' },
  '/app/evidence':    { title: 'Evidence-Assistent',   hint: 'Evidence Timeline anzeigen, Snapshots erklären, Lücken im Nachweis-Pfad identifizieren, Export vorbereiten.' },
  '/app/agents':      { title: 'Agenten-Assistent',    hint: 'Agent starten, Skill konfigurieren, Laufzeit prüfen, Ergebnisse zusammenfassen.' },
  '/app/documents':   { title: 'Dokument-Assistent',   hint: 'Datenschutzerklärung erstellen, AVV generieren, TOM-Status prüfen, DSFA vorbereiten.' },
  '/app/audit':       { title: 'Audit-Assistent',      hint: 'Audit-Bundle erstellen, Behörden-Export vorbereiten, Report signieren, Wirtschaftsprüfer briefen.' },
  '/app/risks':       { title: 'Risiko-Assistent',      hint: 'Risiken priorisieren, Maßnahmenplan erstellen.' },
  '/app/monitoring':  { title: 'Monitoring-Assistent',  hint: 'Drift bewerten, neue Events zusammenfassen.' },
  '/app/vendors':     { title: 'Vendor-Assistent',      hint: 'Fehlende DPAs anzeigen, Drittlandtransfer prüfen, SCC-Pflichten erklären.' },
  '/app/reports':     { title: 'Report-Assistent',      hint: 'Management Summary erstellen, Audit Report vorbereiten.' },
};

interface GovernanceAssistantPanelProps {
  open: boolean;
  onClose: () => void;
}

export function GovernanceAssistantPanel({ open, onClose }: GovernanceAssistantPanelProps) {
  const { pathname } = useLocation();

  // Kontext aus aktuellem Modul ableiten
  const ctx = Object.entries(CONTEXT_MAP).find(([route]) => pathname.startsWith(route))?.[1] ?? {
    title: 'Governance Assistent',
    hint: 'Kontextbezogene Hilfe für das aktuelle Modul.',
  };

  if (!open) {
    return (
      <button
        onClick={() => onClose()} // wird von Shell als toggle behandelt
        className="hidden lg:flex flex-col items-center justify-center w-8 shrink-0 bg-obsidian-900 border-l border-titanium-900 text-titanium-600 hover:text-titanium-200 hover:bg-obsidian-800 transition-colors gap-1.5"
        aria-label="Assistent öffnen"
      >
        <Sparkles className="h-4 w-4" />
        <span
          className="font-mono text-[8px] uppercase tracking-widest"
          style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)' }}
        >
          Assistent
        </span>
        <ChevronRight className="h-3 w-3" />
      </button>
    );
  }

  return (
    <aside className="w-80 shrink-0 flex flex-col bg-obsidian-900 border-l border-titanium-900 overflow-hidden">
      {/* Header */}
      <div className="h-10 shrink-0 flex items-center justify-between px-3 border-b border-titanium-900">
        <div className="flex items-center gap-2">
          <Bot className="h-3.5 w-3.5 text-cyan-400" />
          <span className="text-xs font-semibold text-titanium-100">{ctx.title}</span>
        </div>
        <button onClick={onClose} className="text-titanium-600 hover:text-titanium-200">
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Kontext-Hint */}
      <div className="px-3 py-2 border-b border-titanium-900 bg-obsidian-950">
        <p className="text-[10px] text-titanium-500 leading-relaxed">{ctx.hint}</p>
      </div>

      {/* Agent Widget */}
      <div className="flex-1 overflow-hidden">
        <Suspense fallback={
          <div className="flex items-center justify-center h-full">
            <Sparkles className="h-5 w-5 text-titanium-700 animate-pulse" />
          </div>
        }>
          <AgentWidget mode="tenant" />
        </Suspense>
      </div>
    </aside>
  );
}
