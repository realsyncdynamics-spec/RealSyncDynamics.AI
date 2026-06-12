import React, { useState } from 'react';
import { Bot, Send, Sparkles, X } from 'lucide-react';
import { Button } from './Button';

export interface AgentMessage {
  id: string;
  role: 'agent' | 'user';
  text: string;
  timestamp: string;
}

const SUGGESTIONS = [
  'Fasse die kritischen Risiken zusammen',
  'Welche Nachweise fehlen für Art. 30 DSGVO?',
  'Erstelle einen Compliance-Report für Q2',
];

interface AgentChatPanelProps {
  open: boolean;
  onClose: () => void;
  messages: AgentMessage[];
}

export function AgentChatPanel({ open, onClose, messages }: AgentChatPanelProps) {
  const [draft, setDraft] = useState('');

  return (
    <aside
      className={`fixed inset-y-0 right-0 z-40 flex w-full max-w-sm flex-col border-l border-titanium-800 bg-obsidian-900 shadow-2xl transition-transform duration-200 ${
        open ? 'translate-x-0' : 'translate-x-full'
      }`}
      aria-hidden={!open}
    >
      <div className="flex items-center justify-between border-b border-titanium-800 px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="flex h-7 w-7 items-center justify-center border border-security-500/40 bg-security-500/10 text-security-400">
            <Bot className="h-4 w-4" />
          </span>
          <div>
            <p className="font-display text-sm font-semibold text-titanium-50">Compliance Agent</p>
            <p className="font-mono text-[10px] uppercase tracking-wider text-risk-passed">Online · EU-lokal</p>
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="flex h-8 w-8 items-center justify-center text-titanium-500 transition-colors hover:text-titanium-100"
          aria-label="Schließen"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="flex-1 space-y-4 overflow-y-auto px-4 py-4">
        {messages.map((msg) => (
          <div key={msg.id} className={`flex flex-col gap-1 ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
            <div
              className={`max-w-[85%] border px-3 py-2 text-xs leading-relaxed ${
                msg.role === 'user'
                  ? 'border-security-500/40 bg-security-500/10 text-titanium-100'
                  : 'border-titanium-800 bg-obsidian-800 text-titanium-300'
              }`}
            >
              {msg.text}
            </div>
            <span className="font-mono text-[9px] uppercase tracking-wider text-titanium-600">{msg.timestamp}</span>
          </div>
        ))}
      </div>

      <div className="border-t border-titanium-800 px-4 py-3">
        <div className="mb-3 flex flex-wrap gap-2">
          {SUGGESTIONS.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setDraft(s)}
              className="flex items-center gap-1 border border-titanium-800 px-2 py-1 text-left font-mono text-[10px] text-titanium-400 transition-colors hover:border-security-500/40 hover:text-titanium-100"
            >
              <Sparkles className="h-3 w-3 text-security-400" />
              {s}
            </button>
          ))}
        </div>
        <form
          className="flex items-center gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            setDraft('');
          }}
        >
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Frage an den Agenten…"
            className="flex-1 border border-titanium-700 bg-obsidian-950 px-3 py-2 text-xs text-titanium-100 placeholder:text-titanium-600 focus:border-security-500 focus:outline-none"
          />
          <Button type="submit" variant="primary" size="sm" aria-label="Senden">
            <Send className="h-3.5 w-3.5" />
          </Button>
        </form>
      </div>
    </aside>
  );
}
