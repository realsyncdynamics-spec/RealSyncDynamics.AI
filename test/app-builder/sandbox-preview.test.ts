// Spike „React-Vorschau per Sandbox“ — Tests gegen den FAKE-Adapter.
// Nicht gegen einen echten Anbieter getestet.
import { describe, expect, it } from 'vitest';
import { PreviewSessionManager, isForeignHttpsUrl } from '../../supabase/functions/_shared/preview-sandbox/manager';
import { MemoryPreviewStore, PREVIEW_LIMITS, type PreviewLimits } from '../../supabase/functions/_shared/preview-sandbox/limits';
import { FakePreviewRuntime } from '../../supabase/functions/_shared/preview-sandbox/fake-runtime';
import { DEV_SERVER, checkProjectFiles } from '../../supabase/functions/_shared/preview-sandbox/files';
import type { PreviewAuthz } from '../../supabase/functions/_shared/preview-sandbox/types';

const A: PreviewAuthz = { authenticated: true, tenantId: 'tenant-a', actorId: 'user-a', entitlementBuilder: true };
const B: PreviewAuthz = { authenticated: true, tenantId: 'tenant-b', actorId: 'user-b', entitlementBuilder: true };
const C: PreviewAuthz = { authenticated: true, tenantId: 'tenant-c', actorId: 'user-c', entitlementBuilder: true };

/** Generiertes Vite+React-Projekt: mehrere Dateien, ein zusätzliches npm-Paket (clsx). */
function reactProject(title = 'Nordlicht Handwerk'): Record<string, string> {
  return {
    'package.json': JSON.stringify({
      name: 'preview-app',
      private: true,
      type: 'module',
      dependencies: { react: '^19.0.0', 'react-dom': '^19.0.0', clsx: '^2.1.1' },
      devDependencies: { vite: '^6.0.0', '@vitejs/plugin-react': '^4.3.4' },
    }),
    'vite.config.js': "import { defineConfig } from 'vite';\nimport react from '@vitejs/plugin-react';\nexport default defineConfig({ plugins: [react()] });\n",
    'index.html': `<!doctype html><html><head><title>${title}</title></head><body><div id="root"></div><script type="module" src="/src/main.jsx"></script></body></html>`,
    'src/main.jsx': "import { createRoot } from 'react-dom/client';\nimport App from './App.jsx';\ncreateRoot(document.getElementById('root')).render(<App />);\n",
    'src/App.jsx': "import Counter from './Counter.jsx';\nexport default function App() { return <main><h1>Anfrage</h1><Counter /></main>; }\n",
    'src/Counter.jsx': "import { useState } from 'react';\nimport clsx from 'clsx';\nexport default function Counter() { const [n, setN] = useState(0); return <button className={clsx('btn', n > 0 && 'on')} onClick={() => setN(n + 1)}>{n}</button>; }\n",
  };
}

function setup(opts: { limits?: Partial<PreviewLimits>; runtime?: FakePreviewRuntime } = {}) {
  const clock = { t: Date.UTC(2026, 10, 22, 12, 0, 0) };
  const runtime = opts.runtime ?? new FakePreviewRuntime();
  const store = new MemoryPreviewStore();
  let seq = 0;
  const manager = new PreviewSessionManager({
    runtime,
    store,
    appHosts: ['realsyncdynamicsai.de', 'localhost'],
    limits: { ...PREVIEW_LIMITS, ...opts.limits },
    now: () => clock.t,
    randomId: () => `id${String(++seq).padStart(4, '0')}${'x'.repeat(28)}`,
  });
  return { clock, runtime, store, manager };
}

async function startOk(m: PreviewSessionManager, who: PreviewAuthz, projectId = 'p1') {
  const res = await m.start(who, { projectId, files: reactProject() });
  if (!res.ok) throw new Error(`start failed: ${res.code} ${res.message}`);
  return res.session;
}

describe('Spike Sandbox-Vorschau — Start eines generierten React-Projekts (Fake)', () => {
  it('startet ein Vite+React-Projekt mit mehreren Dateien und einem npm-Paket', async () => {
    const { manager, runtime } = setup();
    const s = await startOk(manager, A);
    expect(s.state).toBe('running');
    expect(s.previewUrl).toMatch(/^https:\/\//);
    expect(isForeignHttpsUrl(s.previewUrl!, ['realsyncdynamicsai.de'])).toBe(true);

    const sb = runtime.running()[0];
    expect([...sb.files.keys()].sort()).toEqual(
      ['index.html', 'package.json', 'src/App.jsx', 'src/Counter.jsx', 'src/main.jsx', 'vite.config.js'],
    );
    expect(JSON.parse(sb.files.get('package.json')!).dependencies.clsx).toBe('^2.1.1');
    // Vorschau liefert das Projekt — nur mit passendem Token.
    expect(runtime.serve(s.previewUrl!).status).toBe(200);
    expect(runtime.serve(s.previewUrl!).body).toContain('Nordlicht Handwerk');
  });

  it('übergibt keine Secrets, nur Projektdateien und einen festen Startbefehl', async () => {
    const { manager, runtime } = setup();
    await startOk(manager, A);
    const input = runtime.running()[0].input;
    expect(input.env).toEqual({});
    expect(Object.keys(input).sort()).toEqual(
      ['devServer', 'egressAllowlist', 'env', 'files', 'hardTimeoutMs', 'previewToken', 'sandboxKey'],
    );
    expect(input.devServer).toEqual(DEV_SERVER);
    expect(input.devServer.install).toContain('--ignore-scripts');
    expect(input.egressAllowlist).toEqual(['registry.npmjs.org']);
    const blob = JSON.stringify(input);
    expect(blob).not.toMatch(/SERVICE_ROLE|SUPABASE_|API_KEY|tenant-a|user-a/);
    expect(input.hardTimeoutMs).toBe(PREVIEW_LIMITS.maxSessionMs);
  });
});

describe('Spike Sandbox-Vorschau — Kostenlimit', () => {
  it('weist den Start nach Erreichen der Tagesobergrenze ab (ohne Anbieteraufruf)', async () => {
    const { manager, runtime, clock } = setup({ limits: { maxSessionsPerTenantPerDay: 3 } });
    for (let i = 0; i < 3; i++) {
      const s = await startOk(manager, A);
      await manager.stop(A, s.sessionId);
    }
    const fourth = await manager.start(A, { projectId: 'p1', files: reactProject() });
    expect(fourth).toMatchObject({ ok: false, status: 429, code: 'DAILY_LIMIT' });
    expect(runtime.calls.start).toBe(3);
    // Anderer Mandant ist davon nicht betroffen.
    expect((await manager.start(B, { projectId: 'p9', files: reactProject() })).ok).toBe(true);
    // Neuer UTC-Tag → wieder erlaubt.
    clock.t += 24 * 60 * 60_000;
    expect((await manager.start(A, { projectId: 'p1', files: reactProject() })).ok).toBe(true);
  });

  it('parallele Starts eines Mandanten umgehen das Limit nicht', async () => {
    const runtime = new FakePreviewRuntime({ startDelayMs: 15 });
    const { manager } = setup({ runtime, limits: { maxConcurrentPerTenant: 1 } });
    const results = await Promise.all(
      Array.from({ length: 6 }, () => manager.start(A, { projectId: 'p1', files: reactProject() })),
    );
    expect(results.filter((r) => r.ok)).toHaveLength(1);
    const rejected = results.filter((r) => !r.ok);
    expect(rejected).toHaveLength(5);
    for (const r of rejected) expect(r).toMatchObject({ status: 429, code: 'CONCURRENCY_LIMIT' });
    expect(runtime.calls.start).toBe(1);
    expect(runtime.running()).toHaveLength(1);
  });

  it('parallele Starts verschiedener Mandanten halten die globale Obergrenze', async () => {
    const runtime = new FakePreviewRuntime({ startDelayMs: 15 });
    const { manager } = setup({ runtime, limits: { maxConcurrentGlobal: 2 } });
    const results = await Promise.all([A, B, C, A, B, C].map((who) => manager.start(who, { projectId: 'p', files: reactProject() })));
    expect(results.filter((r) => r.ok)).toHaveLength(2);
    expect(runtime.calls.start).toBe(2);
  });

  it('parallele Starts halten auch die Tagesobergrenze', async () => {
    const runtime = new FakePreviewRuntime({ startDelayMs: 10 });
    const { manager } = setup({ runtime, limits: { maxConcurrentPerTenant: 10, maxSessionsPerTenantPerDay: 2 } });
    const results = await Promise.all(Array.from({ length: 5 }, () => manager.start(A, { projectId: 'p', files: reactProject() })));
    expect(results.filter((r) => r.ok)).toHaveLength(2);
    expect(results.filter((r) => !r.ok && r.code === 'DAILY_LIMIT')).toHaveLength(3);
    expect(runtime.calls.start).toBe(2);
  });

  it('ein fehlgeschlagener Anbieterstart zählt zum Tageslimit und gibt den Platz frei', async () => {
    const runtime = new FakePreviewRuntime({ failStart: true });
    const { manager } = setup({ runtime, limits: { maxSessionsPerTenantPerDay: 2 } });
    expect(await manager.start(A, { projectId: 'p', files: reactProject() })).toMatchObject({ code: 'PROVIDER_FAILED' });
    expect(await manager.start(A, { projectId: 'p', files: reactProject() })).toMatchObject({ code: 'PROVIDER_FAILED' });
    expect(await manager.start(A, { projectId: 'p', files: reactProject() })).toMatchObject({ code: 'DAILY_LIMIT' });
    expect(runtime.calls.start).toBe(2);
  });

  it('Grenzen sind fest im Code und unveränderlich', () => {
    expect(Object.isFrozen(PREVIEW_LIMITS)).toBe(true);
    expect(PREVIEW_LIMITS).toEqual({
      maxSessionMs: 900_000,
      idleStopMs: 180_000,
      maxConcurrentPerTenant: 1,
      maxConcurrentGlobal: 10,
      maxSessionsPerTenantPerDay: 20,
    });
  });
});

describe('Spike Sandbox-Vorschau — Beenden', () => {
  it('beendet die Sandbox nach dem harten Zeitlimit', async () => {
    const { manager, runtime, clock } = setup();
    const s = await startOk(manager, A);
    // Heartbeats halten die Sitzung nicht über das Zeitlimit hinaus.
    for (let i = 0; i < 30; i++) {
      clock.t += 30_000;
      await manager.heartbeat(A, s.sessionId);
    }
    expect(clock.t).toBeGreaterThanOrEqual(s.hardDeadline);
    const st = await manager.status(A, s.sessionId);
    expect(st).toMatchObject({ ok: true, session: { state: 'stopped', stopReason: 'timeout', previewUrl: null } });
    expect(runtime.running()).toHaveLength(0);
    expect(runtime.serve(s.previewUrl!).status).toBe(404);
  });

  it('beendet die Sandbox, wenn der Builder geschlossen wird (kein Heartbeat mehr)', async () => {
    const { manager, runtime, clock } = setup();
    const s = await startOk(manager, A);
    clock.t += PREVIEW_LIMITS.idleStopMs - 1_000;
    expect(await manager.sweep()).toBe(0);
    clock.t += 2_000;
    expect(await manager.sweep()).toBe(1);
    expect(await manager.status(A, s.sessionId)).toMatchObject({ session: { state: 'stopped', stopReason: 'idle' } });
    expect(runtime.running()).toHaveLength(0);
  });

  it('beendet die Sandbox sofort beim Schließen (stop mit Grund closed)', async () => {
    const { manager, runtime } = setup();
    const s = await startOk(manager, A);
    expect(await manager.stop(A, s.sessionId, 'closed')).toMatchObject({ ok: true, session: { state: 'stopped', stopReason: 'closed' } });
    expect(runtime.running()).toHaveLength(0);
    // Danach ist ein neuer Start wieder möglich (Platz frei).
    expect((await manager.start(A, { projectId: 'p1', files: reactProject() })).ok).toBe(true);
  });
});

describe('Spike Sandbox-Vorschau — Mandantentrennung', () => {
  it('Mandant B erreicht Sitzung und Vorschau von Mandant A nicht', async () => {
    const { manager, runtime } = setup();
    const a = await startOk(manager, A, 'project-a');
    const b = await startOk(manager, B, 'project-b');

    for (const res of [
      await manager.status(B, a.sessionId),
      await manager.heartbeat(B, a.sessionId),
      await manager.writeFiles(B, a.sessionId, { 'index.html': '<h1>übernommen</h1>' }),
      await manager.stop(B, a.sessionId),
    ]) {
      expect(res).toMatchObject({ ok: false, status: 404, code: 'NOT_FOUND' });
    }
    // A läuft unverändert weiter.
    expect(await manager.status(A, a.sessionId)).toMatchObject({ ok: true, session: { state: 'running' } });
    expect(runtime.serve(a.previewUrl!).body).toContain('Nordlicht');

    // Eigene Sandbox je Sitzung, eigene Dateien, eigene URL.
    expect(runtime.running()).toHaveLength(2);
    expect(a.previewUrl).not.toBe(b.previewUrl);
    // Mit dem Token von B (oder geraten) ist die Vorschau von A nicht abrufbar.
    const tokenB = new URL(b.previewUrl!).searchParams.get('token')!;
    const forged = new URL(a.previewUrl!);
    forged.searchParams.set('token', tokenB);
    expect(runtime.serve(forged.toString()).status).toBe(404);
    forged.searchParams.set('token', 'guess');
    expect(runtime.serve(forged.toString()).status).toBe(404);
  });

  it('Antworten enthalten weder tenantId noch sandboxId', async () => {
    const { manager } = setup();
    const s = await startOk(manager, A);
    const blob = JSON.stringify([s, await manager.status(A, s.sessionId), await manager.heartbeat(A, s.sessionId)]);
    expect(blob).not.toContain('tenant-a');
    expect(blob).not.toContain('sandboxId');
  });

  it('ohne Session, Mandant oder Berechtigung startet nichts', async () => {
    const { manager, runtime } = setup();
    const cases: [PreviewAuthz, number, string][] = [
      [{ ...A, authenticated: false }, 401, 'UNAUTHORIZED'],
      [{ ...A, tenantId: '' }, 403, 'FORBIDDEN'],
      [{ ...A, entitlementBuilder: false }, 403, 'ENTITLEMENT'],
    ];
    for (const [who, status, code] of cases) {
      expect(await manager.start(who, { projectId: 'p', files: reactProject() })).toMatchObject({ status, code });
    }
    expect(runtime.calls.start).toBe(0);
  });
});

describe('Spike Sandbox-Vorschau — fremde Origin und Dateiprüfung', () => {
  it('lehnt Vorschau-URLs auf App-Host, Subdomain oder http ab und stoppt die Sandbox', async () => {
    for (const base of ['preview.realsyncdynamicsai.de', 'realsyncdynamicsai.de']) {
      const runtime = new FakePreviewRuntime({ previewBaseHost: base });
      const { manager } = setup({ runtime });
      expect(await manager.start(A, { projectId: 'p', files: reactProject() })).toMatchObject({ code: 'UNSAFE_PREVIEW_URL' });
      expect(runtime.running()).toHaveLength(0);
    }
    expect(isForeignHttpsUrl('http://x.example.org', ['realsyncdynamicsai.de'])).toBe(false);
    expect(isForeignHttpsUrl('https://user:pw@x.example.org', ['realsyncdynamicsai.de'])).toBe(false);
    expect(isForeignHttpsUrl('https://x.example.org', ['realsyncdynamicsai.de'])).toBe(true);
  });

  it('lässt unsichere Dateien und Abhängigkeiten nicht in die Sandbox', async () => {
    const { manager, runtime } = setup();
    const bad: Record<string, string>[] = [
      { ...reactProject(), '.env': 'SUPABASE_SERVICE_ROLE_KEY=x' },
      { ...reactProject(), '.npmrc': 'registry=https://evil.example' },
      { ...reactProject(), '../escape.js': 'x' },
      { ...reactProject(), 'node_modules/react/index.js': 'x' },
      { ...reactProject(), 'package.json': JSON.stringify({ devDependencies: { vite: '^6.0.0', x: 'git+https://example.org/x.git' } }) },
      { ...reactProject(), 'package.json': JSON.stringify({ dependencies: { react: '^19.0.0' } }) },
    ];
    for (const files of bad) {
      expect(await manager.start(A, { projectId: 'p', files })).toMatchObject({ ok: false, status: 400, code: 'BAD_REQUEST' });
    }
    expect(runtime.calls.start).toBe(0);
    expect(checkProjectFiles({ 'src/App.jsx': 'ok' })).toMatchObject({ ok: true });
  });
});
