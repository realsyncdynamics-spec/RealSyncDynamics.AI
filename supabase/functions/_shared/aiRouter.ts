// AI Router — Policy-basierte Modellauswahl für den AI Gateway
//
// Auswertungsreihenfolge:
// 1. Tenant-spezifische ai_routing_policies (nach priority ASC)
// 2. EU-Residenz-Override (aus resolve_ai_residency)
// 3. Komplexitäts-basiertes Haiku/Sonnet-Routing (modelSelection.ts)
// 4. Hard-coded Fallback: Claude Haiku 4.5

import type { SupabaseClient } from 'jsr:@supabase/supabase-js@2';
import { selectModel, getModelId, type ModelTier } from './modelSelection.ts';
import type { ProviderId } from './providers.ts';

export interface RouterRequest {
  tenantId: string;
  toolKey?: string;
  messageContent?: string;
  historyLength?: number;
  isFollowUp?: boolean;
  /** Wenn gesetzt, wird EU-Residenz erzwungen (überschreibt Cloud-Policies). */
  forceEuResident?: boolean;
}

export interface RouterResult {
  provider: ProviderId;
  modelId: string;
  /** ID der ai_routing_policy die gematcht hat, oder null bei Fallback. */
  policyId: string | null;
  /** Beschreibung warum dieses Modell gewählt wurde (für Audit-Log). */
  reason: string;
  /** Estimated cost constraint from policy (null if unconstrained). */
  maxCostUsd: number | null;
}

interface PolicyRow {
  id: string;
  name: string;
  priority: number;
  match_tool_key_pattern: string | null;
  match_content_type: string | null;
  preferred_provider: string | null;
  preferred_model_id: string | null;
  max_cost_usd_per_call: number | null;
  require_eu_resident: boolean;
}

const FALLBACK: RouterResult = {
  provider: 'anthropic',
  modelId: 'claude-haiku-4-5-20251001',
  policyId: null,
  reason: 'fallback:default',
  maxCostUsd: null,
};

export async function resolveRoute(
  admin: SupabaseClient,
  req: RouterRequest,
): Promise<RouterResult> {
  // EU-Residenz-Zwang: immer Ollama
  if (req.forceEuResident) {
    return {
      provider: 'ollama',
      modelId: 'gemma3:4b',
      policyId: null,
      reason: 'eu_local:forced',
      maxCostUsd: null,
    };
  }

  // Tenant-Policies laden (priority ASC = höchste Priorität zuerst)
  let policies: PolicyRow[] = [];
  try {
    const { data } = await admin
      .from('ai_routing_policies')
      .select('id,name,priority,match_tool_key_pattern,match_content_type,preferred_provider,preferred_model_id,max_cost_usd_per_call,require_eu_resident')
      .eq('tenant_id', req.tenantId)
      .eq('enabled', true)
      .order('priority', { ascending: true });
    policies = (data ?? []) as PolicyRow[];
  } catch {
    // DB-Fehler: Fallback auf Komplexitäts-Routing
  }

  for (const policy of policies) {
    // Tool-Key-Pattern matchen (LIKE-Semantik im Client)
    if (policy.match_tool_key_pattern && req.toolKey) {
      const pattern = policy.match_tool_key_pattern
        .replace(/%/g, '.*')
        .replace(/_/g, '.');
      if (!new RegExp(`^${pattern}$`, 'i').test(req.toolKey)) continue;
    }

    // Content-Type matchen (einfache Keyword-Klassifikation)
    if (policy.match_content_type && req.messageContent) {
      if (!matchesContentType(req.messageContent, policy.match_content_type)) continue;
    }

    // EU-Residenz prüfen
    if (policy.require_eu_resident) {
      return {
        provider: 'ollama',
        modelId: policy.preferred_model_id ?? 'gemma3:4b',
        policyId: policy.id,
        reason: `policy:${policy.name}:eu_local`,
        maxCostUsd: policy.max_cost_usd_per_call ?? null,
      };
    }

    if (policy.preferred_provider && policy.preferred_model_id) {
      return {
        provider: policy.preferred_provider as ProviderId,
        modelId: policy.preferred_model_id,
        policyId: policy.id,
        reason: `policy:${policy.name}`,
        maxCostUsd: policy.max_cost_usd_per_call ?? null,
      };
    }
  }

  // Keine Policy gematcht — Komplexitäts-basiertes Routing
  if (req.messageContent !== undefined) {
    const tier: ModelTier = selectModel(
      req.messageContent,
      req.historyLength ?? 0,
      req.isFollowUp ?? false,
    );
    return {
      provider: 'anthropic',
      modelId: getModelId(tier),
      policyId: null,
      reason: `complexity:${tier}`,
      maxCostUsd: null,
    };
  }

  return FALLBACK;
}

// Klassifiziert Nachrichteninhalt nach groben Content-Typen
function matchesContentType(content: string, type: string): boolean {
  const lower = content.toLowerCase();
  const patterns: Record<string, string[]> = {
    legal:    ['dsgvo', 'gdpr', 'dpia', 'datenschutz', 'ai act', 'compliance', 'recht', 'legal', 'vertrag', 'klausel'],
    code:     ['function', 'class', 'import', 'export', 'const ', 'def ', 'SELECT ', 'async ', 'await ', 'return '],
    summary:  ['zusammenfassung', 'summary', 'zusammenfassen', 'überblick', 'kurz', 'tl;dr'],
    analysis: ['analysiere', 'analyse', 'analyze', 'untersuche', 'bewerte', 'vergleiche', 'evaluate'],
  };
  return (patterns[type] ?? []).some((kw) => lower.includes(kw));
}
