/**
 * Local AI Onboarding — Typen und Statusmodell.
 *
 * Die lokale KI läuft auf dem Gerät des Nutzers (Ollama). RealSyncDynamics
 * prüft nur Verbindung, Modell und Governance-Fähigkeit. Nichts in diesem
 * Modul behauptet, dass eine produktive Automatisierung aktiv ist.
 */

/** Einheitlicher Status je Onboarding-Schritt. */
export type StepStatus = 'pending' | 'checking' | 'success' | 'warning' | 'failed';

export type OnboardingStepId =
  | 'install'
  | 'connection'
  | 'role'
  | 'governance_test'
  | 'profile'
  | 'loop';

/** Rollen statt Modell-Liste zuerst. */
export type LocalAiRoleId = 'governance' | 'coding' | 'vision' | 'persistent';

export interface LocalAiRole {
  id: LocalAiRoleId;
  label: string;
  description: string;
  recommendedModel: string;
  /** Rolle darf erst nach bestandenem Basis-Governance-Test gewählt werden. */
  requiresPassedBaseTest: boolean;
}

/**
 * Fehlercodes des Runtime-Clients. Jeder Fehler ist fail-closed: ohne
 * eindeutigen Erfolg wird kein Schritt als bestanden markiert.
 */
export type LocalAiErrorCode =
  | 'INVALID_URL'
  | 'URL_CREDENTIALS_NOT_ALLOWED'
  | 'NON_LOCAL_HOST'
  | 'MIXED_CONTENT_BLOCKED'
  | 'RUNTIME_UNREACHABLE'
  | 'CORS_BLOCKED'
  | 'TIMEOUT'
  | 'RUNTIME_HTTP_ERROR'
  | 'NOT_OLLAMA'
  | 'NO_MODELS'
  | 'MODEL_NOT_INSTALLED'
  | 'EMPTY_RESPONSE';

export interface LocalAiError {
  code: LocalAiErrorCode;
  message: string;
  /** Konkreter nächster Schritt für den Nutzer, falls sinnvoll. */
  hint?: string;
}

export type LocalAiResult<T> = { ok: true; data: T } | { ok: false; error: LocalAiError };

export interface RuntimeProbe {
  runtimeUrl: string;
  models: string[];
  latencyMs: number;
  checkedAt: string;
}

/** Ergebnis-Kategorie aus UX-Sicht (Schritt 2). */
export type ConnectionOutcome =
  | 'reachable'
  | 'unreachable'
  | 'blocked'
  | 'no_models'
  | 'invalid';

export type GovernanceCheckId =
  | 'json_valid'
  | 'no_fabricated_source'
  | 'risk_present'
  | 'recommendation_present';

export interface GovernanceCheck {
  id: GovernanceCheckId;
  label: string;
  status: Extract<StepStatus, 'success' | 'warning' | 'failed'>;
  detail: string;
}

export interface GovernanceTestResult {
  overall: Extract<StepStatus, 'success' | 'warning' | 'failed'>;
  model: string;
  checks: GovernanceCheck[];
  /** Rohausgabe des Modells — wird im UI sichtbar angezeigt. */
  rawOutput: string;
  durationMs: number;
  ranAt: string;
}

/** Kompakte Form, die im Profil gespeichert wird (ohne Rohausgabe). */
export interface GovernanceTestSummary {
  overall: GovernanceTestResult['overall'];
  model: string;
  checks: Array<Pick<GovernanceCheck, 'id' | 'status'>>;
  ranAt: string;
}

/**
 * Lokales Runtime-Profil. Bewusst **ohne** tenant_id: der Mandant ergibt
 * sich ausschließlich aus dem serverseitig verifizierten Kontext, nie aus
 * gespeicherten Daten.
 */
export interface LocalAiRuntimeProfile {
  schema_version: 1;
  scope: 'device_local';
  profile_name: string;
  runtime_url: string;
  model: string;
  role: LocalAiRoleId;
  last_healthcheck: string | null;
  test_result: GovernanceTestSummary | null;
  enabled: boolean;
}

export interface HealthLoopSnapshot {
  checkedAt: string;
  runtimeReachable: boolean;
  modelReachable: boolean;
  latencyMs: number | null;
  errorCode: LocalAiErrorCode | null;
}
