import { describe, expect, it, vi } from 'vitest';
import {
  MANAGED_BY,
  normalizeOriginInput,
  setBrowserOrigins,
  validateOriginList,
} from '../../supabase/functions/governance-resources/browserOrigins';
import { buildOriginPolicy, checkActions } from '../../supabase/functions/_shared/browser-origin-policy';

type Row = Record<string, unknown> & { id: string };

/** Minimaler Supabase-Ersatz für governance_policies (select/eq/order, insert, update). */
function fakeAdmin(initial: Row[] = [], opts: { failRead?: boolean } = {}) {
  const rows: Row[] = initial.map((r) => ({ ...r }));
  let seq = 0;
  const calls: string[] = [];
  const admin = {
    rows,
    calls,
    from(table: string) {
      expect(table).toBe('governance_policies');
      return {
        select() {
          const filters: Array<[string, unknown]> = [];
          const q = {
            eq(col: string, val: unknown) { filters.push([col, val]); return q; },
            order() {
              calls.push('select');
              if (opts.failRead) return Promise.resolve({ data: null, error: { message: 'boom' } });
              const data = rows.filter((r) => filters.every(([c, v]) => r[c] === v));
              return Promise.resolve({ data, error: null });
            },
          };
          return q;
        },
        insert(row: Record<string, unknown>) {
          calls.push('insert');
          const created = { id: `p${++seq}`, ...row };
          rows.push(created);
          return { select: () => ({ single: () => Promise.resolve({ data: { id: created.id }, error: null }) }) };
        },
        update(patch: Record<string, unknown>) {
          const filters: Array<[string, unknown]> = [];
          const q = {
            eq(col: string, val: unknown) {
              filters.push([col, val]);
              if (filters.length === 2) {
                calls.push('update');
                rows.filter((r) => filters.every(([c, v]) => r[c] === v)).forEach((r) => Object.assign(r, patch));
                return Promise.resolve({ error: null });
              }
              return q;
            },
          };
          return q;
        },
      };
    },
  };
  return admin;
}

function deps(allowed = true) {
  return { isOwnerOrAdmin: vi.fn(async () => allowed), audit: vi.fn(async () => null) };
}

const T = 'tenant-a';

describe('normalizeOriginInput', () => {
  it('ergänzt https und entfernt den Schrägstrich', () => {
    expect(normalizeOriginInput('beispiel.de')).toEqual({ ok: true, origin: 'https://beispiel.de' });
    expect(normalizeOriginInput(' https://Shop.Beispiel.de/ ')).toEqual({ ok: true, origin: 'https://shop.beispiel.de' });
    expect(normalizeOriginInput('https://beispiel.de:8443')).toEqual({ ok: true, origin: 'https://beispiel.de:8443' });
  });

  it.each([
    ['http://beispiel.de', 'nur https'],
    ['https://beispiel.de/pfad', 'ohne Pfad'],
    ['https://beispiel.de/?a=1', 'ohne ? oder #'],
    ['https://user:pw@beispiel.de', 'Zugangsdaten'],
    ['*.beispiel.de', 'Platzhalter'],
    ['javascript:alert(1)', 'nur https'],
    ['beispiel', 'vollständige Domain'],
    ['https://localhost', 'localhost'],
    ['', 'leer'],
  ])('lehnt %s ab', (input, reason) => {
    const r = normalizeOriginInput(input);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toContain(reason);
  });
});

describe('validateOriginList', () => {
  it('dedupliziert und sortiert', () => {
    expect(validateOriginList(['b.de', 'https://a.de', 'https://b.de/'])).toEqual({ ok: true, origins: ['https://a.de', 'https://b.de'] });
  });
  it('ein Fehler lehnt die ganze Liste ab', () => {
    const r = validateOriginList(['a.de', 'http://b.de']);
    expect(r.ok).toBe(false);
  });
  it('begrenzt die Anzahl', () => {
    const many = Array.from({ length: 101 }, (_, i) => `d${i}.de`);
    expect(validateOriginList(many).ok).toBe(false);
  });
  it('kein Array → Fehler', () => {
    expect(validateOriginList('a.de').ok).toBe(false);
  });
});

describe('setBrowserOrigins', () => {
  it('O1: legt die verwaltete Freigabe im Format von browser-execute an', async () => {
    const admin = fakeAdmin();
    const d = deps();
    const r = await setBrowserOrigins(admin, 'u1', 'a@b.de', { tenant_id: T, list: 'allow', origins: ['beispiel.de'] }, d);
    expect(r.status).toBe(200);
    expect(admin.rows).toHaveLength(1);
    expect(admin.rows[0]).toMatchObject({
      tenant_id: T,
      policy_type: 'data_transfer',
      action: 'allow',
      enabled: true,
      mode: 'enforce',
      environment: 'production',
      condition: { scope: 'browser_origin', origins: ['https://beispiel.de'], managed_by: MANAGED_BY },
    });
    expect(d.audit).toHaveBeenCalledWith(expect.objectContaining({
      tenant_id: T, action: 'policy.browser_origins.allow.set',
      payload: { list: 'allow', count: 1, added: ['https://beispiel.de'], removed: [] },
    }));
  });

  it('O2: Gegenprobe – browser-execute erlaubt danach genau diese Domain', async () => {
    const admin = fakeAdmin();
    await setBrowserOrigins(admin, 'u1', null, { tenant_id: T, list: 'allow', origins: ['beispiel.de'] }, deps());
    const policy = buildOriginPolicy(admin.rows as never);
    expect(checkActions([{ type: 'navigate', url: 'https://beispiel.de/kontakt' }], null, null, policy).ok).toBe(true);
    expect(checkActions([{ type: 'navigate', url: 'https://andere.de/' }], null, null, policy).ok).toBe(false);
  });

  it('O3: zweites Speichern aktualisiert dieselbe Zeile und meldet Entferntes', async () => {
    const admin = fakeAdmin();
    await setBrowserOrigins(admin, 'u1', null, { tenant_id: T, list: 'allow', origins: ['a.de', 'b.de'] }, deps());
    const d = deps();
    const r = await setBrowserOrigins(admin, 'u1', null, { tenant_id: T, list: 'allow', origins: ['b.de', 'c.de'] }, d);
    expect(r.status).toBe(200);
    expect(admin.rows).toHaveLength(1);
    expect((admin.rows[0].condition as { origins: string[] }).origins).toEqual(['https://b.de', 'https://c.de']);
    if (r.status === 200) {
      expect(r.body.added).toEqual(['https://c.de']);
      expect(r.body.removed).toEqual(['https://a.de']);
    }
  });

  it('O4: leere Liste entzieht alle verwalteten Freigaben', async () => {
    const admin = fakeAdmin();
    await setBrowserOrigins(admin, 'u1', null, { tenant_id: T, list: 'allow', origins: ['a.de'] }, deps());
    await setBrowserOrigins(admin, 'u1', null, { tenant_id: T, list: 'allow', origins: [] }, deps());
    const policy = buildOriginPolicy(admin.rows as never);
    expect(policy.allow.size).toBe(0);
  });

  it('O5: Sperrliste schlägt Freigabe', async () => {
    const admin = fakeAdmin();
    await setBrowserOrigins(admin, 'u1', null, { tenant_id: T, list: 'allow', origins: ['a.de'] }, deps());
    await setBrowserOrigins(admin, 'u1', null, { tenant_id: T, list: 'block', origins: ['a.de'] }, deps());
    expect(admin.rows).toHaveLength(2);
    const policy = buildOriginPolicy(admin.rows as never);
    expect(checkActions([{ type: 'navigate', url: 'https://a.de/' }], null, null, policy).ok).toBe(false);
  });

  it('O6: ohne owner/admin → 403, nichts geschrieben, keine Validierungsdetails', async () => {
    const admin = fakeAdmin();
    const r = await setBrowserOrigins(admin, 'u2', null, { tenant_id: T, list: 'allow', origins: ['http://x'] }, deps(false));
    expect(r).toMatchObject({ status: 403, code: 'FORBIDDEN' });
    expect(admin.calls).toEqual([]);
  });

  it('O7: ungültige Domain → 400 mit Details, nichts geschrieben', async () => {
    const admin = fakeAdmin();
    const r = await setBrowserOrigins(admin, 'u1', null, { tenant_id: T, list: 'allow', origins: ['a.de', 'http://b.de'] }, deps());
    expect(r).toMatchObject({ status: 400, code: 'INVALID_ORIGINS' });
    expect(admin.calls).toEqual([]);
  });

  it('O8: unbekannte Liste oder fehlender Mandant → 400', async () => {
    expect((await setBrowserOrigins(fakeAdmin(), 'u1', null, { tenant_id: T, list: 'observe', origins: [] }, deps())).status).toBe(400);
    expect((await setBrowserOrigins(fakeAdmin(), 'u1', null, { list: 'allow', origins: [] }, deps())).status).toBe(400);
  });

  it('O9: fremde und nicht verwaltete Regeln bleiben unberührt', async () => {
    const admin = fakeAdmin([
      { id: 'x1', tenant_id: 'tenant-b', policy_type: 'data_transfer', environment: 'production', action: 'allow', enabled: true, mode: 'enforce', condition: { scope: 'browser_origin', origins: ['https://b.de'], managed_by: MANAGED_BY } },
      { id: 'x2', tenant_id: T, policy_type: 'data_transfer', environment: 'production', action: 'allow', enabled: true, mode: 'enforce', condition: { scope: 'browser_origin', origins: ['https://pack.de'] } },
    ]);
    await setBrowserOrigins(admin, 'u1', null, { tenant_id: T, list: 'allow', origins: ['a.de'] }, deps());
    expect(admin.rows.find((r) => r.id === 'x1')!.condition).toEqual({ scope: 'browser_origin', origins: ['https://b.de'], managed_by: MANAGED_BY });
    expect(admin.rows.find((r) => r.id === 'x2')!.condition).toEqual({ scope: 'browser_origin', origins: ['https://pack.de'] });
    expect(admin.rows).toHaveLength(3);
  });

  it('O10: doppelte verwaltete Zeilen werden deaktiviert, Entfernen wirkt', async () => {
    const dup = (id: string) => ({ id, created_at: id, tenant_id: T, policy_type: 'data_transfer', environment: 'production', action: 'allow', enabled: true, mode: 'enforce', condition: { scope: 'browser_origin', origins: ['https://a.de'], managed_by: MANAGED_BY } });
    const admin = fakeAdmin([dup('d1'), dup('d2')]);
    await setBrowserOrigins(admin, 'u1', null, { tenant_id: T, list: 'allow', origins: [] }, deps());
    expect(admin.rows.find((r) => r.id === 'd2')!.enabled).toBe(false);
    const active = admin.rows.filter((r) => r.enabled);
    expect(buildOriginPolicy(active as never).allow.size).toBe(0);
  });

  it('O11: Lesefehler → 500, nichts geschrieben (fail-closed)', async () => {
    const admin = fakeAdmin([], { failRead: true });
    const r = await setBrowserOrigins(admin, 'u1', null, { tenant_id: T, list: 'allow', origins: ['a.de'] }, deps());
    expect(r.status).toBe(500);
    expect(admin.calls).toEqual(['select']);
  });

  it('O12: Staging-Zeilen werden nicht als verwaltete Produktionszeile übernommen', async () => {
    const admin = fakeAdmin([
      { id: 's1', tenant_id: T, policy_type: 'data_transfer', environment: 'staging', action: 'allow', enabled: true, mode: 'enforce', condition: { scope: 'browser_origin', origins: ['https://s.de'], managed_by: MANAGED_BY } },
    ]);
    await setBrowserOrigins(admin, 'u1', null, { tenant_id: T, list: 'allow', origins: ['a.de'] }, deps());
    expect(admin.rows).toHaveLength(2);
    expect(admin.rows.find((r) => r.id === 's1')!.condition).toMatchObject({ origins: ['https://s.de'] });
  });
});
