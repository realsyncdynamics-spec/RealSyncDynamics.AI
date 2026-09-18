import {
  assertSafeSpecUrl,
  fail,
  isHttpMethod,
  parseOpenApiDocument,
  type OpenApiSpec,
} from './parse.ts';
import type {
  CapabilityGrant,
  CapabilityVerb,
  DiscoverOptions,
  DiscoveredCapability,
  DiscoveryOutcome,
  DiscoveryWarning,
  HttpMethod,
} from './types.ts';

const DEFAULT_MAX = 200;

const METHOD_VERB: Record<HttpMethod, CapabilityVerb> = {
  get: 'read',
  head: 'read',
  options: 'read',
  post: 'write',
  put: 'write',
  patch: 'write',
  delete: 'delete',
};

export function defaultGrant(verb: CapabilityVerb): CapabilityGrant {
  if (verb === 'read') return 'allow';
  if (verb === 'write') return 'approval';
  return 'deny';
}

export function defaultRisk(verb: CapabilityVerb): 'low' | 'medium' | 'high' {
  if (verb === 'read') return 'low';
  if (verb === 'write') return 'medium';
  return 'high';
}

export function resourceFromPath(path: string): string {
  const parts = path.split('/').filter((p) => p && !p.startsWith('{'));
  const last = parts[parts.length - 1] ?? 'root';
  return last.replace(/[^a-zA-Z0-9_]+/g, '_').replace(/^_+|_+$/g, '') || 'root';
}

export function operationName(method: HttpMethod, path: string, operationId?: string): string {
  if (operationId && /^[a-zA-Z][a-zA-Z0-9_]*$/.test(operationId)) {
    return operationId;
  }
  const res = resourceFromPath(path);
  const hasId = /\{[^}]+\}/.test(path);
  switch (method) {
    case 'get':
      return hasId ? `get_${singularize(res)}` : `list_${res}`;
    case 'post':
      return `create_${singularize(res)}`;
    case 'put':
    case 'patch':
      return `update_${singularize(res)}`;
    case 'delete':
      return `delete_${singularize(res)}`;
    default:
      return `${method}_${res}`;
  }
}

function singularize(name: string): string {
  if (name.endsWith('ies') && name.length > 3) return `${name.slice(0, -3)}y`;
  if (name.endsWith('ses') && name.length > 3) return name.slice(0, -2);
  if (name.endsWith('s') && !name.endsWith('ss') && name.length > 1) return name.slice(0, -1);
  return name;
}

export function toolId(provider: string, resource: string, operation: string): string {
  const p = provider.replace(/[^a-zA-Z0-9_]+/g, '_').toLowerCase() || 'api';
  return `${p}.${resource}.${operation}`;
}

export function discoverFromDocument(raw: string, options: DiscoverOptions = {}): DiscoveryOutcome {
  const parsed = parseOpenApiDocument(raw);
  if ('ok' in parsed && parsed.ok === false) return parsed;
  return discoverFromSpec(parsed as OpenApiSpec, options);
}

export function discoverFromSpec(spec: OpenApiSpec, options: DiscoverOptions = {}): DiscoveryOutcome {
  const provider = options.provider ?? 'api';
  const max = options.max_operations ?? DEFAULT_MAX;
  const warnings: DiscoveryWarning[] = [];
  const capabilities: DiscoveredCapability[] = [];
  const resources = new Set<string>();

  const paths = spec.paths ?? {};
  const pathKeys = Object.keys(paths);
  if (pathKeys.length === 0) {
    return fail('NO_PATHS', 'OpenAPI-Dokument enthält keine paths.');
  }

  for (const path of pathKeys) {
    const item = paths[path];
    if (!item || typeof item !== 'object') continue;
    for (const key of Object.keys(item)) {
      const methodKey = key.toLowerCase();
      if (!isHttpMethod(methodKey)) continue;
      const method = methodKey as HttpMethod;
      const op = item[key] ?? {};
      const resource = resourceFromPath(path);
      resources.add(resource);
      const operation = operationName(method, path, op.operationId);
      const verb = METHOD_VERB[method];
      if (capabilities.length >= max) {
        warnings.push({
          code: 'TRUNCATED',
          message: `Mehr als ${max} Operationen. Rest ignoriert.`,
          path,
        });
        break;
      }
      capabilities.push({
        tool_id: toolId(provider, resource, operation),
        resource,
        operation,
        verb,
        grant: defaultGrant(verb),
        risk_level: defaultRisk(verb),
        method,
        path,
        summary: typeof op.summary === 'string' ? op.summary : undefined,
        operation_id: typeof op.operationId === 'string' ? op.operationId : undefined,
      });
    }
  }

  if (capabilities.length === 0) {
    return fail('NO_OPERATIONS', 'Keine HTTP-Operationen in paths gefunden.');
  }

  const serverUrl =
    Array.isArray(spec.servers) && spec.servers[0] && typeof spec.servers[0].url === 'string'
      ? spec.servers[0].url
      : null;

  return {
    ok: true,
    spec_title: spec.info?.title ?? null,
    spec_version: spec.info?.version ?? null,
    openapi_version: spec.openapi,
    base_url: serverUrl,
    resources: [...resources].sort(),
    capabilities,
    warnings,
  };
}

export type FetchLike = (input: string, init?: { method?: string; headers?: Record<string, string> }) => Promise<{
  ok: boolean;
  status: number;
  text(): Promise<string>;
}>;

export async function discoverFromUrl(
  rawUrl: string,
  fetchImpl: FetchLike,
  options: DiscoverOptions = {},
): Promise<DiscoveryOutcome> {
  const safe = assertSafeSpecUrl(rawUrl);
  if (!('url' in safe)) return safe;

  let res: Awaited<ReturnType<FetchLike>>;
  try {
    res = await fetchImpl(safe.url.toString(), {
      method: 'GET',
      headers: { accept: 'application/json, application/yaml, text/yaml, text/plain' },
    });
  } catch (err) {
    return fail('FETCH_FAILED', err instanceof Error ? err.message : 'Spec-URL nicht erreichbar.');
  }
  if (!res.ok) {
    return fail('FETCH_HTTP', `Spec-URL antwortete mit HTTP ${res.status}.`);
  }
  const text = await res.text();
  return discoverFromDocument(text, options);
}
