/**
 * Demo-Daten fuer das AI-Governance-OS.
 *
 * In dieser Iteration rendert die /ai-governance-Page (und die
 * eingebettete Section auf /features) statische Daten — die
 * Supabase-Tabellen aus 20260510_ai_governance_core.sql sind angelegt,
 * aber noch nicht mit Auth/RLS-Policies verkabelt.
 *
 * Die Beispiele decken die drei AI-Act-Risikoklassen ab (high / limited /
 * minimal) damit Procurement / DSB sehen, wie die Plattform unterschiedliche
 * Risiko-Profile darstellt.
 */

import type { AiEvidenceEvent, AiPolicy, AiSystem } from './types';

export const demoAiSystems: AiSystem[] = [
  {
    id: 'sys-001',
    name: 'Customer Support Copilot',
    vendor: 'OpenAI',
    modelName: 'GPT-4.1',
    department: 'Support',
    ownerEmail: 'support@example.com',
    purpose: 'Automatisierte Antwortvorschläge für Kundenanfragen',
    dataTypes: ['customer_data', 'support_tickets', 'email_content'],
    aiActClass: 'limited',
    riskScore: 62,
    status: 'under_review',
  },
  {
    id: 'sys-002',
    name: 'HR Screening Assistant',
    vendor: 'Internal Agent',
    modelName: 'Private LLM',
    department: 'HR',
    ownerEmail: 'hr@example.com',
    purpose: 'Vorselektion von Bewerbungen',
    dataTypes: ['applicant_data', 'employment_history'],
    aiActClass: 'high',
    riskScore: 88,
    status: 'active',
  },
  {
    id: 'sys-003',
    name: 'Marketing Content Agent',
    vendor: 'Anthropic',
    modelName: 'Claude',
    department: 'Marketing',
    ownerEmail: 'marketing@example.com',
    purpose: 'Generierung von Kampagnentexten',
    dataTypes: ['public_content', 'campaign_data'],
    aiActClass: 'minimal',
    riskScore: 24,
    status: 'approved',
  },
];

export const demoPolicies: AiPolicy[] = [
  {
    id: 'pol-001',
    name: 'Keine personenbezogenen Daten in externe LLMs',
    description:
      'Personenbezogene oder vertrauliche Daten dürfen nicht an externe Modelle übertragen werden.',
    severity: 'critical',
    ruleType: 'data_transfer',
    action: 'block',
    enabled: true,
  },
  {
    id: 'pol-002',
    name: 'Human Review für High-Risk-Systeme',
    description:
      'High-Risk AI Systeme benötigen dokumentierte menschliche Prüfung.',
    severity: 'high',
    ruleType: 'human_review',
    action: 'require_approval',
    enabled: true,
  },
  {
    id: 'pol-003',
    name: 'Audit Logging für Agent Actions',
    description:
      'Agentische Aktionen müssen vollständig protokolliert werden.',
    severity: 'high',
    ruleType: 'logging_required',
    action: 'warn',
    enabled: true,
  },
];

export const demoEvidenceEvents: AiEvidenceEvent[] = [
  {
    id: 'evt-001',
    aiSystemId: 'sys-002',
    policyId: 'pol-002',
    eventType: 'high_risk_detected',
    eventSummary:
      'HR Screening Assistant wurde als High-Risk AI System klassifiziert.',
    riskLevel: 'critical',
    evidence: {
      reason: 'employment decision support',
      aiActCategory: 'employment_worker_management',
    },
    createdAt: '2026-05-10T08:30:00Z',
  },
  {
    id: 'evt-002',
    aiSystemId: 'sys-001',
    policyId: 'pol-001',
    eventType: 'data_transfer_risk',
    eventSummary:
      'Customer Support Copilot verarbeitet potenziell personenbezogene Kundendaten.',
    riskLevel: 'high',
    evidence: {
      dataTypes: ['customer_data', 'email_content'],
      vendor: 'OpenAI',
    },
    createdAt: '2026-05-10T09:10:00Z',
  },
  {
    id: 'evt-003',
    aiSystemId: 'sys-003',
    eventType: 'system_approved',
    eventSummary:
      'Marketing Content Agent wurde als Minimal-Risk-System freigegeben.',
    riskLevel: 'low',
    evidence: {
      aiActClass: 'minimal',
      reviewedBy: 'compliance',
    },
    createdAt: '2026-05-10T10:00:00Z',
  },
];
