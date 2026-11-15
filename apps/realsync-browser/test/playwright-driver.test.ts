// Echter Chromium-Lauf (headless), Antworten ohne Netz über `transport`.
// Start: node --test apps/realsync-browser/test/playwright-driver.test.ts
import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import type { Route } from 'playwright';
import { PlaywrightDriver } from '../src/playwright-driver.ts';
import {
  BrowserGuardian, EvidenceLog, generateHmacKey, MemoryEvidenceSink,
} from '../../../packages/browser-guardian/src/index.ts';
import type { EgressGuard, GuardianPolicy } from '../../../packages/browser-guardian/src/index.ts';

const DNS: Record<string, string[]> = {
  'shop.example.org': ['93.184.215.14'],
  'tracker.example.net': ['93.184.215.15'],
  'rebind.example.org': ['127.0.0.1'],
};

const BODIES: Record<string, { status?: number; headers?: Record<string, string>; body?: string }> = {
  'https://shop.example.org/': { body: '<title>Shop</title><h1>Öffnungszeiten 8–17 Uhr</h1><img src="http://127.0.0.1:9/p.png">' },
  'https://shop.example.org/weiter': { status: 302, headers: { location: 'https://tracker.example.net/' } },
  'https://shop.example.org/js': { body: '<title>JS</title><script>setTimeout(()=>{location.href="https://tracker.example.net/"},50)</script>' },
  'https://tracker.example.net/': { body: '<title>Tracker</title>' },
};

const served: string[] = [];
async function fakeNet(route: Route): Promise<void> {
  const url = route.request().url();
  served.push(url);
  const r = BODIES[url];
  if (!r) return route.fulfill({ status: 404, body: '' });
  return route.fulfill({ status: r.status ?? 200, headers: { 'content-type': 'text/html; charset=utf-8', ...r.headers }, body: r.body ?? '' });
}

const onlyShop: EgressGuard = { document: (u) => new URL(u).origin === 'https://shop.example.org' };

describe('PlaywrightDriver · Netzwächter', () => {
  let driver: PlaywrightDriver;
  before(async () => {
    driver = await PlaywrightDriver.launch({ resolveHost: async (h) => DNS[h] ?? [], transport: fakeNet });
  });
  after(async () => { await driver.close(); });

  it('lädt ein erlaubtes Ziel; Unterressource ins lokale Netz wird geblockt', async () => {
    const r = await driver.run({ type: 'navigate', url: 'https://shop.example.org/' }, onlyShop);
    assert.equal(r.ok, true, r.error ?? "");
    assert.equal(r.title, 'Shop');
    assert.ok((r.blocked_requests ?? 0) >= 1);
    assert.ok(!served.some((u) => u.includes('127.0.0.1')));
  });

  it('Host, der auf 127.0.0.1 auflöst, wird geblockt (DNS-Prüfung)', async () => {
    const r = await driver.run({ type: 'navigate', url: 'https://rebind.example.org/' }, { document: () => true });
    assert.equal(r.ok, false);
    assert.equal(r.error, 'DOCUMENT_BLOCKED');
  });

  it('Weiterleitung auf ein nicht geprüftes Ziel wird geblockt', async () => {
    const r = await driver.run({ type: 'navigate', url: 'https://shop.example.org/weiter' }, onlyShop);
    assert.equal(r.ok, false);
    assert.ok(!served.includes('https://tracker.example.net/'));
  });

  it('Seitenskript navigiert außerhalb einer Aktion ⇒ geblockt', async () => {
    await driver.run({ type: 'navigate', url: 'https://shop.example.org/js' }, onlyShop);
    await new Promise((r) => setTimeout(r, 300));
    const r = await driver.run({ type: 'wait', milliseconds: 10 }, onlyShop);
    // Blockierte Navigation ⇒ Fehlerseite (keine Seite) oder alte Seite, nie das fremde Ziel.
    assert.ok(r.url === null || r.url === 'https://shop.example.org/js', String(r.url));
    assert.ok(!served.includes('https://tracker.example.net/'));
  });
});

describe('Guardian + Chromium', () => {
  it('öffentliche Seite: navigieren und auslesen, Nachweis mit Richtlinienversion', async () => {
    const policy: GuardianPolicy = { policy_id: 'p', version: 'v-test', origins: [{ origin: 'https://shop.example.org', data_class: 'public' }] };
    const sink = new MemoryEvidenceSink();
    const driver = await PlaywrightDriver.launch({ resolveHost: async (h) => DNS[h] ?? [], transport: fakeNet });
    const g = new BrowserGuardian({
      policy, driver, evidence: new EvidenceLog(sink), key: await generateHmacKey(),
      context: { tenant_id: 't', session_id: 's', actor_id: 'a', kill_switch: false },
    });
    try {
      assert.equal((await g.execute({ action: { type: 'navigate', url: 'https://shop.example.org/' }, source: 'user', channel: 'cli' })).status, 'executed');
      const ex = await g.execute({ action: { type: 'extract' }, source: 'user', channel: 'cli' });
      assert.equal(ex.status, 'executed');
      assert.match(ex.result?.text ?? '', /Öffnungszeiten/);
      assert.equal((await g.execute({ action: { type: 'navigate', url: 'https://tracker.example.net/' }, source: 'user', channel: 'cli' })).status, 'approval_required');
      assert.ok(sink.entries.every((e) => e.record.policy_version === 'v-test' && e.record.executor === 'playwright'));
    } finally {
      await g.close();
    }
  });
});

describe('Egress-Proxy · echte Verbindungen', () => {
  // Nachstellung von Befund C1: öffentliches Ziel leitet ins lokale Netz weiter.
  it('Weiterleitung ins lokale Netz wird am Proxy geblockt (Route allein reicht nicht)', async () => {
    const http = await import('node:http');
    const net = await import('node:net');
    const hits: string[] = [];
    const srv = http.createServer((req, res) => {
      hits.push(req.url ?? '');
      if (req.url === '/start') {
        res.writeHead(302, { location: `http://127.0.0.1:${(srv.address() as { port: number }).port}/internal-secret` });
        return res.end();
      }
      if (req.url === '/start2') { res.writeHead(302, { location: 'http://rebind.example.org/internal-secret' }); return res.end(); }
      res.writeHead(200, { 'content-type': 'text/html' });
      res.end('<title>INTERNAL</title>');
    });
    await new Promise<void>((r) => srv.listen(0, '127.0.0.1', r));
    const port = (srv.address() as { port: number }).port;
    const driver = await PlaywrightDriver.launch({
      resolveHost: async (h) => (h === 'public.test' ? ['203.0.113.10'] : DNS[h] ?? []),
      dial: (address) => {
        assert.equal(address, '203.0.113.10', 'Proxy verbindet nur zur geprüften Adresse');
        return net.connect({ host: '127.0.0.1', port });
      },
    });
    const any: EgressGuard = { document: () => true };
    try {
      const r1 = await driver.run({ type: 'navigate', url: 'http://public.test/start' }, any);
      const r2 = await driver.run({ type: 'navigate', url: 'http://public.test/start2' }, any);
      assert.equal(r1.ok, false);
      assert.equal(r1.error, 'DOCUMENT_BLOCKED');
      assert.equal(r2.ok, false);
      assert.deepEqual(hits, ['/start', '/start2']);
    } finally {
      await driver.close();
      srv.close();
    }
  });
});
