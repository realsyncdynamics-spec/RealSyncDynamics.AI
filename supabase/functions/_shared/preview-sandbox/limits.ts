// Feste Grenzen und atomare Reservierung für Vorschau-Sitzungen (Spike).
//
// Kein Start ohne bestandene Limitprüfung: Die Sitzungsverwaltung reserviert
// IMMER zuerst hier und ruft erst danach den Anbieter auf. Die Reservierung
// selbst ist atomar — parallele Starts können das Limit nicht umgehen.
//
// MemoryPreviewStore ist atomar, weil `reserve` synchron läuft (ein
// JS-Thread, kein await zwischen Prüfen und Eintragen). Er gilt aber nur je
// Isolate. Für den Betrieb braucht es einen dauerhaften Store mit
// Advisory-Lock je Mandant (Muster: Migration
// 20261027120000_bot_usage_budget_hardening.sql). Der ist NICHT Teil dieses
// Spikes — ohne ihn bleibt der Edge-Handler geschlossen (503).

import type { PreviewSessionRecord, StopReason } from './types.ts';

export interface PreviewLimits {
  /** Harte Laufzeit je Sitzung. */
  maxSessionMs: number;
  /** Ohne Heartbeat länger als das → Stopp (Builder geschlossen, Tab weg). */
  idleStopMs: number;
  /** Gleichzeitig laufende Sandboxes je Mandant. */
  maxConcurrentPerTenant: number;
  /** Gleichzeitig laufende Sandboxes insgesamt (Kostenbremse). */
  maxConcurrentGlobal: number;
  /** Gestartete Sitzungen je Mandant und UTC-Tag (auch fehlgeschlagene). */
  maxSessionsPerTenantPerDay: number;
}

/**
 * Spike-Werte. Fest im Code, nicht aus Request oder Env.
 * Ein Kontingent je Tarif ist eine offene Entscheidung (Bericht §5).
 */
export const PREVIEW_LIMITS: Readonly<PreviewLimits> = Object.freeze({
  maxSessionMs: 15 * 60_000,
  idleStopMs: 3 * 60_000,
  maxConcurrentPerTenant: 1,
  maxConcurrentGlobal: 10,
  maxSessionsPerTenantPerDay: 20,
});

/** Heartbeat-Takt im Browser; deutlich kleiner als idleStopMs. */
export const HEARTBEAT_INTERVAL_MS = 30_000;

export type ReserveResult =
  | { ok: true; record: PreviewSessionRecord }
  | { ok: false; code: 'CONCURRENCY_LIMIT' | 'DAILY_LIMIT'; message: string };

export interface ReserveInput {
  sessionId: string;
  tenantId: string;
  actorId: string;
  projectId: string;
  provider: string;
  now: number;
  limits: PreviewLimits;
}

export interface PreviewStore {
  /** Atomar: Limits prüfen und Sitzung im Zustand `reserved` anlegen. */
  reserve(input: ReserveInput): ReserveResult | Promise<ReserveResult>;
  get(sessionId: string): PreviewSessionRecord | null | Promise<PreviewSessionRecord | null>;
  markRunning(sessionId: string, sandboxId: string, previewUrl: string): void | Promise<void>;
  touch(sessionId: string, now: number): void | Promise<void>;
  finish(sessionId: string, state: 'stopped' | 'failed', reason: StopReason, now: number): void | Promise<void>;
  /** Alle Sitzungen im Zustand reserved/running (für den Sweep). */
  listActive(): PreviewSessionRecord[] | Promise<PreviewSessionRecord[]>;
}

export function utcDay(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

function isActive(r: PreviewSessionRecord): boolean {
  return r.state === 'reserved' || r.state === 'running';
}

export class MemoryPreviewStore implements PreviewStore {
  private readonly rows = new Map<string, PreviewSessionRecord>();

  reserve(input: ReserveInput): ReserveResult {
    // Bewusst synchron: zwischen Zählen und Eintragen liegt kein await.
    const all = [...this.rows.values()];
    const active = all.filter(isActive);
    if (active.length >= input.limits.maxConcurrentGlobal) {
      return { ok: false, code: 'CONCURRENCY_LIMIT', message: 'global preview capacity reached' };
    }
    if (active.filter((r) => r.tenantId === input.tenantId).length >= input.limits.maxConcurrentPerTenant) {
      return { ok: false, code: 'CONCURRENCY_LIMIT', message: 'tenant already has a running preview' };
    }
    const day = utcDay(input.now);
    const today = all.filter((r) => r.tenantId === input.tenantId && utcDay(r.startedAt) === day);
    if (today.length >= input.limits.maxSessionsPerTenantPerDay) {
      return { ok: false, code: 'DAILY_LIMIT', message: 'daily preview sessions exhausted' };
    }
    const record: PreviewSessionRecord = {
      sessionId: input.sessionId,
      tenantId: input.tenantId,
      actorId: input.actorId,
      projectId: input.projectId,
      state: 'reserved',
      provider: input.provider,
      sandboxId: null,
      previewUrl: null,
      startedAt: input.now,
      lastSeenAt: input.now,
      hardDeadline: input.now + input.limits.maxSessionMs,
      stoppedAt: null,
      stopReason: null,
    };
    this.rows.set(record.sessionId, record);
    return { ok: true, record: { ...record } };
  }

  get(sessionId: string): PreviewSessionRecord | null {
    const r = this.rows.get(sessionId);
    return r ? { ...r } : null;
  }

  markRunning(sessionId: string, sandboxId: string, previewUrl: string): void {
    const r = this.rows.get(sessionId);
    if (!r || !isActive(r)) return;
    r.state = 'running';
    r.sandboxId = sandboxId;
    r.previewUrl = previewUrl;
  }

  touch(sessionId: string, now: number): void {
    const r = this.rows.get(sessionId);
    if (r && isActive(r)) r.lastSeenAt = now;
  }

  finish(sessionId: string, state: 'stopped' | 'failed', reason: StopReason, now: number): void {
    const r = this.rows.get(sessionId);
    if (!r || !isActive(r)) return;
    r.state = state;
    r.stopReason = reason;
    r.stoppedAt = now;
  }

  listActive(): PreviewSessionRecord[] {
    return [...this.rows.values()].filter(isActive).map((r) => ({ ...r }));
  }
}
