/**
 * Browser-Client für eine lokale Ollama-Runtime.
 *
 * Warum im Browser und nicht in einer Edge Function: `127.0.0.1` bzw. eine
 * LAN-Adresse ist nur vom Gerät des Nutzers aus erreichbar. Kein Request
 * verlässt das Netz des Nutzers; es werden keine Secrets gesendet.
 *
 * Jede Funktion ist fail-closed und liefert einen `LocalAiResult` mit klarem
 * Fehlercode statt zu werfen.
 */
import type {
  ConnectionOutcome,
  LocalAiError,
  LocalAiErrorCode,
  LocalAiResult,
  RuntimeProbe,
} from './types';

export interface RuntimeClientOptions {
  fetchImpl?: typeof fetch;
  /** Origin der App-Seite, für Mixed-Content- und CORS-Hinweise. */
  pageOrigin?: string;
  timeoutMs?: number;
  now?: () => number;
}

const PROBE_TIMEOUT_MS = 5_000;
export const CHAT_TIMEOUT_MS = 120_000;

function fail<T>(code: LocalAiErrorCode, message: string, hint?: string): LocalAiResult<T> {
  return { ok: false, error: { code, message, ...(hint ? { hint } : {}) } };
}

function currentOrigin(opts: RuntimeClientOptions): string {
  if (opts.pageOrigin) return opts.pageOrigin;
  return typeof window !== 'undefined' ? window.location.origin : 'http://localhost';
}

function isLoopback(host: string): boolean {
  return host === 'localhost' || host === '[::1]' || host === '::1' || /^127\.\d+\.\d+\.\d+$/.test(host);
}

function isPrivateIpv4(host: string): boolean {
  const m = /^(\d+)\.(\d+)\.(\d+)\.(\d+)$/.exec(host);
  if (!m) return false;
  const [a, b] = [Number(m[1]), Number(m[2])];
  if ([a, b, Number(m[3]), Number(m[4])].some((n) => n > 255)) return false;
  return (
    a === 10 ||
    (a === 192 && b === 168) ||
    (a === 172 && b >= 16 && b <= 31) ||
    // CGNAT/Tailscale — typisches privates Overlay-Netz
    (a === 100 && b >= 64 && b <= 127)
  );
}

const LOCAL_SUFFIXES = ['.local', '.lan', '.home.arpa', '.internal'];

export function isLocalHost(host: string): boolean {
  const h = host.toLowerCase();
  return isLoopback(h) || isPrivateIpv4(h) || LOCAL_SUFFIXES.some((s) => h.endsWith(s));
}

/**
 * Normalisiert und validiert die Local Server URL. Erlaubt sind nur
 * Loopback-, private LAN- und lokale Hostnamen: eine „lokale KI" auf einem
 * öffentlichen Host wäre keine lokale KI.
 */
export function normalizeRuntimeUrl(input: string): LocalAiResult<string> {
  const raw = input.trim();
  if (!raw) return fail('INVALID_URL', 'Bitte eine Local Server URL angeben.');
  let url: URL;
  try {
    url = new URL(/^[a-z]+:\/\//i.test(raw) ? raw : `http://${raw}`);
  } catch {
    return fail('INVALID_URL', 'Die URL ist ungültig.', 'Beispiel: http://127.0.0.1:11434');
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    return fail('INVALID_URL', 'Nur http:// oder https:// sind erlaubt.');
  }
  if (url.username || url.password) {
    return fail('URL_CREDENTIALS_NOT_ALLOWED', 'Zugangsdaten gehören nicht in die URL.');
  }
  if (!isLocalHost(url.hostname)) {
    return fail(
      'NON_LOCAL_HOST',
      `${url.hostname} ist keine lokale Adresse.`,
      'Erlaubt sind 127.0.0.1, localhost, private LAN-Adressen (10.x, 172.16–31.x, 192.168.x) und *.local.',
    );
  }
  return { ok: true, data: `${url.protocol}//${url.host}` };
}

/**
 * Browser blockieren http-Requests von einer https-Seite an Nicht-Loopback-
 * Adressen (Mixed Content). Das erkennen wir vorab, statt einen
 * nichtssagenden Netzwerkfehler zu zeigen.
 */
export function detectMixedContent(runtimeUrl: string, pageOrigin: string): LocalAiError | null {
  const target = new URL(runtimeUrl);
  const page = new URL(pageOrigin);
  if (page.protocol === 'https:' && target.protocol === 'http:' && !isLoopback(target.hostname)) {
    return {
      code: 'MIXED_CONTENT_BLOCKED',
      message: 'Der Browser blockiert http-Verbindungen von dieser https-Seite zu anderen Geräten.',
      hint: 'Runtime per https (Reverse Proxy) bereitstellen oder Ollama auf diesem Gerät unter 127.0.0.1 betreiben.',
    };
  }
  return null;
}

export function corsHint(pageOrigin: string): string {
  return `Ollama muss diese Seite erlauben: OLLAMA_ORIGINS="${pageOrigin}" ollama serve`;
}

async function fetchWithTimeout(
  fetchImpl: typeof fetch,
  url: string,
  init: RequestInit,
  timeoutMs: number,
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetchImpl(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

function isAbort(err: unknown): boolean {
  return (err as { name?: string })?.name === 'AbortError';
}

/**
 * Ein fehlgeschlagener fetch verrät im Browser nicht, ob der Host fehlt oder
 * CORS blockiert. Ein `no-cors`-Request löst auf, sobald der Host antwortet —
 * dann ist die Runtime da, aber die Seite ist nicht freigegeben.
 */
async function classifyNetworkFailure(
  fetchImpl: typeof fetch,
  runtimeUrl: string,
  pageOrigin: string,
): Promise<LocalAiError> {
  try {
    await fetchWithTimeout(fetchImpl, `${runtimeUrl}/api/version`, { method: 'GET', mode: 'no-cors' }, 2_000);
    return {
      code: 'CORS_BLOCKED',
      message: 'Ollama läuft, aber CORS bzw. die Netzwerkfreigabe blockiert den Zugriff aus dem Browser.',
      hint: corsHint(pageOrigin),
    };
  } catch {
    return {
      code: 'RUNTIME_UNREACHABLE',
      message: 'Runtime nicht erreichbar.',
      hint: 'Läuft Ollama? Starten mit: ollama serve',
    };
  }
}

/** Prüft Verbindung und listet installierte Modelle (`GET /api/tags`). */
export async function probeRuntime(
  input: string,
  opts: RuntimeClientOptions = {},
): Promise<LocalAiResult<RuntimeProbe>> {
  const normalized = normalizeRuntimeUrl(input);
  if (!normalized.ok) return normalized;
  const runtimeUrl = normalized.data;
  const pageOrigin = currentOrigin(opts);
  const mixed = detectMixedContent(runtimeUrl, pageOrigin);
  if (mixed) return { ok: false, error: mixed };

  const fetchImpl = opts.fetchImpl ?? fetch.bind(globalThis);
  const now = opts.now ?? (() => performance.now());
  const started = now();
  let res: Response;
  try {
    res = await fetchWithTimeout(fetchImpl, `${runtimeUrl}/api/tags`, { method: 'GET' }, opts.timeoutMs ?? PROBE_TIMEOUT_MS);
  } catch (err) {
    if (isAbort(err)) return fail('TIMEOUT', 'Die Runtime hat nicht rechtzeitig geantwortet.');
    return { ok: false, error: await classifyNetworkFailure(fetchImpl, runtimeUrl, pageOrigin) };
  }
  const latencyMs = Math.max(0, Math.round(now() - started));
  if (!res.ok) return fail('RUNTIME_HTTP_ERROR', `Runtime antwortet mit HTTP ${res.status}.`);

  let body: unknown;
  try {
    body = await res.json();
  } catch {
    return fail('NOT_OLLAMA', 'Unter dieser Adresse antwortet keine Ollama-Runtime.');
  }
  const list = (body as { models?: unknown })?.models;
  if (!Array.isArray(list)) {
    return fail('NOT_OLLAMA', 'Unter dieser Adresse antwortet keine Ollama-Runtime.');
  }
  const models = list
    .map((m) => (m && typeof m === 'object' ? (m as { name?: unknown }).name : null))
    .filter((n): n is string => typeof n === 'string' && n.length > 0);

  return { ok: true, data: { runtimeUrl, models, latencyMs, checkedAt: new Date().toISOString() } };
}

/** Übersetzt ein Probe-Ergebnis in die vier UX-Ergebnisse aus Schritt 2. */
export function connectionOutcome(result: LocalAiResult<RuntimeProbe>): ConnectionOutcome {
  if (result.ok) return result.data.models.length > 0 ? 'reachable' : 'no_models';
  switch (result.error.code) {
    case 'CORS_BLOCKED':
    case 'MIXED_CONTENT_BLOCKED':
      return 'blocked';
    case 'INVALID_URL':
    case 'URL_CREDENTIALS_NOT_ALLOWED':
    case 'NON_LOCAL_HOST':
      return 'invalid';
    default:
      return 'unreachable';
  }
}

export interface ChatRequest {
  runtimeUrl: string;
  model: string;
  system: string;
  prompt: string;
}

export interface ChatResponse {
  content: string;
  durationMs: number;
}

/** Nicht-streamender JSON-Chat gegen `POST /api/chat`. */
export async function chatJson(req: ChatRequest, opts: RuntimeClientOptions = {}): Promise<LocalAiResult<ChatResponse>> {
  const normalized = normalizeRuntimeUrl(req.runtimeUrl);
  if (!normalized.ok) return normalized;
  const runtimeUrl = normalized.data;
  const pageOrigin = currentOrigin(opts);
  const mixed = detectMixedContent(runtimeUrl, pageOrigin);
  if (mixed) return { ok: false, error: mixed };

  const fetchImpl = opts.fetchImpl ?? fetch.bind(globalThis);
  const now = opts.now ?? (() => performance.now());
  const started = now();
  let res: Response;
  try {
    res = await fetchWithTimeout(
      fetchImpl,
      `${runtimeUrl}/api/chat`,
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          model: req.model,
          stream: false,
          format: 'json',
          options: { temperature: 0 },
          messages: [
            { role: 'system', content: req.system },
            { role: 'user', content: req.prompt },
          ],
        }),
      },
      opts.timeoutMs ?? CHAT_TIMEOUT_MS,
    );
  } catch (err) {
    if (isAbort(err)) return fail('TIMEOUT', 'Das Modell hat nicht rechtzeitig geantwortet.', 'Beim ersten Aufruf lädt Ollama das Modell — erneut versuchen.');
    return { ok: false, error: await classifyNetworkFailure(fetchImpl, runtimeUrl, pageOrigin) };
  }
  if (res.status === 404) {
    return fail('MODEL_NOT_INSTALLED', `Modell ${req.model} ist nicht installiert.`, `ollama pull ${req.model}`);
  }
  if (!res.ok) return fail('RUNTIME_HTTP_ERROR', `Runtime antwortet mit HTTP ${res.status}.`);
  let body: unknown;
  try {
    body = await res.json();
  } catch {
    return fail('NOT_OLLAMA', 'Die Antwort der Runtime ist kein JSON.');
  }
  const content = (body as { message?: { content?: unknown } })?.message?.content;
  if (typeof content !== 'string' || !content.trim()) {
    return fail('EMPTY_RESPONSE', 'Das Modell hat keine Antwort geliefert.');
  }
  return { ok: true, data: { content, durationMs: Math.max(0, Math.round(now() - started)) } };
}
