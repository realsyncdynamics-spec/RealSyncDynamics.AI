// Client-Wrapper für den Enterprise Scheduler.
//
// Schreibpfade (create/update/pause/resume/delete) über die Edge-Function
// `scheduler`. Lesepfad (Liste) RLS-sicher direkt über PostgREST.

import { getSupabase } from '../../lib/supabase';
import type { Frequency } from '../../lib/scheduler/nextRun';

export interface ScanSchedule {
  id: string;
  tenant_id: string;
  label: string | null;
  domains: string[];
  frequency: Frequency;
  hour: number;
  minute: number;
  weekday: number | null;
  day_of_month: number | null;
  enabled: boolean;
  paused: boolean;
  notify: { email?: string; webhook_id?: string } | null;
  next_run_at: string;
  last_run_at: string | null;
  created_at: string;
}

export interface ScheduleInput {
  tenant_id: string;
  label?: string;
  domains: string[];
  frequency: Frequency;
  hour: number;
  minute: number;
  weekday?: number;
  day_of_month?: number;
  notify?: { email?: string; webhook_id?: string };
}

export type SchedulerError =
  | { kind: 'forbidden' }
  | { kind: 'payment_required'; message: string }
  | { kind: 'bad_request'; message: string }
  | { kind: 'error'; message: string };

export type SchedulerResult<T> = { kind: 'ok'; data: T } | SchedulerError;

function mapError(error: unknown): SchedulerError {
  const status = (error as { context?: { status?: number } }).context?.status;
  const message = (error as { message?: string }).message ?? 'Netzwerkfehler';
  if (status === 403) return { kind: 'forbidden' };
  if (status === 402) return { kind: 'payment_required', message };
  if (status === 400) return { kind: 'bad_request', message };
  return { kind: 'error', message };
}

async function invoke<T>(body: Record<string, unknown>): Promise<SchedulerResult<T>> {
  const sb = getSupabase();
  const { data, error } = await sb.functions.invoke('scheduler', { body });
  if (error) return mapError(error);
  return { kind: 'ok', data: data as T };
}

export function createSchedule(input: ScheduleInput): Promise<SchedulerResult<{ id: string; next_run_at: string }>> {
  return invoke({ op: 'create', ...input });
}
export function updateSchedule(id: string, input: ScheduleInput): Promise<SchedulerResult<{ id: string; next_run_at: string }>> {
  return invoke({ op: 'update', id, ...input });
}
export function pauseSchedule(tenant_id: string, id: string, paused: boolean): Promise<SchedulerResult<{ id: string }>> {
  return invoke({ op: paused ? 'pause' : 'resume', tenant_id, id });
}
export function deleteSchedule(tenant_id: string, id: string): Promise<SchedulerResult<{ id: string }>> {
  return invoke({ op: 'delete', tenant_id, id });
}

export async function listSchedules(tenantId: string): Promise<ScanSchedule[]> {
  const sb = getSupabase();
  const { data, error } = await sb
    .from('scan_schedules')
    .select('id, tenant_id, label, domains, frequency, hour, minute, weekday, day_of_month, enabled, paused, notify, next_run_at, last_run_at, created_at')
    .eq('tenant_id', tenantId)
    .order('created_at', { ascending: false })
    .limit(50);
  if (error) throw new Error(error.message);
  return (data ?? []) as ScanSchedule[];
}
