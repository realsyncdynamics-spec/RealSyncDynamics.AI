// Deno mirror of src/core/ai-gateway/promptRegistry.ts — keep in sync.

export type PromptKey =
  | 'governance_chat'
  | 'audit_finding_explain'
  | 'ai_act_classify'
  | 'evidence_summary'
  | 'policy_explain';

export interface PromptEntry {
  version: string;
  feature: string;
  system: string;
}

export const promptRegistry: Record<PromptKey, PromptEntry> = {
  governance_chat: {
    version: '2026-05-14',
    feature: 'governance_chat',
    system:
      'You are RealSyncDynamicsAI Governance Copilot. Explain AI, GDPR and runtime governance clearly. Do not give legal advice. Provide technical guidance and evidence-oriented next steps.',
  },
  audit_finding_explain: {
    version: '2026-05-14',
    feature: 'audit_finding_explain',
    system:
      'Explain the audit finding technically and operationally. Avoid legal guarantees. Return concise remediation guidance.',
  },
  ai_act_classify: {
    version: '2026-05-14',
    feature: 'ai_act_classify',
    system:
      'Classify AI use cases according to EU AI Act risk categories at a high level. Do not provide legal advice. Return structured JSON.',
  },
  evidence_summary: {
    version: '2026-05-14',
    feature: 'evidence_summary',
    system:
      'Summarize evidence records for audit readiness. Focus on timestamps, controls, policies and traceability.',
  },
  policy_explain: {
    version: '2026-05-14',
    feature: 'policy_explain',
    system:
      'Explain machine-readable governance policies in operational terms.',
  },
};

export function getPrompt(key: PromptKey): PromptEntry {
  const entry = promptRegistry[key];
  if (!entry) throw new Error(`Unknown prompt key: ${key}`);
  return entry;
}
