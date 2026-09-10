// siteos-edit — Block-Editor: Redaktion → neue, geprüfte Version.
//
// POST /functions/v1/siteos/edit
// Auth: Authorization: Bearer <user JWT>
// Body:
//   {
//     tenant_id: string,
//     slug: string,               // Site, deren jüngste Version bearbeitet wird
//     base_sha256: string,        // Stand, auf dem die Bearbeitung aufsetzt
//     edits: PageEdit[]           // je Seite: Blockfolge mit redaktionellen Feldern
//   }
//
// ## Was der Server annimmt und was nicht
//
// Wie `builder.ts` nimmt dieser Pfad keinen fertigen Blueprint an. Die
// Anfrage nennt je Seite die gewünschte Blockfolge — vorhandene Blöcke über
// ihre ID, neue über ihre Art — und je Block nur die Felder aus
// `EDITABLE_CONTENT`. Alles Weitere leitet `applyPageEdits` (siteos-core)
// ab: Rechtsgrundlage und Datenschutz-Link neuer Formulare, Drittanbieter-
// Hosts, die KI-Kennzeichnung je Block, die feste Position von Navigation,
// KI-Hinweis und Fuß. Was die Anfrage darüber hinaus enthält, wird verworfen
// und im Ergebnis unter `rejected` genannt — nicht still übergangen.
//
// ## Warum `base_sha256` Pflicht ist
//
// Zwei Bearbeitungen derselben Site aus zwei Browsern würden sich sonst
// gegenseitig überschreiben, ohne dass eine Seite es merkt. Weicht der
// gespeicherte Stand vom genannten ab, antwortet der Server mit 409 und
// nennt den aktuellen Hash. Der Client lädt neu; nichts wurde gespeichert.
//
// Danach läuft dieselbe Kette wie beim Erstbau (`persist.ts`): Hash,
// Analyse, Bewertung, Version mit Vorgänger-Hash, Agenten, Nachweis,
// Prüfpfad. Die Herkunft der Zeile (`origin_source`) bleibt die der
// Vorversion — ein redaktionell überarbeiteter KI-Bau ist im Publish Gate
// weiterhin ein Neubau ohne Vorgängerseite; die Redaktion steht je Block in
// `aiGenerated` und im Prüfpfad (`siteos.blueprint.edit`).

import { createClient } from 'jsr:@supabase/supabase-js@2';
import { handleOptions, jsonResponse, jsonError, methodNotAllowed } from '../../_shared/gateway.ts';
import {
  analyzeBlueprint,
  applyPageEdits,
  canonicalHash,
  computeScores,
  isBlockKind,
  type PageEdit,
  type SiteBlueprint,
} from '../../../../packages/siteos-core/src/index.ts';
import { persistBlueprintVersion } from '../persist.ts';

const MAX_PAGES = 40;
const MAX_BLOCKS_PER_PAGE = 60;
const SHA_PATTERN = /^[0-9a-f]{64}$/;

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
  const slug = String(body.slug ?? '').trim();
  const baseSha = String(body.base_sha256 ?? '').trim();
  if (!tenantId) return jsonError(400, 'BAD_REQUEST', 'tenant_id required');
  if (!slug) return jsonError(400, 'BAD_REQUEST', 'slug required');
  if (!SHA_PATTERN.test(baseSha)) return jsonError(400, 'BAD_REQUEST', 'base_sha256 must be a sha256 hex');

  const edits = sanitizeEdits(body.edits);
  if (edits === null) return jsonError(400, 'BAD_REQUEST', 'edits must be an array of { path, blocks }');
  if (edits.length === 0) return jsonError(400, 'BAD_REQUEST', 'edits is empty');

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
  const userEmail = userResp.user.email ?? null;

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } });

  const { data: member } = await admin
    .from('memberships').select('user_id')
    .eq('tenant_id', tenantId).eq('user_id', userId).maybeSingle();
  if (!member) return jsonError(403, 'FORBIDDEN', 'not a member of this tenant');

  try {
    // ── Jüngste Version laden ────────────────────────────────────────────
    const { data: row } = await admin
      .from('siteos_blueprints')
      .select('id, version, blueprint, content_sha256, origin_source, origin_model, project_id')
      .eq('tenant_id', tenantId).eq('slug', slug)
      .order('version', { ascending: false }).limit(1)
      .maybeSingle<{
        id: string; version: number; blueprint: SiteBlueprint; content_sha256: string;
        origin_source: 'ai-builder' | 'manual' | 'import'; origin_model: string | null; project_id: string | null;
      }>();
    if (!row) return jsonError(404, 'NOT_FOUND', 'no blueprint for this slug');

    if (row.content_sha256 !== baseSha) {
      return jsonError(409, 'STALE_BASE', `blueprint changed; current sha256 is ${row.content_sha256}`);
    }

    // ── Redaktion anwenden ───────────────────────────────────────────────
    const applied = applyPageEdits(row.blueprint, edits);
    const blueprintSha256 = await canonicalHash(applied.blueprint);

    // Nach der Änderung werden Befunde und Bewertung neu gebildet. Sie auf
    // der Vorversion stehen zu lassen, hieße einen Nachweis über eine
    // Struktur auszustellen, die so nicht mehr existiert.
    const findings = analyzeBlueprint(applied.blueprint);
    const scores = computeScores(findings);
    const nowIso = new Date().toISOString();

    const persisted = await persistBlueprintVersion({
      admin, tenantId, userId, userEmail,
      blueprint: applied.blueprint,
      blueprintSha256,
      findings,
      scores,
      projectId: row.project_id,
      originSource: row.origin_source,
      originModel: row.origin_model,
      nowIso,
      // Redaktion ist Content Governance, keine Transformation.
      workflow: 'content-governance',
      auditSource: 'siteos.edit',
      auditAction: 'siteos.blueprint.edit',
      auditPayload: {
        base_sha256: baseSha,
        change_codes: applied.changes.map((c) => c.code),
        changes: applied.changes,
        rejected: applied.rejected,
      },
    });
    if ('error' in persisted) return jsonError(500, 'INTERNAL', persisted.error);

    if (persisted.unchanged) {
      return jsonResponse({
        ok: true,
        unchanged: true,
        slug,
        version: persisted.version,
        content_sha256: persisted.contentSha256,
        blueprint: applied.blueprint,
        findings,
        scores,
        changes: applied.changes,
        rejected: applied.rejected,
      });
    }

    return jsonResponse({
      ok: true,
      unchanged: false,
      blueprint_id: persisted.blueprintId,
      slug,
      version: persisted.version,
      content_sha256: blueprintSha256,
      prev_hash: persisted.prevHash,
      blueprint: applied.blueprint,
      findings,
      scores,
      changes: applied.changes,
      rejected: applied.rejected,
      agent_tasks: persisted.tasks,
      provenance_linked: persisted.provenanceLinked,
    });
  } catch (e) {
    console.error(JSON.stringify({
      level: 'error', scope: 'siteos_edit_failed',
      error: (e as Error)?.message ?? String(e),
    }));
    return jsonError(500, 'INTERNAL', 'siteos-edit failed');
  }
}

/**
 * Bringt die Anfrage in die Form von `PageEdit[]`. Unbekannte Block-Arten
 * bleiben drin und werden von `applyPageEdits` benannt abgewiesen; Form-
 * fehler (kein Array, kein Pfad) lehnen die gesamte Anfrage ab.
 */
function sanitizeEdits(input: unknown): PageEdit[] | null {
  if (!Array.isArray(input)) return null;
  const out: PageEdit[] = [];
  for (const raw of input.slice(0, MAX_PAGES)) {
    if (typeof raw !== 'object' || raw === null) return null;
    const page = raw as Record<string, unknown>;
    const path = typeof page.path === 'string' ? page.path.trim() : '';
    if (!path.startsWith('/')) return null;
    if (!Array.isArray(page.blocks)) return null;
    const blocks = page.blocks.slice(0, MAX_BLOCKS_PER_PAGE).map((entry) => {
      const block = typeof entry === 'object' && entry !== null ? (entry as Record<string, unknown>) : {};
      const kind = typeof block.kind === 'string' ? block.kind : '';
      return {
        id: typeof block.id === 'string' && block.id !== '' ? block.id : undefined,
        // Unbekannte Arten laufen bewusst in die Prüfung des Kerns, damit
        // die Antwort sie unter `rejected` nennt.
        kind: (isBlockKind(kind) ? kind : kind) as PageEdit['blocks'][number]['kind'],
        content: typeof block.content === 'object' && block.content !== null ? (block.content as Record<string, unknown>) : undefined,
      };
    });
    out.push({ path, blocks });
  }
  return out;
}
