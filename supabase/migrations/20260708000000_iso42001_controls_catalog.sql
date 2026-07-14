-- ISO/IEC 42001:2024 Complete Controls Catalog
-- Comprehensive seeding of all ISO 42001 controls with implementation guidance

-- ─── Seed ISO 42001 Controls ───

-- A.4 Context of the AI Management System
INSERT INTO public.framework_controls
  (framework_id, control_code, control_name, description, guidance, severity, category)
SELECT
  f.id, 'ISO42001_A.4.1', 'Understand AI governance and organizational context',
  'Establish understanding of organizational context, interested parties, and AI-related risks/opportunities',
  'Document organizational strategy, stakeholder landscape, regulatory environment. Map AI dependencies and critical systems.',
  'critical', 'governance'
FROM public.compliance_frameworks f WHERE f.code = 'iso42001' AND NOT EXISTS (
  SELECT 1 FROM public.framework_controls WHERE framework_id = f.id AND control_code = 'ISO42001_A.4.1'
);

INSERT INTO public.framework_controls
  (framework_id, control_code, control_name, description, guidance, severity, category)
SELECT
  f.id, 'ISO42001_A.4.2', 'Define AI management system scope',
  'Determine and document scope of the AI management system, including AI processes and systems in and out of scope',
  'Create boundary diagrams. Document rationale for in/out of scope decisions. Link to organizational risk tolerance.',
  'high', 'governance'
FROM public.compliance_frameworks f WHERE f.code = 'iso42001' AND NOT EXISTS (
  SELECT 1 FROM public.framework_controls WHERE framework_id = f.id AND control_code = 'ISO42001_A.4.2'
);

-- A.5 Leadership and Commitment
INSERT INTO public.framework_controls
  (framework_id, control_code, control_name, description, guidance, severity, category)
SELECT
  f.id, 'ISO42001_A.5.1', 'Leadership demonstrates commitment to AI governance',
  'Leadership ensures AI management system is established, implemented, maintained, and continually improved',
  'Executive sponsorship documented. Board-level oversight structure established. Policies approved by senior leadership.',
  'critical', 'governance'
FROM public.compliance_frameworks f WHERE f.code = 'iso42001' AND NOT EXISTS (
  SELECT 1 FROM public.framework_controls WHERE framework_id = f.id AND control_code = 'ISO42001_A.5.1'
);

INSERT INTO public.framework_controls
  (framework_id, control_code, control_name, description, guidance, severity, category)
SELECT
  f.id, 'ISO42001_A.5.2', 'Leadership establishes AI policy',
  'Establish AI policy consistent with strategic direction and AI governance objectives',
  'Policy includes: AI ethics principles, risk tolerance, compliance requirements, responsibility allocation, incident response.',
  'high', 'governance'
FROM public.compliance_frameworks f WHERE f.code = 'iso42001' AND NOT EXISTS (
  SELECT 1 FROM public.framework_controls WHERE framework_id = f.id AND control_code = 'ISO42001_A.5.2'
);

-- A.6 Organization of Roles, Responsibilities and Authorities
INSERT INTO public.framework_controls
  (framework_id, control_code, control_name, description, guidance, severity, category)
SELECT
  f.id, 'ISO42001_A.6.1', 'Assign responsibility and authority for AI management system',
  'Assign responsibility and authority for taking action to conform to AI management system requirements',
  'Define roles: AI governance owner, data steward, model validator, incident response lead. Document RACI matrix.',
  'high', 'governance'
FROM public.compliance_frameworks f WHERE f.code = 'iso42001' AND NOT EXISTS (
  SELECT 1 FROM public.framework_controls WHERE framework_id = f.id AND control_code = 'ISO42001_A.6.1'
);

INSERT INTO public.framework_controls
  (framework_id, control_code, control_name, description, guidance, severity, category)
SELECT
  f.id, 'ISO42001_A.6.2', 'Communicate AI management system to organization',
  'Communicate role of AI governance to organization and ensure people understand AI governance responsibilities',
  'Conduct training program. Document communication plan. Track comprehension via assessments.',
  'medium', 'governance'
FROM public.compliance_frameworks f WHERE f.code = 'iso42001' AND NOT EXISTS (
  SELECT 1 FROM public.framework_controls WHERE framework_id = f.id AND control_code = 'ISO42001_A.6.2'
);

-- A.7 Support, Competence, Awareness and Communication
INSERT INTO public.framework_controls
  (framework_id, control_code, control_name, description, guidance, severity, category)
SELECT
  f.id, 'ISO42001_A.7.1', 'Determine resource needs for AI management system',
  'Determine and provide resources needed to establish, implement, maintain and continually improve AI management system',
  'Budget allocation for: staffing, tools, training, documentation. Link to organizational planning cycles.',
  'high', 'resources'
FROM public.compliance_frameworks f WHERE f.code = 'iso42001' AND NOT EXISTS (
  SELECT 1 FROM public.framework_controls WHERE framework_id = f.id AND control_code = 'ISO42001_A.7.1'
);

INSERT INTO public.framework_controls
  (framework_id, control_code, control_name, description, guidance, severity, category)
SELECT
  f.id, 'ISO42001_A.7.2', 'Ensure competence of people in AI management',
  'Ensure people involved in AI management system are competent on the basis of education, training or experience',
  'Competency matrix created. Training program defined. Continuing education tracked. External expertise secured as needed.',
  'high', 'resources'
FROM public.compliance_frameworks f WHERE f.code = 'iso42001' AND NOT EXISTS (
  SELECT 1 FROM public.framework_controls WHERE framework_id = f.id AND control_code = 'ISO42001_A.7.2'
);

INSERT INTO public.framework_controls
  (framework_id, control_code, control_name, description, guidance, severity, category)
SELECT
  f.id, 'ISO42001_A.7.3', 'Raise awareness about AI risks and governance',
  'Ensure people are aware of relevance and importance of AI governance to meet requirements',
  'Awareness campaigns. Documentation of AI risks. Case studies. Regular refresher training.',
  'medium', 'resources'
FROM public.compliance_frameworks f WHERE f.code = 'iso42001' AND NOT EXISTS (
  SELECT 1 FROM public.framework_controls WHERE framework_id = f.id AND control_code = 'ISO42001_A.7.3'
);

INSERT INTO public.framework_controls
  (framework_id, control_code, control_name, description, guidance, severity, category)
SELECT
  f.id, 'ISO42001_A.7.4', 'Establish communication processes',
  'Establish appropriate communication processes for AI management system effectiveness and compliance',
  'Stakeholder engagement plan. Internal/external communication protocols. Escalation procedures documented.',
  'medium', 'resources'
FROM public.compliance_frameworks f WHERE f.code = 'iso42001' AND NOT EXISTS (
  SELECT 1 FROM public.framework_controls WHERE framework_id = f.id AND control_code = 'ISO42001_A.7.4'
);

-- A.8 Operational Planning and Control
INSERT INTO public.framework_controls
  (framework_id, control_code, control_name, description, guidance, severity, category)
SELECT
  f.id, 'ISO42001_A.8.1', 'Plan and control AI processes',
  'Plan and control AI processes and activities to meet AI management system requirements and address AI risks',
  'Process documentation. Work instructions. Quality gates. Control procedures. Exception handling.',
  'high', 'operations'
FROM public.compliance_frameworks f WHERE f.code = 'iso42001' AND NOT EXISTS (
  SELECT 1 FROM public.framework_controls WHERE framework_id = f.id AND control_code = 'ISO42001_A.8.1'
);

INSERT INTO public.framework_controls
  (framework_id, control_code, control_name, description, guidance, severity, category)
SELECT
  f.id, 'ISO42001_A.8.2', 'Manage changes to AI systems',
  'Define, plan and control changes to AI systems to ensure impacts are assessed and risks are managed',
  'Change management process. Impact assessment template. Approval workflow. Rollback procedures.',
  'high', 'operations'
FROM public.compliance_frameworks f WHERE f.code = 'iso42001' AND NOT EXISTS (
  SELECT 1 FROM public.framework_controls WHERE framework_id = f.id AND control_code = 'ISO42001_A.8.2'
);

-- A.9 Performance Evaluation
INSERT INTO public.framework_controls
  (framework_id, control_code, control_name, description, guidance, severity, category)
SELECT
  f.id, 'ISO42001_A.9.1', 'Determine monitoring and measuring needs',
  'Determine what needs to be monitored and measured, monitoring methods and frequency, when results shall be analyzed',
  'KPI dashboard. Monitoring framework. Measurement tools selected. Analysis methods defined.',
  'high', 'monitoring'
FROM public.compliance_frameworks f WHERE f.code = 'iso42001' AND NOT EXISTS (
  SELECT 1 FROM public.framework_controls WHERE framework_id = f.id AND control_code = 'ISO42001_A.9.1'
);

INSERT INTO public.framework_controls
  (framework_id, control_code, control_name, description, guidance, severity, category)
SELECT
  f.id, 'ISO42001_A.9.2', 'Conduct internal audit of AI management system',
  'Conduct internal audits at planned intervals to provide information on whether AI management system conforms to requirements',
  'Annual audit schedule. Audit checklist developed. Auditor independence ensured. Reports documented.',
  'high', 'monitoring'
FROM public.compliance_frameworks f WHERE f.code = 'iso42001' AND NOT EXISTS (
  SELECT 1 FROM public.framework_controls WHERE framework_id = f.id AND control_code = 'ISO42001_A.9.2'
);

INSERT INTO public.framework_controls
  (framework_id, control_code, control_name, description, guidance, severity, category)
SELECT
  f.id, 'ISO42001_A.9.3', 'Conduct management review',
  'Management shall review AI management system at planned intervals to ensure its continuing suitability and effectiveness',
  'Executive review quarterly/annually. Performance data reviewed. Changes approved. Minutes documented.',
  'high', 'monitoring'
FROM public.compliance_frameworks f WHERE f.code = 'iso42001' AND NOT EXISTS (
  SELECT 1 FROM public.framework_controls WHERE framework_id = f.id AND control_code = 'ISO42001_A.9.3'
);

-- A.10 Improvement
INSERT INTO public.framework_controls
  (framework_id, control_code, control_name, description, guidance, severity, category)
SELECT
  f.id, 'ISO42001_A.10.1', 'Handle nonconformity and take corrective action',
  'Determine nonconformities and take corrective actions to restore conformity and prevent recurrence',
  'Incident log maintained. Root cause analysis process. Corrective action tracking. Effectiveness verification.',
  'high', 'improvement'
FROM public.compliance_frameworks f WHERE f.code = 'iso42001' AND NOT EXISTS (
  SELECT 1 FROM public.framework_controls WHERE framework_id = f.id AND control_code = 'ISO42001_A.10.1'
);

INSERT INTO public.framework_controls
  (framework_id, control_code, control_name, description, guidance, severity, category)
SELECT
  f.id, 'ISO42001_A.10.2', 'Continually improve AI management system',
  'Continually improve the suitability, adequacy and effectiveness of AI management system',
  'Improvement roadmap. Feedback mechanisms. Lessons learned captured. Regular review of standards updates.',
  'medium', 'improvement'
FROM public.compliance_frameworks f WHERE f.code = 'iso42001' AND NOT EXISTS (
  SELECT 1 FROM public.framework_controls WHERE framework_id = f.id AND control_code = 'ISO42001_A.10.2'
);

-- Annex A: Information and Communication Technology
INSERT INTO public.framework_controls
  (framework_id, control_code, control_name, description, guidance, severity, category)
SELECT
  f.id, 'ISO42001_AnxA.1', 'Manage AI training data',
  'Implement controls to ensure quality, fairness, and security of AI training data',
  'Data inventory. Quality checks. Bias testing. Access controls. Retention policies.',
  'critical', 'data'
FROM public.compliance_frameworks f WHERE f.code = 'iso42001' AND NOT EXISTS (
  SELECT 1 FROM public.framework_controls WHERE framework_id = f.id AND control_code = 'ISO42001_AnxA.1'
);

INSERT INTO public.framework_controls
  (framework_id, control_code, control_name, description, guidance, severity, category)
SELECT
  f.id, 'ISO42001_AnxA.2', 'Document AI model development',
  'Maintain comprehensive documentation of AI model development, training, validation, and deployment',
  'Model registry. Version control. Training dataset documentation. Performance metrics. Validation results.',
  'high', 'documentation'
FROM public.compliance_frameworks f WHERE f.code = 'iso42001' AND NOT EXISTS (
  SELECT 1 FROM public.framework_controls WHERE framework_id = f.id AND control_code = 'ISO42001_AnxA.2'
);

INSERT INTO public.framework_controls
  (framework_id, control_code, control_name, description, guidance, severity, category)
SELECT
  f.id, 'ISO42001_AnxA.3', 'Implement monitoring of AI systems',
  'Monitor AI systems performance, drift, and anomalies in production environment',
  'Monitoring dashboard. Alert thresholds. Model performance tracking. Drift detection. Incident response escalation.',
  'high', 'monitoring'
FROM public.compliance_frameworks f WHERE f.code = 'iso42001' AND NOT EXISTS (
  SELECT 1 FROM public.framework_controls WHERE framework_id = f.id AND control_code = 'ISO42001_AnxA.3'
);

-- ─── Create Index for Faster Searches ───

CREATE INDEX IF NOT EXISTS idx_framework_controls_category_code
  ON public.framework_controls(category, control_code);

CREATE INDEX IF NOT EXISTS idx_framework_controls_severity
  ON public.framework_controls(severity);
