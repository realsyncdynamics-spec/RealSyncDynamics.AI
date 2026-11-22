// Sitzungsverwaltung für die Laufzeit-Vorschau (Spike).
//
// Reihenfolge bei jedem Start — nicht umstellen:
//   1. Autorisierung (Session, verifizierter Mandant, siteos.builder)
//   2. Dateiprüfung (files.ts)
//   3. abgelaufene Sitzungen beenden (sweep)
//   4. atomare Limit-Reservierung (limits.ts) — ohne Erfolg KEIN Anbieteraufruf
//   5. Anbieter-Start mit leerer Umgebung und hartem Zeitlimit
//   6. Vorschau-URL prüfen: https, fremde Origin (nicht App-Host oder Subdomain)
//
// Mandantentrennung: Jede Operation lädt die Sitzung und vergleicht deren
// tenantId mit dem verifizierten Mandanten. Fremde Sitzungen sind NOT_FOUND —
// ihre Existenz wird nicht verraten. Der Browser sieht nie sandboxId oder
// tenantId, nur sessionId und die Vorschau-URL der eigenen Sitzung.

import { DEV_SERVER, EGRESS_ALLOWLIST, checkProjectFiles, checkViteProject } from './files.ts';
import { PREVIEW_LIMITS, type PreviewLimits, type PreviewStore } from './limits.ts';
import type {
  PreviewAuthz,
  PreviewError,
  PreviewRuntime,
  PreviewSessionRecord,
  PreviewSessionView,
  RuntimeHandle,
  RuntimeStatus,
  StopReason,
} from './types.ts';

export interface ManagerDeps {
  runtime: PreviewRuntime;
  store: PreviewStore;
  /** Hosts der App (z. B. realsyncdynamicsai.de). Vorschau darf dort nie liegen. */
  appHosts: readonly string[];
  limits?: PreviewLimits;
  now?: () => number;
  randomId?: () => string;
}

export type Ok<T> = { ok: true } & T;

function err(status: PreviewError['status'], code: PreviewError['code'], message: string): PreviewError {
  return { ok: false, status, code, message };
}

export function defaultRandomId(): string {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  return [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('');
}

export function isForeignHttpsUrl(url: string, appHosts: readonly string[]): boolean {
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    return false;
  }
  if (u.protocol !== 'https:') return false;
  if (u.username || u.password) return false;
  const host = u.hostname.toLowerCase();
  for (const raw of appHosts) {
    const app = raw.toLowerCase();
    if (host === app || host.endsWith(`.${app}`)) return false;
  }
  return true;
}

function view(r: PreviewSessionRecord): PreviewSessionView {
  return {
    sessionId: r.sessionId,
    state: r.state,
    previewUrl: r.state === 'running' ? r.previewUrl : null,
    hardDeadline: r.hardDeadline,
    stopReason: r.stopReason,
  };
}

function handleOf(r: PreviewSessionRecord): RuntimeHandle | null {
  return r.sandboxId && r.previewUrl
    ? { provider: r.provider, sandboxId: r.sandboxId, previewUrl: r.previewUrl }
    : null;
}

export class PreviewSessionManager {
  private readonly runtime: PreviewRuntime;
  private readonly store: PreviewStore;
  private readonly appHosts: readonly string[];
  private readonly limits: PreviewLimits;
  private readonly now: () => number;
  private readonly randomId: () => string;

  constructor(deps: ManagerDeps) {
    if (!deps.appHosts.length) throw new Error('appHosts required (fail-closed)');
    this.runtime = deps.runtime;
    this.store = deps.store;
    this.appHosts = deps.appHosts;
    this.limits = deps.limits ?? PREVIEW_LIMITS;
    this.now = deps.now ?? (() => Date.now());
    this.randomId = deps.randomId ?? defaultRandomId;
  }

  private authorize(authz: PreviewAuthz): PreviewError | null {
    if (!authz.authenticated || !authz.actorId) return err(401, 'UNAUTHORIZED', 'missing session');
    if (!authz.tenantId) return err(403, 'FORBIDDEN', 'no verified tenant');
    if (!authz.entitlementBuilder) return err(403, 'ENTITLEMENT', 'feature siteos.builder is not available');
    return null;
  }

  private async owned(authz: PreviewAuthz, sessionId: unknown): Promise<PreviewSessionRecord | PreviewError> {
    const denied = this.authorize(authz);
    if (denied) return denied;
    if (typeof sessionId !== 'string' || !sessionId) return err(400, 'BAD_REQUEST', 'session_id required');
    const r = await this.store.get(sessionId);
    if (!r || r.tenantId !== authz.tenantId) return err(404, 'NOT_FOUND', 'preview session not found');
    return r;
  }

  async start(
    authz: PreviewAuthz,
    input: { projectId: unknown; files: Record<string, unknown> },
  ): Promise<Ok<{ session: PreviewSessionView }> | PreviewError> {
    const denied = this.authorize(authz);
    if (denied) return denied;
    if (typeof input.projectId !== 'string' || !input.projectId) {
      return err(400, 'BAD_REQUEST', 'project_id required');
    }
    const checked = checkProjectFiles(input.files);
    if (!checked.ok) return err(400, 'BAD_REQUEST', checked.message);
    const vite = checkViteProject(checked.files);
    if (!vite.ok) return err(400, 'BAD_REQUEST', vite.message);

    await this.sweep();

    const reserved = await this.store.reserve({
      sessionId: this.randomId(),
      tenantId: authz.tenantId,
      actorId: authz.actorId,
      projectId: input.projectId,
      provider: this.runtime.provider,
      now: this.now(),
      limits: this.limits,
    });
    if (!reserved.ok) return err(429, reserved.code, reserved.message);
    const rec = reserved.record;

    let handle: RuntimeHandle;
    try {
      handle = await this.runtime.start({
        sandboxKey: this.randomId(),
        previewToken: this.randomId(),
        files: checked.files,
        devServer: DEV_SERVER,
        hardTimeoutMs: Math.max(0, rec.hardDeadline - this.now()),
        env: {},
        egressAllowlist: EGRESS_ALLOWLIST,
      });
    } catch {
      await this.store.finish(rec.sessionId, 'failed', 'start_failed', this.now());
      return err(502, 'PROVIDER_FAILED', 'sandbox could not be started');
    }

    if (!isForeignHttpsUrl(handle.previewUrl, this.appHosts)) {
      await this.safeStop(handle);
      await this.store.finish(rec.sessionId, 'failed', 'unsafe_url', this.now());
      return err(502, 'UNSAFE_PREVIEW_URL', 'preview must be served from a foreign https origin');
    }

    // Während des Starts kann der Sweep die Reservierung beendet haben.
    const still = await this.store.get(rec.sessionId);
    if (!still || (still.state !== 'reserved' && still.state !== 'running')) {
      await this.safeStop(handle);
      return err(502, 'PROVIDER_FAILED', 'session ended during start');
    }
    await this.store.markRunning(rec.sessionId, handle.sandboxId, handle.previewUrl);
    const running = await this.store.get(rec.sessionId);
    return { ok: true, session: view(running ?? still) };
  }

  /** Browser meldet sich alle HEARTBEAT_INTERVAL_MS. Fehlt das, greift idleStopMs. */
  async heartbeat(authz: PreviewAuthz, sessionId: unknown): Promise<Ok<{ session: PreviewSessionView }> | PreviewError> {
    const r = await this.owned(authz, sessionId);
    if ('ok' in r) return r;
    if (r.state === 'reserved' || r.state === 'running') {
      if (this.now() >= r.hardDeadline) {
        await this.end(r, 'timeout');
      } else {
        await this.store.touch(r.sessionId, this.now());
      }
    }
    const fresh = await this.store.get(r.sessionId);
    return { ok: true, session: view(fresh ?? r) };
  }

  async status(
    authz: PreviewAuthz,
    sessionId: unknown,
  ): Promise<Ok<{ session: PreviewSessionView; runtime: RuntimeStatus | null }> | PreviewError> {
    const r = await this.owned(authz, sessionId);
    if ('ok' in r) return r;
    const h = handleOf(r);
    let runtime: RuntimeStatus | null = null;
    if (h && r.state === 'running') {
      try {
        runtime = await this.runtime.status(h);
      } catch {
        runtime = 'failed';
      }
    }
    return { ok: true, session: view(r), runtime };
  }

  async writeFiles(
    authz: PreviewAuthz,
    sessionId: unknown,
    files: Record<string, unknown>,
  ): Promise<Ok<{ written: number }> | PreviewError> {
    const r = await this.owned(authz, sessionId);
    if ('ok' in r) return r;
    const h = handleOf(r);
    if (r.state !== 'running' || !h) return err(400, 'BAD_REQUEST', 'preview session is not running');
    const checked = checkProjectFiles(files);
    if (!checked.ok) return err(400, 'BAD_REQUEST', checked.message);
    try {
      await this.runtime.writeFiles(h, checked.files);
    } catch {
      return err(502, 'PROVIDER_FAILED', 'files could not be written');
    }
    await this.store.touch(r.sessionId, this.now());
    return { ok: true, written: checked.files.length };
  }

  async stop(
    authz: PreviewAuthz,
    sessionId: unknown,
    reason: 'user' | 'closed' = 'user',
  ): Promise<Ok<{ session: PreviewSessionView }> | PreviewError> {
    const r = await this.owned(authz, sessionId);
    if ('ok' in r) return r;
    await this.end(r, reason);
    const fresh = await this.store.get(r.sessionId);
    return { ok: true, session: view(fresh ?? r) };
  }

  /** Beendet Sitzungen nach Zeitlimit oder ohne Heartbeat. Liefert die Anzahl. */
  async sweep(): Promise<number> {
    const now = this.now();
    let n = 0;
    for (const r of await this.store.listActive()) {
      if (now >= r.hardDeadline) {
        await this.end(r, 'timeout');
        n++;
      } else if (now - r.lastSeenAt >= this.limits.idleStopMs) {
        await this.end(r, 'idle');
        n++;
      }
    }
    return n;
  }

  private async end(r: PreviewSessionRecord, reason: StopReason): Promise<void> {
    if (r.state !== 'reserved' && r.state !== 'running') return;
    const h = handleOf(r);
    if (h) await this.safeStop(h);
    await this.store.finish(r.sessionId, 'stopped', reason, this.now());
  }

  private async safeStop(h: RuntimeHandle): Promise<void> {
    try {
      await this.runtime.stop(h);
    } catch {
      // stop() darf nicht werfen; falls doch, setzt das anbieterseitige
      // Zeitlimit (hardTimeoutMs) die zweite Grenze.
    }
  }
}
