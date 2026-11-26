// Laufzeit-Vorschau für den Code-Builder (Spike, 22.11.2026).
//
// STATUS: Spike. Nur gegen den Fake-Adapter getestet. Kein echter Anbieter
// angebunden, kein Deploy, keine Migration. Siehe
// docs/builder/SPIKE_SANDBOX_PREVIEW_2026-11-22.md.
//
// Ohne Deno-/jsr-Imports, damit Vitest das Modul laden kann (gleiche Technik
// wie _shared/bot-budget.ts). Imports mit `.ts`-Endung, damit Deno und Node
// (Type-Stripping) die Dateien ohne Bundler laden.
//
// Grundsatz: Die Sandbox führt KEINE KI-erzeugten Shell-Befehle aus. Sie
// bekommt nur die geprüften Projektdateien und startet einen festen Befehl
// (`DEV_SERVER_COMMAND`). boltAction shell/start/build bleiben HOLD
// (governance-gate.ts, control `runtime.webcontainer-disabled`).

/** Schmale Anbieter-Schnittstelle. Ein Adapter je Anbieter (E2B, Cloudflare, Fake). */
export interface PreviewRuntime {
  /** Name für Prüfpfad und Bericht, z. B. `fake`, `cloudflare-sandbox`. */
  readonly provider: string;
  /**
   * Startet genau eine isolierte Sandbox für genau ein Projekt eines Mandanten,
   * schreibt die Dateien, installiert Abhängigkeiten und startet den Dev-Server.
   * Muss das Zeitlimit `hardTimeoutMs` auch anbieterseitig setzen (zweite Linie
   * neben dem Sweep der Sitzungsverwaltung).
   */
  start(input: RuntimeStartInput): Promise<RuntimeHandle>;
  /** Ersetzt/ergänzt Dateien in einer laufenden Sandbox (HMR übernimmt). */
  writeFiles(handle: RuntimeHandle, files: SandboxFile[]): Promise<void>;
  /** Zustand aus Sicht des Anbieters. */
  status(handle: RuntimeHandle): Promise<RuntimeStatus>;
  /** Beendet die Sandbox. Muss idempotent sein und darf nicht werfen. */
  stop(handle: RuntimeHandle): Promise<void>;
  /** Öffentliche Vorschau-URL auf fremder Origin (https). */
  previewUrl(handle: RuntimeHandle): string;
}

export interface SandboxFile {
  path: string;
  content: string;
}

export interface RuntimeStartInput {
  /** Eindeutig je Sitzung. Kein Mandanten-Klartext, kein Projektname. */
  sandboxKey: string;
  /** Zufälliges Token je Sitzung; Adapter bettet es in die Vorschau-URL ein. */
  previewToken: string;
  files: SandboxFile[];
  devServer: DevServerSpec;
  hardTimeoutMs: number;
  /**
   * Umgebung der Sandbox. Immer leer — die Sandbox erhält keine
   * RealSync-Secrets. Feld existiert, damit Tests das prüfen können.
   */
  env: Record<string, never>;
  /** Ausgehender Netzwerkzugriff: nur npm-Registry, falls der Anbieter das kann. */
  egressAllowlist: readonly string[];
}

export interface DevServerSpec {
  port: number;
  install: readonly string[];
  command: readonly string[];
}

export interface RuntimeHandle {
  provider: string;
  sandboxId: string;
  previewUrl: string;
}

export type RuntimeStatus = 'starting' | 'running' | 'stopped' | 'failed';

/** Grund für das Ende einer Sitzung — landet im Prüfpfad. */
export type StopReason = 'user' | 'closed' | 'timeout' | 'idle' | 'start_failed' | 'unsafe_url';

export type SessionState = 'reserved' | 'running' | 'stopped' | 'failed';

export interface PreviewSessionRecord {
  sessionId: string;
  tenantId: string;
  actorId: string;
  projectId: string;
  state: SessionState;
  provider: string;
  sandboxId: string | null;
  previewUrl: string | null;
  startedAt: number;
  lastSeenAt: number;
  hardDeadline: number;
  stoppedAt: number | null;
  stopReason: StopReason | null;
}

/** Verifizierte Identität. Kommt aus JWT + Membership, nie aus dem Body. */
export interface PreviewAuthz {
  authenticated: boolean;
  tenantId: string;
  actorId: string;
  /** `siteos.builder` serverseitig geprüft (gateFeature). */
  entitlementBuilder: boolean;
}

export type PreviewErrorCode =
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'ENTITLEMENT'
  | 'NOT_FOUND'
  | 'BAD_REQUEST'
  | 'CONCURRENCY_LIMIT'
  | 'DAILY_LIMIT'
  | 'PROVIDER_FAILED'
  | 'UNSAFE_PREVIEW_URL';

export interface PreviewError {
  ok: false;
  status: 400 | 401 | 403 | 404 | 429 | 502;
  code: PreviewErrorCode;
  message: string;
}

export interface PreviewSessionView {
  sessionId: string;
  state: SessionState;
  previewUrl: string | null;
  hardDeadline: number;
  stopReason: StopReason | null;
}
