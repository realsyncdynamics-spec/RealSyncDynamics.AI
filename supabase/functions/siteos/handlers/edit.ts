// siteos-edit — Block-Editor: Redaktion → neue, geprüfte Version.
//
// POST /functions/v1/siteos/edit
// Auth: Authorization: Bearer <user JWT>
// Body:
//   {
//     tenant_id: string,
//     slug: string,               // Site, deren jüngste Version bearbeitet wird
//     base_sha256: string,        // Stand, auf dem die Bearbeitung aufsetzt
//     edits?: PageEdit[],         // je Seite: Blockfolge mit redaktionellen Feldern
//     pages?: PageOperation[]     // Seiten anlegen, umbenennen, Pfad, duplizieren, löschen
//   }
//   Mindestens eines von `edits` und `pages` muss nicht leer sein.
//
// Seitenoperationen sind Absichten, keine vom Client gelieferten Seiten.
// `applyPageOperations` leitet Blöcke, Navigation, Verweise und den Schutz
// von Rechtsseiten im Core ab. Redaktion läuft zuerst, Struktur danach.
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
  MAX_PAGE_TITLE_LENGTH,
  PAGE_OPERATION_KINDS,
  analyzeBlueprint,
  applySiteEdits,
  applyPageOperations,
  canonicalHash,
  computeScores,
  isBlockKind,
  isDesignTemplate,
  type DesignTemplate,
  type PageEdit,
  type PageOperation,
  type SiteBlueprint,
} from '../../../../packages/siteos-core/src/index.ts';
import { persistBlueprintVersion } from '../persist.ts';

const MAX_PAGES = 40;
const MAX_BLOCKS_PER_PAGE = 60;
const MAX_PAGE_OPERATIONS = 20;
const MAX_SLUG_LENGTH = 64;
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

  let designTemplate: DesignTemplate | null = null;
  if (body.design_template !== undefined && body.design_template !== null) {
    if (!isDesignTemplate(body.design_template)) {
      return jsonError(400, 'BAD_REQUEST', 'design_template is not a known template');
    }
    designTemplate = body.design_template;
  }

  const edits = body.edits === undefined ? [] : sanitizeEdits(body.edits);
  if (edits === null) return jsonError(400, 'BAD_REQUEST', 'edits must be an array of { path, blocks }');
  const pageOps = body.pages === undefined ? [] : sanitizePageOperations(body.pages);
  if (pageOps === null) return jsonError(400, 'BAD_REQUEST', 'pages must be an array of page operations');
  if (edits.length === 0 && pageOps.length === 0 && !designTemplate) {
    return jsonError(400, 'BAD_REQUEST', 'edits, pages and design_template are empty');
  }

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

    // ── Redaktion, dann Seitenstruktur anwenden ─────────────────────────
    // Beide Wege nehmen nur Absichten entgegen. Der Browser liefert nie einen
    // fertigen Blueprint. Seitenoperationen arbeiten auf dem redigierten Stand,
    // damit z. B. ein gleichzeitiges Umbenennen + Inhaltsedit eine Version bleibt.
    const edited = applySiteEdits(row.blueprint, edits, designTemplate);
    const structured = pageOps.length > 0
      ? applyPageOperations(edited.blueprint, pageOps)
      : { blueprint: edited.blueprint, changes: [], rejected: [] };
    const applied = {
      blueprint: structured.blueprint,
      changes: [...edited.changes, ...structured.changes],
      rejected: [...edited.rejected, ...structured.rejected],
      themeChange: edited.themeChange,
    };
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
        change_codes: [
          ...applied.changes.map((c) => c.code),
          ...(applied.themeChange ? ['theme.template'] : []),
        ],
        changes: applied.changes,
        theme_change: applied.themeChange,
        rejected: applied.rejected,
        page_operations: pageOps,
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
        theme_change: applied.themeChange,
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
      theme_change: applied.themeChange,
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

/**
 * Bringt `pages` in die Form von `PageOperation[]`. Formfehler lehnen die
 * gesamte Anfrage ab; fachliche Regeln (geschützte Rechtsseite, belegter Slug)
 * entscheidet ausschließlich der Core und nennt sie unter `rejected`.
 */
function sanitizePageOperations(input: unknown): PageOperation[] | null {
  if (!Array.isArray(input) || input.length > MAX_PAGE_OPERATIONS) return null;
  const out: PageOperation[] = [];

  for (const raw of input) {
    if (typeof raw !== 'object' || raw === null) return null;
    const entry = raw as Record<string, unknown>;
    const op = typeof entry.op === 'string' ? entry.op : '';
    if (!(PAGE_OPERATION_KINDS as readonly string[]).includes(op)) return null;

    const text = (key: string, max: number): string | undefined =>
      typeof entry[key] === 'string' ? (entry[key] as string).slice(0, max) : undefined;
    const path = text('path', 256);

    switch (op as PageOperation['op']) {
      case 'create': {
        const title = text('title', MAX_PAGE_TITLE_LENGTH);
        if (title === undefined) return null;
        const requestedSlug = text('slug', MAX_SLUG_LENGTH + 16);
        out.push({
          op: 'create',
          title,
          ...(requestedSlug !== undefined ? { slug: requestedSlug } : {}),
        });
        break;
      }
      case 'rename': {
        const title = text('title', MAX_PAGE_TITLE_LENGTH);
        if (path === undefined || !path.startsWith('/') || title === undefined) return null;
        out.push({ op: 'rename', path, title });
        break;
      }
      case 'slug': {
        const nextSlug = text('slug', MAX_SLUG_LENGTH + 16);
        if (path === undefined || !path.startsWith('/') || nextSlug === undefined) return null;
        out.push({ op: 'slug', path, slug: nextSlug });
        break;
      }
      case 'duplicate': {
        if (path === undefined || !path.startsWith('/')) return null;
        const title = text('title', MAX_PAGE_TITLE_LENGTH);
        const nextSlug = text('slug', MAX_SLUG_LENGTH + 16);
        out.push({
          op: 'duplicate',
          path,
          ...(title !== undefined ? { title } : {}),
          ...(nextSlug !== undefined ? { slug: nextSlug } : {}),
        });
        break;
      }
      case 'delete': {
        if (path === undefined || !path.startsWith('/')) return null;
        out.push({ op: 'delete', path });
        break;
      }
    }
  }

  return out;
}
