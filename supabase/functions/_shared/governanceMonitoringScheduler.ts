export interface SchedulerRequestBody {
  source_id?: string;
  frequency_filter?: 'hourly' | 'daily' | 'weekly' | 'monthly';
}

export interface SchedulerEventRow {
  tenant_id: string;
  event_type: string;
  event_source: 'agent_runtime';
  risk_level: 'low';
  payload: Record<string, unknown>;
  asset_id: string | null;
}

export function buildSourceSelection(body: SchedulerRequestBody, nowIso: string) {
  if (body.source_id) {
    return {
      limit: 1,
      source_id: body.source_id,
      statuses: ['active', 'error'] as const,
      dueBefore: null,
      frequency_filter: body.frequency_filter ?? null,
    };
  }

  return {
    limit: 50,
    source_id: null,
    statuses: ['active'] as const,
    dueBefore: nowIso,
    frequency_filter: body.frequency_filter ?? null,
  };
}

export function buildGovernanceEventRow(input: {
  tenantId: string;
  sourceId: string;
  assetId: string | null;
  eventType: string;
  payload: Record<string, unknown>;
}): SchedulerEventRow {
  return {
    tenant_id: input.tenantId,
    event_type: input.eventType,
    event_source: 'agent_runtime',
    risk_level: 'low',
    payload: { source_id: input.sourceId, ...input.payload },
    asset_id: input.assetId,
  };
}

export function scanDurationMs(startedAt: number, finishedAt: number): number {
  return Math.max(0, finishedAt - startedAt);
}
