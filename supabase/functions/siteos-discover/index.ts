import { createClient } from 'jsr:@supabase/supabase-js@2';
import { handleOptions, jsonError, jsonResponse, methodNotAllowed } from '../_shared/gateway.ts';

const MAX_HTML_BYTES = 1_000_000;
const MAX_TEXT_CHARS = 12_000;
const MAX_SERVICES = 12;
const MAX_REDIRECTS = 3;

Deno.serve(async (req) => {
  const preflight = handleOptions(req);
  if (preflight) return preflight;
  if (req.method !== 'POST') return methodNotAllowed();

  const authHeader = req.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return jsonError(401, 'UNAUTHORIZED', 'missing bearer token');
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return jsonError(400, 'BAD_REQUEST', 'invalid json');
  }

  const tenantId = String(body.tenant_id ?? '').trim();
  const rawUrl = String(body.url ?? '').trim();
  if (!tenantId) return jsonError(400, 'BAD_REQUEST', 'tenant_id required');
  if (!rawUrl) return jsonError(400, 'BAD_REQUEST', 'url required');

  let sourceUrl: URL;
  try {
    sourceUrl = new URL(rawUrl);
  } catch {
    return jsonError(400, 'BAD_REQUEST', 'invalid url');
  }
  if (!['http:', 'https:'].includes(sourceUrl.protocol)) {
    return jsonError(400, 'BAD_REQUEST', 'only http and https are supported');
  }
  if (isBlockedHostname(sourceUrl.hostname)) {
    return jsonError(400, 'BAD_REQUEST', 'private or local addresses are not allowed');
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
  const serviceRole = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!supabaseUrl || !anonKey || !serviceRole) {
    return jsonError(500, 'INTERNAL', 'Supabase environment is incomplete');
  }

  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false },
  });
  const { data: userResp, error: userErr } = await userClient.auth.getUser();
  if (userErr || !userResp.user) return jsonError(401, 'UNAUTHORIZED', 'invalid token');

  const admin = createClient(supabaseUrl, serviceRole, { auth: { persistSession: false } });
  const { data: member } = await admin
    .from('memberships')
    .select('user_id')
    .eq('tenant_id', tenantId)
    .eq('user_id', userResp.user.id)
    .maybeSingle();
  if (!member) return jsonError(403, 'FORBIDDEN', 'not a member of this tenant');

  try {
    const discovered = await discover(sourceUrl);
    return jsonResponse({ ok: true, ...discovered });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'website discovery failed';
    return jsonError(502, 'UNREACHABLE', message);
  }
});

async function discover(startUrl: URL) {
  let current = startUrl;
  let response: Response | null = null;

  for (let redirects = 0; redirects <= MAX_REDIRECTS; redirects += 1) {
    if (isBlockedHostname(current.hostname)) {
      throw new Error('redirected to a private or local address');
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8_000);
    try {
      response = await fetch(current, {
        method: 'GET',
        redirect: 'manual',
        headers: {
          'accept': 'text/html,application/xhtml+xml;q=0.9,text/plain;q=0.5,*/*;q=0.1',
          'user-agent': 'RealSyncDynamicsAI-SiteOS-Discovery/1.0',
        },
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timer);
    }

    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get('location');
      if (!location) throw new Error('redirect response without location');
      if (redirects === MAX_REDIRECTS) throw new Error('too many redirects');
      current = new URL(location, current);
      continue;
    }
    break;
  }

  if (!response) throw new Error('no response');
  if (!response.ok) throw new Error(`source returned HTTP ${response.status}`);

  const contentType = response.headers.get('content-type') ?? '';
  if (!/text\/html|application\/xhtml\+xml|text\/plain/i.test(contentType)) {
    throw new Error('source is not an HTML document');
  }

  const declaredLength = Number(response.headers.get('content-length') ?? 0);
  if (declaredLength > MAX_HTML_BYTES) throw new Error('source document is too large');

  const html = (await response.text()).slice(0, MAX_HTML_BYTES);
  const title = cleanText(firstMatch(html, /<title[^>]*>([\s\S]*?)<\/title>/i));
  const description = cleanText(firstMatch(html, /<meta[^>]+name=["']description["'][^>]+content=["']([\s\S]*?)["'][^>]*>/i)
    ?? firstMatch(html, /<meta[^>]+content=["']([\s\S]*?)["'][^>]+name=["']description["'][^>]*>/i));
  const h1 = cleanText(firstMatch(html, /<h1[^>]*>([\s\S]*?)<\/h1>/i));
  const headings = extractAll(html, /<h[2-3][^>]*>([\s\S]*?)<\/h[2-3]>/gi, 12);
  const visibleText = cleanText(
    html
      .replace(/<script\b[\s\S]*?<\/script>/gi, ' ')
      .replace(/<style\b[\s\S]*?<\/style>/gi, ' ')
      .replace(/<noscript\b[\s\S]*?<\/noscript>/gi, ' ')
      .replace(/<[^>]+>/g, ' '),
  ).slice(0, MAX_TEXT_CHARS);
  const services = unique([...headings, ...extractServiceLikeText(visibleText)]).slice(0, MAX_SERVICES);

  return {
    source_url: current.toString(),
    status: response.status,
    content_type: contentType,
    title: title || null,
    description: description || null,
    h1: h1 || null,
    headings,
    services,
    visible_text: visibleText,
    fetched_at: new Date().toISOString(),
  };
}

function firstMatch(input: string, pattern: RegExp): string | null {
  return input.match(pattern)?.[1] ?? null;
}

function extractAll(input: string, pattern: RegExp, limit: number): string[] {
  const values: string[] = [];
  for (const match of input.matchAll(pattern)) {
    const value = cleanText(match[1] ?? '');
    if (value) values.push(value);
    if (values.length >= limit) break;
  }
  return unique(values);
}

function cleanText(value: string | null): string {
  if (!value) return '';
  return decodeEntities(value.replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim();
}

function decodeEntities(value: string): string {
  return value
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>');
}

function extractServiceLikeText(text: string): string[] {
  return text
    .split(/[.!?•|]/)
    .map((part) => part.trim())
    .filter((part) => part.length >= 8 && part.length <= 100)
    .filter((part) => /angebot|leistung|service|produkt|beratung|termin|reparatur|installation|planung|behandlung/i.test(part));
}

function unique(values: string[]): string[] {
  return [...new Map(values.map((value) => [value.toLocaleLowerCase('de-DE'), value])).values()];
}

function isBlockedHostname(hostname: string): boolean {
  const host = hostname.toLowerCase().replace(/^\[|\]$/g, '');
  if (host === 'localhost' || host.endsWith('.localhost') || host === 'local') return true;
  if (host === '::1' || host.startsWith('fc') || host.startsWith('fd') || host.startsWith('fe80:')) return true;

  const parts = host.split('.').map(Number);
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) return false;
  const [a, b] = parts;
  return a === 0 || a === 10 || a === 127 || a === 169 && b === 254 || a === 172 && b >= 16 && b <= 31
    || a === 192 && b === 168 || a === 100 && b >= 64 && b <= 127 || a >= 224;
}