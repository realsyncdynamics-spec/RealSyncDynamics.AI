import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { jwtDecode } from 'https://deno.land/x/jwt@v1.0.0/mod.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface DashboardData {
  marketing_metrics: any[]
  shadow_seo_tools: any[]
  security_events: any[]
  customer_summary: any
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const authHeader = req.headers.get('Authorization') || ''
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Extract token and decode
    const token = authHeader.replace('Bearer ', '')
    const decoded: any = jwtDecode(token)
    const userId = decoded.sub

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') || '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '',
    )

    // Get tenant_id from team_members or tenants
    const { data: tenantData } = await supabase
      .from('team_members')
      .select('tenant_id')
      .eq('user_id', userId)
      .single()

    const tenantId = tenantData?.tenant_id

    if (!tenantId) {
      return new Response(
        JSON.stringify({ error: 'No tenant found for user' }),
        {
          status: 403,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        },
      )
    }

    // Fetch last 6 months of marketing metrics
    const sixMonthsAgo = new Date()
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6)

    const { data: metricsData } = await supabase
      .from('marketing_metrics')
      .select('*')
      .eq('tenant_id', tenantId)
      .gte('period_start', sixMonthsAgo.toISOString().split('T')[0])
      .order('period_start', { ascending: false })
      .limit(6)

    // Fetch shadow SEO tools (high-risk)
    const { data: toolsData } = await supabase
      .from('seo_tool_tracking')
      .select('*')
      .eq('tenant_id', tenantId)
      .order('risk_level', { ascending: false })
      .order('discovered_date', { ascending: false })

    // Fetch security events (last 30 days)
    const thirtyDaysAgo = new Date()
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

    const { data: securityData } = await supabase
      .from('seo_security_events')
      .select('*')
      .eq('tenant_id', tenantId)
      .gte('created_at', thirtyDaysAgo.toISOString())
      .order('created_at', { ascending: false })
      .limit(10)

    // Calculate customer summary
    const { data: lifecycleData } = await supabase
      .from('customer_lifecycle')
      .select('*')
      .eq('tenant_id', tenantId)

    const activeCusts = lifecycleData?.filter((l: any) => l.status === 'active').length || 0
    const churnedCusts = lifecycleData?.filter((l: any) => l.status === 'churned').length || 0
    const avgCac =
      lifecycleData && lifecycleData.length > 0
        ? lifecycleData.reduce((sum: number, l: any) => sum + (l.customer_acquisition_cost || 0), 0) / lifecycleData.length
        : 0

    const avgLtv =
      lifecycleData && lifecycleData.length > 0
        ? lifecycleData.reduce((sum: number, l: any) => sum + (l.lifetime_value || l.predicted_ltv || 0), 0) / lifecycleData.length
        : 0

    const dashboardData: DashboardData = {
      marketing_metrics: metricsData || [],
      shadow_seo_tools: toolsData || [],
      security_events: securityData || [],
      customer_summary: {
        active_customers: activeCusts,
        churned_customers: churnedCusts,
        avg_cac: Math.round(avgCac * 100) / 100,
        avg_ltv: Math.round(avgLtv * 100) / 100,
        ltv_cac_ratio: avgCac > 0 ? Math.round((avgLtv / avgCac) * 100) / 100 : 0,
      },
    }

    return new Response(JSON.stringify(dashboardData), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (error) {
    console.error('Error fetching dashboard data:', error)
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
