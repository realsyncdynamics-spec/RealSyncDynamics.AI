// GovernanceChatSidebar — RealSyncDynamicsAI command workspace
//
// UX model: xAI-style single assistant surface, adapted to the existing
// RealSyncDynamicsAI obsidian/cyan design language. The assistant is the
// primary command surface; product-specific actions are exposed through a
// compact + menu instead of competing primary CTAs.
import React, { useCallback, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  Bot,
  X,
  Plus,
  Clock,
  ChevronDown,
  ChevronUp,
  ChevronRight,
  Send,
  Sparkles,
  Globe2,
  MessageCircle,
  Phone,
  Scan,
  ShieldCheck,
} from 'lucide-react';
import { ChatMessageView } from '../../features/governance/AgentWidget/ChatMessageView';
import { useAgentChat } from '../../features/governance/AgentWidget/useAgentChat';
import { useTenant } from '../../core/access/TenantProvider';

export interface GovernanceChatSidebarProps {
  open: boolean;
  onClose: () => void;
}

const GOVERNANCE_AGENTS = [
  { id: 'dsgvo', label: 'DSGVO Agent' },
  { id: 'ai-act', label: 'AI Act Agent' },
  { id: 'evidence', label: 'Evidence Agent' },
  { id: 'risk', label: 'Risk Agent' },
  { id: 'cookie', label: 'Cookie Agent' },
  { id: 'tracking', label: 'Tracking Agent' },
  { id: 'website', label: 'Website Agent' },
  { id: 'avv', label: 'AVV Agent' },
  { id: 'tom', label: 'TOM Agent' },
  { id: 'vvz', label: 'VVZ Agent' },
  { id: 'incident', label: 'Incident Agent' },
  { id: 'audit', label: 'Audit Agent' },
  { id: 'security-header', label: 'Security Header Agent' },
  { id: 'third-country', label: 'Third Country Transfer Agent' },
  { id: 'consent', label: 'Consent Agent' },
] as const;

const MOCK_CONVERSATIONS = [
  { id: '1', title: 'Meta Pixel Analyse', timestamp: 'Heute 09:14', agent: 'Cookie Agent' },
  { id: '2', title: 'Cookie-Banner TDDDG §25', timestamp: 'Gestern', agent: 'DSGVO Agent' },
  { id: '3', title: 'DSFA Empfehlungsalgorithmus', timestamp: '12.06.', agent: 'Risk Agent' },
  { id: '4', title: 'VVT Aktualisierung Q2', timestamp: '11.06.', agent: 'VVZ Agent' },
  { id: '5', title: 'EU AI Act CV-Screening', timestamp: '10.06.', agent: 'AI Act Agent' },
];

interface ContextEntry {
  label: string;
  quickActions: string[];
}

const CONTEXT_MAP: Record<string, ContextEntry> = {
  '/app/websites': { label: 'Websites', quickActions: ['Website analysieren', 'Neue Website erstellen', 'Cookies prüfen', 'Tracker anzeigen'] },
  '/app/ai-systems': { label: 'KI-Systeme', quickActions: ['Risikoklasse prüfen', 'Pflichten anzeigen', 'Dokumentieren'] },
  '/app/datasets': { label: 'Daten-Governance', quickActions: ['Art-10-Lücken prüfen', 'Bias dokumentieren', 'Datensatz anlegen'] },
  '/app/evidence': { label: 'Evidence Vault', quickActions: ['Snapshot erstellen', 'Lücken anzeigen', 'Export vorbereiten'] },
  '/app/risks': { label: 'Risiken', quickActions: ['Risiken priorisieren', 'Maßnahmen erstellen', 'Triage'] },
  '/app/monitoring': { label: 'Monitoring', quickActions: ['Drift prüfen', 'Events zusammenfassen', 'Alert konfigurieren'] },
  '/app/vendors': { label: 'Vendors', quickActions: ['DPA prüfen', 'Drittland prüfen', 'SCC Nachweis'] },
  '/app/agents': { label: 'Enterprise Skills', quickActions: ['Agent starten', 'Workflow verknüpfen'] },
  '/app/documents': { label: 'Dokumente', quickActions: ['Datenschutzerklärung', 'AVV erstellen', 'TOM', 'VVZ'] },
  '/app/audit': { label: 'Audit Export', quickActions: ['Report erstellen', 'Export starten', 'Behörde'] },
};

function getContext(pathname: string): ContextEntry {
  if (CONTEXT_MAP[pathname]) return CONTEXT_MAP[pathname];
  for (const key of Object.keys(CONTEXT_MAP)) {
    if (pathname.startsWith(key)) return CONTEXT_MAP[key];
  }
  return { label: 'Governance OS', quickActions: ['Neue Website erstellen', 'DSGVO-Status', 'Risiken prüfen', 'Evidence öffnen'] };
}

const COMMAND_ACTIONS = [
  { label: 'Neue Website erstellen', description: 'Bestehende URL analysieren und neue Website generieren', icon: Globe2, to: '/website-builder' },
  { label: 'Website prüfen', description: 'DSGVO, AI Act, Security und SEO analysieren', icon: Scan, to: '/scan/start' },
  { label: 'AI Chatbot erstellen', description: 'Website-Assistent konfigurieren', icon: MessageCircle, to: '/chatbot/start' },
  { label: 'AI Telefonbot erstellen', description: 'Voice Agent konfigurieren', icon: Phone, to: '/phonebot/start' },
] as const;

export function GovernanceChatSidebar({ open, onClose }: GovernanceChatSidebarProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const { activeTenantId } = useTenant();
  const [selectedAgent, setSelectedAgent] = useState<string>('dsgvo');
  const [agentDropdownOpen, setAgentDropdownOpen] = useState(false);
  const [commandMenuOpen, setCommandMenuOpen] = useState(false);
  const [historyCollapsed, setHistoryCollapsed] = useState(true);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [inputValue, setInputValue] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const { messages, isLoading, send, bottomRef } = useAgentChat(activeTenantId ?? null);
  const context = getContext(location.pathname);
  const currentAgent = GOVERNANCE_AGENTS.find((a) => a.id === selectedAgent) ?? GOVERNANCE_AGENTS[0];

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
    if (textareaRef.current) textareaRef.current.style.height = 'auto';
  }, [inputValue, isLoading, send]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleQuickAction = (action: string) => {
    if (action === 'Neue Website erstellen') {
      navigate('/website-builder');
      return;
    }
    if (action === 'Website analysieren') {
      navigate('/scan/start');
      return;
    }
    send(action);
  };

  if (!open) {
    return (
      <div className="hidden lg:flex w-8 shrink-0 flex-col items-center justify-center bg-obsidian-900 border-l border-titanium-900">
        <button onClick={onClose} className="flex flex-col items-center gap-1 py-4 text-titanium-600 hover:text-titanium-200 transition-colors" aria-label="RealSync AI öffnen">
          <ChevronRight className="h-4 w-4" />
          <span className="font-mono text-[9px] uppercase tracking-widest text-titanium-600" style={{ writingMode: 'vertical-rl', textOrientation: 'mixed' }}>AI</span>
        </button>
      </div>
    );
  }

  return (
    <aside className="hidden lg:flex w-[380px] shrink-0 flex-col bg-obsidian-900 border-l border-titanium-900 h-full overflow-hidden">
      <div className="h-12 shrink-0 flex items-center justify-between px-4 border-b border-titanium-900">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-cyan-400" />
          <span className="font-mono text-xs font-semibold tracking-widest text-titanium-100 uppercase">RealSync AI</span>
        </div>
        <div className="flex items-center gap-1">
          <button onClick={() => setCommandMenuOpen((v) => !v)} className="p-1.5 text-titanium-500 hover:text-cyan-400 hover:bg-obsidian-800 transition-colors" aria-label="Werkzeuge öffnen" title="Werkzeuge">
            <Plus className="h-4 w-4" />
          </button>
          <button onClick={() => setActiveConversationId(null)} className="p-1.5 text-titanium-500 hover:text-titanium-200 hover:bg-obsidian-800 transition-colors" aria-label="Neue Konversation" title="Neue Konversation">
            <Bot className="h-4 w-4" />
          </button>
          <button onClick={onClose} className="p-1.5 text-titanium-500 hover:text-titanium-200 hover:bg-obsidian-800 transition-colors" aria-label="Schließen">
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      {commandMenuOpen && (
        <div className="shrink-0 border-b border-titanium-900 bg-obsidian-950 p-2">
          <div className="px-2 py-1 font-mono text-[9px] uppercase tracking-widest text-titanium-600">Create & Run</div>
          <div className="grid gap-1 mt-1">
            {COMMAND_ACTIONS.map(({ label, description, icon: Icon, to }) => (
              <button key={label} onClick={() => navigate(to)} className="flex items-center gap-3 rounded-lg px-2.5 py-2.5 text-left hover:bg-obsidian-800 transition-colors">
                <span className="grid h-8 w-8 shrink-0 place-items-center rounded-md bg-cyan-400/10 border border-cyan-400/20"><Icon className="h-4 w-4 text-cyan-400" /></span>
                <span className="min-w-0"><span className="block text-xs font-medium text-titanium-100">{label}</span><span className="block text-[10px] text-titanium-600 truncate">{description}</span></span>
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="relative shrink-0 border-b border-titanium-900">
        <button onClick={() => setAgentDropdownOpen((v) => !v)} className="w-full h-9 flex items-center justify-between px-4 text-xs text-titanium-200 hover:bg-obsidian-800 transition-colors">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-3.5 w-3.5 text-cyan-400" />
            <span className="font-mono">{currentAgent.label}</span>
            <span className="flex items-center gap-1"><span className="h-1.5 w-1.5 bg-teal-400 block" /><span className="font-mono text-[10px] text-teal-400">EU-lokal</span></span>
          </div>
          <ChevronDown className="h-3.5 w-3.5 text-titanium-500" />
        </button>
        {agentDropdownOpen && (
          <div className="absolute top-full left-0 right-0 z-50 bg-obsidian-950 border border-titanium-900 shadow-xl max-h-64 overflow-y-auto">
            {GOVERNANCE_AGENTS.map((agent) => (
              <button key={agent.id} onClick={() => { setSelectedAgent(agent.id); setAgentDropdownOpen(false); }} className={`w-full flex items-center gap-2 px-4 py-2 text-xs text-left transition-colors hover:bg-obsidian-800 ${agent.id === selectedAgent ? 'text-teal-400 bg-obsidian-800' : 'text-titanium-200'}`}>
                <Bot className="h-3 w-3 shrink-0 text-titanium-500" /><span className="font-mono">{agent.label}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="shrink-0 border-b border-titanium-900">
        <div className="flex items-center justify-between px-4 py-2">
          <span className="font-mono text-[9px] uppercase tracking-widest text-titanium-600">Verlauf</span>
          <button onClick={() => setHistoryCollapsed((v) => !v)} className="text-titanium-600 hover:text-titanium-300 transition-colors" aria-label={historyCollapsed ? 'Verlauf öffnen' : 'Verlauf schließen'}>
            {historyCollapsed ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronUp className="h-3.5 w-3.5" />}
          </button>
        </div>
        {!historyCollapsed && (
          <div>
            {MOCK_CONVERSATIONS.map((conv) => (
              <button key={conv.id} onClick={() => setActiveConversationId(conv.id)} className={`w-full flex items-start gap-3 px-4 py-2 text-left transition-colors hover:bg-obsidian-800 ${activeConversationId === conv.id ? 'bg-obsidian-800 border-l-2 border-teal-400' : ''}`}>
                <Clock className="h-3.5 w-3.5 text-titanium-600 shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0"><div className="flex items-center justify-between gap-2"><span className="text-xs text-titanium-100 truncate font-medium">{conv.title}</span><span className="font-mono text-[9px] text-titanium-600 shrink-0">{conv.timestamp}</span></div><span className="font-mono text-[10px] text-titanium-500 truncate block">{conv.agent}</span></div>
              </button>
            ))}
            <button onClick={() => setActiveConversationId(null)} className="w-full flex items-center gap-2 px-4 py-2.5 text-xs text-cyan-400 hover:bg-obsidian-800 transition-colors border-t border-titanium-900"><Plus className="h-3.5 w-3.5" /><span className="font-mono">Neue Konversation</span></button>
          </div>
        )}
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4 min-h-0">
        {messages.map((msg) => <ChatMessageView key={msg.id} message={msg} />)}
        {isLoading && (
          <div className="flex items-start gap-2">
            <div className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center bg-teal-600 text-[10px] font-bold text-white font-mono">RS</div>
            <div className="border border-white/10 bg-white/5 px-3 py-2"><div className="flex h-4 items-center gap-1">{[0, 1, 2].map((i) => <span key={i} className="h-1.5 w-1.5 animate-bounce bg-teal-400" style={{ animationDelay: `${i * 150}ms` }} />)}</div></div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      <div className="shrink-0 border-t border-titanium-900 px-4 py-2.5 bg-obsidian-950">
        <div className="flex items-center gap-2 mb-2">
          <span className="font-mono text-[9px] uppercase tracking-widest text-titanium-600">Kontext</span>
          <span className="bg-obsidian-800 border border-titanium-800 px-2 py-0.5 text-[10px] font-mono text-cyan-400">{context.label}</span>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {context.quickActions.map((action) => (
            <button key={action} onClick={() => handleQuickAction(action)} className="px-2.5 py-1 text-[10px] font-mono text-titanium-300 bg-obsidian-800 border border-titanium-800 hover:border-teal-700 hover:text-teal-400 transition-colors">{action}</button>
          ))}
        </div>
      </div>

      <div className="shrink-0 border-t border-titanium-900 px-4 pt-3 pb-3 bg-obsidian-950">
        <div className="rounded-2xl border border-titanium-800 bg-obsidian-900 focus-within:border-cyan-500/60 focus-within:ring-1 focus-within:ring-cyan-500/20 transition-colors overflow-hidden">
          <textarea ref={textareaRef} value={inputValue} onChange={handleInputChange} onKeyDown={handleKeyDown} placeholder="Was möchtest du erstellen, prüfen oder automatisieren?" rows={2} className="w-full min-h-[54px] max-h-[120px] resize-none bg-transparent px-3.5 pt-3 text-sm text-titanium-100 placeholder-titanium-600 outline-none font-mono" />
          <div className="flex items-center justify-between px-2 pb-2">
            <button onClick={() => setCommandMenuOpen((v) => !v)} className="grid h-8 w-8 place-items-center rounded-full text-titanium-500 hover:text-cyan-400 hover:bg-obsidian-800 transition-colors" aria-label="Tools hinzufügen" title="Tools"><Plus className="h-4 w-4" /></button>
            <div className="flex items-center gap-1.5"><span className="font-mono text-[9px] text-titanium-600">EU-lokal · Governance aktiv</span><button onClick={handleSend} disabled={!inputValue.trim() || isLoading} className="grid h-8 w-8 place-items-center rounded-full bg-cyan-400 text-[rgb(3,7,18)] hover:bg-cyan-300 disabled:opacity-30 disabled:cursor-not-allowed transition-colors" aria-label="Senden"><Send className="h-3.5 w-3.5" /></button></div>
          </div>
        </div>
        <p className="mt-1.5 text-center font-mono text-[9px] text-titanium-600">↵ senden · keine Rechtsberatung</p>
      </div>
    </aside>
  );
}
