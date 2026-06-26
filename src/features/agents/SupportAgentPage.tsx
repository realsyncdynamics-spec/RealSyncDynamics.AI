import { Link } from 'react-router-dom';
import { ArrowLeft, Headphones } from 'lucide-react';

export function SupportAgentPage() {
  return (
    <div className="space-y-6">
      <Link to="/app/agents" className="inline-flex items-center gap-1.5 text-xs text-titanium-400 hover:text-titanium-100">
        <ArrowLeft className="h-3.5 w-3.5" /> Zurück zu Agents
      </Link>

      <div className="flex items-center gap-3">
        <div className="flex items-center justify-center h-9 w-9 border border-titanium-800 bg-obsidian-950 text-cyan-400">
          <Headphones className="h-4.5 w-4.5" />
        </div>
        <h1 className="text-lg font-semibold text-titanium-50">RealSync Support Agent</h1>
      </div>

      <div className="bg-obsidian-900 border border-titanium-900 p-6">
        <p className="text-sm text-titanium-300">
          Coming in PR3: Automatisierte Beantwortung von Support-Anfragen anhand
          der Wissensbasis mit Eskalation komplexer Fälle ans Team.
        </p>
      </div>
    </div>
  );
}
