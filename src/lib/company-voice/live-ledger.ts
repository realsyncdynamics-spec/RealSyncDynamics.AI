/**
 * Tageslimit und Prüfpfad der Live-Stimme (xAI Grok Realtime).
 *
 * - Tageslimit: höchstens `COMPANY_VOICE_GROK_DAILY_SESSIONS` Gespräche je
 *   UTC-Tag über alle Cloudflare-Instanzen hinweg (Default 30). Zähler im
 *   KV-Namespace `COMPANY_VOICE_LIVE_KV`. Ohne Binding oder bei ungültigem
 *   Limit bleibt die Live-Stimme aus (fail-closed).
 * - Prüfpfad: je Gespräch ein Eintrag im Tagesdatensatz (Anzahl, Sekunden,
 *   Endgründe) und eine JSON-Logzeile. Ohne IP, ohne Audio, ohne Transkript.
 *
 * KV ist eventuell konsistent: Das Limit ist eine Bremse, keine harte Grenze.
 * Die harte Kostengrenze ist das Ausgabenlimit im xAI-Konto.
 *
 * Kein Import aus `grok-relay` oder `endpoint` (Zyklus), kein `import.meta`.
 */
import type { CompanyVoiceEnv, LiveVoiceKv } from './types';

export const DEFAULT_DAILY_SESSIONS = 30;
export const MAX_DAILY_SESSIONS = 1_000;
/** Tagesdatensätze bleiben 35 Tage lesbar. */
export const DAY_RECORD_TTL_SECONDS = 35 * 24 * 60 * 60;

export type LiveEndReason =
  | 'time_limit'
  | 'audio_limit'
  | 'protocol'
  | 'setup_failed'
  | 'provider_closed'
  | 'client_closed'
  | 'provider_unavailable'
  | 'upgrade_failed';

export interface LiveDayRecord {
  day: string;
  /** Reservierte Gespräche (zählt ab Annahme, auch wenn der Provider danach scheitert). */
  sessions: number;
  /** Summe der Gesprächsdauer in Sekunden (gerundet). */
  seconds: number;
  /** Summe des vom Browser gesendeten Audios in Sekunden (gerundet). */
  audioSeconds: number;
  ended: Partial<Record<LiveEndReason, number>>;
}

/** Tageslimit aus der Umgebung. `null` = ungültig konfiguriert → aus. */
export function resolveDailyLimit(env: CompanyVoiceEnv): number | null {
  const raw = env.COMPANY_VOICE_GROK_DAILY_SESSIONS?.trim();
  if (!raw) return DEFAULT_DAILY_SESSIONS;
  if (!/^\d{1,4}$/.test(raw)) return null;
  const value = Number(raw);
  return value >= 1 && value <= MAX_DAILY_SESSIONS ? value : null;
}

function hasKv(env: CompanyVoiceEnv): env is CompanyVoiceEnv & { COMPANY_VOICE_LIVE_KV: LiveVoiceKv } {
  const kv = env.COMPANY_VOICE_LIVE_KV;
  return Boolean(kv && typeof kv.get === 'function' && typeof kv.put === 'function');
}

/**
 * Einzige Einschaltbedingung der Live-Stimme, ohne den Key zurückzugeben.
 * Wird von `/api/company-voice` (Angebot im Widget) und vom Relay genutzt.
 */
export function isLiveVoiceEnabled(env: CompanyVoiceEnv): boolean {
  return (
    env.COMPANY_VOICE_GROK_ENABLED === 'true' &&
    Boolean(env.XAI_API_KEY?.trim()) &&
    hasKv(env) &&
    resolveDailyLimit(env) !== null
  );
}

export function liveDayKey(now: number): string {
  return `live:${new Date(now).toISOString().slice(0, 10)}`;
}

function emptyRecord(day: string): LiveDayRecord {
  return { day, sessions: 0, seconds: 0, audioSeconds: 0, ended: {} };
}

function count(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? Math.floor(value) : 0;
}

/** Liest den Tagesdatensatz. Wirft bei KV-Fehlern (Aufrufer entscheidet fail-closed). */
export async function readDayRecord(kv: LiveVoiceKv, now: number): Promise<LiveDayRecord> {
  const key = liveDayKey(now);
  const day = key.slice(5);
  const raw = await kv.get(key);
  if (!raw) return emptyRecord(day);
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    // Beschädigter Datensatz: nicht als leer behandeln, sonst wäre das Limit umgangen.
    throw new Error('live day record unreadable');
  }
  if (!parsed || typeof parsed !== 'object') throw new Error('live day record unreadable');
  const record = parsed as Record<string, unknown>;
  const ended: LiveDayRecord['ended'] = {};
  if (record.ended && typeof record.ended === 'object') {
    for (const [reason, value] of Object.entries(record.ended as Record<string, unknown>)) {
      ended[reason as LiveEndReason] = count(value);
    }
  }
  return { day, sessions: count(record.sessions), seconds: count(record.seconds), audioSeconds: count(record.audioSeconds), ended };
}

async function writeDayRecord(kv: LiveVoiceKv, now: number, record: LiveDayRecord): Promise<void> {
  await kv.put(liveDayKey(now), JSON.stringify(record), { expirationTtl: DAY_RECORD_TTL_SECONDS });
}

export type ReserveResult = { ok: true; day: string; used: number; limit: number } | { ok: false; code: 'DAILY_LIMIT' | 'LIMIT_UNAVAILABLE' };

/**
 * Reserviert ein Gespräch im Tageslimit. Fehler beim Lesen oder Schreiben
 * führen zu `LIMIT_UNAVAILABLE` (fail-closed), nie zu einer freien Sitzung.
 */
export async function reserveLiveSession(env: CompanyVoiceEnv, now: number): Promise<ReserveResult> {
  const limit = resolveDailyLimit(env);
  if (!hasKv(env) || limit === null) return { ok: false, code: 'LIMIT_UNAVAILABLE' };
  try {
    const record = await readDayRecord(env.COMPANY_VOICE_LIVE_KV, now);
    if (record.sessions >= limit) return { ok: false, code: 'DAILY_LIMIT' };
    record.sessions += 1;
    await writeDayRecord(env.COMPANY_VOICE_LIVE_KV, now, record);
    return { ok: true, day: record.day, used: record.sessions, limit };
  } catch {
    return { ok: false, code: 'LIMIT_UNAVAILABLE' };
  }
}

export interface LiveSessionSummary {
  sessionId: string;
  startedAt: number;
  endedAt: number;
  reason: LiveEndReason;
  clientAudioSeconds: number;
  model: string;
  voice: string;
}

/** Ergänzt den Tagesdatensatz um ein beendetes Gespräch. Wirft nie. */
export async function recordLiveSessionEnd(env: CompanyVoiceEnv, summary: LiveSessionSummary): Promise<void> {
  if (!hasKv(env)) return;
  try {
    const record = await readDayRecord(env.COMPANY_VOICE_LIVE_KV, summary.startedAt);
    record.seconds += Math.max(0, Math.round((summary.endedAt - summary.startedAt) / 1000));
    record.audioSeconds += Math.max(0, Math.round(summary.clientAudioSeconds));
    record.ended[summary.reason] = (record.ended[summary.reason] ?? 0) + 1;
    await writeDayRecord(env.COMPANY_VOICE_LIVE_KV, summary.startedAt, record);
  } catch {
    /* Prüfpfad im KV ist best effort; die Logzeile bleibt. */
  }
}

export type LiveLogEvent =
  | { phase: 'rejected'; code: string }
  | { phase: 'started'; sessionId: string; day: string; used: number; limit: number; model: string; voice: string }
  | ({ phase: 'ended'; durationSeconds: number } & Omit<LiveSessionSummary, 'startedAt' | 'endedAt'>);

/**
 * Eine JSON-Zeile je Ereignis (Cloudflare Workers Logs). Nur die hier
 * typisierten Felder: keine IP, kein Key, kein Audio, kein Transkript.
 */
export function logLiveEvent(event: LiveLogEvent, log: (line: string) => void = (line) => console.info(line)): void {
  try {
    log(JSON.stringify({ event: 'company_voice.live', ...event }));
  } catch {
    /* Logging darf das Gespräch nie beenden. */
  }
}

/** Sekunden PCM16 @ 24 kHz aus der Länge der Base64-Zeichen. */
export function base64PcmSeconds(chars: number, sampleRate: number): number {
  return (chars * 3) / 4 / 2 / sampleRate;
}
