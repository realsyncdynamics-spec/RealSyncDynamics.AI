import { getSupabase } from '../../lib/supabase';

export type AuthType = 'api_key' | 'oauth' | 'token' | 'basic' | 'none';
export type CredentialType = 'api_key' | 'token' | 'password' | 'oauth_token' | 'custom';

export interface McpServer {
  id: string;
  tenant_id: string;
  name: string;
  description?: string;
  server_url: string;
  auth_type: AuthType;
  auth_header_name: string;
  is_active: boolean;
  is_verified: boolean;
  last_verified_at?: string;
  connection_test_result?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
  created_by?: string;
  created_at: string;
  updated_at: string;
}

export interface McpServerCredential {
  id: string;
  server_id: string;
  tenant_id: string;
  credential_key: string;
  credential_type: CredentialType;
  expires_at?: string;
  created_at: string;
  updated_at: string;
}

export interface McpServerUsage {
  id: string;
  server_id: string;
  tenant_id: string;
  user_id?: string;
  endpoint?: string;
  method: string;
  status_code?: number;
  response_time_ms?: number;
  error_message?: string;
  metadata?: Record<string, unknown>;
  created_at: string;
}

export interface CreateServerRequest {
  name: string;
  description?: string;
  server_url: string;
  auth_type: AuthType;
  auth_header_name?: string;
  metadata?: Record<string, unknown>;
}

export interface UpdateServerRequest {
  name?: string;
  description?: string;
  server_url?: string;
  auth_type?: AuthType;
  auth_header_name?: string;
  is_active?: boolean;
  metadata?: Record<string, unknown>;
}

export interface SetCredentialRequest {
  credential_key: string;
  credential_value: string;
  credential_type: CredentialType;
  expires_at?: string;
}

export interface ApiResponse<T> {
  ok: boolean;
  error?: {
    code: string;
    message: string;
  };
  data?: T;
}

async function callEdgeFunction<T>(
  endpoint: string,
  method: 'GET' | 'POST' | 'PUT' | 'DELETE',
  body?: unknown,
): Promise<T> {
  const sb = getSupabase();
  const { data, error } = await sb.functions.invoke('mcp-server-management', {
    method,
    body: body ? JSON.stringify(body) : undefined,
  });

  if (error) {
    throw new Error(`MCP API Error: ${error.message}`);
  }

  if (!data.ok) {
    throw new Error(data.error?.message || 'Unknown error');
  }

  return data as T;
}

export const createServer = async (request: CreateServerRequest): Promise<McpServer> => {
  const response = await callEdgeFunction<{ server: McpServer }>(
    '/mcp-server-management',
    'POST',
    request,
  );
  return response.server;
};

export const updateServer = async (
  serverId: string,
  request: UpdateServerRequest,
): Promise<McpServer> => {
  const response = await callEdgeFunction<{ server: McpServer }>(
    `/mcp-server-management/${serverId}`,
    'PUT',
    request,
  );
  return response.server;
};

export const deleteServer = async (serverId: string): Promise<void> => {
  await callEdgeFunction<{ message: string }>(
    `/mcp-server-management/${serverId}`,
    'DELETE',
  );
};

export const getServers = async (): Promise<McpServer[]> => {
  const response = await callEdgeFunction<{ servers: McpServer[] }>(
    '/mcp-server-management',
    'GET',
  );
  return response.servers || [];
};

export const getServer = async (serverId: string): Promise<McpServer> => {
  const response = await callEdgeFunction<{ server: McpServer }>(
    `/mcp-server-management/${serverId}`,
    'GET',
  );
  return response.server;
};

export const setCredential = async (
  serverId: string,
  credential: SetCredentialRequest,
): Promise<void> => {
  await callEdgeFunction<{ message: string }>(
    `/mcp-server-management/${serverId}/credentials`,
    'POST',
    credential,
  );
};

export interface ConnectionTestResult {
  success: boolean;
  message: string;
  details?: {
    status_code?: number;
    error?: string;
    timestamp: string;
  };
}

export const testServerConnection = async (serverId: string): Promise<ConnectionTestResult> => {
  const response = await callEdgeFunction<ConnectionTestResult>(
    `/mcp-server-management/${serverId}/test`,
    'POST',
  );
  return response;
};

export async function fetchTenantMcpServers(tenantId: string): Promise<McpServer[]> {
  const sb = getSupabase();
  const { data, error } = await sb
    .from('mcp_servers')
    .select('*')
    .eq('tenant_id', tenantId)
    .order('created_at', { ascending: false });

  if (error) throw new Error(error.message);
  return (data ?? []) as McpServer[];
}

export async function fetchMcpServerUsage(
  serverId: string,
  limit = 100,
): Promise<McpServerUsage[]> {
  const sb = getSupabase();
  const { data, error } = await sb
    .from('mcp_server_usage')
    .select('*')
    .eq('server_id', serverId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) throw new Error(error.message);
  return (data ?? []) as McpServerUsage[];
}
