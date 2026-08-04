import React, { useState } from 'react';
import { X, Play, Pause, RotateCcw, Globe2, Terminal, AlertCircle } from 'lucide-react';
import { AGENTS } from '../mock/data';

interface AgentBrowserControlProps {
  isOpen: boolean;
  onClose: () => void;
}

interface BrowserSession {
  agentId: string;
  url: string;
  isRunning: boolean;
  logs: { timestamp: string; message: string; level: 'info' | 'warn' | 'error' }[];
}

export function AgentBrowserControl({ isOpen, onClose }: AgentBrowserControlProps) {
  const [sessions, setSessions] = useState<BrowserSession[]>(
    AGENTS.map((agent) => ({
      agentId: agent.id,
      url: 'about:blank',
      isRunning: agent.status === 'Aktiv',
      logs: [
        { timestamp: '09:14', message: 'Chromium browser instance initialized', level: 'info' },
        { timestamp: '09:15', message: 'Connected to agent runtime', level: 'info' },
      ],
    }))
  );
  const [selectedSession, setSelectedSession] = useState<string>(AGENTS[0]?.id || '');

  const currentSession = sessions.find((s) => s.agentId === selectedSession);
  const currentAgent = AGENTS.find((a) => a.id === selectedSession);

  const toggleSession = (agentId: string) => {
    setSessions((prev) =>
      prev.map((s) =>
        s.agentId === agentId ? { ...s, isRunning: !s.isRunning } : s
      )
    );
  };

  const resetSession = (agentId: string) => {
    setSessions((prev) =>
      prev.map((s) =>
        s.agentId === agentId
          ? {
              ...s,
              url: 'about:blank',
              logs: [
                { timestamp: new Date().toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' }), message: 'Browser reset', level: 'info' },
              ],
            }
          : s
      )
    );
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-end bg-black/40 backdrop-blur-sm">
      <div className="flex h-full w-full max-w-4xl flex-col border-l border-titanium-800 bg-obsidian-900">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-titanium-800 px-6 py-4">
          <div>
            <h2 className="text-lg font-bold text-titanium-50">Chromium Browser Control</h2>
            <p className="text-xs text-titanium-500">Live-Kontrolle autonomer Agenten</p>
          </div>
          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center text-titanium-400 hover:text-titanium-100"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex flex-1 overflow-hidden">
          {/* Agent List */}
          <div className="w-48 border-r border-titanium-800 bg-obsidian-950/30 px-3 py-4">
            <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-titanium-600">Agenten</p>
            <ul className="space-y-1">
              {AGENTS.map((agent) => {
                const session = sessions.find((s) => s.agentId === agent.id);
                return (
                  <li key={agent.id}>
                    <button
                      onClick={() => setSelectedSession(agent.id)}
                      className={`w-full rounded border px-3 py-2 text-left text-xs font-medium transition-colors ${
                        selectedSession === agent.id
                          ? 'border-security-500/40 bg-security-500/15 text-titanium-50'
                          : 'border-titanium-800 text-titanium-400 hover:border-titanium-700 hover:bg-titanium-800/20 hover:text-titanium-100'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <div
                          className={`h-2 w-2 rounded-full ${
                            session?.isRunning ? 'bg-security-400 animate-pulse' : 'bg-titanium-600'
                          }`}
                        />
                        <span className="truncate">{agent.name}</span>
                      </div>
                      <p className="mt-1 text-[10px] text-titanium-500">{agent.role}</p>
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>

          {/* Browser View and Controls */}
          <div className="flex flex-1 flex-col overflow-hidden">
            {currentAgent && currentSession && (
              <>
                {/* Control Bar */}
                <div className="flex items-center gap-2 border-b border-titanium-800 bg-obsidian-950/50 px-4 py-3">
                  <button
                    onClick={() => toggleSession(currentAgent.id)}
                    className="flex h-8 w-8 items-center justify-center rounded border border-security-500/30 bg-security-500/10 text-security-400 transition-colors hover:border-security-500/50 hover:bg-security-500/15"
                    title={currentSession.isRunning ? 'Anhalten' : 'Starten'}
                  >
                    {currentSession.isRunning ? (
                      <Pause className="h-4 w-4" />
                    ) : (
                      <Play className="h-4 w-4" />
                    )}
                  </button>
                  <button
                    onClick={() => resetSession(currentAgent.id)}
                    className="flex h-8 w-8 items-center justify-center rounded border border-titanium-800 text-titanium-400 transition-colors hover:border-titanium-600 hover:text-titanium-100"
                    title="Zurücksetzen"
                  >
                    <RotateCcw className="h-4 w-4" />
                  </button>

                  {/* URL Bar */}
                  <div className="flex flex-1 items-center gap-2 rounded border border-titanium-800 bg-obsidian-900 px-3 py-1">
                    <Globe2 className="h-3.5 w-3.5 text-titanium-600" />
                    <input
                      type="text"
                      value={currentSession.url}
                      onChange={(e) =>
                        setSessions((prev) =>
                          prev.map((s) =>
                            s.agentId === currentAgent.id
                              ? { ...s, url: e.target.value }
                              : s
                          )
                        )
                      }
                      placeholder="URL eingeben oder Befehl…"
                      className="flex-1 bg-transparent text-xs text-titanium-100 placeholder-titanium-600 outline-none"
                    />
                  </div>

                  <div className="text-xs text-titanium-500">
                    {currentSession.isRunning ? (
                      <span className="flex items-center gap-1">
                        <div className="h-2 w-2 rounded-full bg-security-400 animate-pulse" /> Läuft
                      </span>
                    ) : (
                      <span>Pausiert</span>
                    )}
                  </div>
                </div>

                {/* Browser Display Area */}
                <div className="flex-1 overflow-hidden bg-obsidian-950">
                  <iframe
                    src={currentSession.url || 'about:blank'}
                    className="h-full w-full border-0"
                    title={`Agent Browser: ${currentAgent.name}`}
                  />
                </div>

                {/* Logs Panel */}
                <div className="border-t border-titanium-800 bg-obsidian-950/70">
                  <div className="flex items-center gap-2 border-b border-titanium-800 px-4 py-2">
                    <Terminal className="h-4 w-4 text-titanium-600" />
                    <p className="text-xs font-semibold text-titanium-600">Console Logs</p>
                  </div>
                  <div className="max-h-24 overflow-y-auto px-4 py-2 font-mono text-[10px]">
                    {currentSession.logs.map((log, idx) => (
                      <div
                        key={idx}
                        className={`flex gap-2 ${
                          log.level === 'error'
                            ? 'text-red-400'
                            : log.level === 'warn'
                              ? 'text-amber-400'
                              : 'text-titanium-500'
                        }`}
                      >
                        <span className="text-titanium-700">{log.timestamp}</span>
                        {log.level === 'error' && <AlertCircle className="h-3 w-3 shrink-0" />}
                        <span>{log.message}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
