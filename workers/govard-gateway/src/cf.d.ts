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
  abstract class WorkflowEntrypoint<E = unknown, P = unknown> {
    protected ctx: ExecutionContext;
    protected env: E;
    constructor(ctx: ExecutionContext, env: E);
    abstract run(event: WorkflowEvent<P>, step: WorkflowStep): Promise<unknown>;
  }
  export { DurableObject, WorkflowEntrypoint };
}

// ---------------------------------------------------------------
// Workflows — durable, mit Wiederaufnahme und Retries.
//
// Modulnamen am workerd-Binary dieser Toolchain geprueft, nicht geraten:
// `cloudflare:workers` fuehrt WorkflowEntrypoint neben DurableObject und
// WorkerEntrypoint, `cloudflare:workflows` exportiert NonRetryableError.
// ---------------------------------------------------------------
interface WorkflowEvent<T> {
  payload: Readonly<T>;
  timestamp: Date;
  instanceId: string;
  workflowName: string;
}

/** Dauer als Zahl (Millisekunden) oder lesbar, z. B. "30 seconds". */
type WorkflowDuration = string | number;

interface WorkflowStepConfig {
  retries?: {
    limit: number;
    delay: WorkflowDuration;
    backoff?: "constant" | "linear" | "exponential";
  };
  timeout?: WorkflowDuration;
}

interface WorkflowStep {
  /**
   * Fuehrt den Rumpf hoechstens einmal erfolgreich aus: Das Ergebnis wird
   * dauerhaft festgehalten. Ein Wiederanlauf ueberspringt bereits
   * abgeschlossene Schritte. Ein FEHLGESCHLAGENER Schritt wird dagegen
   * ganz wiederholt — der Rumpf muss deshalb idempotent sein.
   */
  do<T>(name: string, callback: () => Promise<T>): Promise<T>;
  do<T>(name: string, config: WorkflowStepConfig, callback: () => Promise<T>): Promise<T>;
  sleep(name: string, duration: WorkflowDuration): Promise<void>;
}

interface WorkflowInstance {
  id: string;
  status(): Promise<{ status: string; output?: unknown; error?: unknown }>;
}

interface WorkflowInstanceCreateOptions<T = unknown> {
  /** Bis 100 Zeichen. Eine bereits vergebene Kennung wird abgewiesen. */
  id?: string;
  params?: T;
}

interface Workflow<T = unknown> {
  create(options?: WorkflowInstanceCreateOptions<T>): Promise<WorkflowInstance>;
  get(id: string): Promise<WorkflowInstance>;
}

declare module "cloudflare:workflows" {
  export class NonRetryableError extends Error {
    constructor(message: string, name?: string);
  }
}
