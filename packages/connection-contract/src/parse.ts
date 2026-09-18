import type { DiscoveryFailure } from './types.ts';

export interface OpenApiOperation {
  operationId?: string;
  summary?: string;
  tags?: string[];
}

export interface OpenApiSpec {
  openapi: string;
  info?: { title?: string; version?: string };
  servers?: Array<{ url?: string }>;
  paths?: Record<string, Record<string, OpenApiOperation | undefined> | undefined>;
}

const HTTP_METHODS = new Set(['get', 'put', 'post', 'patch', 'delete', 'head', 'options']);

export function fail(code: string, message: string): DiscoveryFailure {
  return { ok: false, error_code: code, message };
}

export function assertSafeSpecUrl(raw: string): DiscoveryFailure | { ok: true; url: URL } {
  const trimmed = raw.trim();
  if (!trimmed) return fail('INVALID_URL', 'OpenAPI-URL fehlt.');
  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    return fail('INVALID_URL', 'OpenAPI-URL ist ungültig.');
  }
  const proto = url.protocol.toLowerCase();
  if (proto !== 'https:' && proto !== 'http:') {
    return fail('UNSAFE_URL', `Schema ${url.protocol} ist nicht erlaubt.`);
  }
  return { ok: true, url };
}

export function parseOpenApiDocument(raw: string): OpenApiSpec | DiscoveryFailure {
  const text = raw.replace(/^\uFEFF/, '').trim();
  if (!text) return fail('EMPTY_SPEC', 'OpenAPI-Dokument ist leer.');

  if (text.startsWith('{')) {
    try {
      const parsed = JSON.parse(text) as unknown;
      return normalizeSpec(parsed);
    } catch {
      return fail('INVALID_JSON', 'OpenAPI-JSON ist nicht parsebar.');
    }
  }

  if (/^\s*openapi\s*:/m.test(text) || /^\s*swagger\s*:/m.test(text)) {
    const yamlAttempt = parseMinimalOpenApiYaml(text);
    if (yamlAttempt) return yamlAttempt;
    return fail(
      'YAML_UNSUPPORTED',
      'YAML-OpenAPI wird in dieser Stufe nur als flaches Subset gelesen. Bitte JSON liefern oder Spec vereinfachen.',
    );
  }

  return fail('UNKNOWN_FORMAT', 'Weder JSON-Objekt noch OpenAPI-YAML erkannt.');
}

function normalizeSpec(parsed: unknown): OpenApiSpec | DiscoveryFailure {
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return fail('INVALID_SPEC', 'OpenAPI-Wurzel muss ein Objekt sein.');
  }
  const obj = parsed as Record<string, unknown>;
  if (typeof obj.swagger === 'string' && !obj.openapi) {
    return fail('SWAGGER_2', 'Swagger 2.0 wird nicht unterstützt. OpenAPI 3.x erforderlich.');
  }
  if (typeof obj.openapi !== 'string' || !obj.openapi.startsWith('3.')) {
    return fail('UNSUPPORTED_OPENAPI', 'Nur OpenAPI 3.x wird akzeptiert.');
  }
  const paths = obj.paths;
  if (paths !== undefined && (typeof paths !== 'object' || paths === null || Array.isArray(paths))) {
    return fail('INVALID_PATHS', 'Feld paths muss ein Objekt sein.');
  }
  return obj as unknown as OpenApiSpec;
}

function parseMinimalOpenApiYaml(text: string): OpenApiSpec | DiscoveryFailure | null {
  const lines = text.split(/\r?\n/).filter((l) => !/^\s*#/.test(l) && l.trim() !== '');
  const root: Record<string, unknown> = {};
  const stack: Array<{ indent: number; obj: Record<string, unknown> }> = [{ indent: -1, obj: root }];

  for (const line of lines) {
    const indent = line.match(/^ */)?.[0].length ?? 0;
    const trimmed = line.trim();
    if (trimmed.startsWith('- ')) {
      return null;
    }
    const colon = trimmed.indexOf(':');
    if (colon < 0) return null;
    const key = trimmed.slice(0, colon).trim();
    let value: string = trimmed.slice(colon + 1).trim();
    while (stack.length > 1 && indent <= stack[stack.length - 1].indent) stack.pop();
    const parent = stack[stack.length - 1].obj;
    if (value === '' || value === '|' || value === '>') {
      const child: Record<string, unknown> = {};
      parent[key] = child;
      stack.push({ indent, obj: child });
      continue;
    }
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    parent[key] = value;
  }

  if (typeof root.swagger === 'string') {
    return fail('SWAGGER_2', 'Swagger 2.0 wird nicht unterstützt. OpenAPI 3.x erforderlich.');
  }
  if (typeof root.openapi !== 'string') return null;
  return normalizeSpec(root);
}

export function isHttpMethod(key: string): key is import('./types.ts').HttpMethod {
  return HTTP_METHODS.has(key.toLowerCase());
}
