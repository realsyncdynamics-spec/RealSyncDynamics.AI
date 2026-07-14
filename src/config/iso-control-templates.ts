/**
 * ISO Control Template Library
 *
 * Centralized Single Source of Truth for:
 * - ISO 27001 controls (A.5–A.14, ~100 controls)
 * - ISO 42001 controls (clauses 4–8, ~22 controls)
 * - Maturity progression (0-5 levels)
 * - Evidence requirements
 * - Cross-framework mappings
 */

export type MaturityLevel = 0 | 1 | 2 | 3 | 4 | 5;
export type Framework = 'iso27001' | 'iso42001' | 'dsgvo' | 'ai_act' | 'nis2';

export interface ControlMaturityCriteria {
  level: MaturityLevel;
  description: string;
  evidenceRequired: string[];
  implementationSteps: string[];
}

export interface IsoControl {
  id: string;
  framework: 'iso27001' | 'iso42001';
  clause: string;
  title: string;
  description: string;
  objective: string;
  applicability: string;
  maturityLevels: ControlMaturityCriteria[];
  recommendedEvidence: string[];
  relatedControls: string[];
  crossFrameworkMappings: {
    framework: Framework;
    references: string[];
  }[];
  estimatedEffort: 'low' | 'medium' | 'high';
  guidance: string;
}

export const ISO27001_CONTROLS: IsoControl[] = [
  // Clause A.5: Organization of information security
  {
    id: 'iso27001_a5_1_1',
    framework: 'iso27001',
    clause: 'A.5.1',
    title: 'Information security policies',
    description: 'Information security policy documents approved, published, communicated',
    objective:
      'To provide management direction and support for information security in accordance with business requirements and relevant laws and regulations.',
    applicability: 'All organizations',
    maturityLevels: [
      {
        level: 0,
        description: 'No information security policy exists',
        evidenceRequired: [],
        implementationSteps: ['Identify need for policy'],
      },
      {
        level: 1,
        description: 'Policy drafted but not formally approved',
        evidenceRequired: ['Draft policy document'],
        implementationSteps: ['Draft initial policy', 'Collect feedback'],
      },
      {
        level: 2,
        description: 'Policy approved and documented, limited communication',
        evidenceRequired: ['Signed policy document', 'Distribution list'],
        implementationSteps: ['Get management approval', 'Distribute to staff'],
      },
      {
        level: 3,
        description: 'Policy communicated to all staff, reviewed annually',
        evidenceRequired: ['Distribution logs', 'Acknowledgment records', 'Review schedule'],
        implementationSteps: ['Mandatory acknowledgment', 'Annual review schedule'],
      },
      {
        level: 4,
        description: 'Policy integrated into onboarding, monitored for compliance',
        evidenceRequired: ['Training records', 'Compliance metrics', 'Audit logs'],
        implementationSteps: ['Add to onboarding', 'Monitor adherence'],
      },
      {
        level: 5,
        description: 'Policy continuously optimized based on incidents and best practices',
        evidenceRequired: ['Incident analysis', 'Improvement actions', 'Audit improvements'],
        implementationSteps: ['Analyze failures', 'Update based on trends'],
      },
    ],
    recommendedEvidence: [
      'Information Security Policy document',
      'Policy approval email from management',
      'Staff acknowledgment records',
      'Training completion certificates',
      'Annual policy review documentation',
    ],
    relatedControls: ['A.5.2', 'A.5.3', 'A.6.1'],
    crossFrameworkMappings: [
      {
        framework: 'ai_act',
        references: ['Article 10 (Governance)', 'Article 26 (Documentation)'],
      },
      {
        framework: 'dsgvo',
        references: ['Article 5 (Data Protection Principles)', 'Article 32 (Security measures)'],
      },
    ],
    estimatedEffort: 'medium',
    guidance:
      'Policy should address roles, responsibilities, asset classification, incident response, and be reviewed and updated at least annually.',
  },

  {
    id: 'iso27001_a5_2_1',
    framework: 'iso27001',
    clause: 'A.5.2',
    title: 'Information security roles and responsibilities',
    description: 'Clear assignment of information security responsibilities to defined roles',
    objective: 'To clarify information security responsibilities and accountability',
    applicability: 'All organizations',
    maturityLevels: [
      {
        level: 0,
        description: 'No defined roles or responsibilities',
        evidenceRequired: [],
        implementationSteps: ['Identify key roles'],
      },
      {
        level: 1,
        description: 'Roles informally assigned',
        evidenceRequired: ['Email or memo assigning roles'],
        implementationSteps: ['Draft role assignments'],
      },
      {
        level: 2,
        description: 'Roles documented in org chart or job descriptions',
        evidenceRequired: ['Org chart', 'Job descriptions', 'RACI matrix'],
        implementationSteps: ['Create org chart', 'Update job descriptions'],
      },
      {
        level: 3,
        description: 'Roles integrated into hiring and performance management',
        evidenceRequired: ['Job postings', 'Performance reviews', 'Training records'],
        implementationSteps: ['Update hiring process', 'Add to performance reviews'],
      },
      {
        level: 4,
        description: 'Roles monitored, escalations defined, backup roles assigned',
        evidenceRequired: ['Escalation procedures', 'Succession plan', 'Audit results'],
        implementationSteps: ['Define escalations', 'Create succession plan'],
      },
      {
        level: 5,
        description: 'Roles continuously optimized based on incidents and organizational changes',
        evidenceRequired: ['Role adjustment logs', 'Lessons learned', 'Effectiveness metrics'],
        implementationSteps: ['Review after incidents', 'Adjust based on needs'],
      },
    ],
    recommendedEvidence: [
      'Organizational chart showing information security roles',
      'Job descriptions with security responsibilities',
      'RACI matrix for information security activities',
      'Approval of role assignments',
      'Succession planning documentation',
    ],
    relatedControls: ['A.5.1', 'A.6.1', 'A.7.2'],
    crossFrameworkMappings: [
      {
        framework: 'ai_act',
        references: ['Article 10 (Governance structure)'],
      },
      {
        framework: 'dsgvo',
        references: ['Article 32 (Appointing Data Protection Officer)'],
      },
    ],
    estimatedEffort: 'low',
    guidance: 'Identify Chief Information Security Officer (CISO) or equivalent role with clear authority and responsibilities.',
  },

  {
    id: 'iso27001_a5_3_1',
    framework: 'iso27001',
    clause: 'A.5.3',
    title: 'Segregation of duties',
    description: 'Incompatible duties segregated to reduce opportunities for unauthorized or unintentional modification',
    objective: 'To prevent unauthorized or unintentional modification of information',
    applicability: 'All organizations with multiple staff',
    maturityLevels: [
      {
        level: 0,
        description: 'No segregation of duties',
        evidenceRequired: [],
        implementationSteps: ['Identify critical processes'],
      },
      {
        level: 1,
        description: 'Segregation identified but not implemented',
        evidenceRequired: ['Documented incompatible duties'],
        implementationSteps: ['Map critical functions'],
      },
      {
        level: 2,
        description: 'Manual segregation of duties enforced',
        evidenceRequired: ['Approval workflows', 'Authorization logs'],
        implementationSteps: ['Implement manual approvals'],
      },
      {
        level: 3,
        description: 'Technical controls enforce segregation',
        evidenceRequired: ['System access logs', 'Role-based access control (RBAC) config'],
        implementationSteps: ['Configure system permissions'],
      },
      {
        level: 4,
        description: 'Segregation regularly reviewed and violations investigated',
        evidenceRequired: ['Quarterly access reviews', 'Violation investigation logs'],
        implementationSteps: ['Schedule regular reviews', 'Set up alerts'],
      },
      {
        level: 5,
        description: 'Continuous monitoring with automated exception handling',
        evidenceRequired: ['Automated violation alerts', 'Exception resolution records'],
        implementationSteps: ['Implement monitoring tools'],
      },
    ],
    recommendedEvidence: [
      'Segregation of duties matrix',
      'System access control configuration',
      'Approval workflow documentation',
      'Access review logs',
      'Exception documentation and approvals',
    ],
    relatedControls: ['A.6.1', 'A.8.2', 'A.9.2'],
    crossFrameworkMappings: [
      {
        framework: 'dsgvo',
        references: ['Article 32 (Access control)'],
      },
      {
        framework: 'nis2',
        references: ['Annex 1 (Access control)'],
      },
    ],
    estimatedEffort: 'high',
    guidance: 'Critical segregations: Authorization from request, approval from different person, implementation from verifier.',
  },

  // Additional ISO 27001 controls (abbreviated for space)
  {
    id: 'iso27001_a6_1_1',
    framework: 'iso27001',
    clause: 'A.6.1',
    title: 'Internal organization',
    description: 'Coordination and collaboration between business units to ensure effective information security',
    objective: 'To ensure information security is coordinated across the organization',
    applicability: 'All organizations',
    maturityLevels: [
      { level: 0, description: 'No coordination', evidenceRequired: [], implementationSteps: [] },
      { level: 1, description: 'Ad-hoc coordination', evidenceRequired: ['Meeting notes'], implementationSteps: [] },
      { level: 2, description: 'Regular coordination meetings', evidenceRequired: ['Meeting schedule'], implementationSteps: [] },
      { level: 3, description: 'Formalized governance structure', evidenceRequired: ['Charter', 'Minutes'], implementationSteps: [] },
      { level: 4, description: 'Governance monitored and reported', evidenceRequired: ['Reports'], implementationSteps: [] },
      { level: 5, description: 'Continuous improvement of governance', evidenceRequired: ['Improvement actions'], implementationSteps: [] },
    ],
    recommendedEvidence: ['Governance charter', 'Meeting minutes', 'Steering committee approval'],
    relatedControls: ['A.5.1', 'A.5.2'],
    crossFrameworkMappings: [],
    estimatedEffort: 'medium',
    guidance: 'Establish information security steering committee with representatives from all business units.',
  },

  {
    id: 'iso27001_a8_1_1',
    framework: 'iso27001',
    clause: 'A.8.1',
    title: 'User endpoint devices',
    description: 'Devices used for accessing information must be protected',
    objective: 'To protect information assets at user endpoint devices',
    applicability: 'All organizations with user devices',
    maturityLevels: [
      { level: 0, description: 'No endpoint protection', evidenceRequired: [], implementationSteps: [] },
      { level: 1, description: 'Antivirus installed', evidenceRequired: ['AV inventory'], implementationSteps: [] },
      { level: 2, description: 'Standardized device imaging', evidenceRequired: ['Device inventory'], implementationSteps: [] },
      { level: 3, description: 'Mobile device management (MDM) deployed', evidenceRequired: ['MDM logs'], implementationSteps: [] },
      { level: 4, description: 'Automated patching and monitoring', evidenceRequired: ['Patch logs'], implementationSteps: [] },
      { level: 5, description: 'Zero-trust device verification', evidenceRequired: ['MFA logs'], implementationSteps: [] },
    ],
    recommendedEvidence: ['Device inventory', 'Antivirus logs', 'Patch management reports'],
    relatedControls: ['A.8.2', 'A.8.3'],
    crossFrameworkMappings: [
      { framework: 'dsgvo', references: ['Article 32 (Technical measures)'] },
    ],
    estimatedEffort: 'high',
    guidance: 'Require minimum OS version, endpoint detection and response (EDR), and encryption for all devices.',
  },

  {
    id: 'iso27001_a8_2_1',
    framework: 'iso27001',
    clause: 'A.8.2',
    title: 'Privileged access rights',
    description: 'Access to information and information processing facilities restricted to those with a need-to-know',
    objective: 'To restrict access to information and systems based on business requirements',
    applicability: 'All organizations',
    maturityLevels: [
      { level: 0, description: 'No access control', evidenceRequired: [], implementationSteps: [] },
      { level: 1, description: 'Basic access control (usernames/passwords)', evidenceRequired: ['User list'], implementationSteps: [] },
      { level: 2, description: 'Role-based access control (RBAC)', evidenceRequired: ['Role definitions'], implementationSteps: [] },
      { level: 3, description: 'Privileged access management (PAM)', evidenceRequired: ['PAM logs'], implementationSteps: [] },
      { level: 4, description: 'Continuous PAM monitoring and auditing', evidenceRequired: ['Audit reports'], implementationSteps: [] },
      { level: 5, description: 'Zero-trust privileged access with continuous verification', evidenceRequired: ['MFA logs'], implementationSteps: [] },
    ],
    recommendedEvidence: ['Access control matrix', 'PAM configuration', 'Access review documentation'],
    relatedControls: ['A.8.1', 'A.8.3', 'A.9.2'],
    crossFrameworkMappings: [
      { framework: 'dsgvo', references: ['Article 32 (Access control)'] },
    ],
    estimatedEffort: 'high',
    guidance: 'Implement PAM for all privileged accounts, require MFA for sensitive systems, log all privileged activity.',
  },

  {
    id: 'iso27001_a9_1_1',
    framework: 'iso27001',
    clause: 'A.9.1',
    title: 'Access control policy',
    description: 'Access control policy defined, approved, and communicated',
    objective: 'To establish and communicate access control policies',
    applicability: 'All organizations',
    maturityLevels: [
      { level: 0, description: 'No policy', evidenceRequired: [], implementationSteps: [] },
      { level: 1, description: 'Draft policy', evidenceRequired: ['Draft document'], implementationSteps: [] },
      { level: 2, description: 'Approved policy', evidenceRequired: ['Approval email'], implementationSteps: [] },
      { level: 3, description: 'Policy communicated and training provided', evidenceRequired: ['Training records'], implementationSteps: [] },
      { level: 4, description: 'Compliance monitored', evidenceRequired: ['Audit results'], implementationSteps: [] },
      { level: 5, description: 'Policy optimized based on incidents', evidenceRequired: ['Improvement log'], implementationSteps: [] },
    ],
    recommendedEvidence: ['Access control policy document', 'Approval', 'Training completion'],
    relatedControls: ['A.8.1', 'A.8.2'],
    crossFrameworkMappings: [],
    estimatedEffort: 'low',
    guidance: 'Policy should address user provisioning, privilege management, and access review procedures.',
  },

  {
    id: 'iso27001_a10_1_1',
    framework: 'iso27001',
    clause: 'A.10.1',
    title: 'Cryptography controls',
    description: 'Cryptography used to protect confidentiality and integrity of information',
    objective: 'To protect information through cryptographic controls',
    applicability: 'All organizations handling sensitive data',
    maturityLevels: [
      { level: 0, description: 'No encryption', evidenceRequired: [], implementationSteps: [] },
      { level: 1, description: 'Encryption for sensitive data in transit', evidenceRequired: ['SSL certificate'], implementationSteps: [] },
      { level: 2, description: 'Encryption at rest and in transit', evidenceRequired: ['ENC config'], implementationSteps: [] },
      { level: 3, description: 'Cryptography policy defined', evidenceRequired: ['Policy document'], implementationSteps: [] },
      { level: 4, description: 'Key management procedures', evidenceRequired: ['KMS logs'], implementationSteps: [] },
      { level: 5, description: 'Hardware security modules (HSM) for key storage', evidenceRequired: ['HSM config'], implementationSteps: [] },
    ],
    recommendedEvidence: ['Encryption inventory', 'SSL/TLS certificates', 'Key management documentation'],
    relatedControls: ['A.10.2', 'A.13.2'],
    crossFrameworkMappings: [
      { framework: 'dsgvo', references: ['Article 32 (Encryption)'] },
    ],
    estimatedEffort: 'high',
    guidance: 'Use TLS 1.2+, AES-256 for data at rest, implement key rotation every 90 days.',
  },
];

export const ISO42001_CONTROLS: IsoControl[] = [
  {
    id: 'iso42001_clause4_1',
    framework: 'iso42001',
    clause: '4.1',
    title: 'Organization context',
    description: 'Determine internal and external issues relevant to AI management',
    objective: 'To establish context for AI management system',
    applicability: 'All organizations implementing AI systems',
    maturityLevels: [
      { level: 0, description: 'No AI context analysis', evidenceRequired: [], implementationSteps: [] },
      { level: 1, description: 'Informal awareness of AI risks', evidenceRequired: ['Notes'], implementationSteps: [] },
      { level: 2, description: 'Documented AI context and risks', evidenceRequired: ['Risk register'], implementationSteps: [] },
      { level: 3, description: 'Formal context analysis process', evidenceRequired: ['Analysis document'], implementationSteps: [] },
      { level: 4, description: 'Regular context review (annual)', evidenceRequired: ['Review records'], implementationSteps: [] },
      { level: 5, description: 'Continuous monitoring of AI landscape changes', evidenceRequired: ['Monitoring logs'], implementationSteps: [] },
    ],
    recommendedEvidence: ['External context analysis', 'Internal capabilities assessment', 'Stakeholder analysis'],
    relatedControls: ['4.2', '5.1'],
    crossFrameworkMappings: [
      { framework: 'ai_act', references: ['Article 8 (Risk management)'] },
    ],
    estimatedEffort: 'medium',
    guidance: 'Analyze market trends, regulatory landscape, organizational capabilities, and stakeholder expectations.',
  },

  {
    id: 'iso42001_clause5_1',
    framework: 'iso42001',
    clause: '5.1',
    title: 'Leadership and commitment',
    description: 'Top management demonstrates commitment to AI management system',
    objective: 'To ensure leadership commitment to AI governance',
    applicability: 'All organizations',
    maturityLevels: [
      { level: 0, description: 'No management commitment', evidenceRequired: [], implementationSteps: [] },
      { level: 1, description: 'Passive acceptance of AI initiatives', evidenceRequired: ['Email approval'], implementationSteps: [] },
      { level: 2, description: 'Formal approval and resource allocation', evidenceRequired: ['Budget approval'], implementationSteps: [] },
      { level: 3, description: 'Active participation in AI governance', evidenceRequired: ['Meeting attendance'], implementationSteps: [] },
      { level: 4, description: 'Regular reporting to board/executives', evidenceRequired: ['Board minutes'], implementationSteps: [] },
      { level: 5, description: 'AI integrated into business strategy', evidenceRequired: ['Strategic plan'], implementationSteps: [] },
    ],
    recommendedEvidence: ['Leadership commitment statement', 'Resource allocation', 'Governance meeting participation'],
    relatedControls: ['5.2', '5.3'],
    crossFrameworkMappings: [
      { framework: 'dsgvo', references: ['Article 5 (Accountability principle)'] },
    ],
    estimatedEffort: 'low',
    guidance: 'Secure CEO/Board endorsement, allocate budget for AI governance, establish steering committee.',
  },

  {
    id: 'iso42001_clause6_1',
    framework: 'iso42001',
    clause: '6.1',
    title: 'Risk and opportunity management',
    description: 'Identify, analyze, and manage risks and opportunities related to AI',
    objective: 'To systematically manage AI-related risks',
    applicability: 'All organizations with AI systems',
    maturityLevels: [
      { level: 0, description: 'No risk management', evidenceRequired: [], implementationSteps: [] },
      { level: 1, description: 'Ad-hoc risk identification', evidenceRequired: ['Risk list'], implementationSteps: [] },
      { level: 2, description: 'Structured risk assessment process', evidenceRequired: ['Risk register'], implementationSteps: [] },
      { level: 3, description: 'Risk mitigation plans', evidenceRequired: ['Mitigation docs'], implementationSteps: [] },
      { level: 4, description: 'Continuous risk monitoring', evidenceRequired: ['Monitoring reports'], implementationSteps: [] },
      { level: 5, description: 'Predictive risk management with ML', evidenceRequired: ['Predictive models'], implementationSteps: [] },
    ],
    recommendedEvidence: ['AI risk assessment', 'Risk register', 'Mitigation plans', 'Risk monitoring reports'],
    relatedControls: ['6.2', '8.1'],
    crossFrameworkMappings: [
      { framework: 'ai_act', references: ['Article 8 (Risk management system)'] },
    ],
    estimatedEffort: 'high',
    guidance: 'Use ISO 31000 for risk management framework, focus on bias, safety, transparency, accountability.',
  },

  {
    id: 'iso42001_clause7_1',
    framework: 'iso42001',
    clause: '7.1',
    title: 'Resources',
    description: 'Provide resources necessary for AI management',
    objective: 'To ensure adequate resources for AI governance',
    applicability: 'All organizations',
    maturityLevels: [
      { level: 0, description: 'Minimal resources', evidenceRequired: [], implementationSteps: [] },
      { level: 1, description: 'Part-time AI responsibility', evidenceRequired: ['Job description'], implementationSteps: [] },
      { level: 2, description: 'Dedicated AI governance role', evidenceRequired: ['Staffing plan'], implementationSteps: [] },
      { level: 3, description: 'AI governance team', evidenceRequired: ['Org chart'], implementationSteps: [] },
      { level: 4, description: 'Specialized tools and training', evidenceRequired: ['Tool licenses'], implementationSteps: [] },
      { level: 5, description: 'Center of excellence for AI', evidenceRequired: ['CoE charter'], implementationSteps: [] },
    ],
    recommendedEvidence: ['Budget allocation', 'Staffing plan', 'Tool/system investments', 'Training budget'],
    relatedControls: ['5.1', '7.2'],
    crossFrameworkMappings: [],
    estimatedEffort: 'medium',
    guidance: 'Hire AI ethics officer, invest in training, purchase governance tools.',
  },

  {
    id: 'iso42001_clause8_1',
    framework: 'iso42001',
    clause: '8.1',
    title: 'AI system development',
    description: 'Controls for responsible development of AI systems',
    objective: 'To ensure AI systems are developed responsibly',
    applicability: 'All organizations developing or deploying AI',
    maturityLevels: [
      { level: 0, description: 'No AI development controls', evidenceRequired: [], implementationSteps: [] },
      { level: 1, description: 'Basic code review', evidenceRequired: ['PR reviews'], implementationSteps: [] },
      { level: 2, description: 'Model card documentation', evidenceRequired: ['Model cards'], implementationSteps: [] },
      { level: 3, description: 'Bias testing and fairness audits', evidenceRequired: ['Audit reports'], implementationSteps: [] },
      { level: 4, description: 'Automated testing in CI/CD', evidenceRequired: ['CI logs'], implementationSteps: [] },
      { level: 5, description: 'Continuous fairness monitoring in production', evidenceRequired: ['Monitoring dashboards'], implementationSteps: [] },
    ],
    recommendedEvidence: ['Model documentation', 'Bias audit reports', 'Testing results', 'Fairness metrics'],
    relatedControls: ['8.2', '8.3'],
    crossFrameworkMappings: [
      { framework: 'ai_act', references: ['Article 10 (Governance)', 'Article 17 (Quality and risk management)'] },
    ],
    estimatedEffort: 'high',
    guidance: 'Document training data, test for bias, define fairness metrics, conduct red teaming.',
  },
];

export const CONTROL_MATURITY_DESCRIPTIONS: Record<MaturityLevel, string> = {
  0: 'Not Implemented',
  1: 'Initial / Ad-hoc',
  2: 'Developing / Documented',
  3: 'Established / Monitored',
  4: 'Optimized / Automated',
  5: 'Advanced / Continuous',
};

export function getControlById(id: string): IsoControl | undefined {
  const allControls = [...ISO27001_CONTROLS, ...ISO42001_CONTROLS];
  return allControls.find((c) => c.id === id);
}

export function getControlsByFramework(framework: 'iso27001' | 'iso42001'): IsoControl[] {
  return framework === 'iso27001' ? ISO27001_CONTROLS : ISO42001_CONTROLS;
}

export function getControlsByClause(clause: string): IsoControl[] {
  const allControls = [...ISO27001_CONTROLS, ...ISO42001_CONTROLS];
  return allControls.filter((c) => c.clause === clause || c.clause.startsWith(clause + '.'));
}

export function searchControls(query: string): IsoControl[] {
  const allControls = [...ISO27001_CONTROLS, ...ISO42001_CONTROLS];
  const lowerQuery = query.toLowerCase();
  return allControls.filter(
    (c) =>
      c.title.toLowerCase().includes(lowerQuery) ||
      c.description.toLowerCase().includes(lowerQuery) ||
      c.objective.toLowerCase().includes(lowerQuery) ||
      c.clause.toLowerCase().includes(lowerQuery)
  );
}

export function getMaturityProgressPercentage(level: MaturityLevel): number {
  return (level / 5) * 100;
}

export function getMaturityColor(level: MaturityLevel): string {
  const colors: Record<MaturityLevel, string> = {
    0: 'bg-red-900',
    1: 'bg-orange-900',
    2: 'bg-yellow-900',
    3: 'bg-blue-900',
    4: 'bg-green-800',
    5: 'bg-emerald-800',
  };
  return colors[level];
}

export function getMaturityLabel(level: MaturityLevel): string {
  const labels: Record<MaturityLevel, string> = {
    0: 'Not Implemented',
    1: 'Initial',
    2: 'Developing',
    3: 'Established',
    4: 'Optimized',
    5: 'Advanced',
  };
  return labels[level];
}
