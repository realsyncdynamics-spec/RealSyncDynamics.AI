// @vitest-environment node
/**
 * session-core OHNE Egress-Proxy — der Pfad des Cloudflare-Executors
 * (Browser Run lässt keinen Proxy zu), gegen echtes Chromium.
 *
 * Simuliert werden die zwei Lücken, die nur dort offen sind:
 *   A) DNS-Rebinding: Der HostGuard (DoH) sieht eine öffentliche Adresse,
 *      Chromium verbindet zu 127.0.0.1 (--host-resolver-rules).
 *   B) Redirect-Hop in einem iframe auf ein privates Ziel (der Route-Guard
 *      sieht Redirect-Hops nicht).
 * Zusage: Die Anfrage kann das Ziel erreichen (ohne Proxy nicht verhinderbar),
 * aber nichts davon — kein Text, kein DOM, kein Bild — verlässt den Executor:
 * verifyServerAddress sperrt die Session, die Landeprüfung setzt zurück.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createServer, type Server } from 'node:http';
import { existsSync } from 'node:fs';
import type { AddressInfo } from 'node:net';
import { chromium, type Browser } from 'playwright';
import { createHostGuard } from '../../deploy/playwright-scanner/netguard';
import { GuardedSession, contextOptions, ExecutorError } from '../../deploy/playwright-scanner/session-core';

const CHROMIUM = process.env.EXECUTOR_CHROMIUM_PATH
  ?? ['/opt/pw-browsers/chromium-1194/chrome-linux/chrome', '/opt/pw-browsers/chromium'].find((p) => existsSync(p))
  ?? null;
const RUN = CHROMIUM !== null && process.env.SKIP_EXECUTOR_IT !== '1';

let browser: Browser;
let publicSite: Server;
let secret: Server;
let publicPort = 0;
let secretPort = 0;
const secretHits: string[] = [];

function listen(server: Server): Promise<number> {
  return new Promise((ok) => server.listen(0, '127.0.0.1', () => ok((server.address() as AddressInfo).port)));
}

async function open(): Promise<GuardedSession> {
  // Nur der „öffentliche“ Fixture-Host ist freigegeben; rebind.test löst laut
  // Guard öffentlich auf, Chromium verbindet aber zu 127.0.0.1.
  const guard = createHostGuard([`127.0.0.1:${publicPort}`], async (host) => (host === 'rebind.test' ? ['93.184.216.34'] : []));
  const context = await browser.newContext(contextOptions(false));
  return GuardedSession.open(context, { guard, downloads: null, verifyServerAddress: true });
}

describe.skipIf(!RUN)('session-core ohne Proxy (Cloudflare-Pfad, echtes Chromium)', () => {
  beforeAll(async () => {
    secret = createServer((req, res) => {
      secretHits.push(req.url ?? '');
      res.writeHead(200, { 'content-type': 'text/html' });
      res.end('<!doctype html><title>INTERN</title><p>SECRET-INTERNAL-ADMIN-PANEL</p>');
    });
    secretPort = await listen(secret);
    publicSite = createServer((req, res) => {
      if (req.url === '/hop') {
        res.writeHead(302, { location: `http://127.0.0.1:${secretPort}/admin` });
        res.end();
        return;
      }
      res.writeHead(200, { 'content-type': 'text/html' });
      res.end('<!doctype html><title>Öffentlich</title><iframe src="/hop"></iframe>');
    });
    publicPort = await listen(publicSite);
    browser = await chromium.launch({
      executablePath: CHROMIUM!,
      args: ['--host-resolver-rules=MAP rebind.test 127.0.0.1'],
    });
  }, 60_000);

  afterAll(async () => {
    await browser?.close();
    await new Promise((r) => publicSite?.close(r));
    await new Promise((r) => secret?.close(r));
  });

  it('A) DNS-Rebinding: kein Text, kein DOM, kein Bild vom internen Dienst', async () => {
    const s = await open();
    const out = await s.execute({
      session_id: 'x'.repeat(20),
      actions: [{ type: 'navigate', url: `http://rebind.test:${secretPort}/` }],
      include_frame: true,
    });
    expect(out.results[0]).toMatchObject({ ok: false, error: 'LANDED_ON_BLOCKED_URL', url: 'about:blank' });
    expect(out.page.url).toBe('about:blank');
    expect(JSON.stringify(out)).not.toContain('SECRET-INTERNAL');
    // Danach ist die Session gesperrt: Lesen und Bild werden verweigert.
    await expect(s.execute({ session_id: 'x'.repeat(20), actions: [{ type: 'read_text' }] }))
      .rejects.toMatchObject({ code: 'LANDED_ON_BLOCKED_URL' });
    await expect(s.run(() => s.frame())).rejects.toBeInstanceOf(ExecutorError);
    await s.close();
  }, 60_000);

  it('B) Redirect-Hop in einem iframe: Seite zurückgesetzt, nichts davon im Ergebnis', async () => {
    const s = await open();
    const out = await s.execute({
      session_id: 'y'.repeat(20),
      actions: [{ type: 'navigate', url: `http://127.0.0.1:${publicPort}/` }],
      include_frame: true,
    });
    expect(out.results[0]).toMatchObject({ ok: false, error: 'LANDED_ON_BLOCKED_URL' });
    expect(out.page.url).toBe('about:blank');
    expect(JSON.stringify(out)).not.toContain('SECRET-INTERNAL');
    await s.close();
  }, 60_000);
});

describe.runIf(!RUN)('session-core ohne Proxy (übersprungen)', () => {
  it('kein startbares Chromium gefunden — EXECUTOR_CHROMIUM_PATH setzen', () => {
    expect(RUN).toBe(false);
  });
});
