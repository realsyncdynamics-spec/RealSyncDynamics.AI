// governance-access — Pflege des Zugriffsmodells (P1-3 Rest).
//
// POST /functions/v1/governance-access
// Authorization: Bearer <user JWT>
//   { op: 'unit_create',        tenant_id, name, kind, parent_id? }
//   { op: 'unit_rename',        unit_id, name }
//   { op: 'unit_delete',        unit_id }
//   { op: 'principal_create',   tenant_id, type, display_name, user_id?, external_ref?, org_unit_id? }
//   { op: 'principal_update',   principal_id, display_name?, org_unit_id?, status? }
//   { op: 'role_grant',         principal_id, role, scope_type, org_unit_id? }
//   { op: 'role_revoke',        binding_id }
//
// Warum eine Edge Function statt direkter RLS-Schreibzugriffe aus dem
// Browser: Wer welche Rolle haelt, IST die Autorisierungsgrundlage dieser
// Plattform. Eine Rollenvergabe ohne Pruefpfad waere eine Luecke im
// eigenen Produktversprechen — jede Aenderung landet hier in
// governance_admin_log (EU AI Act Art. 12, ISO-27001-Prinzip
// „Nachvollziehbarkeit privilegierter Aenderungen").
//
// Alle Ops sind owner/admin-gated; tenant_id wird nie dem Body geglaubt,
// sondern bei Bestandsobjekten aus der Zeile gelesen.

import { createClient } from 'jsr:@supabase/supabase-js@2';
import { corsHeaders, handleOptions, jsonResponse, jsonError } from '../_shared/gateway.ts';
import { audit } from '../_shared/auditLog.ts';

const UNIT_KINDS = ['location', 'department', 'team', 'unit'];
const PRINCIPAL_TYPES = ['user', 'service', 'agent', 'device'];
const PRINCIPAL_STATUS = ['active', 'disabled'];
// Muss mit dem CHECK-Constraint aus 20260824120000 uebereinstimmen.
const ROLES = [
  'owner', 'admin', 'member', 'viewer',
  'dpo', 'it_admin', 'compliance_officer', 'approver', 'employee',
];

function text(v: unknown, max: number): string {
  return (v ?? '').toString().trim().slice(0, max);
}

Deno.serve(async (req) => {
  const preflight = handleOptions(req); if (preflight) return preflight;
  if (req.method !== 'POST') return jsonError(405, 'BAD_REQUEST', 'POST only');

  const auth = req.headers.get('Authorization');
  if (!auth?.startsWith('Bearer ')) return jsonError(401, 'UNAUTHORIZED', 'missing bearer token');

  const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
  const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;
  const SRK = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

  const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: auth } },
    auth: { persistSession: false },
  });
  const { data: userResp, error: userErr } = await userClient.auth.getUser();
  if (userErr || !userResp.user) return jsonError(401, 'UNAUTHORIZED', 'invalid token');
  const userId = userResp.user.id;
  const userEmail = userResp.user.email ?? null;

  const admin = createClient(SUPABASE_URL, SRK, { auth: { persistSession: false } });

  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return jsonError(400, 'BAD_REQUEST', 'invalid json'); }

  try {
    switch (body.op) {
      case 'unit_create':      return await unitCreate(admin, userId, userEmail, body);
      case 'unit_rename':      return await unitRename(admin, userId, userEmail, body);
      case 'unit_delete':      return await unitDelete(admin, userId, userEmail, body);
      case 'principal_create': return await principalCreate(admin, userId, userEmail, body);
      case 'principal_update': return await principalUpdate(admin, userId, userEmail, body);
      case 'role_grant':       return await roleGrant(admin, userId, userEmail, body);
      case 'role_revoke':      return await roleRevoke(admin, userId, userEmail, body);
      default: return jsonError(400, 'BAD_REQUEST', 'unknown op');
    }
  } catch (e) {
    return jsonError(500, 'INTERNAL', (e as Error).message);
  }
});

// deno-lint-ignore no-explicit-any
async function isOwnerOrAdmin(admin: any, userId: string, tenantId: string): Promise<boolean> {
  const { data } = await admin.from('memberships')
    .select('role').eq('tenant_id', tenantId).eq('user_id', userId).maybeSingle();
  return data?.role === 'owner' || data?.role === 'admin';
}

/** Laedt eine Zeile und prueft die Berechtigung an DEREN tenant_id. */
// deno-lint-ignore no-explicit-any
async function loadOwned(admin: any, table: string, id: string, userId: string, columns = 'id, tenant_id') {
  const { data } = await admin.from(table).select(columns).eq('id', id).maybeSingle();
  if (!data) return { error: jsonError(404, 'NOT_FOUND', `${table} not found`) };
  if (!(await isOwnerOrAdmin(admin, userId, data.tenant_id))) {
    return { error: jsonError(403, 'FORBIDDEN', 'must be owner or admin') };
  }
  return { row: data };
}

// ─── Organisationseinheiten ──────────────────────────────────────────────────

// deno-lint-ignore no-explicit-any
async function unitCreate(admin: any, userId: string, userEmail: string | null, b: Record<string, unknown>) {
  const tenant_id = b.tenant_id as string;
  const name = text(b.name, 120);
  const kind = (b.kind as string) ?? 'unit';
  if (!tenant_id || !name) return jsonError(400, 'BAD_REQUEST', 'tenant_id and name required');
  if (!UNIT_KINDS.includes(kind)) return jsonError(400, 'BAD_REQUEST', `kind must be one of ${UNIT_KINDS.join('|')}`);
  if (!(await isOwnerOrAdmin(admin, userId, tenant_id))) return jsonError(403, 'FORBIDDEN', 'must be owner or admin');

  // Der Elternknoten muss demselben Tenant gehoeren. Der Trigger prueft das
  // ebenfalls, aber eine klare 400 ist besser als eine 500 aus der DB.
  const parent_id = (b.parent_id as string | undefined) ?? null;
  if (parent_id) {
    const { data: parent } = await admin.from('org_units')
      .select('id, tenant_id').eq('id', parent_id).maybeSingle();
    if (!parent) return jsonError(404, 'NOT_FOUND', 'parent not found');
    if (parent.tenant_id !== tenant_id) return jsonError(403, 'CROSS_TENANT', 'parent belongs to another tenant');
  }

  const { data, error } = await admin.from('org_units')
    .insert({ tenant_id, name, kind, parent_id })
    .select('id, name, kind, parent_id, org_path').single();
  if (error) return jsonError(400, 'INSERT_FAILED', error.message);

  await audit(admin, {
    tenant_id, actor_user_id: userId, actor_email: userEmail,
    action: 'org_unit.create', target_type: 'org_unit', target_id: data.id,
    payload: { name, kind, parent_id },
  });
  return jsonResponse({ ok: true, unit: data });
}

// deno-lint-ignore no-explicit-any
async function unitRename(admin: any, userId: string, userEmail: string | null, b: Record<string, unknown>) {
  const unit_id = b.unit_id as string;
  const name = text(b.name, 120);
  if (!unit_id || !name) return jsonError(400, 'BAD_REQUEST', 'unit_id and name required');
  const owned = await loadOwned(admin, 'org_units', unit_id, userId);
  if (owned.error) return owned.error;

  const { error } = await admin.from('org_units').update({ name }).eq('id', unit_id);
  if (error) return jsonError(400, 'UPDATE_FAILED', error.message);

  await audit(admin, {
    tenant_id: owned.row.tenant_id, actor_user_id: userId, actor_email: userEmail,
    action: 'org_unit.rename', target_type: 'org_unit', target_id: unit_id, payload: { name },
  });
  return jsonResponse({ ok: true });
}

// deno-lint-ignore no-explicit-any
async function unitDelete(admin: any, userId: string, userEmail: string | null, b: Record<string, unknown>) {
  const unit_id = b.unit_id as string;
  if (!unit_id) return jsonError(400, 'BAD_REQUEST', 'unit_id required');
  const owned = await loadOwned(admin, 'org_units', unit_id, userId);
  if (owned.error) return owned.error;

  // Kinder haengen per ON DELETE CASCADE — das Loeschen einer Einheit wuerde
  // stillschweigend den ganzen Teilbaum mitnehmen und Rollenbindungen daran
  // gleich mit. Deshalb: nur leere Einheiten loeschen, alles andere muss
  // der Mensch bewusst umhaengen.
  const { count: childCount } = await admin.from('org_units')
    .select('id', { count: 'exact', head: true }).eq('parent_id', unit_id);
  if ((childCount ?? 0) > 0) {
    return jsonError(409, 'HAS_CHILDREN', 'Einheit hat Untereinheiten — bitte zuerst umhängen oder löschen');
  }
  const { count: principalCount } = await admin.from('principals')
    .select('id', { count: 'exact', head: true }).eq('org_unit_id', unit_id);
  if ((principalCount ?? 0) > 0) {
    return jsonError(409, 'HAS_PRINCIPALS', 'Einheit hat zugeordnete Principals — bitte zuerst umhängen');
  }

  const { error } = await admin.from('org_units').delete().eq('id', unit_id);
  if (error) return jsonError(400, 'DELETE_FAILED', error.message);

  await audit(admin, {
    tenant_id: owned.row.tenant_id, actor_user_id: userId, actor_email: userEmail,
    action: 'org_unit.delete', target_type: 'org_unit', target_id: unit_id, payload: {},
  });
  return jsonResponse({ ok: true });
}

// ─── Principals ──────────────────────────────────────────────────────────────

// deno-lint-ignore no-explicit-any
async function principalCreate(admin: any, userId: string, userEmail: string | null, b: Record<string, unknown>) {
  const tenant_id = b.tenant_id as string;
  const type = b.type as string;
  const display_name = text(b.display_name, 160);
  if (!tenant_id || !type || !display_name) {
    return jsonError(400, 'BAD_REQUEST', 'tenant_id, type and display_name required');
  }
  if (!PRINCIPAL_TYPES.includes(type)) {
    return jsonError(400, 'BAD_REQUEST', `type must be one of ${PRINCIPAL_TYPES.join('|')}`);
  }
  if (!(await isOwnerOrAdmin(admin, userId, tenant_id))) return jsonError(403, 'FORBIDDEN', 'must be owner or admin');

  const org_unit_id = (b.org_unit_id as string | undefined) ?? null;
  if (org_unit_id) {
    const { data: unit } = await admin.from('org_units')
      .select('id, tenant_id').eq('id', org_unit_id).maybeSingle();
    if (!unit || unit.tenant_id !== tenant_id) {
      return jsonError(400, 'BAD_REQUEST', 'org_unit belongs to another tenant or does not exist');
    }
  }
  // Ein user-Principal darf nur auf ein Mitglied DIESES Tenants zeigen —
  // sonst koennte eine fremde auth.uid() Rollen in diesem Tenant erhalten.
  const linkedUser = (b.user_id as string | undefined) ?? null;
  if (linkedUser) {
    const { data: member } = await admin.from('memberships')
      .select('user_id').eq('tenant_id', tenant_id).eq('user_id', linkedUser).maybeSingle();
    if (!member) return jsonError(400, 'BAD_REQUEST', 'user is not a member of this tenant');
  }

  const { data, error } = await admin.from('principals').insert({
    tenant_id, type, display_name,
    user_id: linkedUser,
    external_ref: b.external_ref ? text(b.external_ref, 200) : null,
    org_unit_id,
    status: 'active',
  }).select('id, type, display_name, org_unit_id, status').single();
  if (error) return jsonError(400, 'INSERT_FAILED', error.message);

  await audit(admin, {
    tenant_id, actor_user_id: userId, actor_email: userEmail,
    action: 'principal.create', target_type: 'principal', target_id: data.id,
    payload: { type, display_name, org_unit_id, linked_user: !!linkedUser },
  });
  return jsonResponse({ ok: true, principal: data });
}

// deno-lint-ignore no-explicit-any
async function principalUpdate(admin: any, userId: string, userEmail: string | null, b: Record<string, unknown>) {
  const principal_id = b.principal_id as string;
  if (!principal_id) return jsonError(400, 'BAD_REQUEST', 'principal_id required');
  const owned = await loadOwned(admin, 'principals', principal_id, userId);
  if (owned.error) return owned.error;

  const patch: Record<string, unknown> = {};
  if (b.display_name !== undefined) patch.display_name = text(b.display_name, 160);
  if (b.status !== undefined) {
    if (!PRINCIPAL_STATUS.includes(b.status as string)) {
      return jsonError(400, 'BAD_REQUEST', `status must be one of ${PRINCIPAL_STATUS.join('|')}`);
    }
    patch.status = b.status;
  }
  if (b.org_unit_id !== undefined) {
    const target = (b.org_unit_id as string | null) ?? null;
    if (target) {
      const { data: unit } = await admin.from('org_units')
        .select('id, tenant_id').eq('id', target).maybeSingle();
      if (!unit || unit.tenant_id !== owned.row.tenant_id) {
        return jsonError(400, 'BAD_REQUEST', 'org_unit belongs to another tenant or does not exist');
      }
    }
    patch.org_unit_id = target;
  }
  if (Object.keys(patch).length === 0) return jsonError(400, 'BAD_REQUEST', 'nothing to update');

  const { error } = await admin.from('principals').update(patch).eq('id', principal_id);
  if (error) return jsonError(400, 'UPDATE_FAILED', error.message);

  await audit(admin, {
    tenant_id: owned.row.tenant_id, actor_user_id: userId, actor_email: userEmail,
    action: 'principal.update', target_type: 'principal', target_id: principal_id, payload: patch,
  });
  return jsonResponse({ ok: true });
}

// ─── Rollenbindungen ─────────────────────────────────────────────────────────

// deno-lint-ignore no-explicit-any
async function roleGrant(admin: any, userId: string, userEmail: string | null, b: Record<string, unknown>) {
  const principal_id = b.principal_id as string;
  const role = b.role as string;
  const scope_type = (b.scope_type as string) ?? 'tenant';
  if (!principal_id || !role) return jsonError(400, 'BAD_REQUEST', 'principal_id and role required');
  if (!ROLES.includes(role)) return jsonError(400, 'BAD_REQUEST', `role must be one of ${ROLES.join('|')}`);
  if (scope_type !== 'tenant' && scope_type !== 'org_unit') {
    return jsonError(400, 'BAD_REQUEST', "scope_type must be 'tenant' or 'org_unit'");
  }
  const owned = await loadOwned(admin, 'principals', principal_id, userId);
  if (owned.error) return owned.error;

  const org_unit_id = scope_type === 'org_unit' ? ((b.org_unit_id as string | undefined) ?? null) : null;
  if (scope_type === 'org_unit') {
    if (!org_unit_id) return jsonError(400, 'BAD_REQUEST', 'org_unit_id required for scope_type org_unit');
    const { data: unit } = await admin.from('org_units')
      .select('id, tenant_id').eq('id', org_unit_id).maybeSingle();
    if (!unit || unit.tenant_id !== owned.row.tenant_id) {
      return jsonError(400, 'BAD_REQUEST', 'org_unit belongs to another tenant or does not exist');
    }
  }

  const { data, error } = await admin.from('role_bindings').insert({
    tenant_id: owned.row.tenant_id,
    principal_id, role, scope_type, org_unit_id,
    created_by: userId,
  }).select('id, role, scope_type, org_unit_id').single();
  if (error) {
    // Der partielle Unique-Index macht Doppelvergaben zu einem Konflikt —
    // fuer den Aufrufer ist das kein Fehler, sondern der gewuenschte Zustand.
    if ((error.message ?? '').includes('duplicate')) {
      return jsonError(409, 'ALREADY_GRANTED', 'Rolle ist in diesem Geltungsbereich bereits vergeben');
    }
    return jsonError(400, 'INSERT_FAILED', error.message);
  }

  await audit(admin, {
    tenant_id: owned.row.tenant_id, actor_user_id: userId, actor_email: userEmail,
    action: 'role_binding.grant', target_type: 'role_binding', target_id: data.id,
    payload: { principal_id, role, scope_type, org_unit_id },
  });
  return jsonResponse({ ok: true, binding: data });
}

// deno-lint-ignore no-explicit-any
async function roleRevoke(admin: any, userId: string, userEmail: string | null, b: Record<string, unknown>) {
  const binding_id = b.binding_id as string;
  if (!binding_id) return jsonError(400, 'BAD_REQUEST', 'binding_id required');
  const { data: row } = await admin.from('role_bindings')
    .select('id, tenant_id, principal_id, role, scope_type, org_unit_id')
    .eq('id', binding_id).maybeSingle();
  if (!row) return jsonError(404, 'NOT_FOUND', 'binding not found');
  if (!(await isOwnerOrAdmin(admin, userId, row.tenant_id))) {
    return jsonError(403, 'FORBIDDEN', 'must be owner or admin');
  }

  const { error } = await admin.from('role_bindings').delete().eq('id', binding_id);
  if (error) return jsonError(400, 'DELETE_FAILED', error.message);

  await audit(admin, {
    tenant_id: row.tenant_id, actor_user_id: userId, actor_email: userEmail,
    action: 'role_binding.revoke', target_type: 'role_binding', target_id: binding_id,
    payload: { principal_id: row.principal_id, role: row.role, scope_type: row.scope_type, org_unit_id: row.org_unit_id },
  });
  return jsonResponse({ ok: true });
}
