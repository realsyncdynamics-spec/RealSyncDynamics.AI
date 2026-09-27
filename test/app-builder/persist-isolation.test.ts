import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  authorizePersist,
  bindTenant,
  validateFiles,
  MAX_FILES,
} from '../../src/features/app-builder/persist/contract';
import { MemoryProjectStore, isDenial } from '../../src/features/app-builder/persist/memory-store';
import type { PersistAuthz } from '../../src/features/app-builder/persist/contract';

const tenantA: PersistAuthz = {
  authenticated: true,
  tenantId: 'tenant-a',
  actorId: 'actor-a',
  entitlementBuilder: true,
};
const tenantB: PersistAuthz = {
  authenticated: true,
  tenantId: 'tenant-b',
  actorId: 'actor-b',
  entitlementBuilder: true,
};

function payload(over: Record<string, unknown> = {}) {
  return {
    slug: 'crm',
    title: 'CRM A',
    files: { 'index.html': '<h1>Nordlicht</h1>' },
    merkle: '',
    audit: [] as [],
    messages: [] as [],
    ...over,
  };
}

describe('persist contract', () => {
  it('unauthenticated → DENY', () => {
    const d = authorizePersist(
      { authenticated: false, tenantId: 't', actorId: '', entitlementBuilder: true },
      'load',
    );
    expect(d.ok).toBe(false);
    if (!d.ok) expect(d.status).toBe(401);
  });

  it('missing entitlement → DENY on every op', () => {
    const authz: PersistAuthz = { ...tenantA, entitlementBuilder: false };
    for (const op of ['list', 'load', 'save', 'delete'] as const) {
      const d = authorizePersist(authz, op);
      expect(d.ok).toBe(false);
      if (!d.ok) {
        expect(d.status).toBe(403);
        expect(d.code).toBe('ENTITLEMENT');
      }
    }
  });

  it('forged tenant_id on the payload cannot override Authz', () => {
    const bound = bindTenant(tenantA, { tenantId: 'tenant-b', slug: 'x' });
    expect(bound.tenantId).toBe('tenant-a');
  });

  it('rejects oversized file trees', () => {
    const files: Record<string, string> = {};
    for (let i = 0; i < MAX_FILES + 1; i += 1) files[`f${i}.txt`] = 'x';
    const d = validateFiles(files);
    expect(d.ok).toBe(false);
  });
});

describe('MemoryProjectStore — server-side tenant isolation', () => {
  it('Tenant B cannot load, mutate, delete, or read Tenant A files', async () => {
    const store = new MemoryProjectStore();
    const saved = await store.save(tenantA, payload());
    expect(isDenial(saved)).toBe(false);
    if (isDenial(saved)) return;
    const idA = saved.id;

    const loadB = store.load(tenantB, idA);
    expect(isDenial(loadB) || loadB === null || (loadB as { ok?: false }).ok === false).toBe(true);
    if (isDenial(loadB)) expect(loadB.status).toBe(404);

    const saveB = await store.save(tenantB, {
      ...payload({ title: 'hijack', files: { 'index.html': 'stolen' } }),
      id: idA,
    });
    expect(isDenial(saveB)).toBe(false);
    if (!isDenial(saveB)) {
      expect(saveB.tenantId).toBe('tenant-b');
      expect(saveB.id).not.toBe(idA);
    }

    const delB = store.delete(tenantB, idA);
    expect(isDenial(delB)).toBe(true);
    if (isDenial(delB)) expect(delB.status).toBe(404);

    const stillA = store.load(tenantA, idA);
    expect(isDenial(stillA)).toBe(false);
    if (!isDenial(stillA) && stillA) {
      expect(stillA.files['index.html']).toContain('Nordlicht');
      expect(stillA.tenantId).toBe('tenant-a');
    }

    const listB = store.list(tenantB);
    expect(isDenial(listB)).toBe(false);
    if (!isDenial(listB)) {
      expect(listB.some((p) => p.id === idA)).toBe(false);
    }
  });

  it('save with a forged tenantId still lands in the verified tenant', async () => {
    const store = new MemoryProjectStore();
    const saved = await store.save(tenantA, payload({ tenantId: 'tenant-b' } as never));
    expect(isDenial(saved)).toBe(false);
    if (!isDenial(saved)) expect(saved.tenantId).toBe('tenant-a');
    expect(isDenial(store.list(tenantB)) ? true : (store.list(tenantB) as { length: number }).length === 0).toBe(
      true,
    );
  });

  it('identical merkle does not append a version', async () => {
    const store = new MemoryProjectStore();
    const first = await store.save(tenantA, payload());
    const second = await store.save(tenantA, payload());
    expect(isDenial(first) || isDenial(second)).toBe(false);
    if (!isDenial(first) && !isDenial(second)) {
      expect(second.id).toBe(first.id);
      expect(second.version).toBe(1);
    }
  });
});

describe('code-persist handler source — isolation invariants', () => {
  const src = readFileSync(
    resolve(__dirname, '../../supabase/functions/siteos/handlers/code-persist.ts'),
    'utf8',
  );
  const authSrc = readFileSync(
    resolve(__dirname, '../../supabase/functions/_shared/auth.ts'),
    'utf8',
  );

  it('uses requireAuthAndTenant before any project query', () => {
    expect(src).toMatch(/requireAuthAndTenant/);
    const authAt = src.indexOf('requireAuthAndTenant');
    const tableAt = src.indexOf("from('app_builder_projects')");
    expect(authAt).toBeGreaterThan(-1);
    expect(tableAt).toBeGreaterThan(authAt);
  });

  it('shared auth helper verifies membership against public.memberships', () => {
    expect(authSrc).toMatch(/from\('memberships'\)/);
    expect(authSrc).toMatch(/not a member of the requested tenant/);
    expect(authSrc).toMatch(/eq\('tenant_id', tenantId\)/);
    expect(authSrc).toMatch(/eq\('user_id', userId\)/);
  });

  it('does not query siteos_blueprints', () => {
    expect(src).not.toMatch(/from\('siteos_blueprints'\)/);
    expect(src).toMatch(/from\('app_builder_projects'\)/);
  });

  it('scopes every table access to the verified tenantId', () => {
    const hits = [...src.matchAll(/from\('app_builder_projects'\)([\s\S]{0,320})/g)];
    expect(hits.length).toBeGreaterThan(3);
    for (const h of hits) {
      const scoped = /eq\('tenant_id', tenantId\)/.test(h[1]) || /insert\(insert\)/.test(h[1]);
      expect(scoped).toBe(true);
    }
    expect(src).toMatch(/tenant_id:\s*tenantId/);
    expect(src).not.toMatch(/claimedTenant/);
    expect(src).not.toMatch(/eq\('tenant_id', String\(body\.tenant_id/);
  });

  it('does not insert the client tenant_id as authority', () => {
    expect(src).toMatch(/const \{ tenantId, user, admin \} = auth/);
    expect(src).toMatch(/gateFeature\(admin, tenantId, 'siteos\.builder'\)/);
    const gateAt = src.indexOf("gateFeature(admin, tenantId, 'siteos.builder')");
    const insertAt = src.indexOf('.insert(insert)');
    expect(gateAt).toBeGreaterThan(-1);
    expect(insertAt).toBeGreaterThan(gateAt);
  });

  it('recomputes merkle and rejects a mismatched client hash', () => {
    expect(src).toMatch(/merkleOfFiles/);
    expect(src).toMatch(/MERKLE_MISMATCH/);
    const merkleAt = src.indexOf('merkleOfFiles');
    const insertAt = src.indexOf('.insert(insert)');
    expect(merkleAt).toBeGreaterThan(-1);
    expect(insertAt).toBeGreaterThan(merkleAt);
  });
});

describe('persist-api client — production path', () => {
  const src = readFileSync(
    resolve(__dirname, '../../src/features/app-builder/persist/persist-api.ts'),
    'utf8',
  );

  it('invokes siteos/code-persist, never siteos_blueprints', () => {
    expect(src).toMatch(/edgeFunctionUrl\('siteos\/code-persist'\)/);
    expect(src).not.toMatch(/siteos_blueprints/);
    expect(src).not.toMatch(/siteos\/edit/);
    expect(src).not.toMatch(/siteos\/builder/);
  });
});
