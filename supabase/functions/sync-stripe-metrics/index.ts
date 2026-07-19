import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import Stripe from 'https://esm.sh/stripe@14.0.0?target=deno'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface SyncRequest {
  tenant_id: string
  start_date: string
  end_date: string
}

interface CustomerLifecycleRecord {
  status: string;
  lifetime_value?: number;
  [key: string]: unknown;
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

    const { tenant_id, start_date, end_date }: SyncRequest = await req.json()

    if (!tenant_id || !start_date || !end_date) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    // Get tenant's Stripe API key (should be stored in tenant settings)
    const { data: tenantSettings } = await supabase
      .from('tenant_settings')
      .select('stripe_api_key')
      .eq('tenant_id', tenant_id)
      .single()

    if (!tenantSettings?.stripe_api_key) {
      return new Response(
        JSON.stringify({ error: 'Stripe API key not configured for tenant' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    const stripe = new Stripe(tenantSettings.stripe_api_key, {
      apiVersion: '2024-06-20',
    })

    // Fetch customers from Stripe
    const customers = await stripe.customers.list({
      limit: 100,
      created: {
        gte: Math.floor(new Date(start_date).getTime() / 1000),
        lte: Math.floor(new Date(end_date).getTime() / 1000),
      },
    })

    // Process each customer
    for (const customer of customers.data) {
      // Get invoices for revenue calculation
      const invoices = await stripe.invoices.list({
        customer: customer.id,
        status: 'paid',
      })

      const totalRevenue = invoices.data.reduce((sum, inv) => sum + (inv.amount_paid || 0), 0) / 100

      // Calculate CAC (from metadata if available)
      const cac = customer.metadata?.acquisition_cost
        ? parseFloat(customer.metadata.acquisition_cost)
        : 0

      // Insert/update customer lifecycle record
      await supabase
        .from('customer_lifecycle')
        .upsert(
          {
            tenant_id,
            customer_id: customer.id,
            acquisition_date: customer.created
              ? new Date(customer.created * 1000).toISOString().split('T')[0]
              : new Date().toISOString().split('T')[0],
            customer_acquisition_cost: cac,
            lifetime_value: totalRevenue,
            status: customer.deleted ? 'churned' : 'active',
          },
          { onConflict: 'tenant_id,customer_id' },
        )
    }

    // Aggregate metrics
    const { data: lifecycleData } = await supabase
      .from('customer_lifecycle')
      .select('*')
      .eq('tenant_id', tenant_id)
      .gte('acquisition_date', start_date)
      .lte('acquisition_date', end_date)

    const activeCustomers = lifecycleData?.filter((l: CustomerLifecycleRecord) => l.status === 'active').length || 0
    const totalRevenue = lifecycleData?.reduce((sum: number, l: CustomerLifecycleRecord) => sum + (l.lifetime_value || 0), 0) || 0

    // Insert aggregated metrics
    await supabase.from('marketing_metrics').upsert(
      {
        tenant_id,
        period_start: start_date,
        period_end: end_date,
        customers_acquired: lifecycleData?.length || 0,
        revenue_generated: totalRevenue,
        monthly_recurring_revenue: totalRevenue / Math.max(Math.ceil((new Date(end_date).getTime() - new Date(start_date).getTime()) / (1000 * 60 * 60 * 24) / 30), 1),
        data_source: 'stripe',
      },
      { onConflict: 'tenant_id,period_start,period_end' },
    )

    return new Response(
      JSON.stringify({
        success: true,
        customers_synced: customers.data.length,
        active_customers: activeCustomers,
        total_revenue: totalRevenue,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  } catch (error) {
    console.error('Error syncing Stripe metrics:', error)
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
