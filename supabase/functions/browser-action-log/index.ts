import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';
import { crypto } from 'https://deno.land/std@0.208.0/crypto/mod.ts';

interface BrowserActionPayload {
  tenantId: string;
  actorId?: string;
  sessionId: string;
  workflowId?: string;
  runId?: string;
  toolName?: string;
  browserAction: 'preview_load' | 'preview_error' | 'reload' | 'scan_start' | 'scan_complete' | 'evidence_generate' | 'open_external';
  status: 'started' | 'completed' | 'failed' | 'blocked';
  url?: string;
  httpStatus?: number;
  startedAt?: string;
  completedAt?: string;
  durationMs?: number;
  evidenceHash?: string;
  evidenceSizeBytes?: number;
  errorMessage?: string;
  errorCode?: string;
  browserUserAgent?: string;
  clientIp?: string;
  metadata?: Record<string, unknown>;
}

async function sha256(data: string): Promise<string> {
  const encoder = new TextEncoder();
  const msgUint8 = encoder.encode(data);
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgUint8);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

Deno.serve(async (req) => {
  // CORS headers
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      },
    });
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    const payload: BrowserActionPayload = await req.json();

    // Validate required fields
    if (!payload.tenantId || !payload.sessionId || !payload.browserAction || !payload.status) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: tenantId, sessionId, browserAction, status' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Initialize Supabase with service role (Edge Function inherits auth context)
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') || '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    );

    // Compute evidence hash if provided
    let evidenceHash: string | null = null;
    if (payload.evidenceHash) {
      evidenceHash = payload.evidenceHash;
    }

    // Get current timestamp if not provided
    const now = new Date().toISOString();
    const startedAt = payload.startedAt || now;
    const completedAt = payload.completedAt;

    // Calculate duration if both timestamps provided
    let durationMs = payload.durationMs;
    if (startedAt && completedAt && !durationMs) {
      durationMs = new Date(completedAt).getTime() - new Date(startedAt).getTime();
    }

    // Extract client IP from request
    const clientIp = payload.clientIp ||
      req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
      req.headers.get('cf-connecting-ip') ||
      '';

    // Insert browser action log
    const { data, error } = await supabase
      .from('browser_actions')
      .insert({
        tenant_id: payload.tenantId,
        actor_id: payload.actorId || null,
        session_id: payload.sessionId,
        workflow_id: payload.workflowId || null,
        run_id: payload.runId || null,
        tool_name: payload.toolName || null,
        browser_action: payload.browserAction,
        status: payload.status,
        url: payload.url || null,
        http_status: payload.httpStatus || null,
        started_at: startedAt,
        completed_at: completedAt || null,
        duration_ms: durationMs || null,
        evidence_hash: evidenceHash,
        evidence_size_bytes: payload.evidenceSizeBytes || null,
        error_message: payload.errorMessage || null,
        error_code: payload.errorCode || null,
        browser_user_agent: payload.browserUserAgent || null,
        client_ip: clientIp,
        metadata: payload.metadata || {},
      })
      .select()
      .single();

    if (error) {
      console.error('Error logging browser action:', error);
      return new Response(
        JSON.stringify({ error: 'Failed to log browser action', details: error.message }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    return new Response(JSON.stringify({ success: true, id: data?.id }), {
      status: 201,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('Unexpected error in browser-action-log:', err);
    return new Response(
      JSON.stringify({ error: 'Internal server error', message: (err as Error).message }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
});
