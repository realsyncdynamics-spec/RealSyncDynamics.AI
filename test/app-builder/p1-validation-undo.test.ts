import { describe, expect, it } from 'vitest';
import { bracketsBalanced, validateProjectFile, findSecretLeak, isProductionShell } from '../../src/features/app-builder/bolt/path-guard';
import { evaluateAction } from '../../src/features/app-builder/bolt/governance-gate';
import { BoltEngine } from '../../src/features/app-builder/bolt/engine';
import { canUndo, diffFileMaps, diffLines, makeChangeEntry, markUndone, pushHistory } from '../../src/features/app-builder/bolt/change-history';
import type { GovernanceContext } from '../../src/features/app-builder/bolt/types';

const ctx: GovernanceContext = {
  tenantId: 't1', sessionId: 's', actorId: 'a', tenantVerified: true, authenticated: true, entitlementBuilder: true,
};

describe('validateProjectFile (adapted from bolt.diy projectFileValidation)', () => {
  it('accepts normal code and empty deletes', () => {
    expect(validateProjectFile('app.js', 'function a() {\n  return [1, "}"];\n}\n')).toBeNull();
    expect(validateProjectFile('x.ts', '')).toBeNull();
    expect(validateProjectFile('index.html', '<!doctype html><p>hi</p>\n')).toBeNull();
  });
  it('rejects truncated scripts, bad JSON, binary, oversize, collapsed newlines', () => {
    expect(validateProjectFile('app.js', 'function a() {\n  return 1;\n')).toBe('unbalanced-brackets');
    expect(validateProjectFile('package.json', '{"a":')).toBe('invalid-json');
    expect(validateProjectFile('a.txt', 'ab\u0001c')).toBe('binary-content');
    expect(validateProjectFile('a.txt', 'x'.repeat(600 * 1024))).toBe('too-large');
    expect(validateProjectFile('a.js', `const a = 1;\\n${'x'.repeat(500)}`)).toBe('collapsed-line-breaks');
  });
  it('ignores brackets in strings/comments/templates', () => {
    expect(bracketsBalanced('const s = "(" + `[${1}` + \'{\'; // )\n/* ] */')).toBe(true);
  });
  it('gate blocks invalid files with control file.validate; secret + prod-shell guards unchanged', () => {
    const g = evaluateAction(ctx, { type: 'file', filePath: 'a.js', content: 'if (x) {' }, '1', 'minimal');
    expect(g).toMatchObject({ decision: 'block', control: 'file.validate' });
    const s = evaluateAction(ctx, { type: 'file', filePath: 'a.js', content: 'const k = "sk-' + 'a'.repeat(30) + '";' }, '2', 'minimal');
    expect(s.control).toBe('secret.scan');
    expect(findSecretLeak('AKIA' + 'A'.repeat(16))).toBe('aws');
    expect(isProductionShell('wrangler deploy')).toBe(true);
  });
  it('auth/tenant/entitlement still block before validation', () => {
    const g = evaluateAction({ ...ctx, tenantVerified: false }, { type: 'file', filePath: 'a.js', content: '{' }, '3', 'minimal');
    expect(g.control).toBe('tenant.verified');
  });
});

describe('change history (diff/undo per AI change)', () => {
  it('diffs lines and file maps', () => {
    expect(diffLines('a\nb', 'a\nc').map((o) => o.op)).toEqual(['eq', 'del', 'add']);
    const ch = diffFileMaps({ a: '1', b: '2' }, { a: '1', b: '3', c: '4' });
    expect(ch.map((c) => [c.path, c.kind])).toEqual([['b', 'modified'], ['c', 'added']]);
    expect(makeChangeEntry({ id: 'x', label: 'l', before: { a: '1' }, after: { a: '1' }, merkleBefore: '', merkleAfter: '' })).toBeNull();
  });
  it('only undoes the newest change when tree is unchanged since', () => {
    const e = makeChangeEntry({ id: 'e1', label: 'p', before: {}, after: { a: '1' }, merkleBefore: '', merkleAfter: 'm' });
    const h = pushHistory([], e);
    expect(canUndo(h, { a: '1' })?.id).toBe('e1');
    expect(canUndo(h, { a: 'edited' })).toBeNull();
    expect(canUndo(markUndone(h, 'e1'), {})).toBeNull();
  });
  it('engine.restore goes through gate + audit and yields new merkle', async () => {
    const eng = new BoltEngine(ctx);
    await eng.writeFile('index.html', '<p>v1</p>\n');
    const before = (await eng.store.snapshot()).merkle;
    await eng.writeFile('index.html', '<p>v2</p>\n');
    await eng.writeFile('extra.css', 'body{}\n');
    const res = await eng.restore({ 'index.html': '<p>v1</p>\n' }, 'undo test');
    expect(res.blocked).toBe(false);
    expect(Object.keys(res.snapshot.files)).toEqual(['index.html']);
    expect(res.snapshot.merkle).toBe(before);
    expect(res.audit.at(-1)?.event).toBe('builder.change.undone');
  });
  it('engine.restore is blocked without verified tenant', async () => {
    const eng = new BoltEngine(ctx);
    await eng.writeFile('index.html', '<p>v1</p>\n');
    eng.setCtx({ ...ctx, tenantVerified: false });
    const res = await eng.restore({}, 'undo');
    expect(res.blocked).toBe(true);
    expect(Object.keys(res.snapshot.files)).toEqual(['index.html']);
  });
});
