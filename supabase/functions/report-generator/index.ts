/**
 * Report Generator (Edge Function)
 *
 * Generates PDF/Excel compliance reports from governance data.
 * Async processing with results stored in compliance_reports table.
 *
 * Triggered by: ReportBuilderView or scheduled cron jobs
 */

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

interface ReportRequest {
  tenant_id: string;
  title: string;
  frameworks: string[];
  include_summary: boolean;
  include_control_details: boolean;
  include_findings: boolean;
  include_roadmap: boolean;
  format: 'pdf' | 'excel' | 'both';
  branding: 'minimal' | 'standard' | 'custom';
  custom_logo_url?: string;
  date_range: string;
}

interface ReportOptions {
  include_summary?: boolean;
  include_control_details?: boolean;
  include_findings?: boolean;
  include_roadmap?: boolean;
  branding?: 'minimal' | 'standard' | 'custom';
  [key: string]: unknown;
}

interface ComplianceData {
  iso27001_score: number;
  iso42001_score: number;
  ai_act_score: number;
  dsgvo_score: number;
  nis2_score: number;
  controls_total: number;
  controls_implemented: number;
  gaps_open: number;
  findings: Record<string, unknown>[];
}

Deno.serve(async (req: Request) => {
  const authHeader = req.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return new Response('Unauthorized', { status: 401 });
  }

  try {
    console.log('Starting report generation...');

    const body = await req.json() as ReportRequest;
    const {
      tenant_id,
      title,
      frameworks,
      include_summary,
      include_control_details,
      include_findings,
      include_roadmap,
      format,
      branding,
    } = body;

    // Validate input
    if (!tenant_id || !title) {
      throw new Error('Missing required fields: tenant_id, title');
    }

    // Fetch compliance data for selected frameworks
    const complianceData = await fetchComplianceData(tenant_id, frameworks);

    // Generate report content
    let pdfUrl: string | null = null;
    let excelUrl: string | null = null;

    if (format === 'pdf' || format === 'both') {
      pdfUrl = await generatePdfReport(tenant_id, title, complianceData, {
        include_summary,
        include_control_details,
        include_findings,
        include_roadmap,
        branding,
      });
    }

    if (format === 'excel' || format === 'both') {
      excelUrl = await generateExcelReport(tenant_id, title, complianceData, {
        include_summary,
        include_control_details,
        include_findings,
        include_roadmap,
      });
    }

    // Store report metadata
    const { error: insertError } = await supabase
      .from('compliance_reports')
      .insert({
        tenant_id,
        title,
        frameworks_covered: frameworks,
        format: format,
        pdf_url: pdfUrl,
        excel_url: excelUrl,
        generated_at: new Date().toISOString(),
        branding_type: branding,
        sections_included: {
          summary: include_summary,
          control_details: include_control_details,
          findings: include_findings,
          roadmap: include_roadmap,
        },
      });

    if (insertError) {
      throw new Error(`Failed to store report metadata: ${insertError.message}`);
    }

    console.log(`Report generated successfully for tenant ${tenant_id}`);

    return new Response(
      JSON.stringify({
        success: true,
        pdf_url: pdfUrl,
        excel_url: excelUrl,
        generated_at: new Date().toISOString(),
      }),
      {
        headers: { 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (err) {
    console.error('Error in report generator:', err);
    return new Response(
      JSON.stringify({ error: String(err) }),
      { status: 500 }
    );
  }
});

/**
 * Fetch compliance data across all requested frameworks
 */
async function fetchComplianceData(tenantId: string, frameworks: string[]): Promise<ComplianceData> {
  // Fetch ISO 27001 data
  const { data: iso27001 } = await supabase
    .from('iso27001_implementations')
    .select('*')
    .eq('tenant_id', tenantId);

  const iso27001_score = iso27001
    ? (iso27001.filter((c) => ['implemented', 'optimized'].includes(c.status)).length / iso27001.length) * 100
    : 0;

  // Fetch ISO 42001 data
  const { data: iso42001 } = await supabase
    .from('iso42001_implementations')
    .select('*')
    .eq('tenant_id', tenantId);

  const iso42001_score = iso42001
    ? (iso42001.filter((c) => ['implemented', 'optimized'].includes(c.status)).length / iso42001.length) * 100
    : 0;

  // Fetch AI Act assessments
  const { data: aiAct } = await supabase
    .from('ai_act_assessments')
    .select('overall_risk_score')
    .eq('tenant_id', tenantId)
    .eq('approval_status', 'approved');

  const ai_act_score = aiAct && aiAct.length > 0
    ? aiAct.reduce((sum, a) => sum + a.overall_risk_score, 0) / aiAct.length
    : 50;

  // Fetch DSGVO compliance
  const { data: dsgvo } = await supabase
    .from('data_processing_records')
    .select('*')
    .eq('tenant_id', tenantId);

  const dsgvo_score = dsgvo
    ? (dsgvo.filter((d) => d.has_dpia).length / dsgvo.length) * 100
    : 0;

  // Fetch NIS2 status
  const { data: nis2 } = await supabase
    .from('nis2_incident_deadlines')
    .select('*')
    .eq('tenant_id', tenantId);

  const nis2_score = nis2
    ? (nis2.filter((n) => ['completed', 'on_track'].includes(n.status)).length / nis2.length) * 100
    : 100;

  // Fetch gaps
  const { data: gaps } = await supabase
    .from('compliance_gaps')
    .select('*')
    .eq('tenant_id', tenantId);

  const gaps_open = gaps?.filter((g) => ['identified', 'planned'].includes(g.status)).length ?? 0;

  return {
    iso27001_score: Math.round(iso27001_score),
    iso42001_score: Math.round(iso42001_score),
    ai_act_score: Math.round(ai_act_score),
    dsgvo_score: Math.round(dsgvo_score),
    nis2_score: Math.round(nis2_score),
    controls_total: (iso27001?.length ?? 0) + (iso42001?.length ?? 0),
    controls_implemented: (iso27001?.filter((c) => c.status === 'implemented').length ?? 0) +
      (iso42001?.filter((c) => c.status === 'implemented').length ?? 0),
    gaps_open: gaps_open,
    findings: gaps ?? [],
  };
}

/**
 * Generate PDF report (simplified - in production would use proper PDF library)
 */
async function generatePdfReport(
  tenantId: string,
  title: string,
  data: ComplianceData,
  options: ReportOptions
): Promise<string> {
  // In production, would use pdfkit or puppeteer for proper PDF generation
  // For now, simulating with placeholder

  const reportContent = generateReportContent(title, data, options);
  const fileName = `${title.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.pdf`;

  // Store in Supabase Storage
  const { data: uploadData, error } = await supabase
    .storage
    .from('compliance-reports')
    .upload(`${tenantId}/${fileName}`, new Blob([reportContent]), {
      contentType: 'application/pdf',
    });

  if (error) {
    throw new Error(`Failed to upload PDF: ${error.message}`);
  }

  const { data: publicUrl } = supabase
    .storage
    .from('compliance-reports')
    .getPublicUrl(`${tenantId}/${fileName}`);

  return publicUrl.publicUrl;
}

/**
 * Generate Excel report
 */
async function generateExcelReport(
  tenantId: string,
  title: string,
  data: ComplianceData,
  options: ReportOptions
): Promise<string> {
  // In production, would use xlsx or exceljs library
  // For now, simulating with placeholder

  const reportContent = generateReportContent(title, data, options);
  const fileName = `${title.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.xlsx`;

  // Store in Supabase Storage
  const { data: uploadData, error } = await supabase
    .storage
    .from('compliance-reports')
    .upload(`${tenantId}/${fileName}`, new Blob([reportContent]), {
      contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });

  if (error) {
    throw new Error(`Failed to upload Excel: ${error.message}`);
  }

  const { data: publicUrl } = supabase
    .storage
    .from('compliance-reports')
    .getPublicUrl(`${tenantId}/${fileName}`);

  return publicUrl.publicUrl;
}

/**
 * Generate report content (can be HTML, JSON, etc.)
 */
function generateReportContent(title: string, data: ComplianceData, options: ReportOptions): string {
  const lines: string[] = [
    `Title: ${title}`,
    `Generated: ${new Date().toISOString()}`,
    '',
    'Compliance Scores:',
    `ISO 27001: ${data.iso27001_score}%`,
    `ISO 42001: ${data.iso42001_score}%`,
    `AI Act: ${data.ai_act_score}%`,
    `DSGVO: ${data.dsgvo_score}%`,
    `NIS2: ${data.nis2_score}%`,
    '',
    'Summary:',
    `Total Controls: ${data.controls_total}`,
    `Implemented: ${data.controls_implemented}`,
    `Open Gaps: ${data.gaps_open}`,
  ];

  if (options.include_findings) {
    lines.push('', 'Findings:', JSON.stringify(data.findings, null, 2));
  }

  return lines.join('\n');
}
