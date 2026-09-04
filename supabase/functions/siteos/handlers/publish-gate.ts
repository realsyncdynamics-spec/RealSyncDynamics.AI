// siteos/publish-gate — serverseitige Auswertung des Publish Gates (§7 G1).
//
//   POST /functions/v1/siteos/publish-gate     Bewertung erzeugen
//   POST /functions/v1/siteos/publish-approve  Freigabe erteilen + neu bewerten
//
// ## Warum das hier liegt und nicht im Client
//
// Regel G1: „Die Auswertung läuft serverseitig. Der Client sendet keine
// Teilergebnisse und rechnet nichts nach." Ein clientseitig berechnetes
// `publishable` ist manipulierbar und damit kein Nachweis.
//
// Entsprechend wird hier **nichts** übernommen, was der Aufrufer behauptet:
// Das Auslieferungsbündel wird neu gebaut, die Befunde neu erhoben, der
// Nachweis neu geschrieben. Der Client liefert nur, welche Blueprint-Version
// gemeint ist — und die Backend-Feststellung, die er als Einziges nicht
// selbst herstellen kann (siehe unten).
//
// ## Was der Client zur Backend-Erhaltung sagen darf
//
// Gar nichts. Der Endpunkt nimmt zu dieser Frage keine Eingabe mehr
// entgegen; die Lage wird aus `siteos_blueprints.origin_source` abgeleitet
// (siehe `deriveBackendState`).
//
// Vorher stand hier, ein Aufrufer koenne „nicht durch Weglassen freigeben,
// nur durch einen Vergleich". Das stimmte nicht: Der Vergleich kam
// ebenfalls aus dem Request, und einer mit lauter leeren Listen ergab
// `preserve_all`. Dasselbe galt fuer eine behauptete Neuentwicklung ohne
// Vorgaengerseite. Beide Wege sind geschlossen.
//
// ## Reihenfolge
//
// Artefakt bauen → prüfen → Nachweis schreiben → bewerten → persistieren.
// Wer den Nachweis nach der Bewertung schreibt, bewertet einen Zustand, den
// er anschließend verändert.

import { createClient } from 'jsr:@supabase/supabase-js@2';
import { handleOptions, jsonResponse, jsonError, methodNotAllowed } from '../../_shared/gateway.ts';
import { audit } from '../../_shared/auditLog.ts';
import { appendCustodyEvent } from '../../_shared/provenanceCore.ts';
import {
  analyzeBlueprint,
  buildDeploymentArtifact,
  computeScores,
  evaluatePublishGate,
  type ApprovalState,
  type BackendState,
  type PublishGateEvaluation,
  type SiteBlueprint,
} from '../../../../packages/siteos-core/src/index.ts';
import type { PolicyEngineState } from '../../../../packages/siteos-core/src/index.ts';
import { decide, logShadowComparison } from '../../_shared/pdp/decide.ts';

/** Rollen, die eine Freigabe erteilen dürfen. */
const APPROVER_ROLES = new Set(['owner', 'admin', 'dpo']);

const MAX_REASON_LENGTH = 1000;

/**
 * Der Admin-Client, wie ihn die übrigen Handler benutzen.
 *
 * `ReturnType<typeof createClient>` ohne Typargumente wäre naheliegend und
 * falsch: Ohne generiertes Datenbankschema lösen die Vorgabewerte zu `never`
 * auf, und jeder `.insert()`/`.update()` wird dann gegen `never` geprüft —
 * acht Fehler, die nichts über den Code aussagen. Die anderen Handler
 * umgehen das, indem sie den Client gar nicht erst benennen.
 *
 * `any` ist hier bewusst und auf die Schema-Parameter begrenzt: Das Projekt
 * führt keine generierten Supabase-Typen, also gibt es nichts Genaueres
 * einzusetzen. Sobald `generate_typescript_types` im Repo landet, gehört
 * hier der echte `Database`-Typ hin.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AdminClient = ReturnType<typeof createClient<any, 'public', any>>;

interface Context {
  admin: AdminClient;
  tenantId: string;
  userId: string;
  userEmail: string | null;
  role: string;
}

// ─────────────────────────────────────────────────────────────────────
// Endpunkte
// ─────────────────────────────────────────────────────────────────────

export async function handle(req: Request): Promise<Response> {
  const pre = handleOptions(req);
  if (pre) return pre;
  if (req.method !== 'POST') return methodNotAllowed();

  const parsed = await authorize(req);
  if (parsed instanceof Response) return parsed;
  const { ctx, body } = parsed;

  const blueprintId = String(body.blueprint_id ?? '').trim();
  if (!blueprintId) return jsonError(400, 'BAD_REQUEST', 'blueprint_id required');

  try {
    const result = await runEvaluation(ctx, blueprintId, typeof body.base_url === 'string' ? body.base_url : undefined);
    if (result instanceof Response) return result;
    return jsonResponse({ ok: true, evaluation: result });
  } catch (e) {
    console.error(JSON.stringify({ level: 'error', scope: 'siteos_publish_gate_failed', error: (e as Error)?.message ?? String(e) }));
    return jsonError(500, 'INTERNAL', 'publish gate evaluation failed');
  }
}

export async function handleApprove(req: Request): Promise<Response> {
  const pre = handleOptions(req);
  if (pre) return pre;
  if (req.method !== 'POST') return methodNotAllowed();

  const parsed = await authorize(req);
  if (parsed instanceof Response) return parsed;
  const { ctx, body } = parsed;

  // Eine Freigabe ist eine Zurechnung, keine Einstellung (G4). Wer sie
  // erteilt, muss dazu berechtigt sein und einen Grund nennen.
  if (!APPROVER_ROLES.has(ctx.role)) {
    return jsonError(403, 'FORBIDDEN', `role "${ctx.role}" may not approve a publish`);
  }

  const evaluationId = String(body.evaluation_id ?? '').trim();
  const reason = String(body.reason ?? '').trim();
  if (!evaluationId) return jsonError(400, 'BAD_REQUEST', 'evaluation_id required');
  if (reason.length < 10) {
    return jsonError(400, 'BAD_REQUEST', 'reason required (at least 10 characters) — an approval without a reason is a flag, not an approval');
  }

  const { data: evaluation } = await ctx.admin
    .from('siteos_publish_evaluations')
    .select('id, blueprint_id, artifact_sha256, human_approval_required')
    .eq('id', evaluationId).eq('tenant_id', ctx.tenantId)
    .maybeSingle<{ id: string; blueprint_id: string | null; artifact_sha256: string; human_approval_required: boolean }>();

  if (!evaluation) return jsonError(404, 'NOT_FOUND', 'evaluation not found for this tenant');
  if (!evaluation.human_approval_required) {
    return jsonError(409, 'CONFLICT', 'this evaluation does not await an approval');
  }
  if (!evaluation.blueprint_id) {
    return jsonError(409, 'CONFLICT', 'evaluation is not bound to a blueprint version');
  }

  const nowIso = new Date().toISOString();
  const { error: updateErr } = await ctx.admin
    .from('siteos_publish_evaluations')
    .update({ approved_by: ctx.userId, approved_at: nowIso, approval_reason: reason.slice(0, MAX_REASON_LENGTH) })
    .eq('id', evaluationId).eq('tenant_id', ctx.tenantId);

  if (updateErr) {
    console.error(JSON.stringify({ level: 'error', scope: 'siteos_publish_approval_failed', error: updateErr.message }));
    return jsonError(500, 'INTERNAL', 'could not record approval');
  }

  await audit(ctx.admin, {
    tenant_id: ctx.tenantId, actor_user_id: ctx.userId, actor_email: ctx.userEmail,
    action: 'siteos.publish.approve', target_type: 'siteos_publish_evaluation', target_id: evaluationId,
    payload: { artifact_sha256: evaluation.artifact_sha256, reason: reason.slice(0, MAX_REASON_LENGTH), role: ctx.role },
  });

  // Die Freigabe hebt die Bewertung nicht auf — sie erzeugt eine neue.
  // Die alte bleibt als „pending" stehen, damit im Prüfpfad sichtbar
  // bleibt, dass eine Person entschieden hat und nicht das System.
  try {
    const result = await runEvaluation(ctx, evaluation.blueprint_id, typeof body.base_url === 'string' ? body.base_url : undefined);
    if (result instanceof Response) return result;
    return jsonResponse({ ok: true, approved_evaluation_id: evaluationId, evaluation: result });
  } catch (e) {
    console.error(JSON.stringify({ level: 'error', scope: 'siteos_publish_reeval_failed', error: (e as Error)?.message ?? String(e) }));
    return jsonError(500, 'INTERNAL', 'approval recorded but re-evaluation failed');
  }
}

// ─────────────────────────────────────────────────────────────────────
// Auswertung
// ─────────────────────────────────────────────────────────────────────

async function runEvaluation(
  ctx: Context,
  blueprintId: string,
  baseUrl: string | undefined,
): Promise<PublishGateEvaluation | Response> {
  const { data: row } = await ctx.admin
    .from('siteos_blueprints')
    .select('id, slug, blueprint, content_sha256, origin_source')
    .eq('id', blueprintId).eq('tenant_id', ctx.tenantId)
    .maybeSingle<{ id: string; slug: string; blueprint: SiteBlueprint; content_sha256: string; origin_source: string | null }>();

  if (!row?.blueprint) return jsonError(404, 'NOT_FOUND', 'blueprint not found for this tenant');

  // ── Artefakt und Befunde neu erzeugen ──────────────────────────────
  // Veröffentlicht wird die gestaltete Fassung; sie ist das, was ein
  // Besucher sähe. Der Hash muss über genau dieses Bündel gehen — sonst
  // bewertet das Gate ein anderes Dokument als das ausgelieferte.
  const artifact = await buildDeploymentArtifact(row.blueprint, { baseUrl, presentation: 'showcase' });
  const findings = analyzeBlueprint(row.blueprint);
  const scores = computeScores(findings);

  // ── Nachweis ───────────────────────────────────────────────────────
  // Beide Schritte sind Feststellungen, keine Formalitäten: Schlägt einer
  // fehl, ist `evidence_complete` falsch und das Gate sperrt (G3).
  const nowIso = new Date().toISOString();

  const { data: scan } = await ctx.admin
    .from('siteos_runtime_scans')
    .insert({
      tenant_id: ctx.tenantId, blueprint_id: row.id,
      trigger: 'manual', scope: 'blueprint', status: 'completed',
      findings, finding_count: findings.length, severity_max: scores.severityMax,
      observed_at: nowIso,
    })
    .select('id').maybeSingle<{ id: string }>();

  let custodyLinked = false;
  try {
    await appendCustodyEvent(ctx.admin, {
      tenantId: ctx.tenantId,
      // Eigener Asset-Bezug für das Artefakt: Die Blueprint-Kette
      // (`siteos:blueprint:…`) beschreibt die Absicht, diese hier das
      // tatsächlich Ausgelieferte. Beides in eine Kette zu legen, machte
      // aus zwei Aussagen eine.
      assetRef: `siteos:artifact:${ctx.tenantId}:${row.slug}`,
      contentSha256: artifact.artifactSha256,
      action: 'updated',
      issuer: `tenant:${ctx.tenantId}`,
      timestamp: nowIso,
    });
    custodyLinked = true;
  } catch (provErr) {
    console.error(JSON.stringify({
      level: 'warn', scope: 'siteos_publish_custody_failed',
      artifact_sha256: artifact.artifactSha256, error: (provErr as Error)?.message ?? String(provErr),
    }));
  }

  // ── Freigabelage ───────────────────────────────────────────────────
  // Die jüngste erteilte Freigabe zu dieser Blueprint-Version — unabhängig
  // vom Artefakt-Hash. Ob sie noch gilt, entscheidet das Gate (G6); hier
  // wird sie nur beigebracht.
  const { data: approvalRow } = await ctx.admin
    .from('siteos_publish_evaluations')
    .select('artifact_sha256, approved_by, approval_reason')
    .eq('tenant_id', ctx.tenantId).eq('blueprint_id', row.id)
    .not('approved_by', 'is', null)
    .order('approved_at', { ascending: false }).limit(1)
    .maybeSingle<{ artifact_sha256: string; approved_by: string; approval_reason: string }>();

  const approval: ApprovalState = approvalRow
    ? {
        grantedForArtifactSha256: approvalRow.artifact_sha256,
        grantedBy: approvalRow.approved_by,
        reason: approvalRow.approval_reason,
      }
    : { grantedForArtifactSha256: null, grantedBy: null, reason: null };

  // ── Mandanten-Richtlinien befragen (P2-3) ──────────────────────────
  //
  // Der Publish Gate war bis hierher eine Insel: Er entschied nach fest
  // verdrahteten Regeln, die Richtlinien des Mandanten hatten beim
  // Veroeffentlichen keine Wirkung. Genau der Fragmentierungsbefund aus §1.4
  // des Enforcement-Plans, an der schaerfsten Stelle des Produkts.
  const policyEngine = await consultPolicyEngine(ctx, row, artifact.artifactSha256, findings.length);

  // ── Bewertung ──────────────────────────────────────────────────────
  const evaluationId = crypto.randomUUID();
  const evaluation = evaluatePublishGate({
    policyEngine,
    blueprint: row.blueprint,
    findings,
    artifactSha256: artifact.artifactSha256,
    evidence: { snapshotWritten: scan !== null, custodyLinked },
    // Serverseitig festgestellt, nicht vom Aufrufer entgegengenommen.
    backend: deriveBackendState(row.origin_source),
    approval,
    evaluationId,
    evaluatedAt: nowIso,
  });

  // `publishable` wird bewusst NICHT mitgeschrieben — die Spalte ist in der
  // Datenbank generiert (Migration 20260822120000). Käme sie aus dem Code,
  // gäbe es wieder zwei Ableitungswege.
  const { error: insertErr } = await ctx.admin.from('siteos_publish_evaluations').insert({
    id: evaluationId,
    tenant_id: ctx.tenantId,
    blueprint_id: row.id,
    artifact_sha256: artifact.artifactSha256,
    blueprint_sha256: artifact.blueprintSha256,
    status: evaluation.status,
    evidence_complete: evaluation.evidence_complete,
    backend_preservation: evaluation.backend_preservation,
    policy_compliant: evaluation.policy_compliant,
    human_approval_required: evaluation.human_approval_required,
    blockers: evaluation.blockers,
    warnings: evaluation.warnings,
    finding_count: findings.length,
    // Prüfpfad der Richtlinien-Entscheidung (Migration 20260904110000).
    //
    // Im Vertrag sind „eine Richtlinie hat gesperrt" und „der PDP war nicht
    // erreichbar" beide `policy_compliant: false`; und ein Lauf unter
    // Beobachtung sieht im Ergebnis aus wie einer ohne Regeln. Für einen
    // Prüfer ist beides der entscheidende Unterschied — er gehört
    // maschinell auswertbar festgehalten, nicht nur im Sperrtext.
    ...policyTrail(policyEngine),
    severity_max: scores.severityMax,
    evaluated_at: nowIso,
    created_by: ctx.userId,
  });

  if (insertErr) {
    console.error(JSON.stringify({ level: 'error', scope: 'siteos_publish_eval_insert_failed', error: insertErr.message }));
    return jsonError(500, 'INTERNAL', 'could not persist publish evaluation');
  }

  await audit(ctx.admin, {
    tenant_id: ctx.tenantId, actor_user_id: ctx.userId, actor_email: ctx.userEmail,
    action: 'siteos.publish.evaluate', target_type: 'siteos_publish_evaluation', target_id: evaluationId,
    payload: {
      blueprint_id: row.id, slug: row.slug,
      artifact_sha256: artifact.artifactSha256,
      status: evaluation.status, publishable: evaluation.publishable,
      backend_preservation: evaluation.backend_preservation,
      blocker_count: evaluation.blockers.length,
    },
  });

  return evaluation;
}

// ─────────────────────────────────────────────────────────────────────
// Eingaben
// ─────────────────────────────────────────────────────────────────────

/**
 * Stellt die Backend-Lage fest — aus dem, was der Server aufgezeichnet hat.
 *
 * ## Warum das nicht mehr aus dem Body kommt
 *
 * Vorher las diese Stelle die Backend-Angabe aus dem Request. Damit
 * behauptete der Aufrufer eine
 * der fuenf Bedingungen, aus denen die Datenbank `publishable` erzeugt — und
 * zwar auf zwei Wegen: `{"kind":"greenfield"}` ergab unmittelbar
 * `preserve_all`, und ein mitgeschickter Vergleich mit lauter leeren Listen
 * ebenso. Beides ohne jede Nachpruefung.
 *
 * Genau das schliesst G1 aus: Der Client darf eine sicherheitsrelevante
 * Voraussetzung nicht selbst behaupten. Ein Publish Gate, dessen
 * Sperrgrund sich wegargumentieren laesst, indem man ihn im Request
 * verneint, ist keine Schranke.
 *
 * ## Was jetzt gilt
 *
 * `origin_source` wird bei der Erzeugung des Blueprints gesetzt und danach
 * nicht mehr vom Aufrufer beeinflusst. Er traegt die einzige Tatsache, die
 * hier zaehlt: Wurde diese Site aus einer Beschreibung synthetisiert, oder
 * loest sie etwas Bestehendes ab?
 *
 *   `ai-builder`  aus einer Beschreibung entstanden. Es gab keine
 *                 Vorgaengerseite, also kann auch nichts verlorengegangen
 *                 sein — die Feststellung ist beweisbar, nicht geraten.
 *   alles andere  `import` bringt eine bestehende Seite mit, `manual` sagt
 *                 nichts ueber einen Vorgaenger. Beide fuehren zu
 *                 `transformation` ohne Vergleich, also zu `unknown` — und
 *                 das sperrt.
 *
 * Konservativ heisst hier: Im Zweifel nicht `greenfield`. Wer eine
 * bestehende Seite abloest, kommt erst durch, wenn ein echter Vergleich
 * vorliegt — und der muss von einem Prozess kommen, der die Vorgaengerseite
 * tatsaechlich gesehen hat, nicht aus dem Request.
 *
 * Solange es diesen Vergleichslauf nicht gibt, ist eine Transformation
 * nicht veroeffentlichbar. Das ist die richtige Reihenfolge: lieber ein
 * Weg, der noch fehlt, als eine Schranke, die nur so aussieht.
 */
function deriveBackendState(originSource: string | null): BackendState {
  return originSource === 'ai-builder'
    ? { kind: 'greenfield' }
    : { kind: 'transformation', comparison: null };
}

async function authorize(req: Request): Promise<{ ctx: Context; body: Record<string, unknown> } | Response> {
  const authHeader = req.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) return jsonError(401, 'UNAUTHORIZED', 'missing bearer token');

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return jsonError(400, 'BAD_REQUEST', 'invalid json');
  }

  const tenantId = String(body.tenant_id ?? '').trim();
  if (!tenantId) return jsonError(400, 'BAD_REQUEST', 'tenant_id required');

  const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
  const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;
  const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

  const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false },
  });
  const { data: userResp, error: userErr } = await userClient.auth.getUser();
  if (userErr || !userResp.user) return jsonError(401, 'UNAUTHORIZED', 'invalid token');

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } });
  const { data: member } = await admin
    .from('memberships').select('role')
    .eq('tenant_id', tenantId).eq('user_id', userResp.user.id)
    .maybeSingle<{ role: string }>();

  if (!member) return jsonError(403, 'FORBIDDEN', 'not a member of this tenant');

  return {
    ctx: {
      admin,
      tenantId,
      userId: userResp.user.id,
      userEmail: userResp.user.email ?? null,
      role: member.role,
    },
    body,
  };
}


// ─────────────────────────────────────────────────────────────────────
// Mandanten-Richtlinien (P2-3)
// ─────────────────────────────────────────────────────────────────────

/**
 * Befragt den Policy Decision Point fuer diese Veroeffentlichung.
 *
 * SICHERHEITSRELEVANZ: Der Publish Gate ist ein Klasse-B-Punkt — die
 * Schranke gehoert uns, wir koennen den Uebergang wirklich anhalten. Damit
 * ist er einer der wenigen Orte, an denen eine Mandantenrichtlinie nicht nur
 * festgestellt, sondern durchgesetzt werden kann. Bis P2-3 wurde sie hier
 * nicht einmal gelesen.
 *
 * MODUS, wie bei jedem anderen PEP dieses Plans:
 *   off      — nicht befragen
 *   shadow   — befragen, Abweichung protokollieren, Ergebnis NICHT anwenden (Default)
 *   enforce  — befragen und anwenden
 *
 * Der Default ist `shadow`, damit der Merge das Produktionsverhalten nicht
 * aendert. Umgestellt wird bewusst, nach Auswertung von `pdp_shadow_log`.
 *
 * AUSFALLVERHALTEN: In `enforce` sperrt ein Ausfall (G3 der Zielarchitektur
 * §7 — fehlende Antwort ⇒ nicht veroeffentlichbar). Das weicht vom
 * allgemeinen Default des Plans ab (E2: durchlassen mit Alarm) und ist hier
 * richtig: Veroeffentlichen ist eine bewusste, wiederholbare Handlung, keine
 * laufende Arbeit, die stillsteht. §7 ist ausserdem normativ und spezieller.
 *
 * EU AI Act Art. 14 (menschliche Aufsicht am Freigabepunkt); DSGVO Art. 5
 * Abs. 2 (die Freigabe muss belegbar sein).
 */
/**
 * Übersetzt die Lage der Richtlinienprüfung in die Prüfpfad-Spalten.
 *
 * Bewusst eine eigene Funktion und kein Inline-Ausdruck: Die Zuordnung ist
 * die einzige Stelle, an der der Zustand des PEP zu einer dauerhaften
 * Aussage wird. Wer sie ändert, ändert, was später belegbar ist.
 */
function policyTrail(state: PolicyEngineState): Record<string, unknown> {
  return {
    policy_engine_status: state.engine,
    policy_decision: state.engine === 'consulted' ? state.decision : null,
    // Die Begründungen des PDP; bei `not_enforcing`/`unavailable` steht der
    // Grund im Sperr- bzw. Hinweistext, nicht hier.
    policy_reasons: state.engine === 'consulted' ? state.reasons : [],
  };
}

async function consultPolicyEngine(
  ctx: { admin: any; tenantId: string; userId: string | null },
  row: { id: string; slug: string; blueprint: { compliance?: { dpiaRequired?: boolean; specialCategories?: boolean } } },
  artifactSha256: string,
  findingCount: number,
): Promise<PolicyEngineState> {
  const mode = (Deno.env.get('SITEOS_PUBLISH_PDP') ?? 'shadow').toLowerCase();
  if (mode === 'off') {
    return { engine: 'not_enforcing', reason: 'Richtlinienpruefung ist abgeschaltet (SITEOS_PUBLISH_PDP=off).' };
  }

  const request = {
    contract: 'v1' as const,
    tenant_id: ctx.tenantId,
    action: { verb: 'publish', channel: 'siteos_publish' },
    target: { system_id: row.id },
    data: {
      // Nur Merkmale, keine Inhalte: Der PDP entscheidet ueber Art und Umfang,
      // nicht ueber den Text der Seite (DSGVO Art. 5 Abs. 1 lit. c).
      classification: row.blueprint?.compliance?.specialCategories ? 'special_category' : undefined,
      risk_level: findingCount > 0 ? 'elevated' : 'normal',
    },
    payload: {
      slug: row.slug,
      artifact_sha256: artifactSha256,
      finding_count: findingCount,
      dpia_required: row.blueprint?.compliance?.dpiaRequired === true,
    },
  };

  try {
    const result = await decide(ctx.admin, request as never);
    if (mode !== 'enforce') {
      // Mitrechnen und protokollieren, aber nicht anwenden.
      // Signatur ist (admin, entry) — der frueher hier stehende Aufruf mit
      // sechs Stellungsargumenten lief ins Leere: `entry` war dann die
      // Tenant-ID, `entry.tenant_id` undefiniert, der INSERT scheiterte an
      // NOT NULL, und weil logShadowComparison Fehler bewusst schluckt,
      // wurde **nichts** protokolliert. Der Beobachtungsbetrieb sah aus,
      // als wuerde er mitschreiben (Fehlerklasse K1).
      await logShadowComparison(ctx.admin, {
        tenant_id: ctx.tenantId,
        source: 'siteos_publish',
        // Vor P2-3 gab es beim Veroeffentlichen keine Richtlinienpruefung:
        // Der Alt-Zustand ist "nicht gefragt", nicht "erlaubt".
        legacy_status: null,
        v2_status: result.decision,
        snapshot_version: result.snapshot_version ?? '',
        detail: {
          blueprint_id: row.id,
          slug: row.slug,
          artifact_sha256: artifactSha256,
          finding_count: findingCount,
          matched_policy_ids: result.matched_policy_ids ?? [],
        },
      });
      return {
        engine: 'not_enforcing',
        reason: `Beobachtungsbetrieb (SITEOS_PUBLISH_PDP=${mode}); der PDP haette "${result.decision}" entschieden.`,
      };
    }
    // Der PDP kennt genau diese fuenf Verdikte (Vertrag v1). Ein unbekanntes
    // waere ein Vertragsbruch — dann lieber sperren als raten.
    const known = ['allow', 'log_only', 'warn', 'block', 'require_approval'] as const;
    type Verdict = (typeof known)[number];
    if (!known.includes(result.decision as Verdict)) {
      return { engine: 'unavailable', detail: `unbekanntes Verdikt "${result.decision}"` };
    }
    return {
      engine: 'consulted',
      decision: result.decision as Verdict,
      reasons: Array.isArray(result.reasons) ? result.reasons : [],
    };
  } catch (err) {
    const detail = err instanceof Error ? err.message : 'unbekannter Fehler';
    console.error(JSON.stringify({ level: 'error', scope: 'siteos_publish_pdp_failed', error: detail }));
    if (mode !== 'enforce') {
      // Im Beobachtungsbetrieb darf ein Ausfall nichts blockieren — sonst
      // aendert der Shadow-Mode doch das Verhalten, was sein ganzer Zweck
      // ausschliesst.
      return { engine: 'not_enforcing', reason: `Beobachtungsbetrieb; die Pruefung schlug fehl (${detail}).` };
    }
    return { engine: 'unavailable', detail };
  }
}
