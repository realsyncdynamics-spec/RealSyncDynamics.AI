import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

/**
 * Governed Browser Executor — Quelltext-Vertrag (ergänzt die Verhaltenstests in
 * test/browser-runtime/*, test/executor/* und test/runtime/db/browser-runtime-sessions).
 * Stand 2026-10-01: serverseitige Sessions, Policy-Gate, Einmal-Einlösung über
 * browser_executions (#1728), gekettete Evidence, Egress-Proxy + Landeprüfung.
 */
const productionScanner = readFileSync('deploy/playwright-scanner/server.ts', 'utf8');
const productionExecutor = readFileSync('deploy/playwright-scanner/executor.ts', 'utf8');
const sessionCore = readFileSync('deploy/playwright-scanner/session-core.ts', 'utf8');
const netguard = readFileSync('deploy/playwright-scanner/netguard.ts', 'utf8');
const egressProxy = readFileSync('deploy/playwright-scanner/egress-proxy.ts', 'utf8');
const edge = readFileSync('supabase/functions/browser-execute/index.ts', 'utf8');
const handler = readFileSync('supabase/functions/browser-execute/handler.ts', 'utf8');
const repo = readFileSync('supabase/functions/browser-execute/repo.ts', 'utf8');
const executorClient = readFileSync('supabase/functions/_shared/browser-runtime/executor.ts', 'utf8');
const chainRepo = readFileSync('supabase/functions/_shared/evidence-chain-repo.ts', 'utf8');
const actions = readFileSync('supabase/functions/_shared/browser-runtime/actions.ts', 'utf8');
const client = readFileSync('src/features/governance/browser/browserExecutorClient.ts', 'utf8');
const productionRegistry = readFileSync('src/config/production-edge-functions.ts', 'utf8');

describe('governed browser executor contract', () => {
  it('keeps production browser execution behind the scanner secret', () => {
    expect(productionScanner).toContain("path === '/execute'");
    expect(productionScanner).toContain("path === '/session/open'");
    expect(productionScanner).toContain("path === '/session/frame'");
    expect(productionScanner).toContain('SCANNER_API_KEY');
    expect(productionScanner).toContain('timingSafeEqual');
    expect(sessionCore).toContain('maxActions: 25');
    expect(sessionCore).toContain("context.route('**/*', (route) => s.routeGuard(route))");
    expect(sessionCore).toContain("serviceWorkers: 'block'");
    expect(productionExecutor).toContain('GuardedSession.open(context');
    expect(netguard).toContain('PRIVATE_NETWORK_BLOCKED');
  });

  it('routes all browser traffic through the DNS-pinned egress proxy (redirect hops included)', () => {
    expect(productionScanner).toContain('proxy: { server: egress.url }');
    expect(productionScanner).toContain('--force-webrtc-ip-handling-policy=disable_non_proxied_udp');
    expect(egressProxy).toContain("server.listen(0, '127.0.0.1'");
    expect(egressProxy).toContain('guard.pin(');
    // Laufzeitneutraler Kern: kein System-DNS im geteilten Netz-Schutz.
    expect(netguard).not.toMatch(/from 'node:/);
    expect(sessionCore).not.toMatch(/from 'node:/);
  });

  it('binds approvals to the live page and resets blocked landings before frames leave', () => {
    expect(sessionCore).toContain("new ExecutorError('PAGE_CHANGED', 409");
    expect(sessionCore).toContain("'LANDED_ON_BLOCKED_URL'");
    expect(executorClient).toContain('expected_url: opts.expectedUrl');
    expect(handler).toContain('expectedUrl: executionId ? session.current_url : null');
    // Fehler nur als Codes: keine Playwright-Meldung im Ergebnis.
    expect(sessionCore).toContain('export function errorCode(error: unknown): string');
    expect(sessionCore).not.toMatch(/error:\s*code\.slice|error instanceof Error \? error\.message/);
    expect(productionScanner).not.toMatch(/console\.error\([^)]*err(or)?\.message/);
  });

  it('requires real user + tenant membership before executor access', () => {
    expect(edge).toContain('requireUser(req)');
    expect(edge).toContain(".from('memberships')");
    expect(edge.indexOf('async resolveActor')).toBeLessThan(edge.indexOf('repo: (actor)'));
    expect(handler.indexOf('deps.resolveActor(req')).toBeLessThan(handler.indexOf("switch (op)"));
    for (const code of ['APPROVAL_REQUIRED', 'APPROVAL_MISMATCH', 'APPROVAL_ALREADY_USED', 'APPROVAL_EXPIRED']) {
      expect(handler).toContain(code);
    }
    expect(actions).toContain("'click', 'type', 'select', 'submit', 'upload'");
  });

  it('does not persist typed values or inline screenshots as governance evidence', () => {
    expect(actions).toContain('[redacted:');
    expect(actions).toContain('browser:v2:');
    expect(handler).toContain('redactAction(recordAction)');
    // Abgelehnte Roh-URLs nur ohne Zugangsdaten/Query/Fragment (recordableUrl).
    expect(handler).toContain('recordableUrl(action.url)');
    // Evidence enthält nur Hashes der Artefakte, nie Bild- oder Textinhalt.
    expect(handler).toContain("artifacts.push({ kind: 'frame', sha256: execution.frame.sha256");
    expect(handler).toContain("artifacts.push({ kind: 'text', sha256: textSha");
    // Evidence nur über die gekettete RPC, nie per Direkt-Insert.
    expect(chainRepo).toContain("rpc('append_governance_evidence'");
    for (const src of [handler, repo, chainRepo]) {
      expect(src).not.toMatch(/from\('governance_evidence'\)\s*\.insert/);
    }
  });

  describe('approval is consumed exactly once (reservation before executor, #1728)', () => {
    const act = handler.slice(handler.indexOf('async function act('));
    const reserveAt = act.indexOf('repo.reserveExecution(');
    const executorAt = act.indexOf('deps.executor.execute(');
    const finishExecutedAt = act.indexOf("finish('executed', null)");
    const okAt = act.indexOf('return ok({\n      decision: policySummary');
    const migration = readFileSync(
      'supabase/migrations/20260930190000_browser_execution_reservations.sql',
      'utf8',
    );

    it('reserves atomically in the database before calling the executor', () => {
      expect(repo).toContain("rpc('reserve_browser_execution'");
      expect(reserveAt).toBeGreaterThan(-1);
      expect(executorAt).toBeGreaterThan(-1);
      expect(reserveAt).toBeLessThan(executorAt);
    });

    it('has no second consumption mechanism next to browser_executions', () => {
      for (const src of [handler, repo]) {
        expect(src).not.toContain('consume_browser_approval');
        expect(src).not.toContain('consumed_at');
        expect(src).not.toContain('browser_approval_bindings');
      }
    });

    it('bounds the executor call and records every terminal state', () => {
      expect(executorClient).toContain('new AbortController()');
      expect(handler).toContain("'executor_failed'");
      expect(handler).toContain("'executed_unrecorded'");
      expect(repo).toContain("rpc('finish_browser_execution'");
      // ok erst, nachdem der Abschluss 'executed' geschrieben ist.
      expect(finishExecutedAt).toBeGreaterThan(-1);
      expect(okAt).toBeGreaterThan(-1);
      expect(finishExecutedAt).toBeLessThan(okAt);
    });

    it('migration: once per approval, expiry by db clock, no automatic release', () => {
      expect(migration).toContain('UNIQUE (approval_id)');
      expect(migration).toContain('FOR UPDATE');
      expect(migration).toContain('expires_at <= now()');
      expect(migration).toContain("AND status = 'reserved'");
      expect(migration).toMatch(/REVOKE ALL\s+ON FUNCTION public\.reserve_browser_execution\(uuid, uuid, text\) FROM PUBLIC, anon, authenticated/);
      expect(migration).toMatch(/REVOKE ALL ON TABLE public\.browser_executions FROM PUBLIC, anon, authenticated/);
      // Kein Weg zurück nach 'reserved' und kein Löschen einer Reservierung.
      expect(migration).not.toMatch(/SET\s+status\s*=\s*'reserved'/i);
      expect(migration).not.toMatch(/DELETE\s+FROM\s+public\.browser_executions/i);
    });
  });

  it('keeps the browser client on the user JWT path and exposes a health probe', () => {
    expect(client).toContain('session.access_token');
    expect(client).toContain('/functions/v1/browser-execute');
    expect(client).toContain("op: 'health'");
    expect(client).toContain("op: 'capabilities'");
    expect(client).not.toContain('service_role');
    expect(client).not.toContain('localStorage');
  });

  it('records browser-execute as measured production state', () => {
    expect(productionRegistry).toContain("'browser-execute'");
    // browser-execute kam mit der Messung 191 dazu. Der Zähler darf danach
    // nur steigen — jeder weitere Deploy hebt ihn an. Ein exakter Literal-
    // Vergleich (`= 191`) brach deshalb bei der nächsten Neumessung
    // (local-ai-runtime, 192), ohne dass sich an browser-execute etwas änderte.
    const observed = productionRegistry.match(/EDGE_FUNCTIONS_OBSERVED_MAX = (\d+)/);
    expect(observed).not.toBeNull();
    expect(Number(observed![1])).toBeGreaterThanOrEqual(191);
    expect(productionRegistry).not.toContain("{ slug: 'browser-execute'");
  });
});
