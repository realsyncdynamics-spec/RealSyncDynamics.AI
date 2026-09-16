import { describe, expect, it } from 'vitest';
import { collectActions, StreamingMessageParser } from '../../src/features/app-builder/bolt/message-parser';
import { FileStore } from '../../src/features/app-builder/bolt/file-store';
import { findSecretLeak, isProductionShell, normalizeProjectPath } from '../../src/features/app-builder/bolt/path-guard';
import { classifyPrompt, evaluateAction } from '../../src/features/app-builder/bolt/governance-gate';
import { BoltEngine } from '../../src/features/app-builder/bolt/engine';
import { generateBoltArtifact } from '../../src/features/app-builder/bolt/demo-generator';
import { htmlFromFiles } from '../../src/features/app-builder/bolt/preview';
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
  it('is fail-closed without auth or tenant', () => {
    const file: FileAction = { type: 'file', filePath: 'a.ts', content: 'x' };
    expect(evaluateAction({ ...ctx, authenticated: false }, file, '1', 'minimal').control).toBe(
      'auth.session',
    );
    expect(evaluateAction({ ...ctx, tenantVerified: false }, file, '1', 'minimal').control).toBe(
      'tenant.verified',
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
});
