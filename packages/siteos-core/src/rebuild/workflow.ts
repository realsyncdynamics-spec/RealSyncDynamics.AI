// Der Workflow: DISCOVER → ASSESS → REBUILD → REFINE → PUBLISH → AUTOMATE → GOVERN.
//
// Reine Zustandsübergänge über `RebuildWorkflowState`. Kein Netzwerk,
// keine Persistenz — beides liegt im Handler (`siteos/rebuild-*`) und in
// der Oberfläche. Der Kern legt nur fest, **was** in welcher Reihenfolge
// entsteht und was eine Stufe voraussetzt.
//
// ## Was der Kern nicht tut
//
//   • Er setzt `approval.approved` nie selbst. `recordApproval` verlangt
//     eine Nutzer-ID und einen Artefakt-Hash, die der Handler aus der
//     Sitzung nimmt — nie aus dem Client-Body.
//   • Er kennt keinen Mandanten. `governance.tenantAuthority` ist ein
//     Vertrag: Mandant und Policy kommen vom Server, nie aus URL oder
//     localStorage.

import { canonicalHash, sha256Hex } from '../canonical.ts';
import { analyzeBlueprint } from '../analysis/blueprint.ts';
import type { PublishGateEvaluation } from '../publish/gate.ts';
import { assessImport } from './assess.ts';
import { directionToBlueprint } from './blueprint-bridge.ts';
import { applyComponentOperations } from './components.ts';
import { generateDirections } from './directions.ts';
import { importSite, type ImportInput } from './extract.ts';
import { proposeNextSteps } from './next-steps.ts';
import { assessPublishReadiness } from './publish.ts';
import { renderRebuildPreview } from './render.ts';
import { reviseDirection } from './revise.ts';
import { INDUSTRY_PRESETS } from '../blueprint/industries.ts';
import type { ComponentOperation, GovernanceSummary, RebuildDirection, RebuildDirectionKey, RebuildStage, RebuildWorkflowState, RevisionRecord } from './types.ts';

export function createWorkflow(sourceUrl: string): RebuildWorkflowState {
  return {
    schemaVersion: 1,
    stage: 'discover',
    sourceUrl,
    import: null,
    assessment: null,
    directions: [],
    selectedDirection: null,
    revisions: [],
    readiness: null,
    approval: { approved: false, approvedAt: null, approvedBy: null, artifactSha256: null },
    suggestions: [],
    governance: null,
  };
}

/** DISCOVER + ASSESS + REBUILD in einem Schritt — der Erstbau nach dem Abruf. */
export async function runDiscoverAssessRebuild(state: RebuildWorkflowState, input: ImportInput): Promise<RebuildWorkflowState> {
  const imp = await importSite(input);
  const assessment = await assessImport(imp);
  const directions = generateDirections(imp, assessment);
  return {
    ...state,
    stage: 'rebuild',
    import: imp,
    assessment,
    directions,
    selectedDirection: directions[0]?.key ?? null,
    revisions: [],
    readiness: null,
    approval: { approved: false, approvedAt: null, approvedBy: null, artifactSha256: null },
    suggestions: [],
    governance: null,
  };
}

export function selectDirection(state: RebuildWorkflowState, key: RebuildDirectionKey): RebuildWorkflowState {
  if (!state.directions.some((d) => d.key === key)) return state;
  return { ...state, selectedDirection: key, stage: 'refine', readiness: null, approval: resetApproval() };
}

export function selectedDirection(state: RebuildWorkflowState): RebuildDirection | null {
  return state.directions.find((d) => d.key === state.selectedDirection) ?? null;
}

/** REFINE per Klartext. Ersetzt die gewählte Richtung durch die revidierte Fassung. */
export function reviseSelected(state: RebuildWorkflowState, instruction: string, at: string): { state: RebuildWorkflowState; record: RevisionRecord } {
  const current = selectedDirection(state);
  if (!current || !state.import) {
    const record: RevisionRecord = { at, instruction, operations: [], changes: [], refusals: ['Keine Richtung gewählt.'], understood: false };
    return { state, record };
  }
  const result = reviseDirection(current, instruction, { locality: state.import.positioning.locality, brand: state.import.brand });
  const record: RevisionRecord = { at, instruction, operations: [], changes: result.changes, refusals: result.refusals, understood: result.understood };
  if (!result.understood) return { state: { ...state, revisions: [...state.revisions, record] }, record };
  return { state: replaceSelected(state, result.direction, record), record };
}

/** REFINE per Editor-Operationen. */
export function editSelected(state: RebuildWorkflowState, operations: ComponentOperation[], at: string): { state: RebuildWorkflowState; record: RevisionRecord } {
  const current = selectedDirection(state);
  if (!current) {
    const record: RevisionRecord = { at, instruction: null, operations, changes: [], refusals: ['Keine Richtung gewählt.'], understood: false };
    return { state, record };
  }
  const result = applyComponentOperations(current, operations);
  const record: RevisionRecord = { at, instruction: null, operations, changes: result.changes, refusals: result.rejected, understood: result.changes.length > 0 };
  if (!record.understood) return { state: { ...state, revisions: [...state.revisions, record] }, record };
  return { state: replaceSelected(state, result.direction, record), record };
}

function replaceSelected(state: RebuildWorkflowState, direction: RebuildDirection, record: RevisionRecord): RebuildWorkflowState {
  return {
    ...state,
    stage: 'refine',
    directions: state.directions.map((d) => (d.key === direction.key ? direction : d)),
    revisions: [...state.revisions, record],
    // Jede Änderung verfällt Reife und Freigabe — sie galten für einen anderen Stand.
    readiness: null,
    approval: resetApproval(),
  };
}

function resetApproval(): RebuildWorkflowState['approval'] {
  return { approved: false, approvedAt: null, approvedBy: null, artifactSha256: null };
}

// ─────────────────────────────────────────────────────────────────────
// Vorschau und Artefakt
// ─────────────────────────────────────────────────────────────────────

export function previewHtml(state: RebuildWorkflowState, direction: RebuildDirection = requireSelected(state)): string {
  const imp = state.import;
  const industry = imp?.positioning.industry ?? null;
  return renderRebuildPreview(direction, {
    baseUrl: imp?.finalUrl ?? null,
    brandName: imp?.brand.name ?? direction.seo.title,
    locality: imp?.positioning.locality ?? null,
    structuredDataType: industry ? INDUSTRY_PRESETS[industry].structuredDataType : 'Organization',
  });
}

export async function artifactHash(state: RebuildWorkflowState, direction: RebuildDirection = requireSelected(state)): Promise<string> {
  // Der Hash bindet Richtung UND Vorschau: Ändert sich eine Zeile Copy,
  // ändert sich der Hash — und mit ihm verfällt jede Freigabe.
  const directionHash = await canonicalHash(direction);
  const html = previewHtml(state, direction);
  return sha256Hex(`${directionHash}\n${await sha256Hex(html)}`);
}

function requireSelected(state: RebuildWorkflowState): RebuildDirection {
  const d = selectedDirection(state);
  if (!d) throw new Error('no direction selected');
  return d;
}

// ─────────────────────────────────────────────────────────────────────
// PUBLISH
// ─────────────────────────────────────────────────────────────────────

export async function evaluateReadiness(state: RebuildWorkflowState, evaluatedAt: string, gate: PublishGateEvaluation | null = null): Promise<RebuildWorkflowState> {
  const direction = requireSelected(state);
  const html = previewHtml(state, direction);
  const readiness = assessPublishReadiness({ direction, previewHtml: html, artifactSha256: await artifactHash(state, direction), evaluatedAt, gate });
  return { ...state, stage: 'publish', readiness };
}

/**
 * Hält ein ausdrückliches GO fest. Nur der Handler ruft das — mit der
 * Nutzer-ID aus der geprüften Sitzung. Verweigert, wenn die Reife nicht
 * gegeben ist oder der Hash nicht zum geprüften Stand passt.
 */
export function recordApproval(state: RebuildWorkflowState, approvedBy: string, artifactSha256: string, at: string): { state: RebuildWorkflowState; refused: string | null } {
  if (!state.readiness) return { state, refused: 'Reife nicht bewertet.' };
  if (state.readiness.artifactSha256 !== artifactSha256) return { state, refused: 'Der Hash gehört zu einem anderen Stand — Reife erneut bewerten.' };
  if (!state.readiness.ready) return { state, refused: `Nicht veröffentlichbar: ${state.readiness.blockers.join(' · ')}` };
  return {
    state: { ...state, stage: 'automate', approval: { approved: true, approvedAt: at, approvedBy, artifactSha256 } },
    refused: null,
  };
}

// ─────────────────────────────────────────────────────────────────────
// AUTOMATE + GOVERN
// ─────────────────────────────────────────────────────────────────────

export function proposeAutomations(state: RebuildWorkflowState): RebuildWorkflowState {
  const direction = selectedDirection(state);
  if (!direction || !state.import) return state;
  return { ...state, stage: state.approval.approved ? 'automate' : state.stage, suggestions: proposeNextSteps(state.import, direction, state.assessment) };
}

export async function summarizeGovernance(state: RebuildWorkflowState): Promise<RebuildWorkflowState> {
  const direction = selectedDirection(state);
  const blueprint = direction && state.import ? directionToBlueprint(direction, state.import) : null;
  const blueprintFindings = blueprint ? analyzeBlueprint(blueprint) : [];
  const pending: string[] = [];
  if (!state.approval.approved) pending.push('Veröffentlichung (GO)');
  for (const s of state.suggestions) pending.push(`Automatisierung: ${s.label}`);
  if (state.readiness && !state.readiness.ready) pending.push('Blocker der Publish-Prüfung');

  const governance: GovernanceSummary = {
    tenantAuthority: 'server',
    evidenceCount: state.import?.evidence.length ?? 0,
    findingCount: (state.assessment?.findings.length ?? 0) + blueprintFindings.length,
    hashes: {
      import: state.import?.htmlSha256 ?? null,
      assessment: state.assessment?.importSha256 ?? null,
      artifact: state.readiness?.artifactSha256 ?? (direction ? await artifactHash(state, direction) : null),
    },
    pendingApprovals: pending,
    compliance: blueprint?.compliance ?? null,
  };
  return { ...state, stage: 'govern', governance };
}

/** Welche Stufen bereits erreichbar sind — für die Oberfläche. */
export function reachableStages(state: RebuildWorkflowState): RebuildStage[] {
  const stages: RebuildStage[] = ['discover'];
  if (state.import) stages.push('assess');
  if (state.directions.length > 0) stages.push('rebuild');
  if (state.selectedDirection) stages.push('refine', 'publish');
  if (state.approval.approved) stages.push('automate');
  if (state.governance || state.selectedDirection) stages.push('govern');
  return stages;
}
