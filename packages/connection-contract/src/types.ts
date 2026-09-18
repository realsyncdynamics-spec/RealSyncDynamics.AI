/** Capability grant. Discovery never emits `allow` for mutating verbs. */
export type CapabilityGrant = 'allow' | 'approval' | 'deny';

export type CapabilityVerb = 'read' | 'write' | 'delete' | 'execute';

export type AdapterKind = 'rest' | 'oauth' | 'webhook' | 'mcp' | 'openapi';

export type HttpMethod = 'get' | 'put' | 'post' | 'patch' | 'delete' | 'head' | 'options';

export interface DiscoveredCapability {
  tool_id: string;
  resource: string;
  operation: string;
  verb: CapabilityVerb;
  grant: CapabilityGrant;
  risk_level: 'low' | 'medium' | 'high';
  method: HttpMethod;
  path: string;
  summary?: string;
  operation_id?: string;
}

export interface DiscoveryWarning {
  code: string;
  message: string;
  path?: string;
}

export interface DiscoveryResult {
  ok: true;
  spec_title: string | null;
  spec_version: string | null;
  openapi_version: string;
  base_url: string | null;
  resources: string[];
  capabilities: DiscoveredCapability[];
  warnings: DiscoveryWarning[];
}

export interface DiscoveryFailure {
  ok: false;
  error_code: string;
  message: string;
}

export type DiscoveryOutcome = DiscoveryResult | DiscoveryFailure;

export interface DiscoverOptions {
  provider?: string;
  max_operations?: number;
}
