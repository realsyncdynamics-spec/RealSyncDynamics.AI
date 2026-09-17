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

export function isOmittedSchedulerBody(raw: string): boolean {
  return raw.trim().length === 0;
}

export function parseSchedulerRequestBody(raw: string): SchedulerRequestBody {
  const parsed = JSON.parse(raw) as Record<string, unknown>;
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('invalid json');
  }
  for (const key of Object.keys(parsed)) {
    if (key !== 'source_id' && key !== 'frequency_filter') {
      throw new Error('invalid json');
    }
  }
  if ('source_id' in parsed && typeof parsed.source_id !== 'string') {
    throw new Error('invalid json');
  }
  if ('frequency_filter' in parsed && !isFrequency(parsed.frequency_filter)) {
    throw new Error('invalid json');
  }
  return {
    source_id: typeof parsed.source_id === 'string' ? parsed.source_id : undefined,
    frequency_filter: isFrequency(parsed.frequency_filter) ? parsed.frequency_filter : undefined,
  };
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

export function buildDueFilter(dueBefore: string): string {
  return `next_scan_at.is.null,next_scan_at.lte.${encodeURIComponent(dueBefore)}`;
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

function isFrequency(value: unknown): value is NonNullable<SchedulerRequestBody['frequency_filter']> {
  return value === 'hourly' || value === 'daily' || value === 'weekly' || value === 'monthly';
}
