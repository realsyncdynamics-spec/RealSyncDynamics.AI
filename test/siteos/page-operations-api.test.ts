import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  applyPageOperations,
  buildSiteFromPrompt,
} from '../../packages/siteos-core/src/index';

const ROOT = resolve(__dirname, '../..');

describe('siteos/edit — PageOperation contract', () => {
  const handler = readFileSync(
    resolve(ROOT, 'supabase/functions/siteos/handlers/edit.ts'),
    'utf8',
  );
  const api = readFileSync(
    resolve(ROOT, 'src/features/siteos/siteOsApi.ts'),
    'utf8',
  );

  it('routes page intents through the existing server-side core path', () => {
    expect(handler).toContain('applyPageOperations');
    expect(handler).toContain('body.pages === undefined ? [] : sanitizePageOperations(body.pages)');
    expect(handler).toContain('edits.length === 0 && pageOps.length === 0');
    expect(handler).toContain('const edited = applySiteEdits(row.blueprint, edits, designTemplate)');
    expect(handler).toContain('const structured = pageOps.length > 0');
    expect(handler).toContain('? applyPageOperations(edited.blueprint, pageOps)');
    expect(handler).toContain('page_operations: pageOps');
    expect(handler).not.toMatch(/body\.blueprint/);
  });

  it('exposes page intents on the existing client edit contract, not a second endpoint', () => {
    expect(api).toContain('edits?: PageEdit[]');
    expect(api).toContain('pages?: PageOperation[]');
    expect(api).toContain('changes: (EditChange | PageChange)[]');
    expect(api).toContain("functions.invoke('siteos/edit'");
    expect(api).not.toMatch(/functions\.invoke\(['"]siteos\/pages/);
  });

  it('keeps legal-page protection in the shared core', async () => {
    const { blueprint } = await buildSiteFromPrompt(
      'Erstelle eine Website für eine Zahnarztpraxis in Hamburg.',
      { locale: 'de', model: 'test-model', createdAt: '2026-10-06T00:00:00.000Z' },
    );

    const legal = blueprint.pages.find((page) => page.path === '/impressum');
    expect(legal).toBeTruthy();

    const result = applyPageOperations(blueprint, [
      { op: 'delete', path: '/impressum' },
    ]);

    expect(result.rejected).toContain('page.protected:/impressum');
    expect(result.blueprint.pages.some((page) => page.path === '/impressum')).toBe(true);
    expect(result.changes).toEqual([]);
  });
});
