// Certification Report Generator
// POST: Generate PDF/HTML/Markdown reports for ISO 42001 compliance

import { createClient } from 'jsr:@supabase/supabase-js@2';
import { corsHeaders, handleOptions, jsonResponse, jsonError } from '../_shared/gateway.ts';

Deno.serve(async (req) => {
  const preflight = handleOptions(req);
  if (preflight) return preflight;

  if (req.method !== 'POST') return jsonError(405, 'BAD_REQUEST', 'POST only');

  const auth = req.headers.get('Authorization');
  if (!auth?.startsWith('Bearer ')) return jsonError(401, 'UNAUTHORIZED', 'missing bearer token');

  const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
  const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;

  const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: auth } },
    auth: { persistSession: false },
  });

  const { data: userResp, error: userErr } = await userClient.auth.getUser();
  if (userErr || !userResp.user) return jsonError(401, 'UNAUTHORIZED', 'invalid token');

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return jsonError(400, 'BAD_REQUEST', 'invalid json');
  }

  const tenantId = body.tenant_id as string;
  const templateId = body.template_id as string;
  const includeSignature = body.include_signature as boolean | undefined;
  const metadata = body.metadata as Record<string, unknown> | undefined;

  if (!tenantId || !templateId) {
    return jsonError(400, 'BAD_REQUEST', 'tenant_id and template_id required');
  }

  try {
    // Load all control implementations
    const { data: implementations } = await userClient
      .from('iso42001_implementations')
      .select('*')
      .eq('tenant_id', tenantId);

    // Load audit history
    const { data: auditHistory } = await userClient
      .from('iso_audit_history')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('audit_type', 'iso42001')
      .order('audit_date', { ascending: false });

    // Calculate metrics
    const total = implementations?.length || 0;
    const implemented = implementations?.filter((i) => i.status === 'implemented' || i.status === 'optimized').length || 0;
    const inProgress = implementations?.filter((i) => i.status === 'in_progress').length || 0;
    const avgMaturity = implementations
      ? implementations.reduce((sum, i) => sum + (i.maturity_level || 0), 0) / total
      : 0;

    // Build report content based on template
    const report = generateReportContent(
      templateId,
      {
        tenant_id: tenantId,
        total_controls: total,
        implemented_controls: implemented,
        in_progress_controls: inProgress,
        average_maturity: avgMaturity,
        implementations: implementations || [],
        audit_history: auditHistory || [],
      },
      metadata,
      includeSignature || false
    );

    // Return report info
    return jsonResponse({
      report: {
        id: `report-${Date.now()}`,
        filename: report.filename,
        format: report.format,
        size_kb: Math.ceil(report.content.length / 1024),
        generated_at: new Date().toISOString(),
        download_url: null, // In production: upload to storage and return signed URL
      },
    });
  } catch (e) {
    console.error('Error:', e);
    return jsonError(500, 'INTERNAL', (e as Error).message);
  }
});

interface ReportData {
  tenant_id: string;
  total_controls: number;
  implemented_controls: number;
  in_progress_controls: number;
  average_maturity: number;
  implementations: unknown[];
  audit_history: unknown[];
}

function generateReportContent(
  templateId: string,
  data: ReportData,
  metadata?: Record<string, unknown>,
  includeSignature?: boolean
): { filename: string; format: string; content: string } {
  const timestamp = new Date().toISOString().split('T')[0];
  const orgName = (metadata?.organization_name as string) || 'Organization';

  // Template selection
  switch (templateId) {
    case 'template-1':
      return {
        filename: `ISO42001-Executive-Summary-${timestamp}.pdf`,
        format: 'pdf',
        content: generateExecutiveSummary(data, metadata, orgName),
      };
    case 'template-2':
      return {
        filename: `ISO42001-Comprehensive-Assessment-${timestamp}.pdf`,
        format: 'pdf',
        content: generateComprehensiveReport(data, metadata, orgName, includeSignature),
      };
    case 'template-3':
      return {
        filename: `ISO42001-Technical-Details-${timestamp}.pdf`,
        format: 'pdf',
        content: generateTechnicalReport(data, metadata, orgName),
      };
    case 'template-4':
      return {
        filename: `ISO42001-Gap-Analysis-${timestamp}.pdf`,
        format: 'pdf',
        content: generateGapAnalysisReport(data, metadata, orgName),
      };
    case 'template-5':
      return {
        filename: `ISO42001-Report-${timestamp}.html`,
        format: 'html',
        content: generateHTMLReport(data, metadata, orgName),
      };
    case 'template-6':
      return {
        filename: `ISO42001-Documentation-${timestamp}.md`,
        format: 'markdown',
        content: generateMarkdownReport(data, metadata, orgName),
      };
    default:
      return {
        filename: `ISO42001-Report-${timestamp}.pdf`,
        format: 'pdf',
        content: generateExecutiveSummary(data, metadata, orgName),
      };
  }
}

function generateExecutiveSummary(data: ReportData, metadata?: Record<string, unknown>, orgName?: string): string {
  const completionPercentage = Math.round((data.implemented_controls / data.total_controls) * 100);
  const auditDate = (metadata?.audit_date as string) || new Date().toISOString().split('T')[0];

  return `
=== ISO/IEC 42001:2024 - Executive Summary ===

Organization: ${orgName}
Audit Date: ${auditDate}
Report Generated: ${new Date().toISOString()}

--- OVERALL ASSESSMENT ---
Completion Score: ${completionPercentage}%
Controls Implemented: ${data.implemented_controls} / ${data.total_controls}
Controls In Progress: ${data.in_progress_controls}
Average Maturity Level: ${data.average_maturity.toFixed(1)} / 5.0

--- STATUS SUMMARY ---
✓ Implemented/Optimized: ${data.implemented_controls} controls
◐ In Progress: ${data.in_progress_controls} controls
○ Not Yet Started: ${data.total_controls - data.implemented_controls - data.in_progress_controls} controls

--- READINESS ASSESSMENT ---
${
  completionPercentage >= 85
    ? '✓ Organization is READY for ISO 42001 certification audit'
    : completionPercentage >= 60
      ? '◐ Organization is ON TRACK for certification (estimated 4-8 weeks remaining)'
      : '✕ Organization requires significant work before certification readiness'
}

--- RECOMMENDED NEXT STEPS ---
1. Complete all critical path controls (A.4 - A.6)
2. Finalize documentation and evidence collection
3. Schedule internal audit
4. Engage certification body for pre-audit review
5. Plan auditor engagement and on-site assessment

--- AUDIT TRAIL ---
Total Audit Events: ${Array.isArray(metadata?.audit_history) ? (metadata.audit_history as unknown[]).length : 'N/A'}
Last Assessment Date: [Latest audit date from history]

---
This report is confidential and intended for certification purposes only.
`;
}

function generateComprehensiveReport(
  data: ReportData,
  metadata?: Record<string, unknown>,
  orgName?: string,
  includeSignature?: boolean
): string {
  return `
=== ISO/IEC 42001:2024 - Comprehensive Assessment Report ===

Organization: ${orgName}
Prepared for: ${(metadata?.certification_body as string) || 'Certification Body'}
Auditor: ${(metadata?.auditor_name as string) || 'TBD'}
Report Date: ${new Date().toISOString()}

EXECUTIVE SUMMARY
${generateExecutiveSummary(data, metadata, orgName)}

DETAILED CONTROL ASSESSMENT

[Section A.4: Context of the AI Management System]
Total Controls: 3
Status: [Assessment details would go here with evidence references]

[Section A.5: Leadership and Commitment]
Total Controls: 2
Status: [Assessment details would go here with evidence references]

[Section A.6: Organization of Roles]
Total Controls: 2
Status: [Assessment details would go here with evidence references]

[Continuing for all sections...]

SUPPORTING EVIDENCE INVENTORY
Evidence items referenced throughout assessment:
- Documentation files: [Count]
- Screenshots/Artifacts: [Count]
- Process flows: [Count]
- Policy documents: [Count]

${
  includeSignature
    ? `
CERTIFICATION SIGNATURES
Prepared by: [Name]
Date: ${new Date().toISOString()}
Organization: ${orgName}

Reviewed by: [Auditor Name]
Certification Body: ${(metadata?.certification_body as string) || 'TBD'}
Digital Signature: [Generated signature token]
`
    : ''
}

APPENDICES
A. Controls Library Reference
B. Evidence Manifest
C. Audit Trail
D. Risk Register
E. Remediation Plans
`;
}

function generateTechnicalReport(data: ReportData, metadata?: Record<string, unknown>, orgName?: string): string {
  return `
=== ISO/IEC 42001:2024 - Technical Implementation Details ===

Organization: ${orgName}
Audit Date: ${(metadata?.audit_date as string) || new Date().toISOString().split('T')[0]}

TECHNICAL ARCHITECTURE DOCUMENTATION

1. AI MANAGEMENT SYSTEM ARCHITECTURE
   - System boundary and scope
   - AI processing workflows
   - Data flows and integrations
   - Risk assessment framework
   - Incident response procedures

2. CONTROL IMPLEMENTATION DETAILS

2.1 Data Quality and Governance Controls
   - Training data source documentation
   - Data validation processes
   - Bias testing and mitigation
   - Data retention and archival

2.2 Model Development and Validation
   - Development environment setup
   - Model versioning and tracking
   - Validation procedures
   - Performance monitoring

2.3 Operations and Monitoring
   - Production deployment procedures
   - Continuous monitoring setup
   - Alerting mechanisms
   - Rollback procedures

3. SECURITY AND COMPLIANCE CONTROLS
   - Access control implementation
   - Encryption standards
   - Audit logging
   - Vulnerability management

4. PERFORMANCE METRICS
   - Model accuracy tracking
   - System uptime and availability
   - Response time SLAs
   - User satisfaction metrics

5. EVIDENCE REFERENCES
[Technical evidence files, logs, configuration documents referenced here]

Report Generated: ${new Date().toISOString()}
`;
}

function generateGapAnalysisReport(data: ReportData, metadata?: Record<string, unknown>, orgName?: string): string {
  const notStarted = data.total_controls - data.implemented_controls - data.in_progress_controls;

  return `
=== ISO/IEC 42001:2024 - Gap Analysis Report ===

Organization: ${orgName}
Assessment Date: ${(metadata?.audit_date as string) || new Date().toISOString().split('T')[0]}

EXECUTIVE SUMMARY
Controls not yet implemented: ${notStarted} / ${data.total_controls}
Estimated effort: ${notStarted * 20} hours
Recommended timeline: ${Math.ceil(notStarted / 2)} weeks at 2 controls/week

IDENTIFIED GAPS

Category: Governance
- A.4.1: Understand organizational context
  Gap Description: [Details]
  Evidence Required: [Specific documentation needed]
  Effort Estimate: 16-24 hours
  Remediation Plan: [Steps to close]

Category: Resources
- A.7.1: Determine resource needs
  Gap Description: [Details]
  Remediation Timeline: [Weeks to complete]

Category: Operations
- A.8.1: Plan and control AI processes
  Gap Description: [Details]
  Remediation Timeline: [Weeks to complete]

[Continuing for all gaps identified...]

REMEDIATION ROADMAP
Phase 1 (Weeks 1-2): Foundation controls (A.4, A.5, A.6)
Phase 2 (Weeks 3-4): Governance controls (A.7, A.8)
Phase 3 (Weeks 5-6): Monitoring controls (A.9, A.10)

CRITICAL PATH
Controls that must be completed first (blocking other controls):
1. A.4.1 - Organizational context
2. A.5.1 - Leadership commitment
3. A.6.1 - Role assignment

RESOURCE RECOMMENDATIONS
Recommended team: 1 lead + 1 support
Timeline with current resources: ${Math.ceil(notStarted / 2)} weeks
Timeline with double resources: ${Math.ceil(notStarted / 4)} weeks

Report Generated: ${new Date().toISOString()}
`;
}

function generateHTMLReport(data: ReportData, metadata?: Record<string, unknown>, orgName?: string): string {
  return `
<!DOCTYPE html>
<html lang="de">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>ISO 42001 Certification Report - ${orgName}</title>
  <style>
    * { margin: 0; padding: 0; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #f5f5f5; color: #333; }
    .container { max-width: 1200px; margin: 0 auto; padding: 20px; }
    header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 40px; border-radius: 8px; margin-bottom: 40px; }
    h1 { font-size: 28px; margin-bottom: 10px; }
    .subtitle { font-size: 14px; opacity: 0.9; }
    .metrics { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 20px; margin: 30px 0; }
    .metric-card { background: white; padding: 20px; border-radius: 8px; border-left: 4px solid #667eea; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
    .metric-value { font-size: 32px; font-weight: bold; color: #667eea; }
    .metric-label { font-size: 12px; color: #666; text-transform: uppercase; margin-top: 5px; }
    .section { background: white; padding: 30px; margin: 20px 0; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
    h2 { color: #667eea; margin-bottom: 15px; font-size: 20px; }
    .progress-bar { width: 100%; height: 8px; background: #eee; border-radius: 4px; overflow: hidden; margin: 10px 0; }
    .progress-fill { height: 100%; background: linear-gradient(90deg, #667eea 0%, #764ba2 100%); }
    footer { text-align: center; color: #666; font-size: 12px; margin-top: 40px; }
  </style>
</head>
<body>
  <div class="container">
    <header>
      <h1>ISO/IEC 42001:2024 Certification Report</h1>
      <div class="subtitle">Organization: ${orgName}</div>
    </header>

    <div class="metrics">
      <div class="metric-card">
        <div class="metric-value">${Math.round((data.implemented_controls / data.total_controls) * 100)}%</div>
        <div class="metric-label">Completion Score</div>
      </div>
      <div class="metric-card">
        <div class="metric-value">${data.implemented_controls}</div>
        <div class="metric-label">Controls Implemented</div>
      </div>
      <div class="metric-card">
        <div class="metric-value">${data.average_maturity.toFixed(1)}</div>
        <div class="metric-label">Avg Maturity Level</div>
      </div>
      <div class="metric-card">
        <div class="metric-value">${data.total_controls}</div>
        <div class="metric-label">Total Controls</div>
      </div>
    </div>

    <div class="section">
      <h2>Compliance Progress</h2>
      <div class="progress-bar">
        <div class="progress-fill" style="width: ${Math.round((data.implemented_controls / data.total_controls) * 100)}%"></div>
      </div>
      <p>
        <strong>${data.implemented_controls}</strong> of <strong>${data.total_controls}</strong> controls implemented.
        <strong>${data.in_progress_controls}</strong> in progress.
      </p>
    </div>

    <div class="section">
      <h2>Assessment Details</h2>
      <p><strong>Audit Date:</strong> ${(metadata?.audit_date as string) || 'TBD'}</p>
      <p><strong>Auditor:</strong> ${(metadata?.auditor_name as string) || 'TBD'}</p>
      <p><strong>Certification Body:</strong> ${(metadata?.certification_body as string) || 'TBD'}</p>
      <p><strong>Report Generated:</strong> ${new Date().toISOString()}</p>
    </div>

    <footer>
      <p>This report is confidential and intended for certification purposes only.</p>
      <p>© ${new Date().getFullYear()} ${orgName}</p>
    </footer>
  </div>
</body>
</html>
`;
}

function generateMarkdownReport(data: ReportData, metadata?: Record<string, unknown>, orgName?: string): string {
  return `
# ISO/IEC 42001:2024 - Certification Report

**Organization:** ${orgName}
**Audit Date:** ${(metadata?.audit_date as string) || 'TBD'}
**Report Generated:** ${new Date().toISOString()}

---

## Executive Summary

- **Completion Score:** ${Math.round((data.implemented_controls / data.total_controls) * 100)}%
- **Controls Implemented:** ${data.implemented_controls} / ${data.total_controls}
- **In Progress:** ${data.in_progress_controls}
- **Average Maturity:** ${data.average_maturity.toFixed(1)} / 5.0

---

## Control Assessment

### Section A.4: Context of the AI Management System
- [ ] A.4.1 Understand organizational context
- [ ] A.4.2 Define system scope

### Section A.5: Leadership and Commitment
- [ ] A.5.1 Leadership demonstrates commitment
- [ ] A.5.2 Establish AI policy

### Section A.6: Roles, Responsibilities & Authorities
- [ ] A.6.1 Assign responsibility and authority
- [ ] A.6.2 Communicate to organization

[... additional sections ...]

---

## Next Steps

1. Complete all critical path controls
2. Finalize evidence collection
3. Schedule internal audit
4. Engage certification body
5. Prepare for on-site assessment

---

*This document is confidential and for certification purposes only.*
`;
}
