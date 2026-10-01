// Governed Browser Executor auf Cloudflare Browser Run — Einstiegspunkt.
//
// Ersetzt den Executor-Container (deploy/playwright-scanner) als Host, mit
// demselben HTTP-Vertrag und demselben Aktions-/Sicherheitskern
// (deploy/playwright-scanner/session-core.ts). Entscheidet nichts über
// Governance: Identität, Mandant, Policy, Freigabe und Evidence bleiben in
// der Edge Function browser-execute.
//
// Nur diese Datei kennt @cloudflare/playwright und die echten Bindungen;
// router.ts / session-object.ts / health.ts sind mit Fakes getestet
// (test/workers/browser-run-executor.test.ts).

import { connect, launch, limits } from '@cloudflare/playwright';
import type { BrowserContext } from 'playwright';
import { createDohResolver, createHostGuard, parseAllowlist } from '../../../deploy/playwright-scanner/netguard.js';
import { GuardedSession } from '../../../deploy/playwright-scanner/session-core.js';
import { BROWSER_KEEP_ALIVE_MS, maxSessions, type Env, type StorageLike } from './env.js';
import type { BrowserRunLimits } from './health.js';
import { createRouter } from './router.js';
import { ExecutorSessionCore, type BrowserLike, type BrowserRunPort } from './session-object.js';

// Nur Ereignisart und Codes, nie URLs, Selektoren oder Eingaben.
function log(event: Record<string, unknown>): void {
  console.log(JSON.stringify({ scope: 'browser-run-executor', ...event }));
}

function browserRun(env: Env): BrowserRunPort {
  return {
    // Typen aus @cloudflare/playwright und playwright sind strukturell gleich,
    // aber verschiedene Deklarationen — die Grenze liegt hier, einmal.
    launch: async () => (await launch(env.BROWSER, { keep_alive: BROWSER_KEEP_ALIVE_MS })) as unknown as BrowserLike,
    connect: async (id) => (await connect(env.BROWSER, id)) as unknown as BrowserLike,
    limits: async () => (await limits(env.BROWSER)) as BrowserRunLimits,
  };
}

const router = createRouter({ limits: (env) => browserRun(env).limits(), log });

export default {
  fetch(request: Request, env: Env): Promise<Response> {
    return router(request, env);
  },
};

interface DurableObjectStateLike {
  storage: StorageLike;
}

export class ExecutorSession {
  private readonly core: ExecutorSessionCore;

  constructor(state: DurableObjectStateLike, env: Env) {
    // DNS-genaue Host-Prüfung über DNS-over-HTTPS (kein System-DNS in Workers).
    const guard = createHostGuard(parseAllowlist(env.EXECUTOR_PRIVATE_HOST_ALLOWLIST), createDohResolver((input, init) => fetch(input, init)));
    this.core = new ExecutorSessionCore({
      storage: state.storage,
      browserRun: browserRun(env),
      sessions: {
        open: (context) => GuardedSession.open(context as BrowserContext, { guard, downloads: null, log }),
      },
      maxSessions: maxSessions(env),
      log,
    });
  }

  fetch(request: Request): Promise<Response> {
    return this.core.fetch(request);
  }

  alarm(): Promise<void> {
    return this.core.alarm();
  }
}
