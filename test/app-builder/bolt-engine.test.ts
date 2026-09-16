import { describe, expect, it } from 'vitest';
import { collectActions, StreamingMessageParser } from '../../src/features/app-builder/bolt/message-parser';
import { FileStore } from '../../src/features/app-builder/bolt/file-store';
import { findSecretLeak, isProductionShell, normalizeProjectPath } from '../../src/features/app-builder/bolt/path-guard';
import { classifyPrompt, evaluateAction } from '../../src/features/app-builder/bolt/governance-gate';
import { BoltEngine } from '../../src/features/app-builder/bolt/engine';
import { generateBoltArtifact } from '../../src/features/app-builder/bolt/demo-generator';
import { htmlFromFiles } from '../../src/features/app-builder/bolt/preview';
import { diagnoseFiles } from '../../src/features/app-builder/bolt/diagnostics';
import {
  deleteProject,
  listProjects,
  loadProject,
  saveProject,
  setProjectStorage,
} from '../../src/features/app-builder/bolt/project-store';
import type { FileAction, GovernanceContext, ShellAction } from '../../src/features/app-builder/bolt/types';

const ctx: GovernanceContext = {
  tenantId: 'tenant-demo',
  sessionId: 'sess-1',
  actorId: 'actor-1',
  tenantVerified: true,
  authenticated: true,
  entitlementBuilder: true,
};

const sample = `<boltArtifact title="Demo">
<boltAction type="file" filePath="index.html">
<h1>Hi</h1>
</boltAction>
<boltAction type="shell">
npm run build
</boltAction>
</boltArtifact>`;

describe('bolt engine — path-guard', () => {
  it('rejects traversal and env files', () => {
    expect(normalizeProjectPath('../etc/passwd')).toBeNull();
    expect(normalizeProjectPath('/etc/passwd')).toBeNull();
    expect(normalizeProjectPath('.env')).toBeNull();
    expect(normalizeProjectPath('src/app.tsx')).toBe('src/app.tsx');
  });

  it('detects leaks and production shell', () => {
    expect(findSecretLeak('const k = "sk-ant-abcdefghijklmnopqrstuvwxyz"')).toBe('anthropic');
    expect(isProductionShell('wrangler deploy')).toBe(true);
    expect(isProductionShell('npm run dev')).toBe(false);
  });
});

describe('bolt engine — parser', () => {
  it('extracts file and shell actions', () => {
    const actions = collectActions('m1', sample);
    expect(actions).toHaveLength(2);
    expect(actions[0].action.type).toBe('file');
    if (actions[0].action.type === 'file') {
      expect(actions[0].action.filePath).toBe('index.html');
      expect(actions[0].action.content).toMatch(/<h1>Hi<\/h1>/);
    }
  });

  it('parses incrementally', () => {
    const parser = new StreamingMessageParser();
    const open = parser.parse('m2', '<boltArtifact title="X">');
    expect(open.some((e) => e.kind === 'artifact-open')).toBe(true);
    const rest = parser.parse(
      'm2',
      '<boltArtifact title="X">\n<boltAction type="file" filePath="a.ts">export const x = 1;\n</boltAction>\n</boltArtifact>',
    );
    expect(rest.some((e) => e.kind === 'action-close')).toBe(true);
  });
});

describe('bolt engine — store', () => {
  it('writes hashed snapshots', async () => {
    const store = new FileStore();
    const rec = await store.write('src/a.ts', 'export {}\n');
    expect(rec.path).toBe('src/a.ts');
    expect(rec.sha256).toHaveLength(64);
    const snap = await store.snapshot();
    expect(snap.merkle).toHaveLength(64);
  });
});

describe('bolt engine — governance', () => {
  it('is fail-closed without auth, tenant, or entitlement', () => {
    const file: FileAction = { type: 'file', filePath: 'a.ts', content: 'x' };
    expect(evaluateAction({ ...ctx, authenticated: false }, file, '1', 'minimal').control).toBe(
      'auth.session',
    );
    expect(evaluateAction({ ...ctx, tenantVerified: false }, file, '1', 'minimal').control).toBe(
      'tenant.verified',
    );
    expect(evaluateAction({ ...ctx, entitlementBuilder: false }, file, '1', 'minimal').control).toBe(
      'entitlement.siteos.builder',
    );
  });

  it('blocks secrets, prod infra, and Art. 5', () => {
    const leak: FileAction = {
      type: 'file',
      filePath: 'a.ts',
      content: 'sk-ant-abcdefghijklmnopqrstuvwxyz',
    };
    expect(evaluateAction(ctx, leak, '1', 'minimal').control).toBe('secret.scan');
    const shell: ShellAction = { type: 'shell', content: 'wrangler kv key put foo' };
    expect(evaluateAction(ctx, shell, '2', 'minimal').control).toBe('backstop.no-prod-infra');
    expect(classifyPrompt('social credit system')).toBe('unacceptable');
    expect(classifyPrompt('credit scoring dashboard')).toBe('high');
  });

  it('holds shell while WebContainer is disabled', () => {
    const shell: ShellAction = { type: 'shell', content: 'npm install' };
    const result = evaluateAction(ctx, shell, '3', 'minimal');
    expect(result.decision).toBe('require_approval');
    expect(result.control).toBe('runtime.webcontainer-disabled');
  });
});

describe('bolt engine — ingest', () => {
  it('writes files, holds shell, records Prüfpfad', async () => {
    const engine = new BoltEngine(ctx);
    const result = await engine.ingest('m', sample, 'Kleine Vorschau-Seite');
    expect(result.snapshot.files['index.html']).toBeDefined();
    expect(result.runs.some((r) => r.status === 'complete')).toBe(true);
    expect(result.runs.some((r) => r.gate.control === 'runtime.webcontainer-disabled')).toBe(true);
    expect(result.audit.some((a) => a.event === 'builder.file.written')).toBe(true);
  });

  it('accepts the demo generator protocol', async () => {
    const text = generateBoltArtifact('Compliance Status für Kanzlei');
    const engine = new BoltEngine(ctx);
    const result = await engine.ingest('demo', text, 'Compliance Status für Kanzlei');
    expect(result.snapshot.files['index.html']).toBeDefined();
    const html = htmlFromFiles(Object.values(result.snapshot.files));
    expect(html).toMatch(/Content-Security-Policy/);
    expect(html).toMatch(/KEIN DEPLOY/);
  });

  it('writes nothing when unauthenticated', async () => {
    const engine = new BoltEngine({ ...ctx, authenticated: false });
    const result = await engine.ingest('m', sample, 'hi');
    expect(Object.keys(result.snapshot.files)).toHaveLength(0);
    expect(result.blocked).toBe(true);
  });

  it('keeps the file tree across follow-up prompts', async () => {
    const engine = new BoltEngine(ctx);
    await engine.ingest('m1', sample, 'Erste Seite');
    const follow = `<boltArtifact title="Table">
<boltAction type="file" filePath="customers.html">
<table><tr><td>Ada</td></tr></table>
</boltAction>
</boltArtifact>`;
    const second = await engine.ingest('m2', follow, 'Füge eine Kundentabelle hinzu.');
    expect(second.snapshot.files['index.html']).toBeDefined();
    expect(second.snapshot.files['customers.html']).toBeDefined();
    expect(second.snapshot.files['customers.html'].content).toMatch(/Ada/);
  });

  it('deletes a file only when the gate allows it', async () => {
    const engine = new BoltEngine(ctx);
    await engine.ingest('m', sample, 'hi');
    const del = await engine.deleteFile('index.html');
    expect(del.snapshot.files['index.html']).toBeUndefined();
    const locked = new BoltEngine({ ...ctx, authenticated: false });
    await locked.hydrate({ 'index.html': '<h1>x</h1>' });
    const blocked = await locked.deleteFile('index.html');
    expect(blocked.blocked).toBe(true);
    expect(blocked.snapshot.files['index.html']).toBeDefined();
  });

  it('holds high-risk prompts before any file write', async () => {
    const engine = new BoltEngine(ctx);
    const result = await engine.ingest(
      'hr',
      `<boltArtifact title="x"><boltAction type="file" filePath="index.html"><h1>score</h1></boltAction></boltArtifact>`,
      'credit scoring dashboard',
    );
    expect(Object.keys(result.snapshot.files)).toHaveLength(0);
    expect(result.runs.some((r) => r.gate.decision === 'require_approval')).toBe(true);
    expect(result.runs.some((r) => r.gate.control === 'ai-act.high-risk-gate')).toBe(true);
  });

  it('blocks production commands and does not execute them', async () => {
    const engine = new BoltEngine(ctx);
    const result = await engine.ingest(
      'prod',
      `<boltArtifact title="x"><boltAction type="shell">wrangler deploy</boltAction></boltArtifact>`,
      'deploy to production',
    );
    expect(Object.keys(result.snapshot.files)).toHaveLength(0);
    expect(result.blocked).toBe(true);
    expect(result.runs[0]?.gate.control).toBe('backstop.no-prod-infra');
  });

  it('blocks secrets inside generated file content', async () => {
    const engine = new BoltEngine(ctx);
    const result = await engine.ingest(
      'sec',
      `<boltArtifact title="x"><boltAction type="file" filePath="app.ts">const k = "sk-ant-abcdefghijklmnopqrstuvwxyz"</boltAction></boltArtifact>`,
      'api client',
    );
    expect(Object.keys(result.snapshot.files)).toHaveLength(0);
    expect(result.blocked).toBe(true);
    expect(result.runs[0]?.gate.control).toBe('secret.scan');
  });
});

describe('bolt engine — diagnostics and preview', () => {
  it('flags unbalanced html', () => {
    const d = diagnoseFiles([
      { path: 'index.html', content: '<div><section>x</div>', sha256: 'a'.repeat(64), updatedAt: '', revision: 1 },
    ]);
    expect(d.some((x) => x.severity === 'error')).toBe(true);
  });

  it('preview html changes after a follow-up file write', async () => {
    const engine = new BoltEngine(ctx);
    await engine.ingest(
      'a',
      `<boltArtifact title="A"><boltAction type="file" filePath="index.html"><h1>Eins</h1></boltAction></boltArtifact>`,
      'eins',
    );
    const first = htmlFromFiles(Object.values((await engine.store.snapshot()).files));
    await engine.ingest(
      'b',
      `<boltArtifact title="B"><boltAction type="file" filePath="index.html"><h1>Zwei</h1></boltAction></boltArtifact>`,
      'zwei',
    );
    const second = htmlFromFiles(Object.values((await engine.store.snapshot()).files));
    expect(first).toMatch(/Eins/);
    expect(second).toMatch(/Zwei/);
    expect(first).not.toBe(second);
  });

  it('escapes raw file fallback so markup is not injected', () => {
    const html = htmlFromFiles([
      { path: 'notes.md', content: '<img src=x onerror=alert(1)>', sha256: 'b'.repeat(64), updatedAt: '', revision: 1 },
    ]);
    expect(html.includes('lt;img src=x')).toBe(true);
    expect(html.includes('<img src=x')).toBe(false);
  });
});

describe('bolt engine — tenant isolation', () => {
  it('tenant A never receives tenant B projects', () => {
    const mem = new Map<string, string>();
    setProjectStorage({
      getItem: (k) => mem.get(k) ?? null,
      setItem: (k, v) => {
        mem.set(k, v);
      },
    });
    const base = {
      slug: 'crm',
      files: { 'index.html': '<h1>A</h1>' },
      merkle: 'm',
      audit: [],
      messages: [],
      updatedAt: new Date().toISOString(),
    };
    saveProject({ ...base, id: 'p-a', tenantId: 'tenant-a', title: 'A' });
    saveProject({ ...base, id: 'p-b', tenantId: 'tenant-b', title: 'B' });
    expect(listProjects('tenant-a')).toHaveLength(1);
    expect(listProjects('tenant-a')[0].title).toBe('A');
    expect(loadProject('tenant-a', 'p-b')).toBeNull();
    expect(loadProject('tenant-b', 'p-a')).toBeNull();
    deleteProject('tenant-a', 'p-a');
    expect(listProjects('tenant-a')).toHaveLength(0);
    expect(listProjects('tenant-b')).toHaveLength(1);
    setProjectStorage(null);
  });
});
