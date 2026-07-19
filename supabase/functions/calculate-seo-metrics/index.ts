import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface MetricsRequest {
  tenant_id: string
  start_date: string
  end_date: string
}

interface LifecycleRecord {
  customer_acquisition_cost?: number
  lifetime_value?: number
  predicted_ltv?: number
  status: string
  [key: string]: unknown
}

interface MarketingMetric {
  web_visitors?: number
  leads_generated?: number
  trials_started?: number
  customers_acquired?: number
  revenue_generated?: number
  [key: string]: unknown
}

interface MetricsResponse {
  cac: number
  ltv: number
  ltv_cac_ratio: number
  conversion_rate: number
  churn_rate: number
  cmrr: number
  period_metrics: {
    web_visitors: number
    leads_generated: number
    trials_started: number
    customers_acquired: number
    revenue: number
  }
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const authHeader = req.headers.get('Authorization') || ''
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') || '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '',
    )

    const { tenant_id, start_date, end_date }: MetricsRequest = await req.json()

    // Validate inputs
    if (!tenant_id || !start_date || !end_date) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    // Fetch marketing metrics for period
    const { data: metricsData, error: metricsError } = await supabase
      .from('marketing_metrics')
      .select('*')
      .eq('tenant_id', tenant_id)
      .gte('period_start', start_date)
      .lte('period_end', end_date)

    if (metricsError) throw metricsError

    // Fetch customer lifecycle data for CAC/LTV calculation
    const { data: lifecycleData, error: lifecycleError } = await supabase
      .from('customer_lifecycle')
      .select('*')
      .eq('tenant_id', tenant_id)
      .gte('acquisition_date', start_date)
      .lte('acquisition_date', end_date)

    if (lifecycleError) throw lifecycleError

    // Calculate CAC (Customer Acquisition Cost)
    const totalAcquisitionCosts = lifecycleData?.reduce(
      (sum: number, record: LifecycleRecord) => sum + (record.customer_acquisition_cost || 0),
      0,
    ) || 0
    const totalCustomersAcquired = lifecycleData?.length || 1
    const cac = totalAcquisitionCosts / Math.max(totalCustomersAcquired, 1)

    // Calculate LTV (Lifetime Value)
    const totalLifetimeValue = lifecycleData?.reduce(
      (sum: number, record: LifecycleRecord) => sum + (record.lifetime_value || record.predicted_ltv || 0),
      0,
    ) || 0
    const ltv = totalLifetimeValue / Math.max(totalCustomersAcquired, 1)

    // Calculate LTV:CAC Ratio
    const ltv_cac_ratio = cac > 0 ? ltv / cac : 0

    // Period summary
    const periodMetrics = metricsData && metricsData.length > 0
      ? {
          web_visitors: metricsData.reduce((sum: number, m: MarketingMetric) => sum + (m.web_visitors || 0), 0),
          leads_generated: metricsData.reduce((sum: number, m: MarketingMetric) => sum + (m.leads_generated || 0), 0),
          trials_started: metricsData.reduce((sum: number, m: MarketingMetric) => sum + (m.trials_started || 0), 0),
          customers_acquired: metricsData.reduce((sum: number, m: MarketingMetric) => sum + (m.customers_acquired || 0), 0),
          revenue: metricsData.reduce((sum: number, m: MarketingMetric) => sum + (m.revenue_generated || 0), 0),
        }
      : {
          web_visitors: 0,
          leads_generated: 0,
          trials_started: 0,
          customers_acquired: 0,
          revenue: 0,
        }

    // Calculate conversion rates
    const conversion_rate =
      periodMetrics.web_visitors > 0
        ? (periodMetrics.leads_generated / periodMetrics.web_visitors) * 100
        : 0

    // Calculate churn rate (active customers without churn date vs. churned)
    const activeCustomers = lifecycleData?.filter((l: LifecycleRecord) => l.status === 'active').length || 0
    const churnedCustomers = lifecycleData?.filter((l: LifecycleRecord) => l.status === 'churned').length || 0
    const churn_rate =
      totalCustomersAcquired > 0 ? (churnedCustomers / totalCustomersAcquired) * 100 : 0

    // CMRR (Cumulative Monthly Recurring Revenue)
    const cmrr = periodMetrics.revenue / Math.max(Math.ceil((new Date(end_date).getTime() - new Date(start_date).getTime()) / (1000 * 60 * 60 * 24) / 30), 1)

    const response: MetricsResponse = {
      cac: Math.round(cac * 100) / 100,
      ltv: Math.round(ltv * 100) / 100,
      ltv_cac_ratio: Math.round(ltv_cac_ratio * 100) / 100,
      conversion_rate: Math.round(conversion_rate * 100) / 100,
      churn_rate: Math.round(churn_rate * 100) / 100,
      cmrr: Math.round(cmrr * 100) / 100,
      period_metrics: periodMetrics,
    }

    return new Response(JSON.stringify(response), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (error) {
    console.error('Error calculating metrics:', error)
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
