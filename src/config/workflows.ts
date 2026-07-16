export interface WorkflowStep {
  id: string;
  title: string;
  description: string;
  instruction: string;
  suggestedInput?: Record<string, any>;
  estimatedTime: string;
  helpLink?: string;
}

export interface WorkflowTemplate {
  id: string;
  name: string;
  description: string;
  category: 'policy' | 'vendor' | 'incident' | 'assessment' | 'documentation';
  estimatedDuration: string;
  difficulty: 'easy' | 'medium' | 'hard';
  steps: WorkflowStep[];
  tags: string[];
}

export const WORKFLOW_TEMPLATES: WorkflowTemplate[] = [
  {
    id: 'dpia-assessment',
    name: 'DPIA Assessment Workflow',
    description: 'Complete a Data Protection Impact Assessment for a new processing activity',
    category: 'assessment',
    estimatedDuration: '45 min',
    difficulty: 'hard',
    tags: ['GDPR', 'Assessment', 'Privacy'],
    steps: [
      {
        id: 'dpia-1',
        title: 'Define Processing Activity',
        description: 'Describe the data processing activity being assessed',
        instruction: 'Provide details about what data is being processed, by whom, and for what purpose',
        estimatedTime: '10 min',
        helpLink: '/docs/dpia-processing-activity',
      },
      {
        id: 'dpia-2',
        title: 'Assess Necessity & Proportionality',
        description: 'Evaluate if the processing is necessary and proportionate',
        instruction: 'Document legal basis, necessity justification, and any data minimization opportunities',
        estimatedTime: '8 min',
        helpLink: '/docs/dpia-necessity',
      },
      {
        id: 'dpia-3',
        title: 'Identify Risks',
        description: 'List potential risks to data subjects',
        instruction: 'Document confidentiality, integrity, availability, and other risks related to the processing',
        estimatedTime: '12 min',
        helpLink: '/docs/dpia-risks',
      },
      {
        id: 'dpia-4',
        title: 'Propose Mitigations',
        description: 'Define measures to address identified risks',
        instruction: 'For each risk, propose technical, organizational, or procedural mitigation measures',
        estimatedTime: '10 min',
        helpLink: '/docs/dpia-mitigations',
      },
      {
        id: 'dpia-5',
        title: 'Document Conclusion',
        description: 'Summarize findings and get stakeholder approval',
        instruction: 'Write executive summary, obtain sign-off from legal/compliance, and store in audit trail',
        estimatedTime: '5 min',
        helpLink: '/docs/dpia-conclusion',
      },
    ],
  },
  {
    id: 'vendor-onboarding',
    name: 'Sub-Processor Onboarding',
    description: 'Onboard a new vendor or sub-processor with proper compliance checks',
    category: 'vendor',
    estimatedDuration: '30 min',
    difficulty: 'medium',
    tags: ['Vendor', 'DPA', 'Risk Assessment'],
    steps: [
      {
        id: 'vendor-1',
        title: 'Collect Vendor Information',
        description: 'Gather basic details about the vendor',
        instruction: 'Record vendor name, contact, service type, and data categories they will process',
        estimatedTime: '5 min',
        helpLink: '/docs/vendor-info',
      },
      {
        id: 'vendor-2',
        title: 'Conduct Risk Assessment',
        description: 'Evaluate vendor security and compliance posture',
        instruction: 'Review certifications, security measures, incident history, and geographical location',
        estimatedTime: '8 min',
        helpLink: '/docs/vendor-risk',
      },
      {
        id: 'vendor-3',
        title: 'Execute Data Processing Agreement',
        description: 'Finalize DPA with appropriate clauses',
        instruction: 'Complete DPA including standard contractual clauses if applicable, SCCs, and SLA terms',
        estimatedTime: '8 min',
        helpLink: '/docs/vendor-dpa',
      },
      {
        id: 'vendor-4',
        title: 'Set Up Monitoring',
        description: 'Configure ongoing compliance monitoring',
        instruction: 'Enable vendor risk dashboard, set audit frequency, and configure alerts for incidents',
        estimatedTime: '5 min',
        helpLink: '/docs/vendor-monitoring',
      },
      {
        id: 'vendor-5',
        title: 'Document & Archive',
        description: 'Store vendor documentation in compliance registry',
        instruction: 'Upload DPA, certifications, and risk assessment to evidence vault with metadata',
        estimatedTime: '4 min',
        helpLink: '/docs/vendor-archive',
      },
    ],
  },
  {
    id: 'policy-documentation',
    name: 'Policy Documentation',
    description: 'Draft and approve a new compliance policy',
    category: 'policy',
    estimatedDuration: '20 min',
    difficulty: 'easy',
    tags: ['Policy', 'Documentation', 'Governance'],
    steps: [
      {
        id: 'policy-1',
        title: 'Define Policy Scope',
        description: 'Outline what the policy covers',
        instruction: 'Specify applicable regulations, scope (who, what, where), and policy objective',
        estimatedTime: '5 min',
        helpLink: '/docs/policy-scope',
      },
      {
        id: 'policy-2',
        title: 'Draft Policy Content',
        description: 'Write policy procedures and requirements',
        instruction: 'Use AI assistant to generate draft based on governance framework, edit as needed',
        estimatedTime: '8 min',
        helpLink: '/docs/policy-draft',
      },
      {
        id: 'policy-3',
        title: 'Review & Approve',
        description: 'Get stakeholder sign-off',
        instruction: 'Send to legal/compliance for review, collect approvals, document any changes',
        estimatedTime: '5 min',
        helpLink: '/docs/policy-review',
      },
      {
        id: 'policy-4',
        title: 'Publish & Communicate',
        description: 'Make policy available and notify relevant stakeholders',
        instruction: 'Upload to knowledge base, send announcement, schedule training if needed',
        estimatedTime: '2 min',
        helpLink: '/docs/policy-publish',
      },
    ],
  },
  {
    id: 'incident-response',
    name: 'Incident Response',
    description: 'Respond to and document a security or compliance incident',
    category: 'incident',
    estimatedDuration: 'ongoing',
    difficulty: 'hard',
    tags: ['Incident', 'Response', 'Emergency'],
    steps: [
      {
        id: 'incident-1',
        title: 'Assess & Escalate',
        description: 'Determine incident severity and notify stakeholders',
        instruction: 'Assess impact scope, severity level; notify IR team, legal, and executives',
        estimatedTime: '5 min',
        helpLink: '/docs/incident-assess',
      },
      {
        id: 'incident-2',
        title: 'Contain & Investigate',
        description: 'Stop ongoing damage and gather forensic evidence',
        instruction: 'Isolate affected systems, preserve logs, interview witnesses, document timeline',
        estimatedTime: 'varies',
        helpLink: '/docs/incident-contain',
      },
      {
        id: 'incident-3',
        title: 'Notify Authorities & Subjects',
        description: 'Determine notification requirements and inform relevant parties',
        instruction: 'File breach notification with DPA (if required), notify affected data subjects within 72h',
        estimatedTime: 'varies',
        helpLink: '/docs/incident-notify',
      },
      {
        id: 'incident-4',
        title: 'Root Cause Analysis',
        description: 'Understand how the incident occurred',
        instruction: 'Document technical findings, contributing factors, and root cause',
        estimatedTime: '30 min',
        helpLink: '/docs/incident-rca',
      },
      {
        id: 'incident-5',
        title: 'Remediation & Prevention',
        description: 'Fix immediate issues and prevent recurrence',
        instruction: 'Implement short-term fixes, develop long-term preventive measures, track completion',
        estimatedTime: '1-2 days',
        helpLink: '/docs/incident-remediate',
      },
      {
        id: 'incident-6',
        title: 'Post-Incident Review',
        description: 'Evaluate response effectiveness',
        instruction: 'Document lessons learned, identify process improvements, update incident plan',
        estimatedTime: '30 min',
        helpLink: '/docs/incident-review',
      },
      {
        id: 'incident-7',
        title: 'Archive Evidence',
        description: 'Store incident documentation for audit trail',
        instruction: 'Upload all incident documentation to evidence vault with tamper-proof timestamp',
        estimatedTime: '5 min',
        helpLink: '/docs/incident-archive',
      },
    ],
  },
  {
    id: 'vendor-risk-assessment',
    name: 'Vendor Risk Assessment',
    description: 'Conduct a comprehensive risk assessment for an existing vendor',
    category: 'assessment',
    estimatedDuration: '25 min',
    difficulty: 'medium',
    tags: ['Vendor', 'Risk', 'Assessment'],
    steps: [
      {
        id: 'risk-1',
        title: 'Review Vendor Basics',
        description: 'Verify current vendor information',
        instruction: 'Confirm vendor contact, services, data categories, and location',
        estimatedTime: '3 min',
        helpLink: '/docs/risk-basics',
      },
      {
        id: 'risk-2',
        title: 'Evaluate Security Controls',
        description: 'Assess technical and organizational measures',
        instruction: 'Review certifications (ISO 27001, SOC2), encryption, access controls, incident response',
        estimatedTime: '8 min',
        helpLink: '/docs/risk-security',
      },
      {
        id: 'risk-3',
        title: 'Assess Compliance Posture',
        description: 'Check regulatory compliance status',
        instruction: 'Verify GDPR compliance, data residency, subprocessor policies, audit history',
        estimatedTime: '7 min',
        helpLink: '/docs/risk-compliance',
      },
      {
        id: 'risk-4',
        title: 'Score & Document',
        description: 'Assign risk rating and create assessment record',
        instruction: 'Calculate overall risk score (low/medium/high), document findings, plan remediation',
        estimatedTime: '5 min',
        helpLink: '/docs/risk-score',
      },
      {
        id: 'risk-5',
        title: 'Plan Next Steps',
        description: 'Define follow-up actions',
        instruction: 'Schedule next assessment date, document any concerns, assign owner for remediation',
        estimatedTime: '2 min',
        helpLink: '/docs/risk-followup',
      },
    ],
  },
];

export function getWorkflowById(id: string): WorkflowTemplate | undefined {
  return WORKFLOW_TEMPLATES.find((w) => w.id === id);
}

export function getWorkflowsByCategory(category: WorkflowTemplate['category']): WorkflowTemplate[] {
  return WORKFLOW_TEMPLATES.filter((w) => w.category === category);
}

export function getWorkflowsByTag(tag: string): WorkflowTemplate[] {
  return WORKFLOW_TEMPLATES.filter((w) => w.tags.includes(tag));
}
