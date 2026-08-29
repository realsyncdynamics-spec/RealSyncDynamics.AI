// POST /functions/v1/siteos/publish-gate
//
// Die serverseitige Auswertung des SiteOS Publish Gate
// (docs/architecture/target-architecture.md §7, Regel G1).
//
// ## Aufgabenteilung
//
// Dieser Handler **beschafft Tatsachen**, er entscheidet nicht. Die Regel steht
// in `packages/siteos-core/src/governance/publish-gate.ts` und wird von SPA,
// Deno und Tests gemeinsam benutzt — damit es keine zweite Ableitung gibt (G2).
//
// ## Warum der Client keine Teilergebnisse schicken darf (G1)
//
// Ein clientseitig berechnetes `publishable` ist manipulierbar und damit kein
// Nachweis. Der Handler liest deshalb selbst aus der Datenbank, was er zur
// Bewertung braucht, und akzeptiert vom Aufrufer nur die Kennungen: welchen
// Mandanten, welches Artefakt.
//
// Eine Ausnahme mit Ansage: den **Backend-Vergleich** kann die Datenbank nicht
// liefern, weil nur die transformierende Stelle beide Zustände kennt. Er wird
// deshalb entgegengenommen — aber ausschliesslich vom internen Pipeline-Aufruf
// mit Service-Role-Schluessel, nie von einer Nutzersitzung. Für Nutzeraufrufe
// bleibt er `unknown` und blockiert nach G3. Das hält G1 ein, ohne den späteren
// Publish-Pfad auszusperren.
//
// ## Bekannte offene Kante
//
// Für Evidence gilt heute: der Vault kennt noch keinen Schreibpfad, der einen
// Nachweis an den Artefakt-Hash bindet. Solange das so ist, ist
// `evidence_complete` false und das Gate antwortet `pending`. Das ist der
// beabsichtigte Zustand — das Gate steht vor dem Publish-Pfad, nicht danach —
// und keine Fehlfunktion. Der Handler nennt die fehlenden Eingänge in
// `missing_inputs`, damit der Grund sichtbar ist statt nur das Ergebnis.

import { createClient } from 'jsr:@supabase/supabase-js@2';
import { handleOptions, jsonError, jsonResponse, methodNotAllowed } from '../../_shared/gateway.ts';
import { audit } from '../../_shared/auditLog.ts';
import {
  evaluatePublishGate,
  type BackendComparisonFact,
  type PolicyViolationFact,
  type PublishGateFacts,
} from '../../../../packages/siteos-core/src/index.ts';

/**
 * Nachweise, die eine Veröffentlichung tragen müssen.
 *
 * `hash` verankert die ausgelieferten Bytes, `policy_snapshot` den Regelstand,
 * gegen den geprüft wurde. Ohne den Regelstand liesse sich später nicht mehr
 * sagen, *wonach* damals freigegeben wurde — der Nachweis wäre wertlos, sobald
 * sich die Policy ändert.
 */
const REQUIRED_EVIDENCE = ['hash', 'policy_snapshot'] as const;

/** Ab dieser Schwere gilt ein Runtime-Befund als blockierend. */
const BLOCKING_SEVERITIES = new Set(['critical', 'high']);

const SHA256 = /^[0-9a-f]{64}$/;

interface RuntimeFindingRow {
  code?: unknown;
  severity?: unknown;
  title?: unknown;
  message?: unknown;
}

export async function handle(req: Request): Promise<Response> {
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
  const artifactSha = String(body.artifact_sha256 ?? '').trim().toLowerCase();
  const blueprintSha = String(body.blueprint_sha256 ?? '').trim().toLowerCase();
  const blueprintId = body.blueprint_id ? String(body.blueprint_id).trim() : null;

  if (!tenantId) return jsonError(400, 'BAD_REQUEST', 'tenant_id required');
  if (!SHA256.test(artifactSha)) {
    return jsonError(400, 'BAD_REQUEST', 'artifact_sha256 must be a lowercase hex sha-256');
  }
  if (!SHA256.test(blueprintSha)) {
    return jsonError(400, 'BAD_REQUEST', 'blueprint_sha256 must be a lowercase hex sha-256');
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
  const serviceRole = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!supabaseUrl || !anonKey || !serviceRole) {
    return jsonError(500, 'INTERNAL', 'Supabase environment is incomplete');
  }

  const token = authHeader.slice('Bearer '.length).trim();
  // Der interne Pipeline-Aufruf weist sich mit dem Service-Role-Schluessel aus.
  // Nur er darf den Backend-Vergleich mitliefern (siehe Kopfkommentar).
  const isInternalCall = token === serviceRole;

  const admin = createClient(supabaseUrl, serviceRole, { auth: { persistSession: false } });

  let actorUserId: string | null = null;
  let actorEmail: string | null = null;

  if (!isInternalCall) {
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
      auth: { persistSession: false },
    });
    const { data: userResp, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userResp.user) return jsonError(401, 'UNAUTHORIZED', 'invalid token');
    actorUserId = userResp.user.id;
    actorEmail = userResp.user.email ?? null;

    const { data: member } = await admin
      .from('memberships')
      .select('user_id')
      .eq('tenant_id', tenantId)
      .eq('user_id', actorUserId)
      .maybeSingle();
    if (!member) return jsonError(403, 'FORBIDDEN', 'not a member of this tenant');
  }

  const missingInputs: string[] = [];

  // ── Tatsache 1: Nachweislage ──────────────────────────────────────────────
  // Ein Nachweis zählt nur, wenn er an genau dieses Artefakt gebunden ist.
  // `content_hash` ist die direkte Bindung; `metadata.artifact_sha256` die
  // Bindung für Nachweisarten, deren eigener Hash ein anderer ist (ein
  // Policy-Snapshot hasht den Regelstand, nicht das Artefakt).
  const { data: evidenceRows, error: evidenceErr } = await admin
    .from('governance_evidence')
    .select('evidence_type, content_hash, metadata')
    .eq('tenant_id', tenantId)
    .or(`content_hash.eq.${artifactSha},metadata->>artifact_sha256.eq.${artifactSha}`);

  if (evidenceErr) {
    // Fail-closed (G3): eine nicht lesbare Nachweislage ist keine leere.
    return jsonError(503, 'EVIDENCE_UNAVAILABLE', 'evidence could not be read; gate stays closed');
  }
  const presentEvidence = [...new Set((evidenceRows ?? []).map((row) => String(row.evidence_type)))];
  if (presentEvidence.length === 0) missingInputs.push('evidence:none-anchored-to-artifact');

  // ── Tatsache 2: Policy-Verstösse aus dem jüngsten Runtime-Scan ────────────
  const violations: PolicyViolationFact[] = [];
  if (blueprintId) {
    const { data: scan } = await admin
      .from('siteos_runtime_scans')
      .select('findings, status')
      .eq('tenant_id', tenantId)
      .eq('blueprint_id', blueprintId)
      .eq('status', 'completed')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!scan) {
      // Kein abgeschlossener Scan heisst nicht "keine Verstösse". Es heisst,
      // dass niemand nachgesehen hat — das ist ein fehlender Eingang, kein
      // sauberes Ergebnis.
      missingInputs.push('runtime_scan:no-completed-scan');
      violations.push({
        policy_key: 'siteos.runtime_scan.missing',
        blocking: true,
        message: 'Für diese Version liegt kein abgeschlossener Laufzeit-Scan vor.',
      });
    } else {
      for (const raw of (scan.findings ?? []) as RuntimeFindingRow[]) {
        const severity = String(raw.severity ?? '').toLowerCase();
        if (!BLOCKING_SEVERITIES.has(severity)) continue;
        violations.push({
          policy_key: String(raw.code ?? 'siteos.runtime_finding'),
          blocking: true,
          message: String(raw.title ?? raw.message ?? 'Blockierender Laufzeit-Befund'),
        });
      }
    }
  } else {
    missingInputs.push('blueprint_id:not-supplied');
    violations.push({
      policy_key: 'siteos.blueprint.unreferenced',
      blocking: true,
      message: 'Das Artefakt ist keiner gespeicherten Blueprint-Version zugeordnet.',
    });
  }

  // ── Tatsache 3: Backend-Erhaltung ─────────────────────────────────────────
  const backend = isInternalCall ? readBackendFact(body.backend) : null;
  if (!backend) missingInputs.push('backend_comparison:not-determined');

  // ── Tatsache 4: menschliche Freigabe ──────────────────────────────────────
  // Verlangt wird sie, sobald ein blockierender Befund vorliegt oder der
  // Backend-Vergleich nicht sauber ist. Eine bereits erteilte Freigabe muss
  // sich auf genau dieses Artefakt beziehen (G6 auf Approval-Ebene).
  const approvalRequired = violations.some((v) => v.blocking) || backend === null;

  const { data: approval } = await admin
    .from('governance_approvals')
    .select('status, resolved_by, resolved_at')
    .eq('tenant_id', tenantId)
    .eq('requested_action', `siteos.publish:${artifactSha}`)
    .eq('status', 'approved')
    .order('resolved_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  const facts: PublishGateFacts = {
    artifact_sha256: artifactSha,
    blueprint_sha256: blueprintSha,
    evidence: { expected: [...REQUIRED_EVIDENCE], present: presentEvidence },
    policy: { violations },
    backend,
    approval: {
      required: approvalRequired,
      granted_by: approval?.resolved_by ? String(approval.resolved_by) : null,
      granted_at: approval?.resolved_at ? String(approval.resolved_at) : null,
    },
  };

  const evaluation = evaluatePublishGate(facts);

  // ── Persistenz ────────────────────────────────────────────────────────────
  // `publishable` wird bewusst NICHT geschrieben: die Spalte ist in der
  // Datenbank GENERATED ALWAYS (Migration 20260825000000). Ein Insert, der sie
  // setzen wollte, würde scheitern — und das ist die Absicht hinter G4.
  const { data: stored, error: insertErr } = await admin
    .from('siteos_publish_evaluations')
    .insert({
      id: evaluation.evaluation_id,
      tenant_id: tenantId,
      blueprint_id: blueprintId,
      artifact_sha256: evaluation.artifact_sha256,
      blueprint_sha256: evaluation.blueprint_sha256,
      status: evaluation.status,
      evidence_complete: evaluation.evidence_complete,
      backend_preservation: evaluation.backend_preservation,
      policy_compliant: evaluation.policy_compliant,
      human_approval_required: evaluation.human_approval_required,
      reasons: evaluation.reasons,
      evaluated_at: evaluation.evaluated_at,
      evaluated_by: actorUserId,
    })
    .select('id, publishable')
    .single();

  if (insertErr) {
    return jsonError(500, 'INTERNAL', `evaluation could not be persisted: ${insertErr.message}`);
  }

  // Gegenprobe: die Datenbank hat `publishable` unabhängig neu abgeleitet.
  // Weichen Kern und Schema voneinander ab, ist eine der beiden Definitionen
  // falsch — dann darf nicht die freundlichere gewinnen.
  if (stored.publishable !== evaluation.publishable) {
    return jsonError(
      500,
      'GATE_DERIVATION_MISMATCH',
      'core and database disagree on publishable; gate stays closed',
    );
  }

  if (actorUserId) {
    await audit(admin, {
      tenant_id: tenantId,
      actor_user_id: actorUserId,
      actor_email: actorEmail,
      action: 'siteos.publish_gate.evaluate',
      target_type: 'siteos_publish_evaluation',
      target_id: evaluation.evaluation_id,
      payload: {
        artifact_sha256: artifactSha,
        status: evaluation.status,
        publishable: evaluation.publishable,
      },
    });
  }

  return jsonResponse({ ok: true, evaluation, missing_inputs: missingInputs });
}

/**
 * Liest den Backend-Vergleich aus dem Request-Body — nur beim internen Aufruf.
 *
 * Alles, was nicht als zwei Listen von Fähigkeiten ankommt, wird zu `null` und
 * damit zu `unknown`. Ein halb verstandener Vergleich ist gefährlicher als
 * gar keiner: er sähe aus wie eine Zusage.
 */
function readBackendFact(raw: unknown): BackendComparisonFact | null {
  if (!raw || typeof raw !== 'object') return null;
  const value = raw as Record<string, unknown>;
  if (!Array.isArray(value.before) || !Array.isArray(value.after)) return null;
  return {
    before: value.before.map((entry) => String(entry)),
    after: value.after.map((entry) => String(entry)),
  };
}
