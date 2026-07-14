import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { jwtDecode } from 'https://deno.land/x/jwt@v1.0.0/mod.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface CallbackRequest {
  code: string
  state: string
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

    const token = authHeader.replace('Bearer ', '')
    const decoded: any = jwtDecode(token)
    const userId = decoded.sub

    const { code }: CallbackRequest = await req.json()

    if (!code) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization code' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') || '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '',
    )

    // Get tenant_id for user
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

    // Exchange code for access token with Stripe
    const stripeResponse = await fetch('https://connect.stripe.com/oauth/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: Deno.env.get('STRIPE_CONNECT_CLIENT_ID') || '',
        client_secret: Deno.env.get('STRIPE_SECRET_KEY') || '',
        code: code,
        grant_type: 'authorization_code',
      }).toString(),
    })

    if (!stripeResponse.ok) {
      const error = await stripeResponse.text()
      console.error('Stripe error:', error)
      return new Response(
        JSON.stringify({ error: 'Failed to connect with Stripe' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    const stripeData: any = await stripeResponse.json()

    // Store integration in database
    const { error: integrationError } = await supabase
      .from('integrations')
      .upsert({
        tenant_id: tenantId,
        provider: 'stripe',
        provider_account_id: stripeData.stripe_user_id,
        config: {
          access_token: stripeData.access_token,
          stripe_user_id: stripeData.stripe_user_id,
          refresh_token: stripeData.refresh_token,
          scope: stripeData.scope,
        },
        status: 'active',
        sync_enabled: true,
      })

    if (integrationError) {
      console.error('Database error:', integrationError)
      return new Response(
        JSON.stringify({ error: 'Failed to save integration' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    // Trigger initial data sync
    await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/sync-stripe-metrics`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        tenant_id: tenantId,
        start_date: new Date(new Date().setMonth(new Date().getMonth() - 1)).toISOString().split('T')[0],
        end_date: new Date().toISOString().split('T')[0],
      }),
    })

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Stripe integration successful',
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  } catch (error) {
    console.error('Error in Stripe OAuth callback:', error)
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
