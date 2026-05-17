/**
 * useAiGovernanceData — Lebende Daten für AiGovernanceDashboard.
 *
 * Fetcht in parallel aus den drei AI-Governance-Tabellen (ai_systems,
 * ai_policies, ai_evidence_events) und mappt snake_case → camelCase per
 * Typ aus ./types. Falls keine Zeilen sichtbar sind (anonymer User, leere
 * Tabellen, RLS-Block) wird auf die Demo-Daten zurückgegriffen, damit die
 * Page nicht plötzlich leer ist.
 *
 * Single-source-of-truth bleibt das DB-Schema in
 * supabase/migrations/20260510_ai_governance_core.sql. Schreib-Pfade
 * landen in einem späteren PR.
 */

import { useEffect, useState } from 'react';
import { getSupabase } from '../../lib/supabase';
import { demoAiSystems, demoEvidenceEvents, demoPolicies } from './demoData';
import type {
  AiActClass,
  AiEvidenceEvent,
  AiPolicy,
  AiSystem,
  AiSystemStatus,
} from './types';

type AiSystemRow = {
  id: string;
  name: string;
  vendor: string | null;
  model_name: string | null;
  department: string | null;
  owner_email: string | null;
  purpose: string | null;
  data_types: string[] | null;
  ai_act_class: AiActClass | null;
  risk_score: number | null;
  status: AiSystemStatus | null;
};

type AiPolicyRow = {
  id: string;
  name: string;
  description: string | null;
  severity: AiPolicy['severity'] | null;
  rule_type: AiPolicy['ruleType'];
  action: AiPolicy['action'] | null;
  enabled: boolean | null;
};

type AiEvidenceRow = {
  id: string;
  ai_system_id: string | null;
  policy_id: string | null;
  event_type: string;
  event_summary: string;
  risk_level: AiEvidenceEvent['riskLevel'] | null;
  evidence: Record<string, unknown> | null;
  created_at: string;
};

function mapSystem(row: AiSystemRow): AiSystem {
  return {
    id: row.id,
    name: row.name,
    vendor: row.vendor ?? undefined,
    modelName: row.model_name ?? undefined,
    department: row.department ?? undefined,
    ownerEmail: row.owner_email ?? undefined,
    purpose: row.purpose ?? undefined,
    dataTypes: row.data_types ?? [],
    aiActClass: row.ai_act_class ?? 'unknown',
    riskScore: row.risk_score ?? 0,
    status: row.status ?? 'draft',
  };
}

function mapPolicy(row: AiPolicyRow): AiPolicy {
  return {
    id: row.id,
    name: row.name,
    description: row.description ?? undefined,
    severity: row.severity ?? 'medium',
    ruleType: row.rule_type,
    action: row.action ?? 'warn',
    enabled: row.enabled ?? true,
  };
}

function mapEvidence(row: AiEvidenceRow): AiEvidenceEvent {
  return {
    id: row.id,
    aiSystemId: row.ai_system_id ?? undefined,
    policyId: row.policy_id ?? undefined,
    eventType: row.event_type,
    eventSummary: row.event_summary,
    riskLevel: row.risk_level ?? 'info',
    evidence: row.evidence ?? {},
    createdAt: row.created_at,
  };
}

export interface AiGovernanceData {
  aiSystems: AiSystem[];
  policies: AiPolicy[];
  evidenceEvents: AiEvidenceEvent[];
  /** true → echte Supabase-Daten, false → Demo-Fallback. */
  live: boolean;
  loading: boolean;
  error: string | null;
}

export function useAiGovernanceData(): AiGovernanceData {
  const [data, setData] = useState<AiGovernanceData>({
    aiSystems: demoAiSystems,
    policies: demoPolicies,
    evidenceEvents: demoEvidenceEvents,
    live: false,
    loading: true,
    error: null,
  });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const sb = getSupabase();
        const [systemsRes, policiesRes, eventsRes] = await Promise.all([
          sb
            .from('ai_systems')
            .select('id, name, vendor, model_name, department, owner_email, purpose, data_types, ai_act_class, risk_score, status')
            .order('created_at', { ascending: false })
            .limit(50),
          sb
            .from('ai_policies')
            .select('id, name, description, severity, rule_type, action, enabled')
            .eq('enabled', true)
            .order('severity', { ascending: false })
            .limit(50),
          sb
            .from('ai_evidence_events')
            .select('id, ai_system_id, policy_id, event_type, event_summary, risk_level, evidence, created_at')
            .order('created_at', { ascending: false })
            .limit(50),
        ]);

        if (cancelled) return;

        const liveSystems = (systemsRes.data ?? []).map((r) => mapSystem(r as AiSystemRow));
        const livePolicies = (policiesRes.data ?? []).map((r) => mapPolicy(r as AiPolicyRow));
        const liveEvents = (eventsRes.data ?? []).map((r) => mapEvidence(r as AiEvidenceRow));

        const anyLive = liveSystems.length > 0 || livePolicies.length > 0 || liveEvents.length > 0;

        setData({
          aiSystems: liveSystems.length > 0 ? liveSystems : demoAiSystems,
          policies: livePolicies.length > 0 ? livePolicies : demoPolicies,
          evidenceEvents: liveEvents.length > 0 ? liveEvents : demoEvidenceEvents,
          live: anyLive,
          loading: false,
          error: systemsRes.error?.message ?? policiesRes.error?.message ?? eventsRes.error?.message ?? null,
        });
      } catch (e) {
        if (cancelled) return;
        setData((prev) => ({ ...prev, loading: false, error: (e as Error).message }));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return data;
}
