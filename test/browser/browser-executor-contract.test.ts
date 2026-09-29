import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

/**
 * Governed Browser Executor — Quelltext-Vertrag (ergänzt die Verhaltenstests in
 * test/browser-runtime/*, test/executor/* und test/runtime/db/browser-runtime-sessions).
 * Stand 2026-09-29: serverseitige Sessions, Policy-Gate, atomare Freigaben.
 */
const productionScanner = readFileSync('deploy/playwright-scanner/server.ts', 'utf8');
const productionExecutor = readFileSync('deploy/playwright-scanner/executor.ts', 'utf8');
const netguard = readFileSync('deploy/playwright-scanner/netguard.ts', 'utf8');
const edge = readFileSync('supabase/functions/browser-execute/index.ts', 'utf8');
const handler = readFileSync('supabase/functions/browser-execute/handler.ts', 'utf8');
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
    expect(productionExecutor).toContain('maxActions: 25');
    expect(productionExecutor).toContain("context.route('**/*', (route) => this.routeGuard(route))");
    expect(productionExecutor).toContain("serviceWorkers: 'block'");
    expect(netguard).toContain('PRIVATE_NETWORK_BLOCKED');
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
    expect(handler).toContain('redactAction(action)');
    // Evidence enthält nur Hashes der Artefakte, nie Bild- oder Textinhalt.
    expect(handler).toContain("artifacts.push({ kind: 'frame', sha256: execution.frame.sha256");
    expect(handler).toContain("artifacts.push({ kind: 'text', sha256: textSha");
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
