import { useState } from 'react';
import { Bot, X, ArrowRight, ExternalLink } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const QUICK_COMMANDS = [
  { label: 'Websites öffnen',           route: '/app/websites' },
  { label: 'Evidence anzeigen',         route: '/app/evidence' },
  { label: 'Risiken erklären',          route: '/app/risks' },
  { label: 'Monitoring öffnen',         route: '/app/monitoring' },
  { label: 'Report vorbereiten',        route: '/app/compliance' },
  { label: 'Kostenlosen Audit starten', route: '/audit' },
];

export function GovernanceAgentFloat() {
  const navigate = useNavigate();
  const [agentOpen, setAgentOpen] = useState(false);
  const [input, setInput] = useState('');

  const handleCommand = (route: string) => {
    navigate(route);
    setAgentOpen(false);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;
    navigate(`/audit?q=${encodeURIComponent(input.trim())}`);
    setInput('');
    setAgentOpen(false);
  };

  return (
    <>
      {/* Floating Button — rechts unten */}
      <button
        onClick={() => setAgentOpen((v) => !v)}
        className="fixed bottom-6 right-6 z-40 flex items-center gap-2 bg-cyan-400 text-obsidian-950 px-4 py-2.5 text-sm font-semibold shadow-lg hover:bg-cyan-300 transition-colors"
        aria-label="Governance Agent öffnen"
      >
        <Bot className="h-4 w-4" />
        Governance Agent
      </button>

      {/* Backdrop */}
      {agentOpen && (
        <div
          className="fixed inset-0 z-40 bg-obsidian-950/50"
          onClick={() => setAgentOpen(false)}
        />
      )}

      {/* Drawer — öffnet sich von rechts */}
      <aside
        className={`fixed top-0 right-0 z-50 h-full w-80 bg-obsidian-900 border-l border-titanium-900 flex flex-col shadow-2xl transition-transform duration-200 ${
          agentOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        {/* Header */}
        <div className="h-12 shrink-0 flex items-center justify-between px-4 border-b border-titanium-900">
          <div className="flex items-center gap-2">
            <Bot className="h-4 w-4 text-cyan-400" />
            <span className="font-display font-semibold text-sm text-titanium-50">
              Governance Guide Agent
            </span>
          </div>
          <button
            onClick={() => setAgentOpen(false)}
            className="text-titanium-600 hover:text-titanium-200 transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Quick Commands */}
        <div className="p-4 border-b border-titanium-900">
          <p className="font-mono text-[9px] uppercase tracking-widest text-titanium-600 mb-3">
            Schnellzugriff
          </p>
          <ul className="space-y-1">
            {QUICK_COMMANDS.map(({ label, route }) => (
              <li key={route}>
                <button
                  onClick={() => handleCommand(route)}
                  className="w-full flex items-center justify-between px-3 py-2 text-sm text-titanium-200 hover:bg-obsidian-800 hover:text-titanium-50 transition-colors text-left"
                >
                  <span className="flex items-center gap-2">
                    <ArrowRight className="h-3.5 w-3.5 text-cyan-400 shrink-0" />
                    {label}
                  </span>
                  <ExternalLink className="h-3 w-3 text-titanium-700 shrink-0" />
                </button>
              </li>
            ))}
          </ul>
        </div>

        {/* Input Field */}
        <div className="p-4 flex-1">
          <form onSubmit={handleSubmit} className="flex flex-col gap-3">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Was möchten Sie tun?"
              rows={4}
              className="w-full bg-obsidian-950 border border-titanium-800 text-sm text-titanium-100 placeholder-titanium-600 px-3 py-2 resize-none outline-none focus:border-cyan-700 transition-colors font-mono"
            />
            <button
              type="submit"
              disabled={!input.trim()}
              className="flex items-center justify-center gap-2 bg-cyan-400 text-obsidian-950 px-4 py-2 text-sm font-semibold hover:bg-cyan-300 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <Bot className="h-4 w-4" />
              Anfrage starten
            </button>
          </form>
        </div>

        {/* Hinweis */}
        <div className="px-4 pb-5 shrink-0">
          <p className="font-mono text-[9px] text-titanium-600 leading-relaxed">
            Der Governance Agent führt Sie durch DSGVO-, EU-AI-Act- und Evidence-Prozesse.
            Antworten sind keine Rechtsberatung.
          </p>
        </div>
      </aside>
    </>
  );
}
