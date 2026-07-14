import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { jwtDecode } from 'https://esm.sh/jwt-decode@4.0.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface ShareRequest {
  action: 'create' | 'update' | 'revoke' | 'get'
  dashboard_view_id: string
  shared_with_user_id?: string
  shared_with_email?: string
  access_level?: 'view' | 'edit' | 'comment' | 'manage'
  expires_at?: string
  can_export?: boolean
  can_share?: boolean
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

    const body = await req.json() as ShareRequest

    // Verify user owns the dashboard or is admin
    const { data: view, error: viewError } = await supabase
      .from('seo_dashboard_views')
      .select('*')
      .eq('id', body.dashboard_view_id)
      .eq('tenant_id', tenantId)
      .single()

    if (viewError || !view) {
      return new Response(
        JSON.stringify({ error: 'Dashboard view not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const isOwner = view.created_by === userId
    const { data: teamMember } = await supabase
      .from('team_members')
      .select('role')
      .eq('tenant_id', tenantId)
      .eq('user_id', userId)
      .single()

    const isAdmin = teamMember?.role === 'admin' || teamMember?.role === 'owner'

    if (!isOwner && !isAdmin) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized - you cannot share this dashboard' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    let result: unknown

    switch (body.action) {
      case 'create':
        result = await createShare(supabase, tenantId, userId, body)
        break

      case 'update':
        result = await updateShare(supabase, tenantId, userId, body)
        break

      case 'revoke':
        result = await revokeShare(supabase, tenantId, body.dashboard_view_id)
        break

      case 'get':
        result = await getShares(supabase, body.dashboard_view_id)
        break

      default:
        throw new Error('Invalid action')
    }

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (error) {
    console.error('Error in share-dashboard:', error)
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})

async function createShare(
  supabase: ReturnType<typeof createClient>,
  tenantId: string,
  userId: string,
  request: ShareRequest
) {
  const shareToken = generateToken()
  const expiresAt = request.expires_at
    ? new Date(request.expires_at).toISOString()
    : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()

  const { data, error } = await supabase
    .from('seo_dashboard_shares')
    .insert({
      tenant_id: tenantId,
      dashboard_view_id: request.dashboard_view_id,
      shared_by: userId,
      shared_with_user_id: request.shared_with_user_id || null,
      shared_with_email: request.shared_with_email || null,
      share_token: shareToken,
      access_level: request.access_level || 'view',
      expires_at: expiresAt,
      can_export: request.can_export !== false,
      can_share: request.can_share || false,
    })
    .select()
    .single()

  if (error) throw error

  // Send notification if shared with specific user
  if (request.shared_with_user_id) {
    await supabase
      .from('seo_dashboard_notifications')
      .insert({
        tenant_id: tenantId,
        recipient_user_id: request.shared_with_user_id,
        notification_type: 'shared_dashboard',
        related_resource_id: request.dashboard_view_id,
        title: 'Dashboard geteilt',
        message: `Ein Dashboard wurde mit Ihnen geteilt`,
      })
  }

  return {
    success: true,
    share: data,
    share_url: `${Deno.env.get('SUPABASE_URL')}/functions/v1/view-shared-dashboard?token=${shareToken}`,
  }
}

async function updateShare(
  supabase: ReturnType<typeof createClient>,
  tenantId: string,
  userId: string,
  request: ShareRequest
) {
  const { data, error } = await supabase
    .from('seo_dashboard_shares')
    .update({
      access_level: request.access_level,
      expires_at: request.expires_at ? new Date(request.expires_at).toISOString() : undefined,
      can_export: request.can_export,
      can_share: request.can_share,
    })
    .eq('dashboard_view_id', request.dashboard_view_id)
    .eq('shared_by', userId)
    .select()

  if (error) throw error

  return { success: true, shares: data }
}

async function revokeShare(
  supabase: ReturnType<typeof createClient>,
  tenantId: string,
  dashboardViewId: string
) {
  const { error } = await supabase
    .from('seo_dashboard_shares')
    .delete()
    .eq('dashboard_view_id', dashboardViewId)
    .eq('tenant_id', tenantId)

  if (error) throw error

  return { success: true, message: 'All shares revoked' }
}

async function getShares(
  supabase: ReturnType<typeof createClient>,
  dashboardViewId: string
) {
  const { data, error } = await supabase
    .from('seo_dashboard_shares')
    .select(
      'id, shared_with_user_id, shared_with_email, access_level, can_export, can_share, expires_at, created_at'
    )
    .eq('dashboard_view_id', dashboardViewId)

  if (error) throw error

  return { shares: data }
}

function generateToken(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
  let token = ''
  for (let i = 0; i < 32; i++) {
    token += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return token
}
