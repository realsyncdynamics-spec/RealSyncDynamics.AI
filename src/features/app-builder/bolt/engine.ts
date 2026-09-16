/**
 * RealSync bolt.diy engine facade.
 *
 * Parse → classify → gate → run file actions → snapshot evidence.
 * One function the UI calls. No secrets, no network, no deploy.
 */

import type { EngineRunResult, GovernanceContext, ParseEvent } from './types';
import { StreamingMessageParser } from './message-parser';
import { FileStore } from './file-store';
import { ActionRunner } from './action-runner';
import { classifyPrompt, recordEvent } from './governance-gate';

export class BoltEngine {
  readonly store: FileStore;
  readonly parser = new StreamingMessageParser();
  readonly audit: EngineRunResult['audit'] = [];
  readonly runs: EngineRunResult['runs'] = [];
  readonly ctx: GovernanceContext;

  constructor(ctx: GovernanceContext) {
    this.ctx = ctx;
    this.store = new FileStore();
  }

  async ingest(messageId: string, modelText: string, userPrompt: string): Promise<EngineRunResult> {
    const risk = classifyPrompt(userPrompt);
    this.audit.push(recordEvent(this.ctx, 'builder.prompt.received', userPrompt.slice(0, 500), risk));

    const events: ParseEvent[] = this.parser.parse(messageId, modelText);
    const actions = events
      .filter((e): e is Extract<ParseEvent, { kind: 'action-close' }> => e.kind === 'action-close')
      .map((e) => e.parsed);
    const runner = new ActionRunner(this.store, this.ctx);

    let blocked = false;
    for (const parsed of actions) {
      const { result, audit } = await runner.run(parsed.actionId, parsed.action, risk);
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
      runs: this.runs.slice(),
      audit: this.audit.slice(),
      snapshot,
      blocked,
    };
  }
}
