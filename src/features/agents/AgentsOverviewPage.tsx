import { Bot, Headphones, Phone, Camera } from 'lucide-react';
import { AgentCard } from './components/AgentCard';

export function AgentsOverviewPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-semibold text-titanium-50">Agents</h1>
        <p className="mt-1 text-sm text-titanium-400">
          Interne Governance-Agenten: Automatisierung, Support, Voice-Calls und
          Screenshot-basierte Fehleranalyse.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <AgentCard
          icon={Bot}
          name="Automation Governance Agent"
          description="Analysiert Nutzungsmuster und schlägt passende Automatisierungs-Workflows aus dem Katalog vor."
          status="coming-soon"
          to="/app/agents/automation"
        />
        <AgentCard
          icon={Headphones}
          name="RealSync Support Agent"
          description="Beantwortet Support-Anfragen anhand der Wissensbasis und eskaliert komplexe Fälle ans Team."
          status="coming-soon"
          to="/app/agents/support"
        />
        <AgentCard
          icon={Phone}
          name="Call Agent Susi"
          description="Telefonischer Voice-Agent mit ElevenLabs-Stimme 'Susi' und automatischem Fallback."
          status="coming-soon"
          to="/app/agents/susi"
        />
        <AgentCard
          icon={Camera}
          name="Screenshot & Issue Fix Agent"
          description="Erkennt UI- und Funktionsprobleme aus Screenshots und schlägt konkrete Fixes vor."
          status="coming-soon"
          to="/app/agents/screenshot"
        />
      </div>
    </div>
  );
}
