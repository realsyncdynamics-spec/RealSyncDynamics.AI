/**
 * Static EU AI Act requirement catalog (Art. 9–15 + Art. 50).
 * Source of truth for IDs: docs/compliance/ai-act-requirement-catalog.json
 * Keep in sync when the JSON catalog changes.
 */

import type { AiActComplianceArticle } from './aiActCompliance';

export type AiActActorRole = 'provider' | 'deployer';

export interface AiActCatalogRequirement {
  requirementId: string;
  article: AiActComplianceArticle;
  title: string;
  appliesTo: AiActActorRole[];
  highRiskOnly: boolean;
  relatedRequirementIds?: string[];
}

export const AI_ACT_REQUIREMENT_CATALOG: readonly AiActCatalogRequirement[] = [
  { requirementId: '9.1', article: 9, title: 'Risk management system established and maintained', appliesTo: ['provider', 'deployer'], highRiskOnly: true },
  { requirementId: '9.2', article: 9, title: 'Identify and analyse risks to health, safety, fundamental rights', appliesTo: ['provider', 'deployer'], highRiskOnly: true },
  { requirementId: '9.3', article: 9, title: 'Assess intended use and reasonably foreseeable misuse', appliesTo: ['provider', 'deployer'], highRiskOnly: true },
  { requirementId: '9.4', article: 9, title: 'Define and prioritise risk mitigation measures', appliesTo: ['provider', 'deployer'], highRiskOnly: true },
  { requirementId: '9.5', article: 9, title: 'Document residual risks and acceptance rationale', appliesTo: ['provider', 'deployer'], highRiskOnly: true },
  { requirementId: '9.6', article: 9, title: 'Update risk management on system, risk, or incident change', appliesTo: ['provider', 'deployer'], highRiskOnly: true },
  { requirementId: '9.7', article: 9, title: 'Test risk-mitigation measures as appropriate', appliesTo: ['provider', 'deployer'], highRiskOnly: true },
  { requirementId: '9.8', article: 9, title: 'Feed post-market monitoring into risk management', appliesTo: ['provider', 'deployer'], highRiskOnly: true },

  { requirementId: '10.1', article: 10, title: 'Describe training, validation, and testing data where used', appliesTo: ['provider', 'deployer'], highRiskOnly: true },
  { requirementId: '10.2', article: 10, title: 'Data relevant, representative, and sufficiently complete for purpose', appliesTo: ['provider', 'deployer'], highRiskOnly: true },
  { requirementId: '10.3', article: 10, title: 'Document data governance practices', appliesTo: ['provider', 'deployer'], highRiskOnly: true },
  { requirementId: '10.4', article: 10, title: 'Examine and mitigate bias where relevant', appliesTo: ['provider', 'deployer'], highRiskOnly: true },
  { requirementId: '10.5', article: 10, title: 'Special-category data only under applicable legal conditions', appliesTo: ['provider', 'deployer'], highRiskOnly: true },
  { requirementId: '10.6', article: 10, title: 'Datasets and governance traceable for conformity assessment', appliesTo: ['provider', 'deployer'], highRiskOnly: true },

  { requirementId: '11.1', article: 11, title: 'Technical documentation available before placing on market / putting into service', appliesTo: ['provider'], highRiskOnly: true },
  { requirementId: '11.2', article: 11, title: 'General description of the AI system', appliesTo: ['provider'], highRiskOnly: true },
  { requirementId: '11.3', article: 11, title: 'Detailed technical description', appliesTo: ['provider'], highRiskOnly: true },
  { requirementId: '11.4', article: 11, title: 'Development process and data described', appliesTo: ['provider'], highRiskOnly: true },
  { requirementId: '11.5', article: 11, title: 'Risk management documented (link Art. 9)', appliesTo: ['provider'], highRiskOnly: true, relatedRequirementIds: ['9.1', '9.2', '9.3', '9.4', '9.5', '9.6', '9.7', '9.8'] },
  { requirementId: '11.6', article: 11, title: 'Monitoring and control mechanisms described', appliesTo: ['provider'], highRiskOnly: true },
  { requirementId: '11.7', article: 11, title: 'System changes traceable', appliesTo: ['provider'], highRiskOnly: true },
  { requirementId: '11.8', article: 11, title: 'Documentation current and available to authorities', appliesTo: ['provider'], highRiskOnly: true },

  { requirementId: '12.1', article: 12, title: 'Automatic logging of relevant operational events', appliesTo: ['provider', 'deployer'], highRiskOnly: true },
  { requirementId: '12.2', article: 12, title: 'Logs support traceability of outputs', appliesTo: ['provider', 'deployer'], highRiskOnly: true },
  { requirementId: '12.3', article: 12, title: 'Logs support monitoring and risk detection', appliesTo: ['provider', 'deployer'], highRiskOnly: true },
  { requirementId: '12.4', article: 12, title: 'Retention period defined and enforced', appliesTo: ['provider', 'deployer'], highRiskOnly: true },
  { requirementId: '12.5', article: 12, title: 'Log integrity and access control', appliesTo: ['provider', 'deployer'], highRiskOnly: true },
  { requirementId: '12.6', article: 12, title: 'Deployers can use or receive relevant logs', appliesTo: ['provider', 'deployer'], highRiskOnly: true },

  { requirementId: '13.1', article: 13, title: 'Clear instructions for use for deployers', appliesTo: ['provider'], highRiskOnly: true, relatedRequirementIds: ['50.1', '50.2', '50.3', '50.4'] },
  { requirementId: '13.2', article: 13, title: 'Characteristics, capabilities, and limitations described', appliesTo: ['provider'], highRiskOnly: true },
  { requirementId: '13.3', article: 13, title: 'Intended purpose and risky misuse described', appliesTo: ['provider'], highRiskOnly: true },
  { requirementId: '13.4', article: 13, title: 'Performance information provided', appliesTo: ['provider'], highRiskOnly: true },
  { requirementId: '13.5', article: 13, title: 'Human oversight guidance', appliesTo: ['provider'], highRiskOnly: true, relatedRequirementIds: ['14.1', '14.2', '14.3', '14.4', '14.5', '14.6'] },
  { requirementId: '13.6', article: 13, title: 'Guidance on interpreting outputs', appliesTo: ['provider'], highRiskOnly: true },
  { requirementId: '13.7', article: 13, title: 'Maintenance, updates, and material changes communicated', appliesTo: ['provider'], highRiskOnly: true },

  { requirementId: '14.1', article: 14, title: 'System enables effective human oversight', appliesTo: ['provider', 'deployer'], highRiskOnly: true },
  { requirementId: '14.2', article: 14, title: 'Oversight persons have competence and authority', appliesTo: ['deployer'], highRiskOnly: true },
  { requirementId: '14.3', article: 14, title: 'Oversight can understand, challenge, and withhold reliance', appliesTo: ['provider', 'deployer'], highRiskOnly: true },
  { requirementId: '14.4', article: 14, title: 'Ability to interrupt, stop, or deactivate', appliesTo: ['provider', 'deployer'], highRiskOnly: true },
  { requirementId: '14.5', article: 14, title: 'Measures against automation bias', appliesTo: ['provider', 'deployer'], highRiskOnly: true },
  { requirementId: '14.6', article: 14, title: 'Oversight in instructions and procedures', appliesTo: ['provider', 'deployer'], highRiskOnly: true },

  { requirementId: '15.1', article: 15, title: 'Appropriate accuracy defined and measured', appliesTo: ['provider'], highRiskOnly: true },
  { requirementId: '15.2', article: 15, title: 'Robustness against errors and inconsistencies', appliesTo: ['provider'], highRiskOnly: true },
  { requirementId: '15.3', article: 15, title: 'Resilience to manipulation where relevant', appliesTo: ['provider'], highRiskOnly: true },
  { requirementId: '15.4', article: 15, title: 'Proportionate cybersecurity measures', appliesTo: ['provider', 'deployer'], highRiskOnly: true },
  { requirementId: '15.5', article: 15, title: 'Feedback loops and drift handled where applicable', appliesTo: ['provider'], highRiskOnly: true },
  { requirementId: '15.6', article: 15, title: 'Performance and security maintained over lifecycle', appliesTo: ['provider', 'deployer'], highRiskOnly: true },

  // Art. 50 — separate transparency block (not high-risk-only)
  { requirementId: '50.1', article: 50, title: 'Inform natural persons of AI interaction', appliesTo: ['provider'], highRiskOnly: false, relatedRequirementIds: ['13.1'] },
  { requirementId: '50.2', article: 50, title: 'Machine-readable marking of synthetic content', appliesTo: ['provider'], highRiskOnly: false, relatedRequirementIds: ['13.1'] },
  { requirementId: '50.3', article: 50, title: 'Inform persons exposed to emotion recognition or biometric categorisation', appliesTo: ['deployer'], highRiskOnly: false },
  { requirementId: '50.4', article: 50, title: 'Disclose deepfakes and certain public-interest AI text', appliesTo: ['deployer'], highRiskOnly: false },
] as const;

export function getCatalogRequirement(requirementId: string): AiActCatalogRequirement | undefined {
  return AI_ACT_REQUIREMENT_CATALOG.find((r) => r.requirementId === requirementId);
}

export function catalogByArticle(article: AiActComplianceArticle): AiActCatalogRequirement[] {
  return AI_ACT_REQUIREMENT_CATALOG.filter((r) => r.article === article);
}
