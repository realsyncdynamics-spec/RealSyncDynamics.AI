/**
 * Action runner: apply allowed file actions to the FileStore.
 *
 * Unlike bolt.diy's ActionRunner this class never talks to WebContainer.
 * Shell / start / build / supabase-query are recorded, not executed.
 */

import type { ActionRunResult, BoltAction, GovernanceContext, RiskClass } from './types';
import { FileStore } from './file-store';
import { auditFromGate, evaluateAction } from './governance-gate';
import type { AuditRecord } from './types';

export class ActionRunner {
  private readonly store: FileStore;
  private readonly ctx: GovernanceContext;

  constructor(store: FileStore, ctx: GovernanceContext) {
    this.store = store;
    this.ctx = ctx;
  }

  async run(actionId: string, action: BoltAction, promptRisk: RiskClass): Promise<{
    result: ActionRunResult;
    audit: AuditRecord;
  }> {
    const gate = evaluateAction(this.ctx, action, actionId, promptRisk);

    if (gate.decision === 'block') {
      return {
        result: { actionId, status: 'blocked', gate, output: gate.reason },
        audit: auditFromGate(this.ctx, gate, 'builder.action.blocked', summarize(action)),
      };
    }

    if (gate.decision === 'require_approval') {
      return {
        result: { actionId, status: 'blocked', gate, output: gate.reason },
        audit: auditFromGate(this.ctx, gate, 'builder.action.held', summarize(action)),
      };
    }

    if (action.type !== 'file') {
      return {
        result: { actionId, status: 'blocked', gate, output: 'Nur Dateiaktionen werden in dieser Phase ausgeführt.' },
        audit: auditFromGate(this.ctx, gate, 'builder.action.skipped', summarize(action)),
      };
    }

    try {
      const rec = await this.store.write(action.filePath, action.content);
      return {
        result: {
          actionId,
          status: 'complete',
          gate,
          output: `geschrieben ${rec.path} · ${rec.sha256.slice(0, 12)}… · rev ${rec.revision}`,
          filePath: rec.path,
        },
        audit: auditFromGate(this.ctx, gate, 'builder.file.written', rec.path, rec.sha256),
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return {
        result: { actionId, status: 'failed', gate, output: message, filePath: action.filePath },
        audit: auditFromGate(this.ctx, { ...gate, decision: 'block', reason: message }, 'builder.file.failed', message),
      };
    }
  }
}

function summarize(action: BoltAction): string {
  if (action.type === 'file') return `file:${action.filePath}`;
  if (action.type === 'supabase') return `supabase:${action.operation}:${action.filePath ?? ''}`;
  return `${action.type}:${action.content.slice(0, 80)}`;
}
