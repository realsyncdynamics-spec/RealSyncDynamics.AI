// siteos/code-persist — Web App Builder file-tree persistence.
//
// POST /functions/v1/siteos/code-persist
// Auth: Authorization: Bearer <user JWT>
// Body: { op: 'list'|'load'|'save'|'delete', tenant_id, ... }
//
// tenant_id in the body is a CLAIM, never authority. Membership is
// resolved with the shared requireAuthAndTenant helper (JWT → user →
// public.memberships). After that, every query uses the verified
// tenantId. A forged tenant_id cannot read or write another tenant's rows.
//
// Distinct from siteos_blueprints (Puck). Writes via service_role only
// AFTER membership is confirmed. No Cloudflare KV.

import { handleOptions, jsonResponse, jsonError, methodNotAllowed } from '../../_shared/gateway.ts';
import { requireAuthAndTenant, type AuthContext } from '../../_shared/auth.ts';
import { EntitlementError, gateFeature } from '../../_shared/entitlements.ts';

const OPS = new Set(['list', 'load', 'save', 'delete']);
const MAX_FILES = 80;
const MAX_FILE_BYTES = 200_000;
const MAX_PROJECT_BYTES = 1_500_000;

type Admin = AuthContext['admin'];

interface ProjectRow {
  id: string;
  tenant_id: string;
  created_by: string;
  slug: string;
  title: string;
  files: Record<string, string>;
  merkle: string;
  audit: unknown[];
  messages: unknown[];
  version: number;
  prev_hash: string | null;
  status: 'draft' | 'archived';
  created_at: string;
  updated_at: string;
}

function publicRecord(row: ProjectRow) {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    createdBy: row.created_by,
    slug: row.slug,
    title: row.title,
    files: row.files ?? {},
    merkle: row.merkle,
    audit: row.audit ?? [],
    messages: row.messages ?? [],
    version: row.version,
    prevHash: row.prev_hash,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function validateFiles(files: unknown): string | null {
  if (!files || typeof files !== 'object' || Array.isArray(files)) return 'files must be an object';
  const entries = Object.entries(files as Record<string, unknown>);
  if (entries.length > MAX_FILES) return `too many files (${entries.length})`;
  let total = 0;
  for (const [path, content] of entries) {
    if (typeof content !== 'string') return `invalid content for ${path}`;
    if (content.length > MAX_FILE_BYTES) return `file too large: ${path}`;
    total += content.length;
  }
  if (total > MAX_PROJECT_BYTES) return 'project too large';
  return null;
}

export async function handle(req: Request): Promise<Response> {
  const preflight = handleOptions(req);
  if (preflight) return preflight;
  if (req.method !== 'POST') return methodNotAllowed();

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return jsonError(400, 'BAD_REQUEST', 'invalid json');
  }

  const op = String(body.op ?? '').trim();
  if (!OPS.has(op)) return jsonError(400, 'BAD_REQUEST', 'op must be list|load|save|delete');

  // Claim from the body is verified against memberships. After this,
  // body.tenant_id is not consulted — only auth.tenantId.
  const auth = await requireAuthAndTenant(req, typeof body.tenant_id === 'string' ? body.tenant_id : null);
  if (auth instanceof Response) return auth;
  const { tenantId, user, admin } = auth;

  try {
    await gateFeature(admin, tenantId, 'siteos.builder');
  } catch (e) {
    if (e instanceof EntitlementError) {
      return jsonError(e.code === 'INTERNAL' ? 500 : 403, e.code === 'FORBIDDEN' ? 'ENTITLEMENT' : e.code, e.message);
    }
    throw e;
  }

  if (op === 'list') return listProjects(admin, tenantId);
  if (op === 'load') return loadProject(admin, tenantId, String(body.id ?? '').trim());
  if (op === 'delete') return archiveProject(admin, tenantId, String(body.id ?? '').trim());
  return saveProject(admin, tenantId, user.id, body);
}

async function listProjects(admin: Admin, tenantId: string): Promise<Response> {
  const { data, error } = await admin
    .from('app_builder_projects')
    .select('id, slug, title, merkle, version, status, updated_at, files')
    .eq('tenant_id', tenantId)
    .neq('status', 'archived')
    .order('updated_at', { ascending: false });
  if (error) return jsonError(500, 'INTERNAL', error.message);

  const latest = new Map<string, ProjectListRow>();
  for (const row of (data ?? []) as ProjectListRow[]) {
    const prev = latest.get(row.slug);
    if (!prev || row.version > prev.version) latest.set(row.slug, row);
  }
  const projects = [...latest.values()].map((p) => ({
    id: p.id,
    slug: p.slug,
    title: p.title,
    updatedAt: p.updated_at,
    fileCount: p.files ? Object.keys(p.files).length : 0,
    merkle: p.merkle,
    version: p.version,
  }));
  return jsonResponse({ ok: true, projects });
}

interface ProjectListRow {
  id: string;
  slug: string;
  title: string;
  merkle: string;
  version: number;
  status: string;
  updated_at: string;
  files: Record<string, string> | null;
}

async function loadProject(admin: Admin, tenantId: string, id: string): Promise<Response> {
  if (!id) return jsonError(400, 'BAD_REQUEST', 'id required');
  const { data, error } = await admin
    .from('app_builder_projects')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('id', id)
    .maybeSingle<ProjectRow>();
  if (error) return jsonError(500, 'INTERNAL', error.message);
  if (!data || data.status === 'archived') return jsonError(404, 'NOT_FOUND', 'project not found');
  return jsonResponse({ ok: true, project: publicRecord(data) });
}

async function archiveProject(admin: Admin, tenantId: string, id: string): Promise<Response> {
  if (!id) return jsonError(400, 'BAD_REQUEST', 'id required');
  const { data, error } = await admin
    .from('app_builder_projects')
    .select('id, slug')
    .eq('tenant_id', tenantId)
    .eq('id', id)
    .maybeSingle<{ id: string; slug: string }>();
  if (error) return jsonError(500, 'INTERNAL', error.message);
  if (!data) return jsonError(404, 'NOT_FOUND', 'project not found');

  const { error: upErr } = await admin
    .from('app_builder_projects')
    .update({ status: 'archived', updated_at: new Date().toISOString() })
    .eq('tenant_id', tenantId)
    .eq('slug', data.slug)
    .neq('status', 'archived');
  if (upErr) return jsonError(500, 'INTERNAL', upErr.message);
  return jsonResponse({ ok: true });
}

async function saveProject(
  admin: Admin,
  tenantId: string,
  userId: string,
  body: Record<string, unknown>,
): Promise<Response> {
  const slug = String(body.slug ?? '').trim();
  const title = String(body.title ?? slug).trim() || slug;
  if (!slug) return jsonError(400, 'BAD_REQUEST', 'slug required');
  const files = (body.files ?? {}) as Record<string, string>;
  const filesErr = validateFiles(files);
  if (filesErr) return jsonError(400, 'BAD_REQUEST', filesErr);
  const merkle = String(body.merkle ?? '');
  const audit = Array.isArray(body.audit) ? body.audit.slice(-80) : [];
  const messages = Array.isArray(body.messages) ? body.messages.slice(-24) : [];

  const { data: previous, error: prevErr } = await admin
    .from('app_builder_projects')
    .select('id, version, merkle, created_at')
    .eq('tenant_id', tenantId)
    .eq('slug', slug)
    .neq('status', 'archived')
    .order('version', { ascending: false })
    .limit(1)
    .maybeSingle<{ id: string; version: number; merkle: string; created_at: string }>();
  if (prevErr) return jsonError(500, 'INTERNAL', prevErr.message);

  if (previous && previous.merkle === merkle) {
    const { data: full } = await admin
      .from('app_builder_projects')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('id', previous.id)
      .maybeSingle<ProjectRow>();
    if (full) return jsonResponse({ ok: true, unchanged: true, project: publicRecord(full) });
  }

  const now = new Date().toISOString();
  const insert = {
    tenant_id: tenantId,
    created_by: userId,
    slug,
    title,
    files,
    merkle,
    audit,
    messages,
    version: (previous?.version ?? 0) + 1,
    prev_hash: previous?.merkle && previous.merkle.length === 64 ? previous.merkle : null,
    status: 'draft',
    created_at: previous?.created_at ?? now,
    updated_at: now,
  };

  const { data: row, error } = await admin
    .from('app_builder_projects')
    .insert(insert)
    .select('*')
    .single<ProjectRow>();
  if (error) return jsonError(500, 'INTERNAL', error.message);
  return jsonResponse({ ok: true, unchanged: false, project: publicRecord(row) });
}
