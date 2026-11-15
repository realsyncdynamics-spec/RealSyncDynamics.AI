// RealSync Browser · lokaler MVP (Kommandozeile).
//
//   node apps/realsync-browser/src/cli.ts --policy <policy.json> --plan <plan.json> [--headed] [--simulate]
//
// Der Plan (Format des bestehenden `browser_task_planner`) ist nur ein
// Vorschlag. Jeder Schritt geht einzeln durch den Guardian; Freigaben gibt
// ein Mensch im Terminal mit dem Wort FREIGEBEN. Ohne Terminal (kein TTY)
// wird jede Freigabe abgelehnt. Bei `deny` endet der Lauf.

import { appendFile, mkdir, readFile } from 'node:fs/promises';
import { homedir, userInfo } from 'node:os';
import { join } from 'node:path';
import { createInterface } from 'node:readline/promises';
import { parseBrowserPlan } from '../../../supabase/functions/_shared/browser-plan.ts';
import {
  BrowserGuardian, DATA_CLASS_LABEL_DE, EvidenceLog, generateHmacKey, policyError, SimulatedDriver, verifyEvidence,
} from '../../../packages/browser-guardian/src/index.ts';
import type { BrowserDriver, EvidenceEntry, EvidenceSink, GuardianPolicy } from '../../../packages/browser-guardian/src/index.ts';
import { PlaywrightDriver } from './playwright-driver.ts';

class JsonlEvidenceSink implements EvidenceSink {
  readonly path: string;
  entries: EvidenceEntry[] = [];
  constructor(path: string) { this.path = path; }
  async append(entry: EvidenceEntry): Promise<void> {
    await appendFile(this.path, `${JSON.stringify(entry)}\n`, { mode: 0o600 });
    this.entries.push(entry);
  }
}

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}
const flag = (name: string) => process.argv.includes(`--${name}`);

async function main(): Promise<number> {
  const policyPath = arg('policy');
  const planPath = arg('plan');
  if (!policyPath || !planPath) {
    console.error('Aufruf: node apps/realsync-browser/src/cli.ts --policy <policy.json> --plan <plan.json> [--headed] [--simulate]');
    return 2;
  }
  const policy = JSON.parse(await readFile(policyPath, 'utf8')) as GuardianPolicy;
  const pErr = policyError(policy);
  if (pErr) { console.error(`Richtlinie ungültig: ${pErr}`); return 2; }

  const plan = parseBrowserPlan(await readFile(planPath, 'utf8'));
  if (plan.kind === 'refused') { console.log(`Planer hat abgelehnt: ${plan.reason}`); return 0; }
  if (plan.kind === 'invalid') { console.error(`Plan ungültig: ${plan.error}`); return 2; }

  const simulate = flag('simulate');
  const sessionId = crypto.randomUUID();
  const dir = join(homedir(), '.realsync-browser', 'evidence');
  await mkdir(dir, { recursive: true, mode: 0o700 });
  const sink = new JsonlEvidenceSink(arg('evidence') ?? join(dir, `${sessionId}.jsonl`));

  const driver: BrowserDriver = simulate
    ? new SimulatedDriver({}, () => ({ title: 'SIMULATION', text: 'SIMULATION – kein echter Seiteninhalt.' }))
    : await PlaywrightDriver.launch({ headless: !flag('headed') });

  const guardian = new BrowserGuardian({
    policy,
    driver,
    evidence: new EvidenceLog(sink),
    key: await generateHmacKey(),
    context: {
      tenant_id: policy.policy_id,
      session_id: sessionId,
      actor_id: userInfo().username || 'local-user',
      kill_switch: process.env.REALSYNC_BROWSER_KILL_SWITCH === '1',
    },
  });

  const tty = Boolean(process.stdin.isTTY);
  const rl = tty ? createInterface({ input: process.stdin, output: process.stdout }) : null;
  console.log(`${simulate ? '[SIMULATION] ' : ''}RealSync Browser · Sitzung ${sessionId}`);
  console.log(`Richtlinie ${policy.policy_id} · Version ${policy.version}${plan.summary ? ` · Plan: ${plan.summary}` : ''}\n`);

  let exitCode = 0;
  try {
    for (const [i, step] of plan.steps.entries()) {
      const request = { action: step.action, source: 'planner' as const, channel: 'cli' as const };
      const label = `Schritt ${i + 1}/${plan.steps.length} ${step.action.type}`;
      const { decision, approval } = await guardian.propose(request);
      const why = decision.reasons.map((r) => `   - ${r.code}: ${r.text_de}`).join('\n');
      console.log(`${label} → ${decision.decision} (Ziel: ${DATA_CLASS_LABEL_DE[decision.target_class]})\n${why}`);
      if (decision.decision === 'deny') { exitCode = 1; break; }

      let approvalId: string | undefined;
      if (approval) {
        const answer = rl
          ? await rl.question(`   Prüfung: ${approval.review}. Gültig bis ${new Date(approval.expires_at).toLocaleTimeString('de-DE')}. Zum Freigeben FREIGEBEN tippen: `)
          : '';
        const ok = answer.trim() === 'FREIGEBEN';
        await guardian.decideApproval(approval.id, { kind: 'human', id: userInfo().username || 'local-user' }, ok);
        if (!ok) { console.log(`   abgelehnt${tty ? '' : ' (kein Terminal: Freigaben werden ohne Mensch nicht erteilt)'}.`); exitCode = 1; break; }
        approvalId = approval.id;
      }

      const out = await guardian.execute(request, approvalId);
      const res = out.result;
      console.log(`   ${out.status}${res?.url ? ` · ${new URL(res.url).origin}` : ''}${res?.error ? ` · ${res.error}` : ''}${res?.blocked_requests ? ` · ${res.blocked_requests} Anfrage(n) geblockt` : ''}`);
      if (typeof res?.text === 'string') {
        console.log(`   Inhalt (${res.text.length} Zeichen, lokal angezeigt, ${out.forward_to_model ? 'darf' : 'darf NICHT'} an ein Modell):`);
        console.log(`   ${res.text.slice(0, 400).replace(/\s+/g, ' ')}`);
      }
      if (res?.screenshot_png) console.log(`   Bildschirmfoto: ${res.screenshot_png.byteLength} Bytes (nicht gespeichert).`);
      if (out.status !== 'executed') { exitCode = 1; break; }
    }
  } finally {
    rl?.close();
    await guardian.close();
  }

  const check = await verifyEvidence(sink.entries);
  console.log(`\nNachweis: ${sink.path} · ${check.checked} Einträge · Kette ${check.ok ? 'geprüft, unverändert' : 'FEHLERHAFT'}${simulate ? ' · SIMULATION (kein Browser)' : ''}`);
  return check.ok ? exitCode : 3;
}

main().then((code) => process.exit(code), (e) => {
  console.error(`Abbruch: ${e instanceof Error ? e.message : String(e)}`);
  process.exit(1);
});
