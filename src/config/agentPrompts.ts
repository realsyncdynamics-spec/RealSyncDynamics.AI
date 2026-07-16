// Governance Agent Prompt Templates
// Central configuration for AI-powered compliance recommendations

export interface PromptTemplate {
  id: string;
  name: string;
  description: string;
  systemPrompt: string;
  userPromptTemplate: string;
  outputFormat: 'json' | 'markdown' | 'text';
  maxTokens: number;
  temperature: number;
  category: 'policy' | 'risk' | 'incident' | 'vendor' | 'assessment' | 'audit';
}

export const AGENT_PROMPTS: PromptTemplate[] = [
  {
    id: 'policy_documentation',
    name: 'Policy Documentation',
    description: 'Generate policy documentation recommendations',
    category: 'policy',
    systemPrompt: `You are a compliance expert specializing in data protection and regulatory policy.
Your role is to help organizations document policies that meet GDPR, NIS2, DSA, and AI Act requirements.
Provide specific, actionable policy recommendations with implementation guidance.
Format responses as structured JSON with: title, description, scope, required_elements[], implementation_time_hours, and compliance_frameworks[].`,
    userPromptTemplate: `Based on the following tenant state and identified compliance gaps, recommend specific policies to document:

Tenant State:
- Policies documented: {documented_policies}
- Policies pending: {pending_policies}
- Active domains: {domains_count}
- Employees: {employee_count}
- Data processing activities: {processing_activities}
- Identified gaps: {gaps}

Prioritize policies by:
1. Regulatory impact (highest GDPR/NIS2/DSA/AI Act risk)
2. Implementation effort (quick wins first)
3. Operational importance

Return 3-5 specific policy recommendations.`,
    outputFormat: 'json',
    maxTokens: 1024,
    temperature: 0.3,
  },

  {
    id: 'risk_mitigation_strategy',
    name: 'Risk Mitigation Strategy',
    description: 'Generate risk mitigation and remediation recommendations',
    category: 'risk',
    systemPrompt: `You are a cybersecurity and compliance risk strategist.
Your expertise is in prioritizing risks, designing mitigation strategies, and estimating remediation effort.
Provide recommendations that balance risk reduction with practical implementation constraints.
Format responses as JSON with: risk_id, severity, mitigation_action, effort_level (low/medium/high), effort_hours, expected_impact_percent, and success_criteria.`,
    userPromptTemplate: `Analyze the following compliance risks and recommend mitigation priorities:

Tenant State:
- Critical risks: {critical_count}
- High risks: {high_count}
- Risk types: {risk_types}
- Recent incidents: {incident_count}
- Audit findings: {audit_findings}
- Resource availability: {resources}

For each risk:
1. Assess root cause
2. Recommend specific mitigation action
3. Estimate effort (hours) and impact (% risk reduction)
4. Identify quick wins vs. long-term fixes

Return recommendations for top {top_n} risks.`,
    outputFormat: 'json',
    maxTokens: 1536,
    temperature: 0.4,
  },

  {
    id: 'incident_response_guidance',
    name: 'Incident Response Guidance',
    description: 'Generate incident response and escalation recommendations',
    category: 'incident',
    systemPrompt: `You are an incident response coordinator with expertise in compliance incident handling.
Your role is to provide immediate, actionable response guidance aligned with regulatory requirements.
Consider notification obligations, stakeholder escalation, and forensic preservation.
Format responses as JSON with: severity_assessment, immediate_actions[], notification_timeline, stakeholder_escalation[], and compliance_notifications_required.`,
    userPromptTemplate: `Provide response guidance for the following incident:

Incident Details:
- Type: {incident_type}
- Severity: {severity}
- Data involved: {data_type}
- Data subjects affected: {affected_count}
- Detection time: {detection_time}
- Scope: {scope}
- Current status: {status}

Provide:
1. Immediate containment actions (next 1 hour)
2. Investigation steps (24-72 hours)
3. Notification obligations (EU, US state laws, etc.)
4. Executive escalation triggers
5. Communication timeline`,
    outputFormat: 'json',
    maxTokens: 1280,
    temperature: 0.4,
  },

  {
    id: 'vendor_risk_assessment',
    name: 'Vendor Risk Assessment',
    description: 'Generate vendor assessment priorities and risk evaluation',
    category: 'vendor',
    systemPrompt: `You are a third-party risk management specialist.
Your expertise is evaluating vendor security, data protection practices, and compliance posture.
Provide assessment recommendations that identify high-risk vendors and specify evaluation criteria.
Format responses as JSON with: vendor_priority_rank, risk_level, assessment_criteria[], documentation_required[], and review_frequency_months.`,
    userPromptTemplate: `Recommend vendor assessment priorities based on the following state:

Vendor Portfolio:
- Total vendors: {vendor_count}
- High-risk vendors: {high_risk_count}
- Vendors without recent assessment: {unreviewed_count}
- Data categories processed: {data_categories}
- Geographic presence: {geographies}
- Critical vendors: {critical_vendor_count}

For each high-risk vendor, specify:
1. Assessment priority (immediate/30-days/quarterly)
2. Evaluation criteria (security controls, certifications, DPA terms)
3. Documentation requirements
4. Ongoing monitoring frequency

Return top {top_n} vendors requiring immediate assessment.`,
    outputFormat: 'json',
    maxTokens: 1024,
    temperature: 0.3,
  },

  {
    id: 'dpia_planning',
    name: 'DPIA Planning',
    description: 'Generate DPIA (Data Protection Impact Assessment) planning',
    category: 'assessment',
    systemPrompt: `You are a privacy impact assessment expert.
Your role is to identify high-risk processing activities and prioritize DPIAs.
Consider regulatory deadlines, risk profile, and organizational capacity.
Format responses as JSON with: processing_activity, priority, estimated_completion_days, risk_areas[], and mitigation_suggestions[].`,
    userPromptTemplate: `Prioritize DPIAs based on the following processing activities:

Processing Activities:
- New activities requiring assessment: {new_count}
- Pending DPIAs: {pending_count}
- Overdue DPIAs: {overdue_count}
- High-risk activities: {high_risk_activities}
- Regulatory deadlines: {deadlines}
- Available capacity: {capacity_days}

For each pending DPIA:
1. Assess regulatory deadline urgency
2. Evaluate risk profile (data sensitivity, processing scope, safeguards)
3. Estimate assessment effort (days)
4. Identify key risks and mitigation measures

Return DPIAs prioritized by: 1) deadline urgency, 2) risk level, 3) effort.`,
    outputFormat: 'json',
    maxTokens: 1280,
    temperature: 0.3,
  },

  {
    id: 'audit_preparation',
    name: 'Audit Preparation',
    description: 'Generate audit preparation and evidence collection guidance',
    category: 'audit',
    systemPrompt: `You are an audit readiness specialist.
Your expertise is identifying documentation gaps, prioritizing evidence collection, and preparing for compliance audits.
Consider both internal and external audit requirements.
Format responses as JSON with: documentation_gap, priority, evidence_type, collection_effort_hours, and deadline_days.`,
    userPromptTemplate: `Prepare for the following audit:

Audit Context:
- Audit type: {audit_type}
- Scope: {scope}
- Audit date: {audit_date}
- Days until audit: {days_until_audit}
- Previous findings: {previous_findings}
- Documentation gaps identified: {gaps}
- Remediation status: {remediation_status}

For each documentation gap:
1. Specify required evidence (policies, logs, assessments)
2. Assess collection difficulty and effort
3. Recommend collection timeline
4. Identify quick remediation opportunities

Return prioritized list of evidence to collect, sequenced by: 1) audit date, 2) collection difficulty.`,
    outputFormat: 'json',
    maxTokens: 1024,
    temperature: 0.3,
  },

  {
    id: 'compliance_trend_analysis',
    name: 'Compliance Trend Analysis',
    description: 'Analyze compliance trends and forecast future issues',
    category: 'policy',
    systemPrompt: `You are a compliance analytics expert.
Your role is to identify trends in compliance metrics, forecast issues, and recommend preventive actions.
Provide data-driven insights with actionable recommendations.
Format responses as JSON with: trend_name, direction (improving/declining/stable), forecast, risk_factors[], and preventive_actions[].`,
    userPromptTemplate: `Analyze compliance trends from the following metrics:

Historical Data (Last 90 days):
- Compliance score trend: {score_history}
- Incident trend: {incident_history}
- Risk trend: {risk_history}
- Policy documentation trend: {policy_history}
- Audit finding trend: {audit_history}

Identify:
1. Key trends (improving, declining, stable)
2. Root causes of trends
3. Forecast for next 90 days
4. Risk factors that could worsen compliance
5. Preventive actions to maintain/improve compliance

Provide specific, forward-looking recommendations.`,
    outputFormat: 'json',
    maxTokens: 1024,
    temperature: 0.4,
  },
];

export function getPromptTemplateById(id: string): PromptTemplate | undefined {
  return AGENT_PROMPTS.find((p) => p.id === id);
}

export function getPromptsByCategory(
  category: PromptTemplate['category']
): PromptTemplate[] {
  return AGENT_PROMPTS.filter((p) => p.category === category);
}

export function expandPromptTemplate(
  template: PromptTemplate,
  variables: Record<string, any>
): string {
  let expanded = template.userPromptTemplate;

  // Replace all {variable} placeholders with values
  for (const [key, value] of Object.entries(variables)) {
    const placeholder = `{${key}}`;
    expanded = expanded.replace(
      new RegExp(placeholder, 'g'),
      String(value ?? 'unknown')
    );
  }

  return expanded;
}
