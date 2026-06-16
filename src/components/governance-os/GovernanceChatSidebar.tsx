// GovernanceChatSidebar — Claude.ai-style Governance Agent Sidebar
//
// Layout: Header → AgentSelector → Conversations (collapsible) → Chat → ContextBar → Input
// Width: 380px (open) | 32px collapsed strip (closed)
import React, { useCallback, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import {
  Bot,
  X,
  Plus,
  Clock,
  ChevronDown,
  ChevronUp,
  ChevronRight,
  Send,
} from 'lucide-react';
import { ChatMessageView } from '../../features/governance/AgentWidget/ChatMessageView';
import { useAgentChat } from '../../features/governance/AgentWidget/useAgentChat';
import { useTenant } from '../../core/access/TenantProvider';

export interface GovernanceChatSidebarProps {
  open: boolean;
  onClose: () => void;
}

// ── 15 Governance-Agenten ──────────────────────────────────────────────────
const GOVERNANCE_AGENTS = [
  { id: 'dsgvo',          label: 'DSGVO Agent' },
  { id: 'ai-act',         label: 'AI Act Agent' },
  { id: 'evidence',       label: 'Evidence Agent' },
  { id: 'risk',           label: 'Risk Agent' },
  { id: 'cookie',         label: 'Cookie Agent' },
  { id: 'tracking',       label: 'Tracking Agent' },
  { id: 'website',        label: 'Website Agent' },
  { id: 'avv',            label: 'AVV Agent' },
  { id: 'tom',            label: 'TOM Agent' },
  { id: 'vvz',            label: 'VVZ Agent' },
  { id: 'incident',       label: 'Incident Agent' },
  { id: 'audit',          label: 'Audit Agent' },
  { id: 'security-header', label: 'Security Header Agent' },
  { id: 'third-country',  label: 'Third Country Transfer Agent' },
  { id: 'consent',        label: 'Consent Agent' },
] as const;

// ── Mock-Konversationsverlauf ──────────────────────────────────────────────
const MOCK_CONVERSATIONS = [
  { id: '1', title: 'Meta Pixel Analyse',        preview: 'Scan abgeschlossen, 2 Verstöße erkannt',  timestamp: 'Heute 09:14', agent: 'Cookie Agent' },
  { id: '2', title: 'Cookie-Banner TTDSG §25',   preview: 'Granulare Kategorien fehlen',             timestamp: 'Gestern',     agent: 'DSGVO Agent' },
  { id: '3', title: 'DSFA Empfehlungsalgorithmus', preview: 'Fragebogen zu 60% ausgefüllt',           timestamp: '12.06.',      agent: 'Risk Agent' },
  { id: '4', title: 'VVT Aktualisierung Q2',     preview: 'Sub-Prozessoren-Liste exportiert',        timestamp: '11.06.',      agent: 'VVZ Agent' },
  { id: '5', title: 'EU AI Act CV-Screening',    preview: 'Hochrisiko-Klassifizierung bestätigt',    timestamp: '10.06.',      agent: 'AI Act Agent' },
];

// ── Kontext-Mapping nach Route ─────────────────────────────────────────────
interface ContextEntry {
  label: string;
  quickActions: string[];
}

const CONTEXT_MAP: Record<string, ContextEntry> = {
  '/app/websites':   { label: 'Websites',         quickActions: ['Scan starten', 'Cookies prüfen', 'Tracker anzeigen', 'Bericht'] },
  '/app/ai-systems': { label: 'KI-Systeme',       quickActions: ['Risikoklasse prüfen', 'Pflichten anzeigen', 'Dokumentieren'] },
  '/app/evidence':   { label: 'Evidence Vault',   quickActions: ['Snapshot erstellen', 'Lücken anzeigen', 'Export vorbereiten'] },
  '/app/risks':      { label: 'Risiken',          quickActions: ['Risiken priorisieren', 'Maßnahmen erstellen', 'Triage'] },
  '/app/monitoring': { label: 'Monitoring',       quickActions: ['Drift prüfen', 'Events zusammenfassen', 'Alert konfigurieren'] },
  '/app/vendors':    { label: 'Vendors',          quickActions: ['DPA prüfen', 'Drittland prüfen', 'SCC Nachweis'] },
  '/app/agents':     { label: 'Enterprise Skills', quickActions: ['Agent starten', 'Workflow verknüpfen'] },
  '/app/documents':  { label: 'Dokumente',        quickActions: ['Datenschutzerklärung', 'AVV erstellen', 'TOM', 'VVZ'] },
  '/app/audit':      { label: 'Audit Export',     quickActions: ['Report erstellen', 'Export starten', 'Behörde'] },
};

function getContext(pathname: string): ContextEntry {
  // Exakter Match
  if (CONTEXT_MAP[pathname]) return CONTEXT_MAP[pathname];
  // Präfix-Match
  for (const key of Object.keys(CONTEXT_MAP)) {
    if (pathname.startsWith(key)) return CONTEXT_MAP[key];
  }
  return { label: 'Governance OS', quickActions: ['DSGVO-Status', 'Risiken prüfen', 'Evidence öffnen'] };
}

// ── Hauptkomponente ────────────────────────────────────────────────────────
export function GovernanceChatSidebar({ open, onClose }: GovernanceChatSidebarProps) {
  const location = useLocation();
  const { activeTenantId } = useTenant();

  const [selectedAgent, setSelectedAgent] = useState<string>('dsgvo');
  const [agentDropdownOpen, setAgentDropdownOpen] = useState(false);
  const [historyCollapsed, setHistoryCollapsed] = useState(false);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [inputValue, setInputValue] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const { messages, isLoading, send, bottomRef } = useAgentChat(activeTenantId ?? null);

  const context = getContext(location.pathname);
  const currentAgent = GOVERNANCE_AGENTS.find((a) => a.id === selectedAgent) ?? GOVERNANCE_AGENTS[0];

  // Auto-resize textarea
  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInputValue(e.target.value);
    const ta = e.target;
    ta.style.height = 'auto';
    ta.style.height = Math.min(ta.scrollHeight, 120) + 'px';
  };

  const handleSend = useCallback(() => {
    const text = inputValue.trim();
    if (!text || isLoading) return;
    send(text);
    setInputValue('');
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  }, [inputValue, isLoading, send]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleQuickAction = (action: string) => {
    send(action);
  };

  // ── Collapsed strip ──────────────────────────────────────────────────────
  if (!open) {
    return (
      <div className="hidden lg:flex w-8 shrink-0 flex-col items-center justify-center bg-obsidian-900 border-l border-titanium-900">
        <button
          onClick={onClose}
          className="flex flex-col items-center gap-1 py-4 text-titanium-600 hover:text-titanium-200 transition-colors"
          aria-label="Governance Agent öffnen"
        >
          <ChevronRight className="h-4 w-4" />
          <span
            className="font-mono text-[9px] uppercase tracking-widest text-titanium-600"
            style={{ writingMode: 'vertical-rl', textOrientation: 'mixed' }}
          >
            AGENT
          </span>
        </button>
      </div>
    );
  }

  // ── Open sidebar ─────────────────────────────────────────────────────────
  return (
    <aside className="hidden lg:flex w-[380px] shrink-0 flex-col bg-obsidian-900 border-l border-titanium-900 h-full overflow-hidden">

      {/* ── Header ────────────────────────────────────────────────────────── */}
      <div className="h-12 shrink-0 flex items-center justify-between px-4 border-b border-titanium-900">
        <div className="flex items-center gap-2">
          <Bot className="h-4 w-4 text-teal-400" />
          <span className="font-mono text-xs font-semibold tracking-widest text-titanium-100 uppercase">
            Governance Agent
          </span>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => { /* neue Konversation */ }}
            className="p-1.5 text-titanium-600 hover:text-titanium-200 hover:bg-obsidian-800 transition-colors"
            aria-label="Neue Konversation"
            title="Neue Konversation"
          >
            <Plus className="h-4 w-4" />
          </button>
          <button
            onClick={onClose}
            className="p-1.5 text-titanium-600 hover:text-titanium-200 hover:bg-obsidian-800 transition-colors"
            aria-label="Schließen"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* ── Agent-Selector ────────────────────────────────────────────────── */}
      <div className="relative shrink-0 border-b border-titanium-900">
        <button
          onClick={() => setAgentDropdownOpen((v) => !v)}
          className="w-full h-9 flex items-center justify-between px-4 text-xs text-titanium-200 hover:bg-obsidian-800 transition-colors"
        >
          <div className="flex items-center gap-2">
            <ChevronDown className="h-3.5 w-3.5 text-titanium-500" />
            <span className="font-mono">{currentAgent.label}</span>
            <span className="flex items-center gap-1">
              <span className="h-1.5 w-1.5 bg-teal-400 block" />
              <span className="font-mono text-[10px] text-teal-400">EU-lokal</span>
            </span>
          </div>
        </button>

        {agentDropdownOpen && (
          <div className="absolute top-full left-0 right-0 z-50 bg-obsidian-950 border border-titanium-900 shadow-xl max-h-64 overflow-y-auto">
            {GOVERNANCE_AGENTS.map((agent) => (
              <button
                key={agent.id}
                onClick={() => {
                  setSelectedAgent(agent.id);
                  setAgentDropdownOpen(false);
                }}
                className={`w-full flex items-center gap-2 px-4 py-2 text-xs text-left transition-colors hover:bg-obsidian-800 ${
                  agent.id === selectedAgent
                    ? 'text-teal-400 bg-obsidian-800'
                    : 'text-titanium-200'
                }`}
              >
                <Bot className="h-3 w-3 shrink-0 text-titanium-500" />
                <span className="font-mono">{agent.label}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* ── Konversationsverlauf ──────────────────────────────────────────── */}
      <div className="shrink-0 border-b border-titanium-900">
        {/* Verlauf-Header */}
        <div className="flex items-center justify-between px-4 py-2">
          <span className="font-mono text-[9px] uppercase tracking-widest text-titanium-600">
            Konversationen
          </span>
          <button
            onClick={() => setHistoryCollapsed((v) => !v)}
            className="text-titanium-600 hover:text-titanium-300 transition-colors"
            aria-label={historyCollapsed ? 'Aufklappen' : 'Einklappen'}
          >
            {historyCollapsed ? (
              <ChevronDown className="h-3.5 w-3.5" />
            ) : (
              <ChevronUp className="h-3.5 w-3.5" />
            )}
          </button>
        </div>

        {!historyCollapsed && (
          <div>
            {MOCK_CONVERSATIONS.map((conv) => (
              <button
                key={conv.id}
                onClick={() => setActiveConversationId(conv.id)}
                className={`w-full flex items-start gap-3 px-4 py-2 text-left transition-colors hover:bg-obsidian-800 ${
                  activeConversationId === conv.id ? 'bg-obsidian-800 border-l-2 border-teal-400' : ''
                }`}
              >
                <Clock className="h-3.5 w-3.5 text-titanium-600 shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs text-titanium-100 truncate font-medium">{conv.title}</span>
                    <span className="font-mono text-[9px] text-titanium-600 shrink-0">{conv.timestamp}</span>
                  </div>
                  <span className="font-mono text-[10px] text-titanium-500 truncate block">{conv.agent}</span>
                </div>
              </button>
            ))}
            {/* Neue Konversation */}
            <button
              onClick={() => setActiveConversationId(null)}
              className="w-full flex items-center gap-2 px-4 py-2.5 text-xs text-teal-400 hover:bg-obsidian-800 transition-colors border-t border-titanium-900"
            >
              <Plus className="h-3.5 w-3.5" />
              <span className="font-mono">Neue Konversation</span>
            </button>
          </div>
        )}
      </div>

      {/* ── Chat-Thread ───────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4 min-h-0">
        {messages.map((msg) => (
          <ChatMessageView key={msg.id} message={msg} />
        ))}

        {/* Typing Indicator */}
        {isLoading && (
          <div className="flex items-start gap-2">
            <div className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center bg-teal-600 text-[10px] font-bold text-white font-mono">
              RS
            </div>
            <div className="border border-white/10 bg-white/5 px-3 py-2">
              <div className="flex h-4 items-center gap-1">
                {[0, 1, 2].map((i) => (
                  <span
                    key={i}
                    className="h-1.5 w-1.5 animate-bounce bg-teal-400"
                    style={{ animationDelay: `${i * 150}ms` }}
                  />
                ))}
              </div>
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* ── Kontext-Bar ───────────────────────────────────────────────────── */}
      <div className="shrink-0 border-t border-titanium-900 px-4 py-2.5 bg-obsidian-950">
        {/* Aktuelles Modul */}
        <div className="flex items-center gap-2 mb-2">
          <span className="font-mono text-[9px] uppercase tracking-widest text-titanium-600">Kontext:</span>
          <span className="flex items-center gap-1 bg-obsidian-800 border border-titanium-800 px-2 py-0.5 text-[10px] font-mono text-teal-400">
            {context.label}
            <X className="h-2.5 w-2.5 ml-1 text-titanium-600 cursor-pointer hover:text-titanium-300" />
          </span>
        </div>
        {/* Quick Actions */}
        <div className="flex flex-wrap gap-1.5">
          {context.quickActions.map((action) => (
            <button
              key={action}
              onClick={() => handleQuickAction(action)}
              className="px-2.5 py-1 text-[10px] font-mono text-titanium-300 bg-obsidian-800 border border-titanium-800 hover:border-teal-700 hover:text-teal-400 transition-colors"
            >
              {action}
            </button>
          ))}
        </div>
      </div>

      {/* ── Eingabe-Bereich ───────────────────────────────────────────────── */}
      <div className="shrink-0 border-t border-titanium-900 px-4 pt-3 pb-3 bg-obsidian-950">
        <div className="flex items-end gap-2 border border-titanium-800 bg-obsidian-900 focus-within:border-teal-700 transition-colors">
          <textarea
            ref={textareaRef}
            value={inputValue}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            placeholder="Frage an den Agenten …"
            rows={1}
            className="flex-1 min-h-[36px] max-h-[120px] resize-none bg-transparent px-3 py-2.5 text-sm text-titanium-100 placeholder-titanium-600 outline-none font-mono"
          />
          <button
            onClick={handleSend}
            disabled={!inputValue.trim() || isLoading}
            className="shrink-0 m-1.5 flex h-7 w-7 items-center justify-center bg-teal-600 text-white hover:bg-teal-500 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            aria-label="Senden"
          >
            <Send className="h-3.5 w-3.5" />
          </button>
        </div>
        <p className="mt-1.5 font-mono text-[9px] text-titanium-600">
          ↵ senden · EU-lokal · keine Rechtsberatung
        </p>
      </div>
    </aside>
  );
}
