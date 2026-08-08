import { createClient } from 'jsr:@supabase/supabase-js@2';
import { buildCorsHeaders, handleOptions, jsonResponse, jsonError } from '../_shared/gateway.ts';
import { auditLog } from '../_shared/auditLog.ts';

const supabaseUrl = Deno.env.get('SUPABASE_URL');
const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

if (!supabaseUrl || !supabaseKey) {
  throw new Error('Missing Supabase environment variables');
}

const supabase = createClient(supabaseUrl, supabaseKey);
const corsHeaders = buildCorsHeaders('GET, POST, PUT, DELETE, OPTIONS');

interface McpServerPayload {
  name?: string;
  description?: string;
  server_url?: string;
  auth_type?: string;
  auth_header_name?: string;
  is_active?: boolean;
  metadata?: Record<string, unknown>;
}

interface CredentialPayload {
  credential_key: string;
  credential_value: string;
  credential_type: 'api_key' | 'token' | 'password' | 'oauth_token' | 'custom';
  expires_at?: string;
}

async function getUserTenantId(authHeader: string | null): Promise<string> {
  if (!authHeader?.startsWith('Bearer ')) {
    throw new Error('Missing or invalid authorization header');
  }

  const token = authHeader.slice(7);
  const { data: { user }, error } = await supabase.auth.getUser(token);

  if (error || !user) {
    throw new Error('Invalid or expired token');
  }

  // Tenant-Zugehoerigkeit kommt aus public.memberships, nicht aus profiles:
  // profiles fuehrt keine tenant_id, und auth.users ebenfalls nicht. memberships
  // ist die Quelle, auf der auch public.is_tenant_member() aufsetzt — damit
  // entscheiden Edge Function und RLS-Policy nach derselben Regel.
  const { data: membership, error: membershipError } = await supabase
    .from('memberships')
    .select('tenant_id')
    .eq('user_id', user.id)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle();

  if (membershipError || !membership) {
    throw new Error('User is not a member of any tenant');
  }

  return membership.tenant_id;
}

async function createServer(
  tenantId: string,
  payload: McpServerPayload,
  userId: string,
): Promise<{ id: string; name: string }> {
  const { data, error } = await supabase
    .from('mcp_servers')
    .insert({
      tenant_id: tenantId,
      name: payload.name,
      description: payload.description,
      server_url: payload.server_url,
      auth_type: payload.auth_type || 'api_key',
      auth_header_name: payload.auth_header_name || 'Authorization',
      is_active: payload.is_active !== false,
      metadata: payload.metadata || {},
      created_by: userId,
    })
    .select('id, name')
    .single();

  if (error) {
    throw new Error(`Failed to create MCP server: ${error.message}`);
  }

  await auditLog(supabase, {
    tenant_id: tenantId,
    user_id: userId,
    action: 'mcp_server_created',
    resource_type: 'mcp_server',
    resource_id: data.id,
    changes: { created: payload },
  });

  return data;
}

async function updateServer(
  tenantId: string,
  serverId: string,
  payload: McpServerPayload,
  userId: string,
): Promise<{ id: string; name: string }> {
  const { data, error } = await supabase
    .from('mcp_servers')
    .update({
      ...payload,
      updated_at: new Date().toISOString(),
    })
    .eq('id', serverId)
    .eq('tenant_id', tenantId)
    .select('id, name')
    .single();

  if (error) {
    throw new Error(`Failed to update MCP server: ${error.message}`);
  }

  await auditLog(supabase, {
    tenant_id: tenantId,
    user_id: userId,
    action: 'mcp_server_updated',
    resource_type: 'mcp_server',
    resource_id: serverId,
    changes: { updated: payload },
  });

  return data;
}

async function deleteServer(
  tenantId: string,
  serverId: string,
  userId: string,
): Promise<void> {
  const { error } = await supabase
    .from('mcp_servers')
    .delete()
    .eq('id', serverId)
    .eq('tenant_id', tenantId);

  if (error) {
    throw new Error(`Failed to delete MCP server: ${error.message}`);
  }

  await auditLog(supabase, {
    tenant_id: tenantId,
    user_id: userId,
    action: 'mcp_server_deleted',
    resource_type: 'mcp_server',
    resource_id: serverId,
  });
}

async function getServers(tenantId: string): Promise<unknown[]> {
  const { data, error } = await supabase
    .from('mcp_servers')
    .select('*')
    .eq('tenant_id', tenantId)
    .order('created_at', { ascending: false });

  if (error) {
    throw new Error(`Failed to fetch MCP servers: ${error.message}`);
  }

  return data || [];
}

async function getServer(tenantId: string, serverId: string): Promise<unknown> {
  const { data, error } = await supabase
    .from('mcp_servers')
    .select('*')
    .eq('id', serverId)
    .eq('tenant_id', tenantId)
    .single();

  if (error) {
    throw new Error(`Failed to fetch MCP server: ${error.message}`);
  }

  return data;
}

async function setCredential(
  tenantId: string,
  serverId: string,
  payload: CredentialPayload,
  userId: string,
): Promise<void> {
  // Verify server exists and belongs to tenant
  const { data: server, error: serverError } = await supabase
    .from('mcp_servers')
    .select('id')
    .eq('id', serverId)
    .eq('tenant_id', tenantId)
    .single();

  if (serverError || !server) {
    throw new Error('MCP server not found');
  }

  // Der Geheimniswert geht in Supabase Vault, die Tabelle behaelt nur den
  // Namen. RLS ist Zugriffskontrolle, keine Verschluesselung — ein Wert in
  // einer per SELECT-Policy lesbaren Spalte waere fuer jedes Tenant-Mitglied
  // sichtbar und laege zusaetzlich in Backups und WAL.
  const vaultSecretName = `mcp_cred_${serverId}_${payload.credential_key}`;

  const { error: vaultError } = await supabase.rpc('set_app_secret', {
    secret_name: vaultSecretName,
    secret_value: payload.credential_value,
  });

  if (vaultError) {
    throw new Error(`Failed to store credential in vault: ${vaultError.message}`);
  }

  const { error } = await supabase
    .from('mcp_server_credentials')
    .upsert(
      {
        server_id: serverId,
        tenant_id: tenantId,
        credential_key: payload.credential_key,
        vault_secret_name: vaultSecretName,
        credential_type: payload.credential_type,
        expires_at: payload.expires_at,
      },
      { onConflict: 'server_id, credential_key' },
    );

  if (error) {
    throw new Error(`Failed to store credential: ${error.message}`);
  }

  await auditLog(supabase, {
    tenant_id: tenantId,
    user_id: userId,
    action: 'mcp_credential_set',
    resource_type: 'mcp_server',
    resource_id: serverId,
    changes: { key: payload.credential_key },
  });
}

async function testConnection(
  tenantId: string,
  serverId: string,
  userId: string,
): Promise<{ success: boolean; message: string; details?: unknown }> {
  const { data: server, error: serverError } = await supabase
    .from('mcp_servers')
    .select('*')
    .eq('id', serverId)
    .eq('tenant_id', tenantId)
    .single();

  if (serverError || !server) {
    throw new Error('MCP server not found');
  }

  try {
    const response = await fetch(`${server.server_url}/health`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
      signal: AbortSignal.timeout(5000),
    });

    const testResult = {
      success: response.ok,
      status_code: response.status,
      timestamp: new Date().toISOString(),
    };

    // Update server with test result
    await supabase
      .from('mcp_servers')
      .update({
        is_verified: response.ok,
        last_verified_at: new Date().toISOString(),
        connection_test_result: testResult,
      })
      .eq('id', serverId);

    await auditLog(supabase, {
      tenant_id: tenantId,
      user_id: userId,
      action: 'mcp_connection_tested',
      resource_type: 'mcp_server',
      resource_id: serverId,
      changes: { test_result: testResult },
    });

    return {
      success: response.ok,
      message: response.ok ? 'Connection successful' : `Server returned status ${response.status}`,
      details: testResult,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    const testResult = {
      success: false,
      error: errorMessage,
      timestamp: new Date().toISOString(),
    };

    await supabase
      .from('mcp_servers')
      .update({
        connection_test_result: testResult,
      })
      .eq('id', serverId);

    return {
      success: false,
      message: `Connection failed: ${errorMessage}`,
      details: testResult,
    };
  }
}

Deno.serve(async (req) => {
  const preflight = handleOptions(req, corsHeaders);
  if (preflight) return preflight;

  try {
    const authHeader = req.headers.get('authorization');
    const tenantId = await getUserTenantId(authHeader);
    const { data: { user } } = await supabase.auth.getUser(authHeader?.slice(7));

    const url = new URL(req.url);
    const pathname = url.pathname;
    const method = req.method;

    // POST /mcp-server-management — Create server
    if (method === 'POST' && pathname === '/functions/v1/mcp-server-management') {
      const payload = await req.json() as McpServerPayload;
      const result = await createServer(tenantId, payload, user?.id || '');
      return jsonResponse({ ok: true, server: result });
    }

    // GET /mcp-server-management — List servers
    if (method === 'GET' && pathname === '/functions/v1/mcp-server-management') {
      const servers = await getServers(tenantId);
      return jsonResponse({ ok: true, servers });
    }

    // GET /mcp-server-management/:serverId — Get server
    if (method === 'GET' && pathname.match(/\/mcp-server-management\/[a-f0-9-]+$/)) {
      const serverId = pathname.split('/').pop()!;
      const server = await getServer(tenantId, serverId);
      return jsonResponse({ ok: true, server });
    }

    // PUT /mcp-server-management/:serverId — Update server
    if (method === 'PUT' && pathname.match(/\/mcp-server-management\/[a-f0-9-]+$/)) {
      const serverId = pathname.split('/').pop()!;
      const payload = await req.json() as McpServerPayload;
      const result = await updateServer(tenantId, serverId, payload, user?.id || '');
      return jsonResponse({ ok: true, server: result });
    }

    // DELETE /mcp-server-management/:serverId — Delete server
    if (method === 'DELETE' && pathname.match(/\/mcp-server-management\/[a-f0-9-]+$/)) {
      const serverId = pathname.split('/').pop()!;
      await deleteServer(tenantId, serverId, user?.id || '');
      return jsonResponse({ ok: true, message: 'Server deleted' });
    }

    // POST /mcp-server-management/:serverId/credentials — Set credential
    if (method === 'POST' && pathname.match(/\/mcp-server-management\/[a-f0-9-]+\/credentials$/)) {
      const serverId = pathname.split('/')[pathname.split('/').length - 2];
      const payload = await req.json() as CredentialPayload;
      await setCredential(tenantId, serverId, payload, user?.id || '');
      return jsonResponse({ ok: true, message: 'Credential stored' });
    }

    // POST /mcp-server-management/:serverId/test — Test connection
    if (method === 'POST' && pathname.match(/\/mcp-server-management\/[a-f0-9-]+\/test$/)) {
      const serverId = pathname.split('/')[pathname.split('/').length - 2];
      const result = await testConnection(tenantId, serverId, user?.id || '');
      return jsonResponse({ ok: result.success, ...result });
    }

    return jsonError(404, 'NOT_FOUND', 'Endpoint not found', corsHeaders);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('[mcp-server-management]', message);
    return jsonError(500, 'INTERNAL_ERROR', message, corsHeaders);
  }
});
