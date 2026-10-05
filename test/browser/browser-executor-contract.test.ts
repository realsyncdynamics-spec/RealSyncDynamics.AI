import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const productionScanner = readFileSync('deploy/playwright-scanner/server.ts', 'utf8');
const productionExecutor = readFileSync('deploy/playwright-scanner/executor.ts', 'utf8');
const edge = readFileSync('supabase/functions/browser-execute/index.ts', 'utf8');
const client = readFileSync('src/features/governance/browser/browserExecutorClient.ts', 'utf8');
const productionRegistry = readFileSync('src/config/production-edge-functions.ts', 'utf8');

describe('governed browser executor contract', () => {
  it('keeps production browser execution behind the scanner secret and /execute', () => {
    expect(productionScanner).toContain("url === '/execute'");
    expect(productionScanner).toContain('SCANNER_API_KEY');
    expect(productionScanner).toContain('executeBrowserActions');
    expect(productionExecutor).toContain('PRIVATE_NETWORK_BLOCKED');
    expect(productionExecutor).toContain('MAX_ACTIONS = 25');
    expect(productionExecutor).toContain("context.route('**/*', routeGuard)");
  });

  it('requires real user + tenant membership before executor access', () => {
    expect(edge).toContain('requireAuthAndTenant');
    expect(edge.indexOf('requireAuthAndTenant')).toBeLessThan(edge.indexOf("PLAYWRIGHT_SCANNER_URL"));
    expect(edge).toContain('APPROVAL_REQUIRED');
    expect(edge).toContain('APPROVAL_MISMATCH');
    expect(edge).toContain('APPROVAL_ALREADY_USED');
    expect(edge).toContain("MUTATING_ACTIONS");
    expect(edge).toContain("'click', 'type', 'select'");
  });

  it('does not persist typed values or inline screenshots as governance evidence', () => {
    expect(edge).toContain('redactActions');
    expect(edge).toContain('[redacted:');
    expect(edge).toContain('sanitizeExecutorPayload');
    expect(edge).toContain("key === 'screenshot_base64'");
    expect(edge).toContain("persisted_inline: false");
    expect(edge).toContain("browser:v1:");
    expect(edge).toContain("rpc('append_governance_evidence'");
    expect(edge).toContain('evidenceContentHash(snapshot)');
    expect(edge).toContain('EVIDENCE_HASH_METHOD');
    expect(edge).not.toMatch(/from\('governance_evidence'\)\.insert/);
    expect(edge).toContain("EVIDENCE_WRITE_FAILED");
  });

  describe('approval is consumed exactly once (reservation before executor)', () => {
    // Reihenfolge-Zusicherungen gelten dem Handler-Rumpf: die Hilfsfunktionen
    // stehen oberhalb von Deno.serve, ein Vergleich über die ganze Datei
    // träfe ihre Definition und wäre leer wahr.
    const handler = edge.slice(edge.indexOf('Deno.serve('));
    const reserveAt = handler.indexOf('reserveExecution(auth.admin');
    const executorAt = handler.indexOf('fetch(`${scannerBase}/execute`');
    const okAt = handler.indexOf('ok: true,\n    session_id');
    const finishExecutedAt = handler.indexOf("finishExecution(auth.admin, executionId, 'executed')");
    const migration = readFileSync(
      'supabase/migrations/20260930190000_browser_execution_reservations.sql',
      'utf8',
    );

    it('reserves atomically in the database before calling the executor', () => {
      expect(edge).toContain("rpc('reserve_browser_execution'");
      expect(reserveAt).toBeGreaterThan(-1);
      expect(executorAt).toBeGreaterThan(-1);
      expect(reserveAt).toBeLessThan(executorAt);
    });

    it('no longer treats a later evidence row as the consumption marker', () => {
      expect(handler).not.toMatch(/contains\('metadata'/);
      expect(handler).not.toMatch(/from\('governance_approvals'\)\s*\.select/);
    });

    it('bounds the executor call and records every terminal state', () => {
      expect(edge).toContain('new AbortController()');
      expect(handler).toContain('signal: abort.signal');
      expect(handler).toContain("'executor_failed'");
      expect(handler).toContain("'executed_unrecorded'");
      expect(edge).toContain("rpc('finish_browser_execution'");
      // ok erst, nachdem der Abschluss 'executed' geschrieben ist.
      expect(finishExecutedAt).toBeGreaterThan(-1);
      expect(okAt).toBeGreaterThan(-1);
      expect(finishExecutedAt).toBeLessThan(okAt);
      expect(edge).toContain('APPROVAL_EXPIRED');
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
    expect(client).not.toContain('service_role');
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
