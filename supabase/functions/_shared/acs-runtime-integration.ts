/**
 * ACS Runtime Integration — Load and validate Agent Contracts from registry.
 *
 * Provides:
 * - getAgentContract() — Load contract by agent_id and optional version
 * - validateAgentContract() — Schema validation for contract JSON
 * - resolveAgentCapabilities() — Extract tool permissions from contract
 */

import { SupabaseClient } from 'jsr:@supabase/supabase-js@2';

export interface AgentContractData {
  id: string;
  version: string;
  name: string;
  description?: string;
  agent_type: 'governance' | 'automation' | 'enterprise' | 'custom';
  status: 'draft' | 'active' | 'deprecated' | 'retired';
  contract_json: Record<string, unknown>;
  published_at?: string;
}

/**
 * Load agent contract from registry by ID and optional version.
 * If version not specified, fetches latest active contract.
 */
export async function getAgentContract(
  admin: SupabaseClient,
  agentId: string,
  version?: string,
): Promise<AgentContractData | null> {
  let query = admin
    .from('agent_contracts')
    .select('id, version, name, description, agent_type, status, contract_json, published_at');

  query = query.eq('id', agentId);

  if (version) {
    query = query.eq('version', version);
  } else {
    // Fetch latest active contract
    query = query.eq('status', 'active').order('version', { ascending: false }).limit(1);
  }

  const { data, error } = await query.maybeSingle();
  if (error) throw new Error(`Failed to fetch contract: ${error.message}`);
  return data as AgentContractData | null;
}

/**
 * Validate contract structure against minimal ACS schema.
 * Returns validation error message or null if valid.
 */
export function validateAgentContract(contract: Record<string, unknown>): string | null {
  // Minimum required fields per ACS spec
  const required = ['id', 'goals', 'capabilities', 'permissions'];
  for (const field of required) {
    if (!(field in contract)) {
      return `Contract missing required field: ${field}`;
    }
  }

  // Validate capabilities is array
  if (!Array.isArray(contract.capabilities)) {
    return 'capabilities must be an array';
  }

  // Validate permissions is object
  if (typeof contract.permissions !== 'object' || contract.permissions === null) {
    return 'permissions must be an object';
  }

  return null;
}

/**
 * Extract list of tool permissions from contract.
 * Returns array of tool names the agent is authorized to call.
 */
export function resolveAgentCapabilities(contract: AgentContractData): string[] {
  const perms = contract.contract_json.permissions as Record<string, unknown> | undefined;
  if (!perms) return [];

  const tools = perms.tools as string[] | undefined;
  if (!Array.isArray(tools)) return [];

  return tools;
}

/**
 * Extract cost model from contract (tokens/cost limits per execution).
 */
export function getAgentCostModel(contract: AgentContractData): {
  tokens_per_execution?: number;
  max_tokens_per_turn?: number;
  cost_limit_usd?: number;
} {
  const costModel = contract.contract_json.cost_model as Record<string, unknown> | undefined;
  return {
    tokens_per_execution: costModel?.tokens_per_execution as number | undefined,
    max_tokens_per_turn: costModel?.max_tokens_per_turn as number | undefined,
    cost_limit_usd: costModel?.cost_limit_usd as number | undefined,
  };
}
