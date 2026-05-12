/**
 * Demo data for the Governance Runtime Dashboard.
 *
 * The real dashboard (post-pilot) reads from Supabase via service-role
 * Edge Functions. Until the first browser-extension and SDK emitters
 * exist, the public `/governance-runtime` page renders this fixture so
 * prospects can see the shape of the product.
 *
 * IDs are stable strings (not UUIDs) so cross-references between
 * assets, events, policies, evidence and control-mappings stay
 * readable in the source. They are never persisted.
 */
import type {
  FrameworkControl,
  GovernanceAsset,
  GovernanceEvent,
  GovernancePolicy,
} from "./types";

export const demoGovernanceAssets: GovernanceAsset[] = [
  {
    id: "asset-website-001",
    assetType: "website",
    name: "Corporate Website",
    description: "Public marketing website with consent layer and tracking stack.",
    ownerEmail: "marketing@example.com",
    vendor: "Internal",
    systemUrl: "https://example.com",
    dataTypes: ["ip_address", "cookie_ids", "contact_form_data"],
    riskScore: 64,
    aiActClass: "unknown",
    status: "under_review",
    metadata: {
      crawler: "playwright",
      pagesScanned: 42
    }
  },
  {
    id: "asset-ai-001",
    assetType: "ai_system",
    name: "Customer Support Copilot",
    description: "AI assistant for customer support answer drafting.",
    ownerEmail: "support@example.com",
    vendor: "OpenAI",
    systemUrl: "https://platform.openai.com",
    dataTypes: ["customer_data", "support_tickets", "email_content"],
    riskScore: 72,
    aiActClass: "limited",
    status: "under_review",
    metadata: {
      model: "GPT-4.1",
      department: "Support"
    }
  },
  {
    id: "asset-ai-002",
    assetType: "ai_system",
    name: "HR Screening Assistant",
    description: "AI-assisted pre-screening of job applications.",
    ownerEmail: "hr@example.com",
    vendor: "Internal Agent",
    dataTypes: ["applicant_data", "employment_history", "assessment_notes"],
    riskScore: 91,
    aiActClass: "high",
    status: "active",
    metadata: {
      model: "Private LLM",
      aiActCategory: "employment_worker_management"
    }
  },
  {
    id: "asset-agent-001",
    assetType: "agent",
    name: "n8n Sales Qualification Agent",
    description: "Agentic workflow that qualifies inbound leads and creates CRM tasks.",
    ownerEmail: "sales@example.com",
    vendor: "n8n",
    dataTypes: ["lead_data", "email_content", "company_profile"],
    riskScore: 58,
    aiActClass: "limited",
    status: "active",
    metadata: {
      runtime: "n8n",
      actions: ["classify_lead", "create_task", "send_email"]
    }
  }
];

export const demoGovernancePolicies: GovernancePolicy[] = [
  {
    id: "policy-001",
    name: "No personal data in external LLMs",
    description:
      "Personal, customer or employee data must not be sent to external LLM providers without approval.",
    policyType: "data_transfer",
    severity: "critical",
    action: "block",
    condition: {
      dataTypes: ["customer_data", "employee_data", "health_data"],
      externalVendor: true
    },
    enabled: true
  },
  {
    id: "policy-002",
    name: "Human review for high-risk AI",
    description:
      "High-risk AI systems require documented human review before operational use.",
    policyType: "human_review",
    severity: "high",
    action: "require_approval",
    condition: {
      aiActClass: "high"
    },
    enabled: true
  },
  {
    id: "policy-003",
    name: "Agent actions require audit logging",
    description:
      "Agentic workflows that perform external actions must create immutable audit events.",
    policyType: "logging_required",
    severity: "high",
    action: "warn",
    condition: {
      assetType: "agent",
      actionExecuted: true
    },
    enabled: true
  }
];

export const demoGovernanceEvents: GovernanceEvent[] = [
  {
    id: "event-001",
    assetId: "asset-ai-002",
    policyId: "policy-002",
    eventType: "ai.high_risk_classified",
    eventSource: "manual",
    title: "High-risk AI system classified",
    summary:
      "HR Screening Assistant mapped to EU AI Act high-risk category for employment and worker management.",
    riskLevel: "critical",
    actorEmail: "compliance@example.com",
    vendor: "Internal Agent",
    modelName: "Private LLM",
    dataTypes: ["applicant_data", "employment_history"],
    policyAction: "require_approval",
    payload: {
      aiActArticle: "Art. 6",
      category: "employment_worker_management"
    },
    createdAt: "2026-05-12T08:30:00Z"
  },
  {
    id: "event-002",
    assetId: "asset-ai-001",
    policyId: "policy-001",
    eventType: "ai.data_transfer_risk",
    eventSource: "sdk",
    title: "Customer data detected in external LLM workflow",
    summary:
      "Support Copilot may process customer tickets and email content through an external AI vendor.",
    riskLevel: "high",
    actorEmail: "support@example.com",
    vendor: "OpenAI",
    modelName: "GPT-4.1",
    dataTypes: ["customer_data", "support_tickets"],
    policyAction: "warn",
    payload: {
      endpoint: "/v1/chat/completions",
      detectedBy: "sdk"
    },
    createdAt: "2026-05-12T09:10:00Z"
  },
  {
    id: "event-003",
    assetId: "asset-agent-001",
    policyId: "policy-003",
    eventType: "agent.action.executed",
    eventSource: "agent_runtime",
    title: "Agent created CRM task",
    summary:
      "n8n Sales Qualification Agent created an external CRM task and generated evidence.",
    riskLevel: "medium",
    actorEmail: "sales@example.com",
    vendor: "n8n",
    dataTypes: ["lead_data"],
    policyAction: "log",
    payload: {
      action: "create_task",
      target: "crm",
      evidenceCreated: true
    },
    createdAt: "2026-05-12T10:05:00Z"
  },
  {
    id: "event-004",
    assetId: "asset-website-001",
    eventType: "cookie.before_consent",
    eventSource: "website_scanner",
    title: "Cookie set before consent",
    summary:
      "Analytics identifier was detected before a valid opt-in signal was present.",
    riskLevel: "high",
    vendor: "Google Analytics",
    dataTypes: ["cookie_ids", "ip_address"],
    policyAction: "warn",
    payload: {
      cookie: "_ga",
      url: "https://example.com"
    },
    createdAt: "2026-05-12T11:20:00Z"
  }
];

export const demoFrameworkControls: FrameworkControl[] = [
  {
    id: "control-gdpr-5",
    framework: "GDPR",
    controlCode: "Art. 5",
    title: "Principles relating to processing",
    description: "Lawfulness, fairness, transparency, minimisation and accountability."
  },
  {
    id: "control-gdpr-35",
    framework: "GDPR",
    controlCode: "Art. 35",
    title: "Data Protection Impact Assessment",
    description: "Assessment for high-risk processing operations."
  },
  {
    id: "control-ai-9",
    framework: "EU_AI_ACT",
    controlCode: "Art. 9",
    title: "Risk Management System",
    description: "Risk management system for high-risk AI systems."
  },
  {
    id: "control-ai-12",
    framework: "EU_AI_ACT",
    controlCode: "Art. 12",
    title: "Record Keeping",
    description: "Automatic logging and traceability."
  },
  {
    id: "control-soc2-cc72",
    framework: "SOC_2",
    controlCode: "CC7.2",
    title: "Monitoring and detection",
    description: "Monitor system components and detect anomalies."
  }
];

