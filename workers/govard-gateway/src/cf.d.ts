/**
 * Minimale Cloudflare-Workers-Typdeklarationen — nur die Oberfläche, die
 * dieser Worker tatsächlich benutzt.
 *
 * Warum kein `@cloudflare/workers-types`: Das Repo installiert Worker-
 * Verzeichnisse nicht separat (siehe workers/siteos-preview — gleiches
 * Muster). Eine Root-Dependency nur für Typen eines einzelnen Workers wäre
 * mehr Kopplung als diese Datei. Wird die Oberfläche größer, ist der Wechsel
 * auf das offizielle Paket der richtige Schritt.
 */

interface D1Meta {
  changes: number;
  last_row_id: number;
}

interface D1Result<T = unknown> {
  results: T[];
  success: boolean;
  meta: D1Meta;
}

interface D1PreparedStatement {
  bind(...values: unknown[]): D1PreparedStatement;
  run(): Promise<{ success: boolean; meta: D1Meta }>;
  all<T = unknown>(): Promise<D1Result<T>>;
  first<T = unknown>(): Promise<T | null>;
}

interface D1Database {
  prepare(query: string): D1PreparedStatement;
  batch(statements: D1PreparedStatement[]): Promise<D1Result[]>;
}

interface R2PutOptions {
  httpMetadata?: { contentType?: string };
}

interface R2Bucket {
  put(key: string, value: string | ArrayBuffer, options?: R2PutOptions): Promise<unknown>;
}

interface DurableObjectId {
  toString(): string;
}

interface DurableObjectTransaction {
  get<T = unknown>(key: string): Promise<T | undefined>;
  put(key: string, value: unknown): Promise<void>;
  delete(key: string): Promise<boolean>;
}

interface DurableObjectStorage {
  get<T = unknown>(key: string): Promise<T | undefined>;
  put(key: string, value: unknown): Promise<void>;
  delete(key: string): Promise<boolean>;
  setAlarm(scheduledTime: number): Promise<void>;
  transaction(closure: (txn: DurableObjectTransaction) => Promise<void>): Promise<void>;
}

interface DurableObjectState {
  storage: DurableObjectStorage;
}

/**
 * RPC-Stub: Auf einem per `get()` bezogenen Stub sind die öffentlichen
 * Methoden der DO-Klasse direkt aufrufbar (Workers-RPC).
 */
type DurableObjectStub<T> = T;

interface DurableObjectNamespace<T = unknown> {
  idFromName(name: string): DurableObjectId;
  get(id: DurableObjectId): DurableObjectStub<T>;
}

interface ExecutionContext {
  waitUntil(promise: Promise<unknown>): void;
}

interface ScheduledController {
  scheduledTime: number;
  cron: string;
}

declare module "cloudflare:workers" {
  abstract class DurableObject<E = unknown> {
    protected ctx: DurableObjectState;
    protected env: E;
    constructor(ctx: DurableObjectState, env: E);
  }
  export { DurableObject };
}
