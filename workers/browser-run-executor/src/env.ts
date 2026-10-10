// Governed Browser Executor auf Cloudflare Browser Run — Umgebung und die
// kleinste Workers-Oberfläche, die dieser Worker benutzt.
//
// Bewusst ohne @cloudflare/workers-types in den geteilten Modulen: router.ts,
// session-object.ts und health.ts laufen auch unter vitest (Node) mit Fakes.
// Nur index.ts importiert @cloudflare/playwright und die echten Bindungen.

/** Browser-Run-Bindung (wrangler: "browser": { "binding": "BROWSER" }). */
export interface BrowserBinding {
  fetch: typeof fetch;
}

export interface DurableObjectIdLike {
  toString(): string;
}

export interface DurableObjectStubLike {
  fetch(input: string, init?: RequestInit): Promise<Response>;
}

export interface DurableObjectNamespaceLike {
  idFromName(name: string): DurableObjectIdLike;
  get(id: DurableObjectIdLike): DurableObjectStubLike;
  /** Datenhaltung/Ausführung des Durable Objects auf eine Jurisdiktion begrenzen. */
  jurisdiction(name: 'eu'): DurableObjectNamespaceLike;
}

/** Ausschnitt aus DurableObjectStorage, den session-object.ts braucht. */
export interface StorageLike {
  get<T = unknown>(key: string): Promise<T | undefined>;
  put(entries: Record<string, unknown>): Promise<void>;
  delete(keys: string[]): Promise<number>;
  getAlarm(): Promise<number | null>;
  setAlarm(scheduledTime: number): Promise<void>;
  deleteAlarm(): Promise<void>;
}

export interface Env {
  BROWSER: BrowserBinding;
  SESSIONS: DurableObjectNamespaceLike;
  /** Secret (wrangler secret put SCANNER_API_KEY) — derselbe Wert wie PLAYWRIGHT_SCANNER_KEY in Supabase. */
  SCANNER_API_KEY?: string;
  /** Höchstzahl gleichzeitiger Browser dieses Executors (Standard 10 = im Workers-Paid-Plan enthalten). */
  MAX_SESSIONS?: string;
  /** Ausdrücklich freigegebene private Hosts (Standard leer; im Cloudflare-Netz ohnehin nicht erreichbar). */
  EXECUTOR_PRIVATE_HOST_ALLOWLIST?: string;
}

export const EXECUTOR_VERSION = '2026.10.1';
export const EXECUTOR_RUNTIME = 'cloudflare-browser-run';

/** Browser-Run-Leerlauf bis zum Schließen (Maximum 10 min). */
export const BROWSER_KEEP_ALIVE_MS = 600_000;
/** Alarm-Takt des Durable Objects (hält es im Speicher, prüft Leerlauf/Höchstalter). */
export const ALARM_INTERVAL_MS = 10_000;
/** Lebenszeichen an den Browser, solange die Session nach unseren Fristen lebt. */
export const PING_INTERVAL_MS = 240_000;

export function maxSessions(env: Pick<Env, 'MAX_SESSIONS'>): number {
  const n = Number.parseInt(env.MAX_SESSIONS ?? '', 10);
  return Number.isInteger(n) && n > 0 && n <= 200 ? n : 10;
}
