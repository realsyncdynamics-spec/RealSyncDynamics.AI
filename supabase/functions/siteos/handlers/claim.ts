// siteos/claim — einen anonymen Entwurf in einen Mandanten übernehmen.
//
// POST /functions/v1/siteos/claim
// Auth: Authorization: Bearer <user JWT>
// Body: { tenant_id: string, draft_key: string }
//
// ── Das Akzeptanzkriterium ───────────────────────────────────────────────
//
// Der Besucher hat vor dem Anmelden etwas gesehen. Nach dem Anmelden muss er
// **genau dasselbe** sehen. Wird an dieser Stelle neu erzeugt, ist die
// Übernahme funktional kaputt — auch wenn Oberfläche und Datenbank formal
// arbeiten.
//
// Deshalb erzeugt dieser Handler nichts. Er kennt weder `parseBrief` noch
// `synthesizeBlueprint`; er kopiert den gespeicherten Blueprint unverändert
// und übernimmt dessen `content_sha256` mit. Stimmen Hash und Inhalt am Ende
// nicht überein, bricht er ab, statt eine andere Fassung einzusetzen.
//
// ── Idempotenz ───────────────────────────────────────────────────────────
//
// Ein zweiter Aufruf mit demselben Schlüssel durch denselben Mandanten gibt
// dieselbe Blueprint-Kennung zurück und legt nichts Neues an. Das ist keine
// Bequemlichkeit: Zwischen „Konto angelegt" und „Entwurf übernommen" liegt
// ein Seitenwechsel, und den wiederholt ein Browser bei jedem Neuladen.
//
// Ein fremder Mandant bekommt 409 — nicht 404. Der Entwurf existiert, er
// gehört nur bereits jemand anderem, und das ist eine andere Aussage.

import { createClient } from 'jsr:@supabase/supabase-js@2';
import { handleOptions, jsonResponse, jsonError, methodNotAllowed } from '../../_shared/gateway.ts';
import { canonicalHash, type SiteBlueprint } from '../../../../packages/siteos-core/src/index.ts';

const DRAFT_KEY_PATTERN = /^[0-9a-f]{32}$/;

interface DraftRow {
  id: string;
  draft_key: string;
  blueprint: SiteBlueprint;
  content_sha256: string;
  origin_model: string | null;
  prompt_sha256: string | null;
  preview_id: string | null;
  expires_at: string;
  claimed_at: string | null;
  claimed_by_tenant: string | null;
  claimed_blueprint: string | null;
}

export async function handle(req: Request): Promise<Response> {
  const preflight = handleOptions(req);
  if (preflight) return preflight;
  if (req.method !== 'POST') return methodNotAllowed();

  const authHeader = req.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) return jsonError(401, 'UNAUTHORIZED', 'missing bearer token');

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return jsonError(400, 'BAD_REQUEST', 'invalid json');
  }

  const tenantId = String(body.tenant_id ?? '').trim();
  const draftKey = String(body.draft_key ?? '').trim().toLowerCase();
  if (!tenantId) return jsonError(400, 'BAD_REQUEST', 'tenant_id required');
  // Vor jedem Datenbankzugriff geprüft: Der Schlüssel ist der einzige
  // Zugangsschutz eines Entwurfs ohne Mandant.
  if (!DRAFT_KEY_PATTERN.test(draftKey)) return jsonError(400, 'BAD_REQUEST', 'invalid draft_key');

  const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
  const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;
  const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

  const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false },
  });
  const { data: userResp, error: userErr } = await userClient.auth.getUser();
  if (userErr || !userResp.user) return jsonError(401, 'UNAUTHORIZED', 'invalid token');
  const userId = userResp.user.id;

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } });

  const { data: member } = await admin
    .from('memberships').select('user_id')
    .eq('tenant_id', tenantId).eq('user_id', userId).maybeSingle();
  if (!member) return jsonError(403, 'FORBIDDEN', 'not a member of this tenant');

  const { data: draft, error: draftErr } = await admin
    .from('siteos_anonymous_drafts')
    .select('*')
    .eq('draft_key', draftKey)
    .maybeSingle<DraftRow>();
  if (draftErr) return jsonError(500, 'INTERNAL', draftErr.message);
  if (!draft) return jsonError(404, 'NOT_FOUND', 'draft not found or expired');

  // ── Bereits übernommen ─────────────────────────────────────────────────
  if (draft.claimed_at) {
    if (draft.claimed_by_tenant !== tenantId) {
      return jsonError(409, 'ALREADY_CLAIMED', 'draft belongs to another workspace');
    }
    // Derselbe Mandant, zweiter Aufruf: dieselbe Antwort, nichts Neues.
    return jsonResponse({
      ok: true,
      idempotent: true,
      blueprint_id: draft.claimed_blueprint,
      preview_id: draft.preview_id,
      content_sha256: draft.content_sha256,
    });
  }

  // ── Verfall ────────────────────────────────────────────────────────────
  //
  // Geprüft, auch wenn das Aufräumen periodisch läuft: Zwischen zwei Läufen
  // liegt Zeit, und ein abgelaufener Entwurf darf sie nicht überdauern, nur
  // weil der Aufräumer noch nicht dran war.
  if (Date.parse(draft.expires_at) <= Date.now()) {
    return jsonError(410, 'EXPIRED', 'draft has expired');
  }

  // ── Unversehrtheit ─────────────────────────────────────────────────────
  //
  // Der gespeicherte Hash wird gegen den gespeicherten Blueprint nachgerechnet.
  // Stimmen sie nicht überein, ist entweder der Inhalt oder der Nachweis
  // verändert worden — in beiden Fällen ist das nicht mehr die Fassung, die
  // der Besucher gesehen hat.
  const recomputed = await canonicalHash(draft.blueprint);
  if (recomputed !== draft.content_sha256) {
    return jsonError(409, 'DRAFT_CORRUPT', 'draft integrity check failed');
  }

  const blueprint = draft.blueprint;
  const slug = String(blueprint.slug ?? '').trim();
  const name = String(blueprint.name ?? '').trim();
  const industry = String(blueprint.industry ?? '').trim();
  if (!slug || !name || !industry) {
    return jsonError(409, 'DRAFT_INCOMPLETE', 'draft blueprint is missing slug, name or industry');
  }

  // ── Versionskette ──────────────────────────────────────────────────────
  //
  // Der übernommene Entwurf reiht sich in die Kette des Mandanten ein, statt
  // sie zu ersetzen: Hat dieser Mandant bereits eine Site mit demselben Slug,
  // wird die Übernahme deren nächste Version und verweist über `prev_hash`
  // auf die vorige.
  const { data: latest } = await admin
    .from('siteos_blueprints')
    .select('version, content_sha256')
    .eq('tenant_id', tenantId).eq('slug', slug)
    .order('version', { ascending: false })
    .limit(1)
    .maybeSingle<{ version: number; content_sha256: string }>();

  const version = (latest?.version ?? 0) + 1;
  const prevHash = latest?.content_sha256 ?? null;

  const { data: inserted, error: insertErr } = await admin
    .from('siteos_blueprints')
    .insert({
      tenant_id: tenantId,
      slug,
      name,
      industry,
      version,
      // Unverändert übernommen — hier wird nichts neu erzeugt.
      blueprint,
      content_sha256: draft.content_sha256,
      prev_hash: prevHash,
      origin_source: 'ai-builder',
      origin_model: draft.origin_model,
      prompt_sha256: draft.prompt_sha256,
    })
    .select('id')
    .single<{ id: string }>();
  if (insertErr) return jsonError(500, 'INTERNAL', insertErr.message);

  // ── Entwurf schliessen ─────────────────────────────────────────────────
  //
  // Die Bedingung `claimed_at IS NULL` ist der Schutz gegen zwei gleichzeitige
  // Übernahmen: Kommen zwei Aufrufe zusammen, gewinnt genau einer die Zeile.
  const { data: closed, error: closeErr } = await admin
    .from('siteos_anonymous_drafts')
    .update({
      claimed_at: new Date().toISOString(),
      claimed_by_tenant: tenantId,
      claimed_blueprint: inserted.id,
    })
    .eq('draft_key', draftKey)
    .is('claimed_at', null)
    .select('id')
    .maybeSingle<{ id: string }>();

  if (closeErr) return jsonError(500, 'INTERNAL', closeErr.message);
  if (!closed) {
    // Der andere Aufruf war schneller. Die eben angelegte Version ist damit
    // überzählig und wird zurückgenommen — sonst bliebe eine Blueprint-Zeile
    // stehen, die zu keiner Übernahme gehört.
    await admin.from('siteos_blueprints').delete().eq('id', inserted.id);
    const { data: winner } = await admin
      .from('siteos_anonymous_drafts')
      .select('claimed_blueprint, claimed_by_tenant, preview_id, content_sha256')
      .eq('draft_key', draftKey)
      .maybeSingle<{ claimed_blueprint: string | null; claimed_by_tenant: string | null; preview_id: string | null; content_sha256: string }>();
    if (winner?.claimed_by_tenant && winner.claimed_by_tenant !== tenantId) {
      return jsonError(409, 'ALREADY_CLAIMED', 'draft belongs to another workspace');
    }
    return jsonResponse({
      ok: true,
      idempotent: true,
      blueprint_id: winner?.claimed_blueprint ?? null,
      preview_id: winner?.preview_id ?? null,
      content_sha256: winner?.content_sha256 ?? draft.content_sha256,
    });
  }

  return jsonResponse({
    ok: true,
    idempotent: false,
    blueprint_id: inserted.id,
    // Die Vorschau bleibt dieselbe. Der Besucher soll nach dem Anmelden
    // nicht auf eine andere Adresse geschickt werden.
    preview_id: draft.preview_id,
    content_sha256: draft.content_sha256,
    version,
  });
}
