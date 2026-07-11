import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface GAMetricsRequest {
  tenant_id: string
  start_date: string
  end_date: string
  property_id: string
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') || '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '',
    )

    const { tenant_id, start_date, end_date, property_id }: GAMetricsRequest = await req.json()

    if (!tenant_id || !start_date || !end_date || !property_id) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    // Get tenant's Google Analytics credentials
    const { data: gaConfig } = await supabase
      .from('integrations')
      .select('*')
      .eq('tenant_id', tenant_id)
      .eq('provider', 'google_analytics')
      .single()

    if (!gaConfig?.config?.access_token) {
      return new Response(
        JSON.stringify({ error: 'Google Analytics not configured for tenant' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    // Fetch data from Google Analytics API
    const gaResponse = await fetch('https://analyticsdata.googleapis.com/v1beta/properties/' + property_id + ':runReport', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${gaConfig.config.access_token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        dateRanges: [
          {
            startDate: start_date.replace(/-/g, ''),
            endDate: end_date.replace(/-/g, ''),
          },
        ],
        metrics: [
          { name: 'activeUsers' },
          { name: 'sessions' },
          { name: 'conversions' },
        ],
        dimensions: [{ name: 'date' }],
      }),
    })

    if (!gaResponse.ok) {
      throw new Error('Failed to fetch Google Analytics data: ' + gaResponse.statusText)
    }

    const gaData = await gaResponse.json()

    // Aggregate metrics from GA response
    let totalVisitors = 0
    let totalSessions = 0
    let totalConversions = 0

    if (gaData.rows) {
      for (const row of gaData.rows) {
        totalVisitors += parseInt(row.metricValues[0].value || 0)
        totalSessions += parseInt(row.metricValues[1].value || 0)
        totalConversions += parseInt(row.metricValues[2].value || 0)
      }
    }

    // Insert/update marketing metrics with GA data
    await supabase.from('marketing_metrics').upsert(
      {
        tenant_id,
        period_start: start_date,
        period_end: end_date,
        web_visitors: totalVisitors,
        leads_generated: totalConversions, // GA conversions as proxy for leads
        data_source: 'google_analytics',
      },
      { onConflict: 'tenant_id,period_start,period_end' },
    )

    return new Response(
      JSON.stringify({
        success: true,
        visitors: totalVisitors,
        sessions: totalSessions,
        conversions: totalConversions,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  } catch (error) {
    console.error('Error syncing GA metrics:', error)
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
