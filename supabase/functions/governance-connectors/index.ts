// governance-connectors — Integrationen, beidseitig (Zielarchitektur §9).
//
//   POST /functions/v1/governance-connectors
//   { op: 'list' | 'create' | 'update' | 'delete' | 'observe' | 'act', … }
//
// ## Warum diese Datei neu geschrieben ist
//
// Vorher waren es 37 Zeilen, die `{ action, data }` lasen, `console.log`
// riefen und `{ success: true, message: 'Governance connector active' }`
// zurueckgaben. Nichts wurde geschrieben.
//
// Der Aufrufer ist `src/features/governance/connectorsApi.ts` hinter der
// gerouteten, auth-gated Seite `/app/connectors`. Er sendet `{ op: 'create',
// … }` — ein anderes Feld als das gelesene. Ein Nutzer legte also einen
// Connector an, bekam `success: true` und eine leere Liste, ohne Fehler.
//
// Nach CLAUDE.md §14 ist das **Fertigstellen** ("Buttons ohne Handler …
// entweder fertigstellen oder entfernen"), nicht Umschreiben — und damit
// ausdruecklich frei. Die Antwortform folgt jetzt dem, was der Client
// ohnehin erwartet: `{ ok, connector?, error? }`.
//
// ## Regel 1: beidseitig
//
// `observe` holt den Repository-Zustand und schreibt Befunde ans Asset.
// `act` traegt einen Befund als Issue nach GitHub zurueck. Eine Integration,
// die nur liest, waere nach §9 ein Datensilo.
//
// ## Regel 2: Zugangsdaten nie im Client
//
// Das Token geht **nie** nach `integration_connectors.config` — die Tabelle
// hat mit `connectors_tenant_read` ein Leserecht fuer `authenticated`, ein
// Geheimnis dort waere aus dem Browser lesbar. Es liegt verschluesselt in
// `integration_connector_secrets`, die keine Policy fuer `authenticated`
// traegt. Ein DB-CHECK weist `config` mit geheimnisartigen Schluesseln ab.
//
// ## Regel 4: Ausfall ist ein Zustand
//
// Der Beobachtungslauf wird **vor** dem Netzaufruf angelegt und danach
// fortgeschrieben. Wer die Zeile erst nach Erfolg schreibt, hat von einem
// Timeout keine Spur — und der Kunde liest "keine Befunde" als Entwarnung.

import { createClient } from 'jsr:@supabase/supabase-js@2';
import { buildCorsHeaders, handleOptions, jsonResponse } from '../_shared/gateway.ts';
import { recordFinding } from '../_shared/findings.ts';
import {
  GITHUB_DETECTOR,
  deriveGitHubFindings,
  isConclusive,
  issueBodyFor,
  issueTitleFor,
  undeterminedFields,
  type GitHubFinding,
  type GitHubRepoObservation,
} from '../_shared/github-observation.ts';

const corsHeaders = buildCorsHeaders('POST, OPTIONS');

const GITHUB_API = 'https://api.github.com';
const FETCH_TIMEOUT_MS = 10_000;

/** Nur diese Typen kennt der CHECK auf `integration_connectors.connector_type`. */
const CONNECTOR_TYPES = new Set(['jira', 'github', 'linear', 'servicenow', 'slack', 'teams']);

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AdminClient = ReturnType<typeof createClient<any, 'public', any>>;

interface Ctx {
  admin: AdminClient;
  tenantId: string;
  userId: string;
}

function fail(code: string, message: string, status = 400): Response {
  return jsonResponse({ ok: false, error: { code, message } }, status, corsHeaders);
}

Deno.serve(async (req) => {
  const preflight = handleOptions(req, corsHeaders);
  if (preflight) return preflight;
  if (req.method !== 'POST') return fail('METHOD_NOT_ALLOWED', 'POST required', 405);

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return fail('BAD_REQUEST', 'invalid json');
  }

  const authHeader = req.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) return fail('UNAUTHORIZED', 'missing bearer token', 401);

  const url = Deno.env.get('SUPABASE_URL');
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
  const serviceRole = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !anonKey || !serviceRole) return fail('INTERNAL', 'Supabase environment incomplete', 500);

  const userClient = createClient(url, anonKey, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false },
  });
  const { data: userResp, error: userErr } = await userClient.auth.getUser();
  if (userErr || !userResp.user) return fail('UNAUTHORIZED', 'invalid token', 401);

  const admin = createClient(url, serviceRole, { auth: { persistSession: false } });

  // `tenant_id` ist optional, und das ist kein Entgegenkommen: Der Aufrufer
  // `connectorsApi.ts` sendet es bei `create`, aber nicht bei `update` und
  // `delete` — dort kennt die Oberfläche nur die Connector-Id. Da ein Nutzer
  // laut CLAUDE.md §11 zu genau einem Mandanten gehört, ist die Zugehörigkeit
  // ableitbar. Ein verlangtes Feld hätte zwei der vier Aufrufe abgewiesen.
  let tenantId = String(body.tenant_id ?? '').trim();
  if (tenantId) {
    const { data: member } = await admin
      .from('memberships').select('user_id')
      .eq('tenant_id', tenantId).eq('user_id', userResp.user.id).maybeSingle();
    if (!member) return fail('FORBIDDEN', 'not a member of this tenant', 403);
  } else {
    const { data: memberships } = await admin
      .from('memberships').select('tenant_id').eq('user_id', userResp.user.id);
    const ids = (memberships ?? []).map((m: { tenant_id: string }) => m.tenant_id);
    if (ids.length === 0) return fail('FORBIDDEN', 'user belongs to no tenant', 403);
    // Mehrdeutigkeit wird nicht geraten. Wer in zwei Mandanten steht, muss
    // sagen, welcher gemeint ist — sonst schriebe die Function in den
    // falschen.
    if (ids.length > 1) return fail('BAD_REQUEST', 'tenant_id required — user belongs to more than one tenant');
    tenantId = ids[0];
  }

  const ctx: Ctx = { admin, tenantId, userId: userResp.user.id };
  const op = String(body.op ?? '').trim();

  try {
    switch (op) {
      case 'list':    return await opList(ctx);
      case 'create':  return await opCreate(ctx, body);
      case 'update':  return await opUpdate(ctx, body);
      case 'delete':  return await opDelete(ctx, body);
      case 'observe': return await opObserve(ctx, body);
      case 'act':     return await opAct(ctx, body);
      default:
        return fail('BAD_REQUEST', `unknown op "${op}"; known: list, create, update, delete, observe, act`);
    }
  } catch (e) {
    console.error(JSON.stringify({
      level: 'error', scope: 'governance_connectors_failed', op,
      error: (e as Error)?.message ?? String(e),
    }));
    return fail('INTERNAL', 'connector operation failed', 500);
  }
});

// ─────────────────────────────────────────────────────────────────────
// Verwaltung
// ─────────────────────────────────────────────────────────────────────

/** Spalten, die der Client sehen darf — `config` ist bewusst dabei, das Token nie. */
const PUBLIC_COLUMNS =
  'id, tenant_id, connector_type, name, config, enabled, trigger_on_risk_level, ' +
  'trigger_on_policy_action, asset_id, status, last_observed_at, last_error, created_at';

async function opList(ctx: Ctx): Promise<Response> {
  const { data, error } = await ctx.admin
    .from('integration_connectors').select(PUBLIC_COLUMNS)
    .eq('tenant_id', ctx.tenantId).order('created_at', { ascending: false });
  if (error) return fail('INTERNAL', error.message, 500);
  return jsonResponse({ ok: true, connectors: data ?? [] }, 200, corsHeaders);
}

async function opCreate(ctx: Ctx, body: Record<string, unknown>): Promise<Response> {
  const connectorType = String(body.connector_type ?? '').trim();
  const name = String(body.name ?? '').trim();
  if (!CONNECTOR_TYPES.has(connectorType)) {
    return fail('BAD_REQUEST', `connector_type must be one of: ${[...CONNECTOR_TYPES].join(', ')}`);
  }
  if (!name) return fail('BAD_REQUEST', 'name required');

  const config = sanitizeConfig(body.config);
  if (config === null) {
    return fail('BAD_REQUEST', 'config must not carry credentials — pass them as `token` (§9 Regel 2)');
  }

  const { data: created, error } = await ctx.admin
    .from('integration_connectors')
    .insert({
      tenant_id: ctx.tenantId,
      connector_type: connectorType,
      name,
      config,
      enabled: body.enabled === undefined ? true : Boolean(body.enabled),
      asset_id: typeof body.asset_id === 'string' && body.asset_id ? body.asset_id : null,
      // Ohne geprüfte Verbindung ist der Zustand nicht "connected", sondern
      // "unverified". Erst eine erfolgreiche Beobachtung setzt ihn.
      status: 'unverified',
    })
    .select(PUBLIC_COLUMNS).single();

  if (error) return fail('INTERNAL', error.message, 500);

  // Das Token geht in die getrennte Tabelle — nie in die Zeile oben.
  const token = typeof body.token === 'string' ? body.token.trim() : '';
  if (token) {
    const stored = await storeSecret(ctx, created.id, token, body.scopes);
    if (!stored.ok) return fail('INTERNAL', stored.error ?? 'secret not stored', 500);
  }

  return jsonResponse({ ok: true, connector: created }, 200, corsHeaders);
}

async function opUpdate(ctx: Ctx, body: Record<string, unknown>): Promise<Response> {
  const id = String(body.id ?? '').trim();
  if (!id) return fail('BAD_REQUEST', 'id required');

  const patch: Record<string, unknown> = {};
  if (typeof body.name === 'string') patch.name = body.name.trim();
  if (body.enabled !== undefined) patch.enabled = Boolean(body.enabled);
  if (typeof body.asset_id === 'string') patch.asset_id = body.asset_id || null;
  if (body.config !== undefined) {
    const config = sanitizeConfig(body.config);
    if (config === null) {
      return fail('BAD_REQUEST', 'config must not carry credentials (§9 Regel 2)');
    }
    patch.config = config;
  }

  if (Object.keys(patch).length > 0) {
    const { error } = await ctx.admin
      .from('integration_connectors').update(patch)
      .eq('id', id).eq('tenant_id', ctx.tenantId);
    if (error) return fail('INTERNAL', error.message, 500);
  }

  // Ein neues Token ersetzt das alte und setzt den Zustand zurück: Ob es
  // trägt, weiß erst die nächste Beobachtung.
  const token = typeof body.token === 'string' ? body.token.trim() : '';
  if (token) {
    const stored = await storeSecret(ctx, id, token, body.scopes);
    if (!stored.ok) return fail('INTERNAL', stored.error ?? 'secret not stored', 500);
    await ctx.admin.from('integration_connectors')
      .update({ status: 'unverified', last_error: null })
      .eq('id', id).eq('tenant_id', ctx.tenantId);
  }

  const { data: updated, error: readErr } = await ctx.admin
    .from('integration_connectors').select(PUBLIC_COLUMNS)
    .eq('id', id).eq('tenant_id', ctx.tenantId).maybeSingle();
  if (readErr) return fail('INTERNAL', readErr.message, 500);
  if (!updated) return fail('NOT_FOUND', 'connector not found for this tenant', 404);

  return jsonResponse({ ok: true, connector: updated }, 200, corsHeaders);
}

async function opDelete(ctx: Ctx, body: Record<string, unknown>): Promise<Response> {
  const id = String(body.id ?? '').trim();
  if (!id) return fail('BAD_REQUEST', 'id required');

  // Das Geheimnis fällt über ON DELETE CASCADE mit — es bleibt nichts liegen,
  // was niemand mehr einem Connector zuordnen kann.
  const { error } = await ctx.admin
    .from('integration_connectors').delete()
    .eq('id', id).eq('tenant_id', ctx.tenantId);
  if (error) return fail('INTERNAL', error.message, 500);

  return jsonResponse({ ok: true }, 200, corsHeaders);
}

/**
 * Weist `config` ab, wenn dort ein Geheimnis steht.
 *
 * Der DB-CHECK tut dasselbe; diese Prüfung liegt davor, damit der Aufrufer
 * einen benannten Fehler bekommt statt eines Constraint-Verstosses. `null`
 * heisst abgelehnt.
 */
function sanitizeConfig(raw: unknown): Record<string, unknown> | null {
  if (raw === undefined || raw === null) return {};
  if (typeof raw !== 'object' || Array.isArray(raw)) return {};
  const forbidden = new Set([
    'token', 'secret', 'password', 'api_key', 'apiKey', 'access_token',
    'accessToken', 'private_key', 'privateKey', 'client_secret', 'clientSecret',
  ]);
  for (const key of Object.keys(raw as Record<string, unknown>)) {
    if (forbidden.has(key)) return null;
  }
  return raw as Record<string, unknown>;
}

// ─────────────────────────────────────────────────────────────────────
// Zugangsdaten
// ─────────────────────────────────────────────────────────────────────

/**
 * Verschlüsselt mit AES-GCM und legt das Ergebnis in der getrennten Tabelle ab.
 *
 * Der Schlüssel kommt aus `INTEGRATION_SECRET_KEY` (32 Byte, base64). Fehlt er,
 * wird **nicht** im Klartext gespeichert — dann scheitert das Anlegen. Ein
 * Klartext-Rückfall wäre die Sorte Bequemlichkeit, die §9 Regel 2 aufhebt.
 */
async function storeSecret(
  ctx: Ctx, connectorId: string, token: string, rawScopes: unknown,
): Promise<{ ok: boolean; error?: string }> {
  const keyB64 = Deno.env.get('INTEGRATION_SECRET_KEY');
  if (!keyB64) return { ok: false, error: 'INTEGRATION_SECRET_KEY is not configured' };

  let encrypted: string;
  try {
    encrypted = await encryptToken(token, keyB64);
  } catch (e) {
    return { ok: false, error: `encryption failed: ${(e as Error).message}` };
  }

  const scopes = Array.isArray(rawScopes) ? rawScopes.map((s) => String(s)) : [];
  const { error } = await ctx.admin
    .from('integration_connector_secrets')
    .upsert({
      connector_id: connectorId,
      tenant_id: ctx.tenantId,
      token_encrypted: encrypted,
      scopes,
      rotated_at: new Date().toISOString(),
    }, { onConflict: 'connector_id' });

  return error ? { ok: false, error: error.message } : { ok: true };
}

async function loadToken(ctx: Ctx, connectorId: string): Promise<string | null> {
  const keyB64 = Deno.env.get('INTEGRATION_SECRET_KEY');
  if (!keyB64) return null;

  const { data } = await ctx.admin
    .from('integration_connector_secrets').select('token_encrypted')
    .eq('connector_id', connectorId).eq('tenant_id', ctx.tenantId)
    .maybeSingle<{ token_encrypted: string }>();
  if (!data) return null;

  try {
    return await decryptToken(data.token_encrypted, keyB64);
  } catch {
    return null;
  }
}

async function importKey(keyB64: string): Promise<CryptoKey> {
  const raw = Uint8Array.from(atob(keyB64), (c) => c.charCodeAt(0));
  if (raw.byteLength !== 32) throw new Error('INTEGRATION_SECRET_KEY must be 32 bytes (base64)');
  return crypto.subtle.importKey('raw', raw, { name: 'AES-GCM' }, false, ['encrypt', 'decrypt']);
}

/** Format: base64(iv[12] ‖ ciphertext). Der IV ist je Aufruf neu. */
async function encryptToken(plain: string, keyB64: string): Promise<string> {
  const key = await importKey(keyB64);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const cipher = new Uint8Array(
    await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, new TextEncoder().encode(plain)),
  );
  const joined = new Uint8Array(iv.byteLength + cipher.byteLength);
  joined.set(iv, 0);
  joined.set(cipher, iv.byteLength);
  return btoa(String.fromCharCode(...joined));
}

async function decryptToken(stored: string, keyB64: string): Promise<string> {
  const key = await importKey(keyB64);
  const joined = Uint8Array.from(atob(stored), (c) => c.charCodeAt(0));
  const iv = joined.slice(0, 12);
  const cipher = joined.slice(12);
  const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, cipher);
  return new TextDecoder().decode(plain);
}

// ─────────────────────────────────────────────────────────────────────
// Beobachtung (§9 Regel 1, erste Hälfte)
// ─────────────────────────────────────────────────────────────────────

async function opObserve(ctx: Ctx, body: Record<string, unknown>): Promise<Response> {
  const id = String(body.connector_id ?? '').trim();
  if (!id) return fail('BAD_REQUEST', 'connector_id required');

  const { data: connector } = await ctx.admin
    .from('integration_connectors')
    .select('id, connector_type, config, asset_id, enabled')
    .eq('id', id).eq('tenant_id', ctx.tenantId)
    .maybeSingle<{ id: string; connector_type: string; config: Record<string, unknown>; asset_id: string | null; enabled: boolean }>();

  if (!connector) return fail('NOT_FOUND', 'connector not found for this tenant', 404);
  if (connector.connector_type !== 'github') {
    return fail('UNSUPPORTED', `observation is implemented for github, not "${connector.connector_type}"`);
  }
  if (!connector.enabled) return fail('CONFLICT', 'connector is disabled', 409);

  const owner = String(connector.config?.owner ?? '').trim();
  const repo = String(connector.config?.repo ?? '').trim();
  if (!owner || !repo) return fail('BAD_REQUEST', 'config.owner and config.repo required for a github connector');

  // Regel 4: Der Lauf existiert, bevor das Netz befragt wird.
  const { data: run, error: runErr } = await ctx.admin
    .from('integration_observations')
    .insert({
      tenant_id: ctx.tenantId, connector_id: connector.id,
      asset_id: connector.asset_id, status: 'running',
    })
    .select('id').single();
  if (runErr) return fail('INTERNAL', runErr.message, 500);

  const token = await loadToken(ctx, connector.id);
  if (!token) {
    await failRun(ctx, run.id, connector.id, 'NO_CREDENTIAL', 'no usable credential stored for this connector');
    return fail('NO_CREDENTIAL', 'no usable credential stored for this connector', 409);
  }

  let observation: GitHubRepoObservation;
  try {
    observation = await observeRepo(owner, repo, token);
  } catch (e) {
    const message = (e as Error)?.message ?? String(e);
    await failRun(ctx, run.id, connector.id, 'UNREACHABLE', message);
    return fail('UNREACHABLE', message, 502);
  }

  const findings = deriveGitHubFindings(observation);
  const undetermined = undeterminedFields(observation);

  for (const f of findings) {
    await recordFinding(ctx.admin, {
      tenant_id: ctx.tenantId,
      category: f.category,
      severity: f.severity,
      detector: GITHUB_DETECTOR,
      summary: f.title,
      // `observed`: Die Tatsache kommt aus der API des Fremdsystems, nicht
      // aus einer Ableitung (§9 Regel 3 — Quelle, nicht Urteil).
      evidence_level: 'observed',
      evidence_ref: `${GITHUB_API}/repos/${owner}/${repo}`,
      correlation_id: run.id,
      raw_payload: { code: f.code, detail: f.detail, reference: f.reference, observed_at: observation.observedAt },
    });
  }

  const nowIso = new Date().toISOString();
  await ctx.admin.from('integration_observations').update({
    status: 'completed', finding_count: findings.length,
    undetermined, completed_at: nowIso,
  }).eq('id', run.id);

  await ctx.admin.from('integration_connectors').update({
    status: 'connected', last_observed_at: nowIso, last_error: null,
  }).eq('id', connector.id).eq('tenant_id', ctx.tenantId);

  return jsonResponse({
    ok: true,
    observation_id: run.id,
    finding_count: findings.length,
    findings,
    undetermined,
    // Ohne diese Angabe liest sich `finding_count: 0` als Entwarnung, auch
    // wenn drei Felder gar nicht feststellbar waren.
    conclusive: isConclusive(observation),
  }, 200, corsHeaders);
}

async function failRun(
  ctx: Ctx, runId: string, connectorId: string, code: string, message: string,
): Promise<void> {
  const nowIso = new Date().toISOString();
  await ctx.admin.from('integration_observations').update({
    status: 'failed', error_code: code, error_message: message.slice(0, 500),
    completed_at: nowIso,
  }).eq('id', runId);

  // Der Ausfall steht auch am Connector — sonst müsste die Oberfläche die
  // Laufhistorie durchsuchen, um "geht nicht" anzuzeigen.
  await ctx.admin.from('integration_connectors').update({
    status: 'error', last_error: `${code}: ${message}`.slice(0, 500),
  }).eq('id', connectorId).eq('tenant_id', ctx.tenantId);
}

async function ghFetch(path: string, token: string): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    return await fetch(`${GITHUB_API}${path}`, {
      headers: {
        authorization: `Bearer ${token}`,
        accept: 'application/vnd.github+json',
        'x-github-api-version': '2022-11-28',
        'user-agent': 'RealSyncDynamicsAI-GitHubConnector/1.0',
      },
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Holt den Repository-Zustand.
 *
 * Jede Teilabfrage kann `null` liefern — das heisst „nicht feststellbar",
 * nicht „nein". Ein Token ohne `admin:repo` bekommt auf die Branch-Protection
 * einen 403; daraus „ungeschützt" zu schliessen wäre ein erfundener Befund
 * gegen ein fremdes Unternehmen.
 */
async function observeRepo(owner: string, repo: string, token: string): Promise<GitHubRepoObservation> {
  const observedAt = new Date().toISOString();
  const repoResp = await ghFetch(`/repos/${owner}/${repo}`, token);

  // Die Basisabfrage ist die einzige, deren Scheitern den ganzen Lauf kippt:
  // ohne sie ist nicht einmal klar, ob das Repository existiert.
  if (!repoResp.ok) {
    throw new Error(`GET /repos/${owner}/${repo} returned HTTP ${repoResp.status}`);
  }
  const meta = await repoResp.json() as Record<string, unknown>;

  const defaultBranch = typeof meta.default_branch === 'string' ? meta.default_branch : null;
  const security = (meta.security_and_analysis ?? null) as Record<string, { status?: string }> | null;

  const [protection, alerts, community] = await Promise.all([
    defaultBranch
      ? ghFetch(`/repos/${owner}/${repo}/branches/${defaultBranch}/protection`, token)
      : Promise.resolve(null),
    ghFetch(`/repos/${owner}/${repo}/vulnerability-alerts`, token),
    ghFetch(`/repos/${owner}/${repo}/community/profile`, token),
  ]);

  let communityFiles: Record<string, unknown> | null = null;
  if (community?.ok) {
    const profile = await community.json() as Record<string, unknown>;
    communityFiles = (profile.files ?? null) as Record<string, unknown> | null;
  }

  return {
    owner, repo, observedAt,
    isPrivate: typeof meta.private === 'boolean' ? meta.private : null,
    archived: typeof meta.archived === 'boolean' ? meta.archived : null,
    defaultBranch,
    // 200 = geschützt, 404 = nicht geschützt, alles andere (403, 5xx) = unbekannt.
    defaultBranchProtected: protection === null ? null
      : protection.status === 200 ? true
      : protection.status === 404 ? false
      : null,
    // 204 = an, 404 = aus, sonst unbekannt.
    vulnerabilityAlertsEnabled: alerts.status === 204 ? true
      : alerts.status === 404 ? false
      : null,
    secretScanningEnabled: security?.secret_scanning?.status === 'enabled' ? true
      : security?.secret_scanning?.status === 'disabled' ? false
      : null,
    hasSecurityPolicy: communityFiles ? communityFiles.security != null : null,
    hasLicense: typeof meta.license === 'object'
      ? meta.license !== null
      : communityFiles ? communityFiles.license != null : null,
  };
}

// ─────────────────────────────────────────────────────────────────────
// Aktion (§9 Regel 1, zweite Hälfte)
// ─────────────────────────────────────────────────────────────────────

/**
 * Trägt einen Befund als Issue nach GitHub zurück.
 *
 * Der Lauf wird in `remediation_actions` protokolliert — auch beim
 * Scheitern. Eine Aktion, die nur bei Erfolg eine Spur hinterlässt, macht
 * genau die Fälle unsichtbar, für die man den Prüfpfad braucht.
 */
async function opAct(ctx: Ctx, body: Record<string, unknown>): Promise<Response> {
  const connectorId = String(body.connector_id ?? '').trim();
  const raw = body.finding as Partial<GitHubFinding> | undefined;
  if (!connectorId) return fail('BAD_REQUEST', 'connector_id required');
  if (!raw?.code || !raw.title) return fail('BAD_REQUEST', 'finding with code and title required');

  const { data: connector } = await ctx.admin
    .from('integration_connectors')
    .select('id, connector_type, config, enabled')
    .eq('id', connectorId).eq('tenant_id', ctx.tenantId)
    .maybeSingle<{ id: string; connector_type: string; config: Record<string, unknown>; enabled: boolean }>();

  if (!connector) return fail('NOT_FOUND', 'connector not found for this tenant', 404);
  if (connector.connector_type !== 'github') {
    return fail('UNSUPPORTED', `action is implemented for github, not "${connector.connector_type}"`);
  }
  if (!connector.enabled) return fail('CONFLICT', 'connector is disabled', 409);

  const owner = String(connector.config?.owner ?? '').trim();
  const repo = String(connector.config?.repo ?? '').trim();
  if (!owner || !repo) return fail('BAD_REQUEST', 'config.owner and config.repo required');

  const finding: GitHubFinding = {
    code: String(raw.code),
    category: (raw.category ?? 'other') as GitHubFinding['category'],
    severity: (raw.severity ?? 'medium') as GitHubFinding['severity'],
    title: String(raw.title),
    detail: String(raw.detail ?? ''),
    reference: raw.reference ? String(raw.reference) : null,
  };

  const { data: action, error: actionErr } = await ctx.admin
    .from('remediation_actions')
    .insert({
      tenant_id: ctx.tenantId, connector_id: connector.id,
      action_type: 'create_issue', status: 'executing',
      payload: { code: finding.code, severity: finding.severity, repo: `${owner}/${repo}` },
    })
    .select('id').single();
  if (actionErr) return fail('INTERNAL', actionErr.message, 500);

  const token = await loadToken(ctx, connector.id);
  if (!token) {
    await ctx.admin.from('remediation_actions').update({
      status: 'failed', error_message: 'no usable credential stored', executed_at: new Date().toISOString(),
    }).eq('id', action.id);
    return fail('NO_CREDENTIAL', 'no usable credential stored for this connector', 409);
  }

  let created: { number?: number; html_url?: string };
  try {
    // Eigener Aufruf statt `ghFetch`: Das ist der einzige Schreibzugriff,
    // und er braucht Methode, Content-Type und Rumpf.
    const post = await fetch(`${GITHUB_API}/repos/${owner}/${repo}/issues`, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${token}`,
        accept: 'application/vnd.github+json',
        'x-github-api-version': '2022-11-28',
        'content-type': 'application/json',
        'user-agent': 'RealSyncDynamicsAI-GitHubConnector/1.0',
      },
      body: JSON.stringify({
        title: issueTitleFor(finding),
        body: issueBodyFor(finding, `${owner}/${repo}`),
      }),
    });
    if (!post.ok) throw new Error(`POST issues returned HTTP ${post.status}`);
    created = await post.json() as { number?: number; html_url?: string };
  } catch (e) {
    const message = (e as Error)?.message ?? String(e);
    await ctx.admin.from('remediation_actions').update({
      status: 'failed', error_message: message.slice(0, 500), executed_at: new Date().toISOString(),
    }).eq('id', action.id);
    await ctx.admin.from('integration_connectors').update({
      status: 'error', last_error: `create_issue: ${message}`.slice(0, 500),
    }).eq('id', connector.id).eq('tenant_id', ctx.tenantId);
    return fail('ACTION_FAILED', message, 502);
  }

  await ctx.admin.from('remediation_actions').update({
    status: 'completed',
    external_id: created.number != null ? String(created.number) : null,
    external_url: created.html_url ?? null,
    executed_at: new Date().toISOString(),
  }).eq('id', action.id);

  return jsonResponse({
    ok: true, action_id: action.id,
    issue_number: created.number ?? null, issue_url: created.html_url ?? null,
  }, 200, corsHeaders);
}
