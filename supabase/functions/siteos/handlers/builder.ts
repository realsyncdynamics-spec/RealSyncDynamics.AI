// siteos-builder — AI Builder: Prompt → geprüfter, nachweisbarer Blueprint.
//
// POST /functions/v1/siteos/builder
// Auth: Authorization: Bearer <user JWT>
// Body:
//   {
//     tenant_id: string,
//     prompt: string,
//     project_id?: string,      // optionale Bindung an website_projects
//     locale?: 'de' | 'en' | ...,
//     enrichment?: { name?, summary?, services?, locality? },  // Modell-Vorschläge
//     refinements?: string[]    // Anweisungen aus der anonymen Vorschau
//   }
//
// ## Warum `refinements` Anweisungen sind und kein fertiger Blueprint
//
// Vor der Registrierung baut und verfeinert der Besucher seine Site in der
// anonymen Vorschau — im Browser, gegen denselben Kern. Beim Übernehmen
// muss das Ergebnis hier ankommen. Naheliegend wäre, den Blueprint aus dem
// Browser zu übernehmen. Das wäre eine Struktur aus einer Quelle, die der
// Nutzer kontrolliert: Compliance-Profil, KI-Hinweis und Rechtsgrundlagen
// kämen dann vom Client.
//
// Stattdessen kommt nur die Anweisungsfolge. Der Server spielt sie mit
// derselben deterministischen Funktion nach und erzeugt das Ergebnis selbst.
// Gleiche Eingabe ⇒ gleicher Blueprint ⇒ gleicher Hash: Der Besucher sieht
// genau das, was persistiert wird, ohne dass ihm dabei vertraut werden muss.
//
// Ablauf (Reihenfolge ist verbindlich, siehe siteos-core/pipeline.ts):
//   1. Brief deterministisch aus dem Prompt ableiten
//   2. Blueprint synthetisieren (Compliance-Gerüst modellunabhängig)
//   2b. Verfeinerungen nachspielen (falls übergeben)
//   3. Kanonisch hashen
//   4. Statisch prüfen (8 Dimensionen) und bewerten
//   5. Persistieren, Evidence-Snapshot setzen, Agenten einreihen
//
// Der Snapshot im Evidence Vault ist Teil des Ergebnisses, nicht ein
// Nebeneffekt: ein Blueprint ohne Nachweis gilt hier als nicht erzeugt.

import { createClient } from 'jsr:@supabase/supabase-js@2';
import { handleOptions, jsonResponse, jsonError, methodNotAllowed } from '../../_shared/gateway.ts';
import { audit } from '../../_shared/auditLog.ts';
import { appendCustodyEvent } from '../../_shared/provenanceCore.ts';
import {
  analyzeBlueprint,
  buildSiteFromPrompt,
  canonicalHash,
  computeScores,
  planAgentTasks,
  skillForFindingCodes,
  refineBlueprint,
  type Locale,
  type RefinementChange,
} from '../../../../packages/siteos-core/src/index.ts';

const MAX_PROMPT_LENGTH = 2000;
// Obergrenzen für die nachgespielte Anweisungsfolge. Eine Vorschau-Sitzung
// erreicht diese Werte im Normalfall nicht; sie begrenzen den Aufwand, den
// ein einzelner Aufruf erzeugen kann.
const MAX_REFINEMENTS = 40;
const MAX_REFINEMENT_LENGTH = 400;
const VALID_LOCALES = new Set<Locale>(['de', 'en', 'fr', 'it', 'es', 'nl', 'pl']);

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
  const prompt = String(body.prompt ?? '').trim();
  if (!tenantId) return jsonError(400, 'BAD_REQUEST', 'tenant_id required');
  if (!prompt) return jsonError(400, 'BAD_REQUEST', 'prompt required');
  if (prompt.length > MAX_PROMPT_LENGTH) {
    return jsonError(400, 'BAD_REQUEST', `prompt exceeds ${MAX_PROMPT_LENGTH} characters`);
  }

  const localeInput = typeof body.locale === 'string' ? (body.locale as Locale) : 'de';
  const locale: Locale = VALID_LOCALES.has(localeInput) ? localeInput : 'de';

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
    const nowIso = new Date().toISOString();

    // Das Modell wird nur zur Dokumentation der Herkunft mitgeführt. Die
    // Anreicherung selbst kommt vom Aufrufer (SPA/Agent), damit diese
    // Function ohne Modellzugriff und damit ohne Ausfallrisiko läuft.
    const model = typeof body.model === 'string' && body.model.trim() !== ''
      ? body.model.trim()
      : Deno.env.get('SITEOS_BUILDER_MODEL') ?? null;

    const built = await buildSiteFromPrompt(prompt, {
      locale,
      enrichment: sanitizeEnrichment(body.enrichment),
      model,
      createdAt: nowIso,
    });

    // ── Verfeinerungen nachspielen ───────────────────────────────────────
    // Nach der letzten Anweisung werden Hash, Befunde und Bewertung neu
    // gebildet. Sie auf dem Erstbau stehen zu lassen, hieße einen Nachweis
    // über eine Struktur auszustellen, die so nicht mehr existiert.
    const refinements = sanitizeRefinements(body.refinements);
    const refinementLog: RefinementChange[] = [];
    let blueprint = built.blueprint;
    for (const instruction of refinements) {
      const step = refineBlueprint(blueprint, instruction);
      blueprint = step.blueprint;
      refinementLog.push(...step.changes);
    }

    const refinedFindings = refinements.length === 0 ? built.findings : analyzeBlueprint(blueprint);
    const result = refinements.length === 0
      ? built
      : {
          ...built,
          blueprint,
          blueprintSha256: await canonicalHash(blueprint),
          findings: refinedFindings,
          scores: computeScores(refinedFindings),
        };

    // ── Version + Verkettung ─────────────────────────────────────────────
    // Version und prev_hash werden ausschließlich hier vergeben; RLS lässt
    // clientseitige Inserts gar nicht erst zu.
    const { data: previous } = await admin
      .from('siteos_blueprints').select('version, content_sha256')
      .eq('tenant_id', tenantId).eq('slug', result.blueprint.slug)
      .order('version', { ascending: false }).limit(1)
      .maybeSingle<{ version: number; content_sha256: string }>();

    const version = (previous?.version ?? 0) + 1;
    const prevHash = previous?.content_sha256 ?? null;

    // Unveränderter Blueprint ⇒ keine neue Version. Sonst füllt jeder
    // Klick auf „Neu generieren" die Kette mit identischen Einträgen und
    // entwertet den Prüfpfad.
    if (prevHash === result.blueprintSha256) {
      return jsonResponse({
        ok: true,
        unchanged: true,
        slug: result.blueprint.slug,
        version: previous?.version ?? 1,
        content_sha256: result.blueprintSha256,
        scores: result.scores,
        findings: result.findings,
      });
    }

    const projectId = typeof body.project_id === 'string' && body.project_id.trim() !== ''
      ? body.project_id.trim()
      : null;

    const { data: inserted, error: insertErr } = await admin
      .from('siteos_blueprints')
      .insert({
        tenant_id: tenantId,
        project_id: projectId,
        slug: result.blueprint.slug,
        name: result.blueprint.name,
        industry: result.blueprint.industry,
        version,
        blueprint: result.blueprint,
        content_sha256: result.blueprintSha256,
        prev_hash: prevHash,
        origin_source: 'ai-builder',
        origin_model: model,
        prompt_sha256: result.blueprint.origin.promptSha256,
        status: 'draft',
        created_by: userId,
      })
      .select('id').single();

    if (insertErr || !inserted) {
      console.error(JSON.stringify({ level: 'error', scope: 'siteos_blueprint_insert_failed', error: insertErr?.message }));
      return jsonError(500, 'INTERNAL', 'could not persist blueprint');
    }
    const blueprintId = inserted.id as string;

    // ── Scan + Scores aus der statischen Analyse ─────────────────────────
    const { data: scan } = await admin
      .from('siteos_runtime_scans')
      .insert({
        tenant_id: tenantId,
        blueprint_id: blueprintId,
        trigger: 'manual',
        scope: 'blueprint',
        status: 'completed',
        findings: result.findings,
        finding_count: result.findings.length,
        severity_max: result.scores.severityMax,
        observed_at: nowIso,
      })
      .select('id').single();

    if (scan) {
      await admin.from('siteos_scores').insert({
        tenant_id: tenantId,
        scan_id: scan.id,
        blueprint_id: blueprintId,
        health: result.scores.health,
        risk: result.scores.risk,
        compliance: result.scores.compliance,
        performance: result.scores.performance,
        ai_risk: result.scores.aiRisk,
        dimensions: result.scores.dimensions,
      });
    }

    // ── Agenten einreihen ────────────────────────────────────────────────
    const tasks = planAgentTasks(result.findings);
    if (tasks.length > 0) {
      await admin.from('siteos_agent_runs').insert(tasks.map((task) => ({
        tenant_id: tenantId,
        blueprint_id: blueprintId,
        scan_id: scan?.id ?? null,
        agent: task.agent,
        // Agenten mit Freigabepflicht warten, statt sofort zu laufen.
        status: task.requiresApproval ? 'awaiting_approval' : 'queued',
        finding_codes: task.findingCodes,
        severity_max: task.severityMax,
        requires_approval: task.requiresApproval,
        // Beschriftung nach §8: unter welchem Skill der Lauf steht und aus
        // welchem Anlass. Hier ist der Anlass festgelegt, nicht abgeleitet —
        // der Builder erzeugt eine neue Fassung, das ist per Definition
        // Website Transformation.
        skill: skillForFindingCodes(task.findingCodes, task.agent),
        workflow: 'website-transformation',
      })));
    }

    // ── Nachweis: Snapshot + Herkunftskette ──────────────────────────────
    // Best-effort in dem Sinne, dass ein Fehler protokolliert und im
    // Ergebnis sichtbar gemacht wird — er wird nicht verschluckt.
    const subjectRef = `siteos:blueprint:${tenantId}:${result.blueprint.slug}`;
    let provenanceLinked = false;
    try {
      const custody = await appendCustodyEvent(admin, {
        tenantId,
        assetRef: subjectRef,
        contentSha256: result.blueprintSha256,
        action: version === 1 ? 'registered' : 'updated',
        issuer: `tenant:${tenantId}`,
        timestamp: nowIso,
      });
      provenanceLinked = true;
      await audit(admin, {
        tenant_id: tenantId, actor_user_id: userId, actor_email: userEmail,
        action: 'provenance.auto', target_type: 'provenance_manifest', target_id: subjectRef,
        payload: { seq: custody.seq, source: 'siteos.builder', event_hash: custody.eventHash, signed: custody.signed },
      });
    } catch (provErr) {
      console.error(JSON.stringify({
        level: 'warn', scope: 'siteos_provenance_link_failed',
        subject_ref: subjectRef, error: (provErr as Error)?.message ?? String(provErr),
      }));
    }

    await audit(admin, {
      tenant_id: tenantId, actor_user_id: userId, actor_email: userEmail,
      action: 'siteos.blueprint.create', target_type: 'siteos_blueprint', target_id: blueprintId,
      payload: {
        slug: result.blueprint.slug, version, industry: result.blueprint.industry,
        content_sha256: result.blueprintSha256, finding_count: result.findings.length,
        severity_max: result.scores.severityMax, model,
        // Die Anweisungsfolge gehört in den Prüfpfad: Sie erklärt, warum
        // dieser Blueprint von dem abweicht, den der Prompt allein ergäbe.
        refinements, refinement_codes: refinementLog.map((change) => change.code),
      },
    });

    return jsonResponse({
      ok: true,
      unchanged: false,
      blueprint_id: blueprintId,
      slug: result.blueprint.slug,
      version,
      content_sha256: result.blueprintSha256,
      prev_hash: prevHash,
      blueprint: result.blueprint,
      findings: result.findings,
      scores: result.scores,
      agent_tasks: tasks,
      provenance_linked: provenanceLinked,
      refinements: refinementLog,
    });
  } catch (e) {
    console.error(JSON.stringify({
      level: 'error', scope: 'siteos_builder_failed',
      error: (e as Error)?.message ?? String(e),
    }));
    return jsonError(500, 'INTERNAL', 'siteos-builder failed');
  }
}

/**
 * Nimmt nur die vier compliance-neutralen Felder an. Alles andere aus
 * `enrichment` wird verworfen — ein Aufrufer darf über diesen Weg weder
 * Branche noch Rechtsgrundlagen setzen.
 */
/**
 * Anweisungen aus der Vorschau. Reihenfolge ist bedeutungstragend — sie
 * bleibt erhalten. Leere Einträge fallen weg, zu lange werden abgeschnitten;
 * unbekannte Anweisungen bleiben drin und laufen ins Leere, statt den
 * gesamten Aufruf abzulehnen.
 */
function sanitizeRefinements(input: unknown): string[] {
  if (!Array.isArray(input)) return [];
  return input
    .filter((entry): entry is string => typeof entry === 'string')
    .map((entry) => entry.trim().slice(0, MAX_REFINEMENT_LENGTH))
    .filter((entry) => entry !== '')
    .slice(0, MAX_REFINEMENTS);
}

function sanitizeEnrichment(raw: unknown): { name?: string; summary?: string; services?: string[]; locality?: string | null } | undefined {
  if (typeof raw !== 'object' || raw === null) return undefined;
  const input = raw as Record<string, unknown>;
  const out: { name?: string; summary?: string; services?: string[]; locality?: string | null } = {};

  if (typeof input.name === 'string') out.name = input.name.slice(0, 120);
  if (typeof input.summary === 'string') out.summary = input.summary.slice(0, 400);
  if (input.locality === null) out.locality = null;
  else if (typeof input.locality === 'string') out.locality = input.locality.slice(0, 80);
  if (Array.isArray(input.services)) {
    out.services = input.services.filter((s): s is string => typeof s === 'string').slice(0, 12).map((s) => s.slice(0, 80));
  }

  return Object.keys(out).length > 0 ? out : undefined;
}
