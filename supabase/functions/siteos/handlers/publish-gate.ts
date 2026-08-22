// siteos/publish-gate — die serverseitige Auswertung vor jeder Veröffentlichung.
//
// POST /functions/v1/siteos/publish-gate
// Auth: Authorization: Bearer <user JWT>
// Body:
//   {
//     tenant_id: string,
//     artifact_sha256: string,
//     blueprint_id?: string,
//     backend_preservation?: 'preserve_all' | 'changed' | 'unknown'
//   }
//
// ── Warum dieser Endpunkt existiert ──────────────────────────────────────
//
// docs/architecture/target-architecture.md §7, Regel G1: Die Auswertung läuft
// serverseitig. Der Client sendet keine Teilergebnisse und rechnet nichts
// nach. Ein clientseitig berechnetes `publishable` ist manipulierbar und
// damit kein Nachweis.
//
// Deshalb nimmt dieser Handler bewusst **nicht** entgegen: `publishable`,
// `status`, `policy_compliant`, `evidence_complete`, `findings` oder eine
// Freigabe. Alles davon wird hier aus der Datenbank gelesen oder abgeleitet.
// Was der Client schickt, ist nur die Frage — nie ein Teil der Antwort.
//
// Die einzige Ausnahme ist `backend_preservation`: Sie stammt aus dem
// Transformationslauf und ist noch nicht als Feld persistiert. Sie wird
// deshalb entgegengenommen, aber fail-closed behandelt — ein fehlender oder
// unbekannter Wert wird zu `unknown` und blockiert. Sobald der
// Transformationslauf das Ergebnis schreibt, wird sie von dort gelesen und
// der Parameter entfällt. Bis dahin steht hier eine benannte Lücke statt
// einer stillschweigenden Annahme.

import { createClient } from 'jsr:@supabase/supabase-js@2';
import { handleOptions, jsonResponse, jsonError, methodNotAllowed } from '../../_shared/gateway.ts';
import {
  evaluatePublishGate,
  failClosedContract,
  type BackendPreservation,
  type RuntimeFinding,
} from '../../../../packages/siteos-core/src/index.ts';

const VALID_PRESERVATION = new Set<BackendPreservation>(['preserve_all', 'changed', 'unknown']);

/** SHA-256 als 64 Hex-Zeichen. Alles andere ist kein Artefakt-Hash. */
const ARTIFACT_PATTERN = /^[0-9a-f]{64}$/;

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
  const artifactSha256 = String(body.artifact_sha256 ?? '').trim().toLowerCase();
  if (!tenantId) return jsonError(400, 'BAD_REQUEST', 'tenant_id required');
  if (!ARTIFACT_PATTERN.test(artifactSha256)) {
    return jsonError(400, 'BAD_REQUEST', 'artifact_sha256 must be a hex sha-256 digest');
  }

  const preservationInput = String(body.backend_preservation ?? 'unknown') as BackendPreservation;
  // Fail closed (G3): Ein unbekannter Wert wird nicht geraten, sondern zu
  // `unknown` — und `unknown` blockiert.
  const backendPreservation: BackendPreservation =
    VALID_PRESERVATION.has(preservationInput) ? preservationInput : 'unknown';

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

  const evaluationId = crypto.randomUUID();
  const evaluatedAt = new Date().toISOString();
  const anchor = { evaluation_id: evaluationId, evaluated_at: evaluatedAt, artifact_sha256: artifactSha256 };

  // Optionaler Blueprint-Bezug, tenant-gefiltert — ein fremder Blueprint darf
  // nicht über die ID adressierbar sein.
  let blueprintId: string | null = null;
  if (typeof body.blueprint_id === 'string' && body.blueprint_id.trim() !== '') {
    const { data: bp } = await admin
      .from('siteos_blueprints').select('id')
      .eq('id', body.blueprint_id.trim()).eq('tenant_id', tenantId).maybeSingle();
    if (!bp) return jsonError(404, 'NOT_FOUND', 'blueprint not found for this tenant');
    blueprintId = bp.id as string;
  }

  // ── Der Scan ───────────────────────────────────────────────────────────
  //
  // Gelesen, nicht entgegengenommen. Ohne Scan gibt es keine Aussage über
  // Konformität — nur die Abwesenheit einer Prüfung.
  let findings: RuntimeFinding[] = [];
  let scanPresent = false;
  {
    let query = admin
      .from('siteos_runtime_scans')
      .select('findings, status')
      .eq('tenant_id', tenantId)
      .eq('status', 'completed')
      .order('created_at', { ascending: false })
      .limit(1);
    if (blueprintId) query = query.eq('blueprint_id', blueprintId);

    const { data: scan, error: scanErr } = await query.maybeSingle();
    if (scanErr) {
      // Ein Lesefehler ist kein "keine Befunde". Fail closed.
      return jsonResponse({
        ok: true,
        contract: failClosedContract(
          { code: 'evaluation_missing', detail: 'Der Governance-Scan konnte nicht gelesen werden.' },
          anchor,
        ),
      });
    }
    if (scan) {
      scanPresent = true;
      findings = Array.isArray(scan.findings) ? (scan.findings as RuntimeFinding[]) : [];
    }
  }

  // ── Die Nachweiskette ──────────────────────────────────────────────────
  //
  // Vollständig heisst: Für dieses Artefakt existiert mindestens ein
  // Evidence-Snapshot. Er wird VOR der Veröffentlichung geschrieben, nicht
  // danach — sonst belegt er nur, dass etwas online ging, nicht dass es
  // geprüft war.
  const { count: evidenceCount } = await admin
    .from('evidence_snapshots')
    .select('id', { count: 'exact', head: true })
    .eq('tenant_id', tenantId)
    .eq('subject_ref', `siteos:artifact:${artifactSha256}`);
  const evidenceComplete = (evidenceCount ?? 0) > 0;

  // ── Menschliche Freigabe ───────────────────────────────────────────────
  //
  // G4: Die Ausnahme ist ein Approval — eine Person mit Begründung — und nie
  // ein Flag. Deshalb wird sie hier aus der Datenbank gelesen und ist an
  // genau dieses Artefakt gebunden.
  // `subject_ref` ist additiv ergänzt worden (Migration
  // 20260825000000): `governance_approvals` band bisher nur an `asset_id`
  // und `event_id`, und ein Artefakt ist keines von beidem — es ist eine
  // konkrete, gehashte Fassung.
  //
  // Benannte Lücke statt stillschweigender Annahme: Ein Pfad, über den eine
  // solche Freigabe **erteilt** wird, existiert noch nicht. Bis er gebaut
  // ist, findet diese Abfrage nichts, und Befunde mit hohem Schweregrad
  // blockieren dauerhaft. Das ist die richtige Richtung des Fehlers.
  const nowIso = new Date().toISOString();
  const { data: approval } = await admin
    .from('governance_approvals')
    .select('id, expires_at')
    .eq('tenant_id', tenantId)
    .eq('subject_ref', `siteos:artifact:${artifactSha256}`)
    .eq('status', 'approved')
    // Eine abgelaufene Freigabe ist keine Freigabe.
    .or(`expires_at.is.null,expires_at.gt.${nowIso}`)
    .limit(1)
    .maybeSingle();

  const contract = evaluatePublishGate({
    ...anchor,
    findings,
    scan_present: scanPresent,
    evidence_complete: evidenceComplete,
    backend_preservation: backendPreservation,
    human_approval_granted: Boolean(approval),
  });

  // Persistiert wird der vollständige Vertrag. `publishable`, `status` und
  // `evaluated_at` leitet die Datenbank daraus ab (G4) — sie werden hier
  // absichtlich nicht mitgeschrieben.
  const { error: insertErr } = await admin.from('siteos_publish_evaluations').insert({
    tenant_id: tenantId,
    evaluation_id: evaluationId,
    artifact_sha256: artifactSha256,
    blueprint_id: blueprintId,
    contract,
    requested_by: userId,
  });
  if (insertErr) {
    // G5: Ohne Prüfpfad-Anker gibt es keine Freigabe. Eine Evaluation, die
    // nicht festgehalten werden konnte, darf nichts tragen.
    return jsonResponse({
      ok: true,
      contract: failClosedContract(
        { code: 'evaluation_missing', detail: 'Die Auswertung konnte nicht festgehalten werden.' },
        anchor,
      ),
    });
  }

  // G2: Das Frontend rendert `publishable` und die Begründung — es leitet sie
  // nie aus Einzelfeldern ab. Deshalb wird der vollständige Vertrag geliefert.
  return jsonResponse({ ok: true, contract });
}
