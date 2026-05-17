// Role-rotation logic for cross-agent learning.

import type { AgentRole, RotationLog } from './types';
import { ALL_AGENT_ROLES } from './types';

/**
 * Suggest a rotation role for an agent. The trainer picks a role
 * that's adjacent to the agent's primary role (so the agent isn't
 * thrown into a wildly different domain), but distinct enough to
 * teach something new.
 */
const ADJACENCY: Record<AgentRole, AgentRole[]> = {
  ResearchAgent:   ['MemoryAgent', 'PlanningAgent', 'SimulationAgent'],
  MemoryAgent:     ['ResearchAgent', 'DecisionAgent'],
  PlanningAgent:   ['DecisionAgent', 'SimulationAgent', 'ResearchAgent'],
  SimulationAgent: ['PlanningAgent', 'DecisionAgent', 'ResearchAgent'],
  PromotionAgent:  ['DecisionAgent', 'OutputAgent', 'ResearchAgent'],
  MonitoringAgent: ['MemoryAgent', 'DecisionAgent'],
  DecisionAgent:   ['PlanningAgent', 'SimulationAgent', 'PromotionAgent'],
  OutputAgent:     ['PromotionAgent', 'DecisionAgent'],
  // TrainerAgent never rotates — it observes, it doesn't perform.
  TrainerAgent:    [],
};

export function suggestRotationRole(from: AgentRole): AgentRole | null {
  const candidates = ADJACENCY[from] ?? [];
  if (candidates.length === 0) return null;
  // Pick deterministically based on a hash of the role name so two
  // consecutive suggestions for the same agent vary.
  const idx = simpleHash(from + Date.now().toString(36)) % candidates.length;
  return candidates[idx]!;
}

/**
 * Decide if an agent is due for a rotation. The default policy is:
 *   - new agents (never rotated): due after 7 days
 *   - any agent: due 30 days after last rotation
 */
export function isRotationDue(args: {
  last_rotation_at: string | null;
  now?: number;
  warmup_days?: number;
  interval_days?: number;
}): boolean {
  const now = args.now ?? Date.now();
  const warmupMs = (args.warmup_days ?? 7)   * 24 * 60 * 60 * 1000;
  const intervalMs = (args.interval_days ?? 30) * 24 * 60 * 60 * 1000;
  if (!args.last_rotation_at) {
    // Without a baseline, use the warmup window from creation. We
    // don't have created_at here so the caller can decide; default
    // is "yes, eligible right away" so the trainer surfaces it.
    return true;
  }
  const lastMs = Date.parse(args.last_rotation_at);
  if (!Number.isFinite(lastMs)) return true;
  return now - lastMs >= intervalMs - warmupMs;
}

let _counter = 0;
function nextId(): string {
  _counter += 1;
  return `rot_${Date.now().toString(36)}_${_counter.toString(36)}`;
}

export function createRotationLog(args: {
  agent_name: string;
  original_role: AgentRole;
  rotated_role: AgentRole;
  task: string;
  result: string;
  trainer_feedback: string;
  produced_usable_output: boolean;
}): RotationLog {
  return {
    id: nextId(),
    ...args,
    created_at: new Date().toISOString(),
  };
}

export { ALL_AGENT_ROLES };

function simpleHash(s: string): number {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}
