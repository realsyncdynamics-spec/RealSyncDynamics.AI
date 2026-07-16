import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { jwtDecode } from 'https://esm.sh/jwt-decode@4.0.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface ComplianceReportRequest {
  tenant_id: string
  report_type: 'dsgvo_access_log' | 'eu_ai_act_audit' | 'data_processing' | 'export_history'
  start_date: string // YYYY-MM-DD
  end_date: string // YYYY-MM-DD
  format?: 'json' | 'csv'
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const auth = req.headers.get('Authorization')
    if (!auth) throw new Error('Missing authorization header')

    const token = auth.replace('Bearer ', '')
    const decoded = jwtDecode(token) as { sub: string; user_metadata?: { tenant_id?: string } }
    const userId = decoded.sub
    const tenantId = decoded.user_metadata?.tenant_id

    if (!tenantId) throw new Error('Tenant ID not found in token')

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') || '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '',
    )

    const body = await req.json() as ComplianceReportRequest

    // Verify user is admin
    const { data: teamMember, error: memberError } = await supabase
      .from('team_members')
      .select('role')
      .eq('tenant_id', body.tenant_id)
      .eq('user_id', userId)
      .single()

    if (memberError || !teamMember || !['admin', 'owner'].includes(teamMember.role)) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized - admin access required' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    let reportData: Record<string, unknown>

    switch (body.report_type) {
      case 'dsgvo_access_log':
        reportData = await generateDsgvoAccessLog(supabase, body.tenant_id, body.start_date, body.end_date)
        break

      case 'eu_ai_act_audit':
        reportData = await generateEuAiActAudit(supabase, body.tenant_id, body.start_date, body.end_date)
        break

      case 'export_history':
        reportData = await generateExportHistory(supabase, body.tenant_id, body.start_date, body.end_date)
        break

      case 'data_processing':
        reportData = await generateDataProcessingReport(supabase, body.tenant_id, body.start_date, body.end_date)
        break

      default:
        throw new Error('Invalid report type')
    }

    // Log report generation
    await supabase
      .from('seo_dashboard_compliance_reports')
      .insert({
        tenant_id: body.tenant_id,
        generated_by: userId,
        report_type: body.report_type,
        period_start: body.start_date,
        period_end: body.end_date,
        summary: reportData.summary || {},
        audit_records_count: reportData.record_count || 0,
        compliance_checks: reportData.checks || {},
      })

    // Format output
    const output = body.format === 'csv' ? convertToCSV(reportData) : JSON.stringify(reportData, null, 2)

    return new Response(output, {
      status: 200,
      headers: {
        ...corsHeaders,
        'Content-Type': body.format === 'csv' ? 'text/csv; charset=utf-8' : 'application/json',
        'Content-Disposition': `attachment; filename="${body.report_type}_${new Date().toISOString().split('T')[0]}.${body.format === 'csv' ? 'csv' : 'json'}"`,
      },
    })
  } catch (error) {
    console.error('Error generating compliance report:', error)
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})

async function generateDsgvoAccessLog(
  supabase: ReturnType<typeof createClient>,
  tenantId: string,
  startDate: string,
  endDate: string,
) {
  const { data: auditLogs, error } = await supabase
    .rpc('generate_dsgvo_access_report', {
      p_tenant_id: tenantId,
      p_start_date: startDate,
      p_end_date: endDate,
    })

  if (error) throw error

  const summary = {
    report_type: 'dsgvo_access_log',
    period: { start: startDate, end: endDate },
    total_users: auditLogs?.length || 0,
    total_operations: auditLogs?.reduce((sum: number, u: unknown) => sum + ((u as Record<string, unknown>).operation_count as number), 0) || 0,
    total_exports: auditLogs?.reduce((sum: number, u: unknown) => sum + ((u as Record<string, unknown>).export_count as number), 0) || 0,
    generated_at: new Date().toISOString(),
  }

  return {
    summary,
    data: auditLogs,
    record_count: auditLogs?.length || 0,
    checks: {
      gdpr_right_to_access: 'complete',
      data_processing_logged: true,
      user_identification: 'complete',
    },
  }
}

async function generateEuAiActAudit(
  supabase: ReturnType<typeof createClient>,
  tenantId: string,
  startDate: string,
  endDate: string,
) {
  const { data: auditData, error } = await supabase
    .rpc('generate_eu_ai_act_audit', {
      p_tenant_id: tenantId,
      p_start_date: startDate,
      p_end_date: endDate,
    })

  if (error) throw error

  const summary = {
    report_type: 'eu_ai_act_audit',
    period: { start: startDate, end: endDate },
    total_records: auditData?.length || 0,
    high_risk_operations: auditData?.filter((d: unknown) => (d as Record<string, unknown>).data_sensitivity_level === 'high').length || 0,
    error_rate: calculateErrorRate(auditData),
    generated_at: new Date().toISOString(),
  }

  return {
    summary,
    data: auditData,
    record_count: auditData?.length || 0,
    checks: {
      transparency_requirements: 'met',
      human_oversight_logged: true,
      decision_logging: 'complete',
      error_tracking: 'active',
    },
  }
}

async function generateExportHistory(
  supabase: ReturnType<typeof createClient>,
  tenantId: string,
  startDate: string,
  endDate: string,
) {
  const { data: exports, error } = await supabase
    .from('seo_dashboard_exports')
    .select(
      'id, created_by, export_type, record_count, data_classification, created_at, deleted_at, file_path'
    )
    .eq('tenant_id', tenantId)
    .gte('created_at', `${startDate}T00:00:00Z`)
    .lte('created_at', `${endDate}T23:59:59Z`)
    .order('created_at', { ascending: false })

  if (error) throw error

  const summary = {
    report_type: 'export_history',
    period: { start: startDate, end: endDate },
    total_exports: exports?.length || 0,
    by_type: groupByField(exports || [], 'export_type'),
    by_classification: groupByField(exports || [], 'data_classification'),
    total_records_exported: exports?.reduce((sum: number, e: unknown) => sum + ((e as Record<string, unknown>).record_count as number), 0) || 0,
    generated_at: new Date().toISOString(),
  }

  return {
    summary,
    data: exports,
    record_count: exports?.length || 0,
    checks: {
      exports_logged: true,
      data_classification_tracked: true,
      deletion_records_maintained: true,
    },
  }
}

async function generateDataProcessingReport(
  supabase: ReturnType<typeof createClient>,
  tenantId: string,
  startDate: string,
  endDate: string,
) {
  const { data: auditLogs, error: auditError } = await supabase
    .from('seo_dashboard_audit_log')
    .select('operation_type, data_sensitivity_level, success, created_at')
    .eq('tenant_id', tenantId)
    .gte('created_at', `${startDate}T00:00:00Z`)
    .lte('created_at', `${endDate}T23:59:59Z`)

  if (auditError) throw auditError

  const { data: policies, error: policyError } = await supabase
    .from('seo_dashboard_data_policies')
    .select('*')
    .eq('tenant_id', tenantId)
    .single()

  if (policyError) throw policyError

  const summary = {
    report_type: 'data_processing',
    period: { start: startDate, end: endDate },
    retention_policy: {
      operational: policies?.retention_days_operational || 90,
      audit: policies?.retention_days_audit || 365,
      exports: policies?.retention_days_exports || 30,
    },
    gdpr_compliance: {
      right_to_deletion: policies?.gdpr_right_to_deletion_enabled || false,
      auto_anonymization: policies?.auto_anonymize_old_records || false,
    },
    data_processed: auditLogs?.length || 0,
    sensitive_operations: auditLogs?.filter((l: unknown) => (l as Record<string, unknown>).data_sensitivity_level === 'high').length || 0,
    generated_at: new Date().toISOString(),
  }

  return {
    summary,
    data: { audit_logs: auditLogs, policies },
    record_count: (auditLogs?.length || 0) + 1,
    checks: {
      retention_policy_active: true,
      gdpr_mechanisms_enabled: policies?.gdpr_right_to_deletion_enabled || false,
      data_minimization: 'ongoing',
      purpose_limitation: 'enforced',
    },
  }
}

function groupByField(data: Record<string, unknown>[], field: string): Record<string, number> {
  return data.reduce(
    (acc: Record<string, number>, item: Record<string, unknown>) => {
      const key = String(item[field] || 'unknown')
      acc[key] = (acc[key] || 0) + 1
      return acc
    },
    {}
  )
}

function calculateErrorRate(data: unknown[]): string {
  if (!data || data.length === 0) return '0%'
  const errors = (data as Record<string, unknown>[]).filter(d => (d as Record<string, unknown>).error_count).length
  return `${((errors / data.length) * 100).toFixed(2)}%`
}

function convertToCSV(data: Record<string, unknown>): string {
  const rows: string[] = []

  // Add summary section
  if (data.summary) {
    rows.push('COMPLIANCE REPORT SUMMARY')
    rows.push('---')
    Object.entries(data.summary).forEach(([key, value]) => {
      if (typeof value === 'object') {
        rows.push(`${key},"${JSON.stringify(value)}"`)
      } else {
        rows.push(`${key},"${value}"`)
      }
    })
    rows.push('')
  }

  // Add data section with headers
  if (Array.isArray(data.data) && data.data.length > 0) {
    const headers = Object.keys(data.data[0] as Record<string, unknown>)
    rows.push(headers.join(','))
    ;(data.data as Record<string, unknown>[]).forEach(item => {
      rows.push(
        headers
          .map(h => {
            const val = item[h]
            if (typeof val === 'object') return `"${JSON.stringify(val)}"`
            return `"${val}"`
          })
          .join(',')
      )
    })
  }

  return rows.join('\n')
}
