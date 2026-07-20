// Enterprise AI OS Agent Runs List
// Lists historical agent runs with optional filtering and pagination
//
// GET /functions/v1/enterprise-ai-os-agent-runs-list?tenantId=...&agentId=...&limit=25&offset=0
//
// Query Parameters:
//   - tenantId (optional): Filter by tenant
//   - agentId (optional): Filter by agent ID
//   - status (optional): Filter by run status
//   - limit (optional): Number of results (default 25, max 100)
//   - offset (optional): Pagination offset (default 0)
//
// Response:
// {
//   runs: Array<AgentRunRow>
//   total: number
//   limit: number
//   offset: number
// }

import { createClient } from 'jsr:@supabase/supabase-js@2';
import { corsHeaders, handleOptions, jsonResponse, jsonError } from '../_shared/gateway.ts';

interface AgentRunRow {
  id: string;
  tenant_id: string | null;
  agent_id: string;
  actor: string;
  status: string;
  summary: string;
  created_at: string;
}

interface ListResponse {
  runs: AgentRunRow[];
  total: number;
  limit: number;
  offset: number;
}

async function listAgentRuns(params: {
  tenantId?: string;
  agentId?: string;
  status?: string;
  limit?: number;
  offset?: number;
}): Promise<ListResponse> {
  const limit = Math.min(params.limit ?? 25, 100);
  const offset = params.offset ?? 0;

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    );

    // Build query with filters
    let query = supabase
      .from('enterprise_agent_runs')
      .select('id, tenant_id, agent_id, actor, status, summary, created_at', { count: 'exact' });

    if (params.tenantId) {
      query = query.eq('tenant_id', params.tenantId);
    }
    if (params.agentId) {
      query = query.eq('agent_id', params.agentId);
    }
    if (params.status) {
      query = query.eq('status', params.status);
    }

    // Apply pagination and sorting
    const { data, count, error } = await query
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      throw error;
    }

    return {
      runs: (data as AgentRunRow[]) || [],
      total: count ?? 0,
      limit,
      offset,
    };
  } catch (err) {
    console.error('List error:', err);
    throw err;
  }
}

// Main handler
Deno.serve(async (req) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return handleOptions(req);
  }

  if (req.method !== 'GET') {
    return jsonError({ error: 'Method not allowed' }, 405, corsHeaders);
  }

  try {
    const url = new URL(req.url);
    const params = {
      tenantId: url.searchParams.get('tenantId') ?? undefined,
      agentId: url.searchParams.get('agentId') ?? undefined,
      status: url.searchParams.get('status') ?? undefined,
      limit: url.searchParams.get('limit') ? parseInt(url.searchParams.get('limit')!, 10) : undefined,
      offset: url.searchParams.get('offset') ? parseInt(url.searchParams.get('offset')!, 10) : undefined,
    };

    const result = await listAgentRuns(params);
    return jsonResponse(result, 200, corsHeaders);
  } catch (err) {
    console.error('Handler error:', err);
    return jsonError(
      {
        error: err instanceof Error ? err.message : 'Unknown error',
      },
      400,
      corsHeaders
    );
  }
});
