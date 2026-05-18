/**
 * RealSync Dynamics AI — ai-risk-agent Goldset Evaluation
 *
 * Usage:
 *   npx tsx scripts/eval-ai-risk-agent.ts
 *
 * Env required:
 *   SUPABASE_URL              — z.B. https://xxx.supabase.co
 *   SUPABASE_SERVICE_KEY      — Service-Role-Key (RLS bypass)
 *   AI_RISK_AGENT_URL         — Supabase Edge Function URL des ai-risk-agent
 *                                (heute noch zu bauen, siehe docs/qa/ai-risk-eval.md)
 *   AI_RISK_AGENT_TOKEN       — Bearer-Token für internen Agent-Call
 *   AGENT_VERSION             — z.B. "1.4.2"
 *   GIT_SHA                   — wird in CI gesetzt
 *   CI_RUN_URL                — wird in CI gesetzt
 *   EVAL_REPORT_DIR           — optional, Default: ./eval-reports
 *
 * Exit codes:
 *   0  — Eval passed (Akzeptanz-Schwellen eingehalten)
 *   1  — Eval failed (Akzeptanz-Schwellen verletzt)
 *   2  — Eval error (Infrastruktur, Setup)
 */

import { createClient } from '@supabase/supabase-js';
import { writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

// =============================================================================
// Akzeptanz-Schwellen — Release-Blocker, wenn unterschritten
// =============================================================================
const THRESHOLDS = {
  accuracy_min: 0.80,
  f1_high_min: 0.85,
  f1_prohibited_min: 0.90,
  fp_rate_prohibited_max: 0.05,
  fn_rate_high_max: 0.10,
} as const;

type RiskTier = 'minimal' | 'limited' | 'high' | 'prohibited';
const TIERS: RiskTier[] = ['minimal', 'limited', 'high', 'prohibited'];

interface GoldsetEntry {
  id: string;
  label: string;
  input_payload: Record<string, unknown>;
  expected_risk_tier: RiskTier;
  expected_reasons: string[];
}

interface AgentResponse {
  risk_tier: RiskTier;
  reasons?: string[];
  raw?: unknown;
}

interface CaseResult {
  goldset_id: string;
  label: string;
  expected: RiskTier;
  predicted: RiskTier | null;
  predicted_reasons: string[];
  is_correct: boolean;
  latency_ms: number;
  error?: string;
  agent_raw?: unknown;
}

// =============================================================================
// Supabase client
// =============================================================================
function requireEnv(key: string): string {
  const v = process.env[key];
  if (!v) {
    console.error(`FATAL: ${key} nicht gesetzt`);
    process.exit(2);
  }
  return v;
}

const supabaseUrl = requireEnv('SUPABASE_URL');
const supabaseKey = requireEnv('SUPABASE_SERVICE_KEY');
const agentUrl = requireEnv('AI_RISK_AGENT_URL');
const agentToken = requireEnv('AI_RISK_AGENT_TOKEN');
const agentVersion = requireEnv('AGENT_VERSION');
const gitSha = process.env.GIT_SHA ?? 'local';
const ciRunUrl = process.env.CI_RUN_URL ?? null;

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: { persistSession: false },
});

// =============================================================================
// Agent-Call
// =============================================================================
async function callAgent(payload: Record<string, unknown>): Promise<{
  response: AgentResponse;
  latency_ms: number;
}> {
  const start = Date.now();
  const res = await fetch(agentUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${agentToken}`,
    },
    body: JSON.stringify({ payload }),
    signal: AbortSignal.timeout(30_000),
  });
  const latency_ms = Date.now() - start;

  if (!res.ok) {
    throw new Error(`Agent HTTP ${res.status}: ${await res.text()}`);
  }

  const json = (await res.json()) as AgentResponse;
  if (!TIERS.includes(json.risk_tier)) {
    throw new Error(`Agent returned invalid risk_tier: ${json.risk_tier}`);
  }
  return { response: json, latency_ms };
}

// =============================================================================
// Metrics
// =============================================================================
interface TierMetrics {
  tp: number; fp: number; fn: number; tn: number;
  precision: number; recall: number; f1: number;
  fp_rate: number; fn_rate: number;
}

function computeTierMetrics(cases: CaseResult[], tier: RiskTier): TierMetrics {
  let tp = 0, fp = 0, fn = 0, tn = 0;
  for (const c of cases) {
    if (c.expected === tier && c.predicted === tier) tp++;
    else if (c.expected !== tier && c.predicted === tier) fp++;
    else if (c.expected === tier && c.predicted !== tier) fn++;
    else tn++;
  }
  const precision = tp + fp === 0 ? 0 : tp / (tp + fp);
  const recall = tp + fn === 0 ? 0 : tp / (tp + fn);
  const f1 = precision + recall === 0 ? 0 : (2 * precision * recall) / (precision + recall);
  const fp_rate = fp + tn === 0 ? 0 : fp / (fp + tn);
  const fn_rate = tp + fn === 0 ? 0 : fn / (tp + fn);
  return { tp, fp, fn, tn, precision, recall, f1, fp_rate, fn_rate };
}

function buildConfusionMatrix(cases: CaseResult[]): Record<string, Record<string, number>> {
  const matrix: Record<string, Record<string, number>> = {};
  for (const exp of TIERS) {
    matrix[exp] = {};
    for (const pred of TIERS) matrix[exp][pred] = 0;
  }
  for (const c of cases) {
    if (c.predicted) matrix[c.expected][c.predicted]++;
  }
  return matrix;
}

// =============================================================================
// Markdown report
// =============================================================================
function buildReport(
  runId: string,
  cases: CaseResult[],
  perTier: Record<RiskTier, TierMetrics>,
  matrix: Record<string, Record<string, number>>,
  passed: boolean,
  failedReasons: string[],
): string {
  const correct = cases.filter(c => c.is_correct).length;
  const accuracy = correct / cases.length;
  const lines: string[] = [];

  lines.push(`# ai-risk-agent Eval Report`);
  lines.push(``);
  lines.push(`- **Run ID:** \`${runId}\``);
  lines.push(`- **Agent Version:** \`${agentVersion}\``);
  lines.push(`- **Git SHA:** \`${gitSha}\``);
  lines.push(`- **CI Run:** ${ciRunUrl ?? '—'}`);
  lines.push(`- **Status:** ${passed ? 'PASSED' : 'FAILED'}`);
  lines.push(`- **Timestamp:** ${new Date().toISOString()}`);
  lines.push(``);

  lines.push(`## Summary`);
  lines.push(``);
  lines.push(`| Metric | Value | Threshold | Pass |`);
  lines.push(`|---|---|---|---|`);
  lines.push(`| Accuracy | ${(accuracy * 100).toFixed(2)}% | >= ${(THRESHOLDS.accuracy_min * 100).toFixed(0)}% | ${accuracy >= THRESHOLDS.accuracy_min ? 'yes' : 'no'} |`);
  lines.push(`| F1 (high) | ${perTier.high.f1.toFixed(4)} | >= ${THRESHOLDS.f1_high_min} | ${perTier.high.f1 >= THRESHOLDS.f1_high_min ? 'yes' : 'no'} |`);
  lines.push(`| F1 (prohibited) | ${perTier.prohibited.f1.toFixed(4)} | >= ${THRESHOLDS.f1_prohibited_min} | ${perTier.prohibited.f1 >= THRESHOLDS.f1_prohibited_min ? 'yes' : 'no'} |`);
  lines.push(`| FP-Rate (prohibited) | ${(perTier.prohibited.fp_rate * 100).toFixed(2)}% | <= ${(THRESHOLDS.fp_rate_prohibited_max * 100).toFixed(0)}% | ${perTier.prohibited.fp_rate <= THRESHOLDS.fp_rate_prohibited_max ? 'yes' : 'no'} |`);
  lines.push(`| FN-Rate (high) | ${(perTier.high.fn_rate * 100).toFixed(2)}% | <= ${(THRESHOLDS.fn_rate_high_max * 100).toFixed(0)}% | ${perTier.high.fn_rate <= THRESHOLDS.fn_rate_high_max ? 'yes' : 'no'} |`);
  lines.push(``);

  lines.push(`## Per-Tier Metrics`);
  lines.push(``);
  lines.push(`| Tier | TP | FP | FN | TN | Precision | Recall | F1 |`);
  lines.push(`|---|---|---|---|---|---|---|---|`);
  for (const tier of TIERS) {
    const m = perTier[tier];
    lines.push(`| ${tier} | ${m.tp} | ${m.fp} | ${m.fn} | ${m.tn} | ${m.precision.toFixed(3)} | ${m.recall.toFixed(3)} | ${m.f1.toFixed(3)} |`);
  }
  lines.push(``);

  lines.push(`## Confusion Matrix (rows: expected, cols: predicted)`);
  lines.push(``);
  lines.push(`| | ${TIERS.join(' | ')} |`);
  lines.push(`|---|${TIERS.map(() => '---').join('|')}|`);
  for (const exp of TIERS) {
    lines.push(`| **${exp}** | ${TIERS.map(p => matrix[exp][p]).join(' | ')} |`);
  }
  lines.push(``);

  if (failedReasons.length > 0) {
    lines.push(`## Failed Reasons`);
    lines.push(``);
    for (const r of failedReasons) lines.push(`- ${r}`);
    lines.push(``);
  }

  const misclassified = cases.filter(c => !c.is_correct);
  if (misclassified.length > 0) {
    lines.push(`## Misclassified Cases (${misclassified.length})`);
    lines.push(``);
    lines.push(`| Label | Expected | Predicted | Latency (ms) | Error |`);
    lines.push(`|---|---|---|---|---|`);
    for (const c of misclassified) {
      lines.push(`| ${c.label} | ${c.expected} | ${c.predicted ?? 'ERROR'} | ${c.latency_ms} | ${c.error ?? '—'} |`);
    }
    lines.push(``);
  }

  const latencies = cases.filter(c => c.latency_ms > 0).map(c => c.latency_ms).sort((a, b) => a - b);
  if (latencies.length > 0) {
    const p50 = latencies[Math.floor(latencies.length * 0.5)];
    const p95 = latencies[Math.floor(latencies.length * 0.95)];
    const p99 = latencies[Math.floor(latencies.length * 0.99)];
    lines.push(`## Latency`);
    lines.push(``);
    lines.push(`- p50: ${p50} ms`);
    lines.push(`- p95: ${p95} ms`);
    lines.push(`- p99: ${p99} ms`);
    lines.push(``);
  }

  return lines.join('\n');
}

// =============================================================================
// Main
// =============================================================================
async function main(): Promise<void> {
  // 1. Goldset laden
  const { data: goldset, error: gErr } = await supabase
    .from('ai_risk_goldset')
    .select('id,label,input_payload,expected_risk_tier,expected_reasons')
    .eq('is_active', true);

  if (gErr || !goldset) {
    console.error('FATAL: Goldset-Query fehlgeschlagen', gErr);
    process.exit(2);
  }
  if (goldset.length < 30) {
    console.error(`FATAL: Goldset hat ${goldset.length} aktive Einträge, mindestens 30 erforderlich`);
    process.exit(2);
  }

  console.log(`Goldset geladen: ${goldset.length} Einträge`);

  // 2. Eval-Run anlegen
  const { data: runRow, error: rErr } = await supabase
    .from('ai_risk_eval_runs')
    .insert({
      agent_version: agentVersion,
      git_sha: gitSha,
      ci_run_url: ciRunUrl,
      total_cases: goldset.length,
      status: 'running',
    })
    .select('id')
    .single();

  if (rErr || !runRow) {
    console.error('FATAL: Eval-Run konnte nicht angelegt werden', rErr);
    process.exit(2);
  }
  const runId = runRow.id as string;
  console.log(`Eval-Run gestartet: ${runId}`);

  // 3. Pro Goldset-Eintrag: Agent aufrufen
  const cases: CaseResult[] = [];
  for (const entry of goldset as GoldsetEntry[]) {
    try {
      const { response, latency_ms } = await callAgent(entry.input_payload);
      const is_correct = response.risk_tier === entry.expected_risk_tier;
      cases.push({
        goldset_id: entry.id,
        label: entry.label,
        expected: entry.expected_risk_tier,
        predicted: response.risk_tier,
        predicted_reasons: response.reasons ?? [],
        is_correct,
        latency_ms,
        agent_raw: response.raw ?? response,
      });
      process.stdout.write(is_correct ? '.' : 'F');
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      cases.push({
        goldset_id: entry.id,
        label: entry.label,
        expected: entry.expected_risk_tier,
        predicted: null,
        predicted_reasons: [],
        is_correct: false,
        latency_ms: 0,
        error: msg,
      });
      process.stdout.write('E');
    }
  }
  process.stdout.write('\n');

  // 4. Eval-Cases persistieren
  const caseInserts = cases.map(c => ({
    run_id: runId,
    goldset_id: c.goldset_id,
    expected_tier: c.expected,
    predicted_tier: c.predicted,
    predicted_reasons: c.predicted_reasons,
    is_correct: c.is_correct,
    latency_ms: c.latency_ms,
    agent_raw_output: c.agent_raw ?? null,
    error_message: c.error ?? null,
  }));
  const { error: cErr } = await supabase.from('ai_risk_eval_cases').insert(caseInserts);
  if (cErr) {
    console.error('WARN: Eval-Cases konnten nicht persistiert werden', cErr);
  }

  // 5. Metriken berechnen
  const correct = cases.filter(c => c.is_correct).length;
  const accuracy = correct / cases.length;
  const perTier: Record<RiskTier, TierMetrics> = {
    minimal: computeTierMetrics(cases, 'minimal'),
    limited: computeTierMetrics(cases, 'limited'),
    high: computeTierMetrics(cases, 'high'),
    prohibited: computeTierMetrics(cases, 'prohibited'),
  };
  const matrix = buildConfusionMatrix(cases);

  // 6. Akzeptanz-Schwellen prüfen
  const failedReasons: string[] = [];
  if (accuracy < THRESHOLDS.accuracy_min) {
    failedReasons.push(`Accuracy ${accuracy.toFixed(4)} < ${THRESHOLDS.accuracy_min}`);
  }
  if (perTier.high.f1 < THRESHOLDS.f1_high_min) {
    failedReasons.push(`F1(high) ${perTier.high.f1.toFixed(4)} < ${THRESHOLDS.f1_high_min}`);
  }
  if (perTier.prohibited.f1 < THRESHOLDS.f1_prohibited_min) {
    failedReasons.push(`F1(prohibited) ${perTier.prohibited.f1.toFixed(4)} < ${THRESHOLDS.f1_prohibited_min}`);
  }
  if (perTier.prohibited.fp_rate > THRESHOLDS.fp_rate_prohibited_max) {
    failedReasons.push(`FP-Rate(prohibited) ${perTier.prohibited.fp_rate.toFixed(4)} > ${THRESHOLDS.fp_rate_prohibited_max}`);
  }
  if (perTier.high.fn_rate > THRESHOLDS.fn_rate_high_max) {
    failedReasons.push(`FN-Rate(high) ${perTier.high.fn_rate.toFixed(4)} > ${THRESHOLDS.fn_rate_high_max}`);
  }
  const passed = failedReasons.length === 0;

  // 7. Run-Status persistieren
  await supabase
    .from('ai_risk_eval_runs')
    .update({
      run_finished_at: new Date().toISOString(),
      correct_cases: correct,
      accuracy,
      f1_high: perTier.high.f1,
      f1_prohibited: perTier.prohibited.f1,
      fp_rate_prohibited: perTier.prohibited.fp_rate,
      fn_rate_high: perTier.high.fn_rate,
      confusion_matrix: matrix,
      per_tier_metrics: perTier,
      status: passed ? 'passed' : 'failed',
      failed_reason: failedReasons.join('; ') || null,
    })
    .eq('id', runId);

  // 8. Markdown-Report schreiben
  const report = buildReport(runId, cases, perTier, matrix, passed, failedReasons);
  const reportDir = process.env.EVAL_REPORT_DIR ?? './eval-reports';
  try {
    mkdirSync(reportDir, { recursive: true });
    const ts = new Date().toISOString().replace(/[:.]/g, '-');
    const reportPath = join(reportDir, `eval-${ts}-${runId.slice(0, 8)}.md`);
    writeFileSync(reportPath, report);
    console.log(`Report: ${reportPath}`);
  } catch (e) {
    console.warn('Report konnte nicht in Filesystem geschrieben werden:', e);
  }

  // Console-Ausgabe (für CI-Log)
  console.log('\n' + report);

  // 9. Exit
  if (!passed) {
    console.error('\nEVAL FAILED — Release blockiert');
    process.exit(1);
  }
  console.log('\nEVAL PASSED');
  process.exit(0);
}

main().catch(e => {
  console.error('UNCAUGHT ERROR:', e);
  process.exit(2);
});
