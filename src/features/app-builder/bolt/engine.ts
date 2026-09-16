/**
 * RealSync bolt.diy engine facade.
 *
 * Parse → classify → gate → run file actions → snapshot evidence.
 * The FileStore survives across ingest() calls so follow-up prompts
 * mutate the same project. No secrets, no network, no deploy.
 */

import type {
  EngineRunResult,
  FileAction,
  GovernanceContext,
  ParseEvent,
  RiskClass,
} from './types';
import { StreamingMessageParser } from './message-parser';
import { FileStore } from './file-store';
import { ActionRunner } from './action-runner';
import { classifyPrompt, evaluateAction, recordEvent, auditFromGate } from './governance-gate';


export class BoltEngine {
  readonly store: FileStore;
  readonly parser = new StreamingMessageParser();
  readonly audit: EngineRunResult['audit'] = [];
  readonly runs: EngineRunResult['runs'] = [];
  ctx: GovernanceContext;

  constructor(ctx: GovernanceContext, store?: FileStore) {
    this.ctx = ctx;
    this.store = store ?? new FileStore();
  }

  setCtx(ctx: GovernanceContext): void {
    this.ctx = ctx;
  }

  async hydrate(files: Record<string, string>): Promise<void> {
    this.store.clear();
    for (const [path, content] of Object.entries(files)) {
      await this.store.write(path, content);
    }
  }

  async ingest(messageId: string, modelText: string, userPrompt: string): Promise<EngineRunResult> {
    const risk = classifyPrompt(userPrompt);
    this.audit.push(recordEvent(this.ctx, 'builder.prompt.received', userPrompt.slice(0, 500), risk));

    const events: ParseEvent[] = this.parser.parse(messageId, modelText);
    const actions = events
      .filter((e): e is Extract<ParseEvent, { kind: 'action-close' }> => e.kind === 'action-close')
      .map((e) => e.parsed);
    const runner = new ActionRunner(this.store, this.ctx);

    const turnRuns: EngineRunResult['runs'] = [];
    let blocked = false;
    for (const parsed of actions) {
      const { result, audit } = await runner.run(parsed.actionId, parsed.action, risk);
      turnRuns.push(result);
      this.runs.push(result);
      this.audit.push(audit);
      if (result.status === 'blocked' && result.gate.decision === 'block') blocked = true;
    }

    const snapshot = await this.store.snapshot();
    this.audit.push(
      recordEvent(
        this.ctx,
        'builder.snapshot',
        `${Object.keys(snapshot.files).length} Dateien`,
        risk,
        snapshot.merkle,
      ),
    );

    return {
      messageId,
      events,
      runs: turnRuns,
      audit: this.audit.slice(),
      snapshot,
      blocked,
    };
  }

  async writeFile(path: string, content: string, promptRisk: RiskClass = 'minimal'): Promise<EngineRunResult> {
    const action: FileAction = { type: 'file', filePath: path, content };
    const runner = new ActionRunner(this.store, this.ctx);
    const { result, audit } = await runner.run(`edit-${Date.now()}`, action, promptRisk);
    this.runs.push(result);
    this.audit.push(audit);
    const snapshot = await this.store.snapshot();
    return {
      messageId: `edit-${path}`,
      events: [],
      runs: [result],
      audit: this.audit.slice(),
      snapshot,
      blocked: result.gate.decision === 'block',
    };
  }

  async deleteFile(path: string, promptRisk: RiskClass = 'minimal'): Promise<EngineRunResult> {
    const action: FileAction = { type: 'file', filePath: path, content: '' };
    const gate = evaluateAction(this.ctx, action, `del-${path}`, promptRisk);
    if (gate.decision !== 'allow') {
      const audit = auditFromGate(this.ctx, gate, 'builder.file.delete-blocked', path);
      this.audit.push(audit);
      const snapshot = await this.store.snapshot();
      return {
        messageId: `del-${path}`,
        events: [],
        runs: [{ actionId: gate.actionId, status: 'blocked', gate, output: gate.reason, filePath: path }],
        audit: this.audit.slice(),
        snapshot,
        blocked: true,
      };
    }
    this.store.remove(path);
    this.audit.push(recordEvent(this.ctx, 'builder.file.deleted', path, promptRisk));
    const snapshot = await this.store.snapshot();
    return {
      messageId: `del-${path}`,
      events: [],
      runs: [{ actionId: gate.actionId, status: 'complete', gate, output: `gelöscht ${path}`, filePath: path }],
      audit: this.audit.slice(),
      snapshot,
      blocked: false,
    };
  }
}
