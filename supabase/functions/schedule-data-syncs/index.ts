import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
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

    // Find all active integrations that need syncing
    const { data: integrations, error: integrationsError } = await supabase
      .from('integrations')
      .select('*')
      .eq('status', 'active')
      .eq('sync_enabled', true)

    if (integrationsError) throw integrationsError

    const syncTasks = []

    for (const integration of integrations || []) {
      // Check if sync is due (based on sync_interval_minutes and last_sync_at)
      const lastSync = integration.last_sync_at
        ? new Date(integration.last_sync_at)
        : new Date(0)
      const timeSinceSync = Date.now() - lastSync.getTime()
      const syncIntervalMs = (integration.sync_interval_minutes || 60) * 60 * 1000

      if (timeSinceSync >= syncIntervalMs) {
        // Create sync job
        const { data: syncJob, error: jobError } = await supabase
          .from('data_sync_jobs')
          .insert({
            tenant_id: integration.tenant_id,
            integration_id: integration.id,
            job_type: `sync_${integration.provider}`,
            status: 'pending',
            scheduled_for: new Date(),
          })
          .select()
          .single()

        if (jobError) {
          console.error('Error creating sync job:', jobError)
          continue
        }

        // Trigger appropriate sync function
        const syncEndpoint =
          integration.provider === 'stripe' ? 'sync-stripe-metrics' : 'sync-ga-metrics'

        syncTasks.push(
          fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/${syncEndpoint}`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              tenant_id: integration.tenant_id,
              integration_id: integration.id,
              sync_job_id: syncJob.id,
              start_date: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000)
                .toISOString()
                .split('T')[0],
              end_date: new Date().toISOString().split('T')[0],
            }),
          })
            .then(async (res) => {
              if (res.ok) {
                // Update sync job status
                await supabase
                  .from('data_sync_jobs')
                  .update({
                    status: 'completed',
                    completed_at: new Date(),
                  })
                  .eq('id', syncJob.id)

                // Update integration last_sync_at
                await supabase
                  .from('integrations')
                  .update({ last_sync_at: new Date() })
                  .eq('id', integration.id)

                return { integration_id: integration.id, status: 'success' }
              } else {
                const error = await res.text()
                await supabase
                  .from('data_sync_jobs')
                  .update({
                    status: 'failed',
                    error_message: error,
                    completed_at: new Date(),
                  })
                  .eq('id', syncJob.id)

                return {
                  integration_id: integration.id,
                  status: 'failed',
                  error,
                }
              }
            })
            .catch((err) => {
              console.error('Sync error:', err)
              return {
                integration_id: integration.id,
                status: 'error',
                error: err.message,
              }
            }),
        )
      }
    }

    const results = await Promise.all(syncTasks)

    return new Response(
      JSON.stringify({
        success: true,
        syncs_triggered: syncTasks.length,
        results,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  } catch (error) {
    console.error('Error in schedule-data-syncs:', error)
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
