/**
 * Compliance Artifact Session — 10-step list for DSGVO / EU AI Act intents.
 * Executable governance artifacts, not chatbot turns.
 */

import type { PlanStep, RiskLevel } from './types';

export const COMPLIANCE_ARTIFACT_IDS = [
  'aufgabe',
  'pruefplan',
  'benoetigte_daten',
  'aktionen',
  'risiko',
  'ergebnisse',
  'offene_punkte',
  'massnahmen',
  'evidence_pack',
  'abschlussbericht',
] as const;

export type ComplianceArtifactId = (typeof COMPLIANCE_ARTIFACT_IDS)[number];

export type ComplianceArtifactDef = {
  id: ComplianceArtifactId;
  title: string;
  action: string;
  risk: RiskLevel;
  requiresApproval: boolean;
};

/** Canonical 10-step artifact order Dominik locked for Agent OS. */
export const COMPLIANCE_ARTIFACTS: readonly ComplianceArtifactDef[] = [
  { id: 'aufgabe', title: 'Aufgabe', action: 'define_compliance_task', risk: 'medium', requiresApproval: false },
  { id: 'pruefplan', title: 'Prüfplan', action: 'create_compliance_plan', risk: 'medium', requiresApproval: false },
  { id: 'benoetigte_daten', title: 'Benötigte Daten', action: 'list_required_data', risk: 'low', requiresApproval: false },
  { id: 'aktionen', title: 'Aktionen', action: 'propose_compliance_actions', risk: 'high', requiresApproval: true },
  { id: 'risiko', title: 'Risiko', action: 'assess_compliance_risk', risk: 'high', requiresApproval: false },
  { id: 'ergebnisse', title: 'Ergebnisse', action: 'evaluate_governance', risk: 'high', requiresApproval: true },
  { id: 'offene_punkte', title: 'Offene Punkte', action: 'list_open_findings', risk: 'medium', requiresApproval: false },
  { id: 'massnahmen', title: 'Maßnahmen', action: 'propose_remediation', risk: 'high', requiresApproval: true },
  { id: 'evidence_pack', title: 'Evidence Pack', action: 'assemble_evidence_pack', risk: 'medium', requiresApproval: true },
  { id: 'abschlussbericht', title: 'Abschlussbericht', action: 'generate_closing_report', risk: 'medium', requiresApproval: true },
] as const;

export type FindingActionId = 'pruefen' | 'dokumentation' | 'delegieren' | 'ignorieren';

export type FindingAction = {
  id: FindingActionId;
  label: string;
};

export const FINDING_ACTIONS: readonly FindingAction[] = [
  { id: 'pruefen', label: 'Prüfen' },
  { id: 'dokumentation', label: 'Dokumentation erstellen' },
  { id: 'delegieren', label: 'Aufgabe delegieren' },
  { id: 'ignorieren', label: 'Ignorieren' },
] as const;

/** Example finding used in the first UI slice — illustrative, not a live scan result. */
export const EXAMPLE_VENDOR_FINDING = {
  id: 'finding-vendor-legal-basis',
  severity: 'high' as const,
  title: 'Fehlende Rechtsgrundlage für Vendor X',
  summary:
    'Für die Verarbeitung personenbezogener Daten durch Vendor X ist keine dokumentierte Rechtsgrundlage hinterlegt (Art. 6 DSGVO). Preview-Befund — kein Live-Scan.',
  vendor: 'Vendor X',
  framework: 'DSGVO · EU AI Act',
  preview: true,
};

export function isComplianceIntent(text: string): boolean {
  const t = text.toLowerCase();
  return (
    t.includes('dsgvo') ||
    t.includes('gdpr') ||
    t.includes('datenschutz') ||
    t.includes('ai act') ||
    t.includes('eu ai') ||
    t.includes('ki-verordnung') ||
    t.includes('compliance') ||
    t.includes('governance') ||
    (t.includes('prüfe') && (t.includes('ki') || t.includes('ai') || t.includes('anwendung')))
  );
}

export function createCompliancePlanSteps(): PlanStep[] {
  return COMPLIANCE_ARTIFACTS.map((artifact, index) => {
    const dependsOn = index === 0 ? [] : [COMPLIANCE_ARTIFACTS[index - 1].id];
    return {
      id: artifact.id,
      title: artifact.title,
      agent: 'compliance',
      action: artifact.action,
      risk: artifact.risk,
      requiresApproval: artifact.requiresApproval,
      dependsOn,
    };
  });
}

const COMPLIANCE_KERNEL_ACTIONS = new Set(
  COMPLIANCE_ARTIFACTS.filter((a) => a.action !== 'evaluate_governance').map((a) => a.action),
);

export function isComplianceKernelAction(action: string): boolean {
  return COMPLIANCE_KERNEL_ACTIONS.has(action);
}

export function complianceArtifactObservation(action: string, intentText: string): Record<string, unknown> {
  const def = COMPLIANCE_ARTIFACTS.find((a) => a.action === action);
  return {
    kind: 'compliance_artifact_preview',
    artifact: def?.id ?? action,
    title: def?.title ?? action,
    intent: intentText,
    note: 'Preview-Artefakt — kein Fake-KPI. Live-Scan nur über gebundene Substrate.',
    preview: true,
  };
}
