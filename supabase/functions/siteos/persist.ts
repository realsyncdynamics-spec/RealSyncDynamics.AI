// Persistenz einer Blueprint-Version — gemeinsam für Erstbau (`builder.ts`)
// und Bearbeitung (`edit.ts`). Liegt wie `preview.ts` und `resolve.ts` neben dem
// Router, nicht unter `handlers/` — dort steht je Datei ein Endpunkt.
//
// Eine Version entsteht in genau dieser Reihenfolge: Vorgänger lesen,
// unveränderten Stand erkennen, Blueprint mit Vorgänger-Hash einfügen,
// statische Analyse als Scan und Bewertung ablegen, Agenten einreihen,
// Herkunftskette und Prüfpfad schreiben. Zwei Aufrufer mit zwei Kopien
// dieser Folge wären die Stelle, an der eine Version irgendwann ohne
// Vorgänger-Hash oder ohne Nachweis entstünde. Deshalb steht sie hier
// einmal — Verhalten unverändert aus `builder.ts` übernommen.

import { audit } from '../_shared/auditLog.ts';
import { appendCustodyEvent } from '../_shared/provenanceCore.ts';
import {
  planAgentTasks,
  skillForFindingCodes,
  type AgentTask,
  type RuntimeFinding,
  type ScoreBreakdown,
  type SiteBlueprint,
  type WorkflowKey,
} from '../../../packages/siteos-core/src/index.ts';

// deno-lint-ignore no-explicit-any
type AdminClient = any;

export interface PersistVersionInput {
  admin: AdminClient;
  tenantId: string;
  userId: string;
  userEmail: string | null;
  blueprint: SiteBlueprint;
  blueprintSha256: string;
  findings: RuntimeFinding[];
  scores: ScoreBreakdown;
  projectId: string | null;
  /** Herkunft der Zeile — steuert u. a. den Backend-Zustand im Publish Gate. */
  originSource: 'ai-builder' | 'manual' | 'import';
  originModel: string | null;
  nowIso: string;
  /** Anlass für die Agenten-Beschriftung (§8) — aus dem Vokabular, das die DB per CHECK erzwingt. */
  workflow: WorkflowKey;
  /** Quelle im Prüfpfad-Eintrag der Herkunftskette, z. B. `siteos.builder`. */
  auditSource: string;
  /** Prüfpfad-Eintrag des Aufrufers; `payload` wird um Version und Hash ergänzt. */
  auditAction: string;
  auditPayload: Record<string, unknown>;
}

export type PersistVersionResult =
  | { unchanged: true; version: number; contentSha256: string }
  | {
      unchanged: false;
      blueprintId: string;
      version: number;
      prevHash: string | null;
      tasks: AgentTask[];
      provenanceLinked: boolean;
    };

export async function persistBlueprintVersion(input: PersistVersionInput): Promise<PersistVersionResult | { error: string }> {
  const { admin, tenantId, blueprint, blueprintSha256, findings, scores, nowIso } = input;

  // ── Version + Verkettung ─────────────────────────────────────────────
  // Version und prev_hash werden ausschließlich hier vergeben; RLS lässt
  // clientseitige Inserts gar nicht erst zu.
  const { data: previous } = await admin
    .from('siteos_blueprints').select('version, content_sha256')
    .eq('tenant_id', tenantId).eq('slug', blueprint.slug)
    .order('version', { ascending: false }).limit(1)
    .maybeSingle();

  const version = (previous?.version ?? 0) + 1;
  const prevHash: string | null = previous?.content_sha256 ?? null;

  // Unveränderter Blueprint ⇒ keine neue Version. Sonst füllt jeder
  // Klick auf „Neu generieren" (oder „Speichern" ohne Änderung) die Kette
  // mit identischen Einträgen und entwertet den Prüfpfad.
  if (prevHash === blueprintSha256) {
    return { unchanged: true, version: previous?.version ?? 1, contentSha256: blueprintSha256 };
  }

  const { data: inserted, error: insertErr } = await admin
    .from('siteos_blueprints')
    .insert({
      tenant_id: tenantId,
      project_id: input.projectId,
      slug: blueprint.slug,
      name: blueprint.name,
      industry: blueprint.industry,
      version,
      blueprint,
      content_sha256: blueprintSha256,
      prev_hash: prevHash,
      origin_source: input.originSource,
      origin_model: input.originModel,
      prompt_sha256: blueprint.origin.promptSha256,
      status: 'draft',
      created_by: input.userId,
    })
    .select('id').single();

  if (insertErr || !inserted) {
    console.error(JSON.stringify({ level: 'error', scope: 'siteos_blueprint_insert_failed', error: insertErr?.message }));
    return { error: 'could not persist blueprint' };
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
      findings,
      finding_count: findings.length,
      severity_max: scores.severityMax,
      observed_at: nowIso,
    })
    .select('id').single();

  if (scan) {
    await admin.from('siteos_scores').insert({
      tenant_id: tenantId,
      scan_id: scan.id,
      blueprint_id: blueprintId,
      health: scores.health,
      risk: scores.risk,
      compliance: scores.compliance,
      performance: scores.performance,
      ai_risk: scores.aiRisk,
      dimensions: scores.dimensions,
    });
  }

  // ── Agenten einreihen ────────────────────────────────────────────────
  const tasks = planAgentTasks(findings);
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
      // welchem Anlass. Der Anlass kommt vom Aufrufer — der Builder erzeugt
      // eine neue Fassung (Website Transformation), der Editor eine
      // redaktionelle Änderung.
      skill: skillForFindingCodes(task.findingCodes, task.agent),
      workflow: input.workflow,
    })));
  }

  // ── Nachweis: Snapshot + Herkunftskette ──────────────────────────────
  // Best-effort in dem Sinne, dass ein Fehler protokolliert und im
  // Ergebnis sichtbar gemacht wird — er wird nicht verschluckt.
  const subjectRef = `siteos:blueprint:${tenantId}:${blueprint.slug}`;
  let provenanceLinked = false;
  try {
    const custody = await appendCustodyEvent(admin, {
      tenantId,
      assetRef: subjectRef,
      contentSha256: blueprintSha256,
      action: version === 1 ? 'registered' : 'updated',
      issuer: `tenant:${tenantId}`,
      timestamp: nowIso,
    });
    provenanceLinked = true;
    await audit(admin, {
      tenant_id: tenantId, actor_user_id: input.userId, actor_email: input.userEmail,
      action: 'provenance.auto', target_type: 'provenance_manifest', target_id: subjectRef,
      payload: { seq: custody.seq, source: input.auditSource, event_hash: custody.eventHash, signed: custody.signed },
    });
  } catch (provErr) {
    console.error(JSON.stringify({
      level: 'warn', scope: 'siteos_provenance_link_failed',
      subject_ref: subjectRef, error: (provErr as Error)?.message ?? String(provErr),
    }));
  }

  await audit(admin, {
    tenant_id: tenantId, actor_user_id: input.userId, actor_email: input.userEmail,
    action: input.auditAction, target_type: 'siteos_blueprint', target_id: blueprintId,
    payload: {
      slug: blueprint.slug, version, industry: blueprint.industry,
      content_sha256: blueprintSha256, finding_count: findings.length,
      severity_max: scores.severityMax,
      ...input.auditPayload,
    },
  });

  return { unchanged: false, blueprintId, version, prevHash, tasks, provenanceLinked };
}
