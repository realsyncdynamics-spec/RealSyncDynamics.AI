// Pipeline: Prompt → auslieferbares, nachweisbares Ergebnis.
//
// Ein Aufruf, weil die Reihenfolge nicht verhandelbar ist: erst Brief, dann
// Blueprint, dann Hash, dann Prüfung, dann Bewertung. Wer die Prüfung nach
// dem Hash einsetzt, bekommt einen Nachweis über eine ungeprüfte Struktur.
//
// Die Edge Function `siteos-builder` ruft ausschließlich diese Funktion auf
// und persistiert deren Ergebnis.

import { canonicalHash, sha256Hex } from './canonical.ts';
import { mergeBrief, parseBrief, type BriefEnrichment, type SiteBrief } from './blueprint/brief.ts';
import { synthesizeBlueprint } from './blueprint/synthesize.ts';
import { analyzeBlueprint } from './analysis/blueprint.ts';
import { computeScores } from './scoring/scores.ts';
import { planAgentTasks, type AgentTask } from './agents/registry.ts';
import type { Locale, RuntimeFinding, ScoreBreakdown, SiteBlueprint } from './types.ts';

export interface BuildOptions {
  locale?: Locale;
  /** Vom Sprachmodell ergänzte Felder. Compliance-neutral (siehe mergeBrief). */
  enrichment?: BriefEnrichment;
  /** Modell-ID für den Herkunftsnachweis; `null` bei modellfreiem Fallback. */
  model?: string | null;
  /** Zeitstempel der Erzeugung. Ohne Angabe bleibt das Ergebnis deterministisch. */
  createdAt?: string;
}

export interface BuildResult {
  brief: SiteBrief;
  blueprint: SiteBlueprint;
  /** Kanonischer SHA-256 des Blueprints — Anker im Evidence Vault. */
  blueprintSha256: string;
  findings: RuntimeFinding[];
  scores: ScoreBreakdown;
  /** Abgeleitete Arbeitspakete für die asynchronen Agenten. */
  tasks: AgentTask[];
}

export async function buildSiteFromPrompt(prompt: string, options: BuildOptions = {}): Promise<BuildResult> {
  const base = parseBrief(prompt, options.locale ?? 'de');
  const brief = options.enrichment ? mergeBrief(base, options.enrichment) : base;

  const blueprint = synthesizeBlueprint(brief, {
    source: 'ai-builder',
    model: options.model ?? null,
    promptSha256: await sha256Hex(prompt),
    createdAt: options.createdAt,
  });

  const blueprintSha256 = await canonicalHash(blueprint);
  const findings = analyzeBlueprint(blueprint);
  const scores = computeScores(findings);

  return { brief, blueprint, blueprintSha256, findings, scores, tasks: planAgentTasks(findings) };
}
