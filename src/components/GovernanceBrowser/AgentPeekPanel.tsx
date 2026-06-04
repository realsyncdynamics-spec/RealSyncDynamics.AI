/**
 * AgentPeekPanel — Peek Mode Sicht auf einen Agenten (read-only).
 *
 * Erweitert AgentCard um zusätzliche Transparency-Informationen:
 * - Explizite Human-Review-Gates
 * - Restricted Actions (was der Agent NICHT darf)
 * - Owner Role
 *
 * Keine Edits, kein Trigger — reine Informations-Sicht.
 */
import { Bot, Lock, AlertTriangle, UserCheck } from 'lucide-react';
import { AgentCard } from '../../features/governance/agents/AgentCard';
import type { GovernanceAgent } from '../../features/governance/agents/types';

interface AgentPeekPanelProps {
  agent: GovernanceAgent;
  expanded?: boolean;
}

export function AgentPeekPanel({ agent, expanded = false }: AgentPeekPanelProps) {
  return (
    <div className={`border border-titanium-800 bg-obsidian-900 rounded-none ${expanded ? 'p-6' : ''}`}>
      <AgentCard agent={agent} />

      {expanded && (
        <div className="mt-6 space-y-4 border-t border-titanium-800 pt-4">
          {/* Restricted Actions */}
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Lock className="h-4 w-4 text-red-400" />
              <span className="text-xs font-semibold text-titanium-400 uppercase">Gesperrte Aktionen</span>
            </div>
            <ul className="text-xs text-titanium-300 space-y-1 ml-6">
              {agent.restrictedActions.map((action, i) => (
                <li key={i} className="list-disc">{action}</li>
              ))}
            </ul>
          </div>

          {/* Human Review Gates */}
          <div>
            <div className="flex items-center gap-2 mb-2">
              <UserCheck className="h-4 w-4 text-amber-400" />
              <span className="text-xs font-semibold text-titanium-400 uppercase">Human Review erforderlich bei</span>
            </div>
            <ul className="text-xs text-titanium-300 space-y-1 ml-6">
              {agent.requiresHumanReview.map((gate, i) => (
                <li key={i} className="list-disc">{gate}</li>
              ))}
            </ul>
          </div>

          {/* Owner Role */}
          <div>
            <span className="text-xs font-semibold text-titanium-400 uppercase">Verantwortliche Rolle</span>
            <p className="text-xs text-cyan-300 mt-1 font-mono">{agent.ownerRole}</p>
          </div>

          {/* Evidence Refs */}
          <div>
            <span className="text-xs font-semibold text-titanium-400 uppercase">Evidence References</span>
            <div className="text-xs text-titanium-300 mt-1 space-y-0.5">
              {agent.evidenceRefs.map((ref, i) => (
                <p key={i} className="font-mono text-security-300">{ref}</p>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
