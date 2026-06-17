// AgentSidebar.tsx — Rechter Agent-Panel mit Kontext-Bewusstsein und Befehlsparser
import React, { useCallback, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bot, X, Plus, ChevronRight, Send, MapPin } from 'lucide-react';
import { ChatMessageView } from '../governance/AgentWidget/ChatMessageView';
import { useAgentChat } from '../governance/AgentWidget/useAgentChat';
import { useTenant } from '../../core/access/TenantProvider';
import { useAgentContext } from './useAgentContext';
import { parseAgentCommand } from './agentCommandParser';
import type { NavigateAction, ScrollAction } from './agentActions';

export interface AgentSidebarProps {
  open: boolean;
  onClose: () => void;
}

export function AgentSidebar({ open, onClose }: AgentSidebarProps) {
  const navigate = useNavigate();
  const { activeTenantId } = useTenant();
  const ctx = useAgentContext();
  const [inputValue, setInputValue] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const { messages, isLoading, send, bottomRef } = useAgentChat(activeTenantId ?? null);

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInputValue(e.target.value);
    const ta = e.target;
    ta.style.height = 'auto';
    ta.style.height = Math.min(ta.scrollHeight, 120) + 'px';
  };

  const handleSend = useCallback(() => {
    const text = inputValue.trim();
    if (!text || isLoading) return;

    const parsed = parseAgentCommand(text);
    if (parsed && parsed.confidence !== 'low') {
      const { action } = parsed;
      if (action.type === 'navigate') {
        navigate((action as NavigateAction).payload.route);
        setInputValue('');
        return;
      }
      if (action.type === 'scroll') {
        const dir = (action as ScrollAction).payload.direction;
        if (dir === 'top')    window.scrollTo({ top: 0, behavior: 'smooth' });
        else if (dir === 'bottom') window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
        else if (dir === 'up')    window.scrollBy({ top: -300, behavior: 'smooth' });
        else if (dir === 'down')  window.scrollBy({ top: 300, behavior: 'smooth' });
        setInputValue('');
        return;
      }
    }

    send(text);
    setInputValue('');
    if (textareaRef.current) textareaRef.current.style.height = 'auto';
  }, [inputValue, isLoading, navigate, send]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  if (!open) {
    return (
      <div className="hidden lg:flex w-8 shrink-0 flex-col items-center justify-center bg-obsidian-900 border-l border-titanium-900">
        <button
          onClick={onClose}
          className="flex flex-col items-center gap-1 py-4 text-titanium-600 hover:text-titanium-200 transition-colors"
          aria-label="Agent öffnen"
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

  return (
    <aside className="hidden lg:flex w-[360px] shrink-0 flex-col bg-obsidian-900 border-l border-titanium-900 h-full overflow-hidden">
      {/* Header */}
      <div className="h-12 shrink-0 flex items-center justify-between px-4 border-b border-titanium-900">
        <div className="flex items-center gap-2">
          <Bot className="h-4 w-4 text-teal-400" />
          <span className="font-mono text-xs font-semibold tracking-widest text-titanium-100 uppercase">
            Governance Agent
          </span>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => {}}
            className="p-1.5 text-titanium-600 hover:text-titanium-200 hover:bg-obsidian-800 transition-colors"
            title="Neue Konversation"
          >
            <Plus className="h-4 w-4" />
          </button>
          <button
            onClick={onClose}
            className="p-1.5 text-titanium-600 hover:text-titanium-200 hover:bg-obsidian-800 transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Context bar */}
      <div className="shrink-0 flex items-center gap-2 px-4 py-2 border-b border-titanium-900 bg-obsidian-950">
        <MapPin className="h-3 w-3 text-titanium-600 shrink-0" />
        <span className="font-mono text-[10px] text-titanium-500 truncate">{ctx.moduleName}</span>
        {ctx.tenantName && (
          <span className="ml-auto font-mono text-[10px] text-titanium-600 truncate shrink-0">
            {ctx.tenantName}
          </span>
        )}
      </div>

      {/* Chat thread */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4 min-h-0">
        {messages.map((msg) => (
          <ChatMessageView key={msg.id} message={msg} />
        ))}
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

      {/* Input */}
      <div className="shrink-0 border-t border-titanium-900 px-4 pt-3 pb-3 bg-obsidian-950">
        <div className="flex items-end gap-2 border border-titanium-800 bg-obsidian-900 focus-within:border-teal-700 transition-colors">
          <textarea
            ref={textareaRef}
            value={inputValue}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            placeholder='Frage oder Befehl… z.B. „öffne DSGVO"'
            rows={1}
            className="flex-1 min-h-[36px] max-h-[120px] resize-none bg-transparent px-3 py-2.5 text-sm text-titanium-100 placeholder-titanium-600 outline-none font-mono"
          />
          <button
            onClick={handleSend}
            disabled={!inputValue.trim() || isLoading}
            className="shrink-0 m-1.5 flex h-7 w-7 items-center justify-center bg-teal-600 text-white hover:bg-teal-500 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            <Send className="h-3.5 w-3.5" />
          </button>
        </div>
        <p className="mt-1.5 font-mono text-[9px] text-titanium-600">
          ↵ senden · Befehle: „öffne DSGVO", „scroll oben" · EU-lokal
        </p>
      </div>
    </aside>
  );
}
