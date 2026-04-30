import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Send, Server, ShieldCheck, Globe, Database, FileLock2,
  Terminal, AlertTriangle, Sparkles, ArrowLeft, Settings2,
} from 'lucide-react';
import Markdown from 'react-markdown';
import { processAIGatewayRequest, ModelProvider } from '../../core/ai-gateway/gateway';
import { KODEE_PERSONA } from './kodee-persona';
import { ActionRunner, formatActionResult } from './ActionRunner';
import { listConnections, type VpsConnection } from './connections/api';
import { isSupabaseConfigured } from '../../lib/supabase';

type Msg = { role: 'user' | 'kodee'; text: string; status?: 'loading' | 'error' | 'success' };

const QUICK_PROMPTS: { icon: React.ElementType; label: string; prompt: string }[] = [
  {
    icon: ShieldCheck,
    label: 'Was fehlt für meine Webseite?',
    prompt: 'Was fehlt noch für die Einrichtung meiner Webseite? Gehe die Setup-Checkliste systematisch durch und frage mich, was schon fertig ist.',
  },
  {
    icon: Globe,
    label: 'Domain + SSL einrichten',
    prompt: 'Erkläre Schritt für Schritt, wie ich eine Domain auf meinen VPS zeige und ein Let\'s-Encrypt-SSL-Zertifikat einrichte (Nginx-Beispiel).',
  },
  {
    icon: Database,
    label: 'Postgres-Backup einrichten',
    prompt: 'Wie richte ich tägliche Postgres-Backups auf meinem VPS ein, idealerweise verschlüsselt und mit Rotation?',
  },
  {
    icon: Terminal,
    label: 'Service debuggen',
    prompt: 'Mein Dienst startet nicht. Welche Befehle (systemd / docker / journalctl) führe ich aus, um die Ursache zu finden?',
  },
  {
    icon: FileLock2,
    label: 'VPS härten',
    prompt: 'Welche Schritte härten einen frischen Ubuntu-VPS ab (SSH, ufw, fail2ban, automatische Updates)?',
  },
];

export function KodeeView() {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState('');
  const [provider, setProvider] = useState<ModelProvider>('gemini');
  const [connections, setConnections] = useState<VpsConnection[]>([]);
  const [activeConnectionId, setActiveConnectionId] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    if (!isSupabaseConfigured()) return;
    let cancelled = false;
    listConnections()
      .then((rows) => {
        if (cancelled) return;
        setConnections(rows);
        setActiveConnectionId((cur) => cur ?? rows[0]?.id ?? null);
      })
      .catch(() => { /* not signed in or no connections — silent for chat-only mode */ });
    return () => { cancelled = true; };
  }, []);

  const send = async (override?: string) => {
    const text = (override ?? input).trim();
    if (!text) return;

    const next: Msg[] = [...messages, { role: 'user', text, status: 'success' }];
    setMessages([...next, { role: 'kodee', text: '', status: 'loading' }]);
    setInput('');

    try {
      const res = await processAIGatewayRequest({
        prompt: text,
        provider,
        systemPrompt: KODEE_PERSONA,
      });
      if (!res.success) throw new Error(res.error || 'Gateway-Fehler');
      setMessages([...next, { role: 'kodee', text: res.modelOutput || '…', status: 'success' }]);
    } catch (err: any) {
      setMessages([...next, {
        role: 'kodee',
        text: err?.message || 'Da ist etwas schiefgelaufen – versuch es nochmal oder wechsel das Modell.',
        status: 'error',
      }]);
    }
  };

  return (
    <div className="flex flex-col h-screen w-screen bg-slate-50 text-slate-800 overflow-hidden">
      {/* Header */}
      <header className="h-14 shrink-0 border-b border-slate-200/60 bg-white flex items-center justify-between px-4">
        <div className="flex items-center gap-3">
          <Link
            to="/dashboard"
            className="p-1.5 rounded-md hover:bg-slate-100 text-slate-500 hover:text-slate-700 transition-colors"
            aria-label="Zurück zum Dashboard"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-sm">
              <Server className="h-4 w-4 text-white" />
            </div>
            <div className="leading-tight">
              <div className="font-display font-bold text-sm tracking-tight text-slate-900">Kodee</div>
              <div className="text-[11px] text-slate-500 font-medium">Dein VPS-Sidekick</div>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {connections.length > 0 ? (
            <select
              value={activeConnectionId ?? ''}
              onChange={(e) => setActiveConnectionId(e.target.value || null)}
              className="bg-slate-50 border border-slate-200 text-slate-700 text-xs rounded-lg px-2 py-1.5 outline-none cursor-pointer font-medium hover:bg-slate-100 max-w-[180px] truncate"
              title="Aktive VPS-Verbindung"
            >
              {connections.map((c) => (
                <option key={c.id} value={c.id}>{c.label} · {c.host}</option>
              ))}
            </select>
          ) : (
            <Link
              to="/kodee/connections"
              className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1.5 text-[11px] font-semibold text-slate-600 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-md transition-colors"
              title="VPS-Verbindungen verwalten"
            >
              <Settings2 className="h-3.5 w-3.5" />
              Verbindungen
            </Link>
          )}
          <select
            value={provider}
            onChange={(e) => setProvider(e.target.value as ModelProvider)}
            className="bg-slate-50 border border-slate-200 text-slate-700 text-xs rounded-lg px-2 py-1.5 outline-none cursor-pointer font-medium hover:bg-slate-100"
          >
            <option value="gemini">Gemini 3.1 Pro</option>
            <option value="claude">Claude 4.6</option>
            <option value="openai">GPT-5</option>
          </select>
        </div>
      </header>

      {/* Conversation */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-6 sm:px-6">
        {messages.length === 0 ? (
          <div className="max-w-2xl mx-auto flex flex-col items-center text-center pt-8">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-lg shadow-emerald-500/20 mb-5">
              <Sparkles className="h-7 w-7 text-white" />
            </div>
            <h1 className="font-display text-2xl font-bold tracking-tight text-slate-900 mb-2">
              Hi, ich bin Kodee 👋
            </h1>
            <p className="text-slate-500 leading-relaxed max-w-md">
              Dein persönlicher VPS-Sidekick. Ich helfe beim Einrichten, Debuggen, Logs lesen,
              Domains, SSL, Backups – frag einfach.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 w-full mt-8">
              {QUICK_PROMPTS.map(({ icon: Icon, label, prompt }) => (
                <button
                  key={label}
                  onClick={() => send(prompt)}
                  className="flex items-center gap-3 p-3.5 bg-white border border-slate-200/80 rounded-xl hover:border-emerald-400 hover:shadow-md transition-all text-left"
                >
                  <div className="p-2 bg-emerald-50 text-emerald-600 rounded-lg shrink-0">
                    <Icon className="h-4 w-4" />
                  </div>
                  <span className="font-semibold text-slate-800 text-sm">{label}</span>
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="max-w-3xl mx-auto space-y-6">
            {messages.map((m, i) => (
              <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                {m.role === 'kodee' && (
                  <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-600 text-white flex items-center justify-center shrink-0 mr-3 shadow-sm mt-1">
                    <Server className="h-4 w-4" />
                  </div>
                )}

                <div
                  className={
                    m.role === 'user'
                      ? 'max-w-[85%] bg-slate-900 text-white px-4 py-2.5 rounded-2xl rounded-tr-sm text-[15px] shadow-sm whitespace-pre-wrap'
                      : 'max-w-[85%] w-full'
                  }
                >
                  {m.status === 'loading' ? (
                    <div className="flex items-center gap-2 text-slate-400 py-1.5">
                      <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-bounce [animation-delay:-0.3s]" />
                      <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-bounce [animation-delay:-0.15s]" />
                      <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-bounce" />
                      <span className="text-sm font-medium ml-1">Kodee tippt…</span>
                    </div>
                  ) : m.status === 'error' ? (
                    <div className="bg-red-50 border border-red-100 text-red-700 px-4 py-3 rounded-xl flex items-start gap-2.5">
                      <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                      <span className="text-sm">{m.text}</span>
                    </div>
                  ) : m.role === 'user' ? (
                    m.text
                  ) : (
                    <div className="prose prose-slate prose-sm max-w-none prose-headings:font-display prose-headings:tracking-tight prose-pre:bg-slate-900 prose-pre:text-slate-100 prose-code:text-emerald-700 prose-code:bg-emerald-50 prose-code:px-1 prose-code:py-0.5 prose-code:rounded prose-code:before:content-none prose-code:after:content-none">
                      <Markdown>{m.text}</Markdown>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Input */}
      <div className="shrink-0 px-4 pt-3 pb-4 bg-white border-t border-slate-200/60">
        <ActionRunner
          connectionId={activeConnectionId}
          onResult={(action, _args, result) => {
            const text = formatActionResult(action, result);
            setMessages((prev) => [...prev, { role: 'kodee', text, status: result.ok ? 'success' : 'error' }]);
          }}
        />
        <div className="max-w-3xl mx-auto flex items-end gap-2 bg-slate-50 border border-slate-200/80 rounded-2xl p-2 shadow-sm focus-within:ring-2 focus-within:ring-emerald-500/20 focus-within:border-emerald-400 transition-all">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                send();
              }
            }}
            placeholder={'Was brauchst du? z. B. „Logs des nginx-Containers checken"…'}
            className="flex-1 max-h-40 min-h-[44px] bg-transparent resize-none py-3 px-3 text-[15px] outline-none text-slate-800 placeholder:text-slate-400"
            rows={1}
          />
          <button
            onClick={() => send()}
            disabled={!input.trim()}
            className="p-2.5 bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 disabled:opacity-40 disabled:hover:bg-emerald-600 transition-colors shadow-sm shrink-0"
            aria-label="Senden"
          >
            <Send className="h-4 w-4" />
          </button>
        </div>
        <p className="text-center text-[10px] text-slate-400 font-medium tracking-wide mt-2">
          Kodee kann Fehler machen. Prüfe Befehle, bevor du sie auf Produktion ausführst.
        </p>
      </div>
    </div>
  );
}
