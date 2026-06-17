/**
 * Contract-Tests fuer die reine Validierungs-/Mapping-Logik der Edge Functions
 * governance-dsr und governance-vendors.
 *
 * Die Functions selbst sind Deno-Wrapper (Auth + Tenant-Gate + DB-Writes); hier
 * locken wir die testbare Kernlogik (Pflichtfelder, Enum-Validierung,
 * Feld-Whitelist), damit Drift im Vertrag nicht unbemerkt durchrutscht.
 */
import { describe, it, expect } from 'vitest';
import {
  buildDsrInsert,
  buildDsrPatch,
  buildVendorInsert,
  buildVendorPatch,
} from '../../supabase/functions/_shared/governance-validation';

const ok = (b: ReturnType<typeof buildDsrInsert>) => {
  if ('error' in b) throw new Error(`expected value, got error: ${b.error}`);
  return b.value;
};

describe('buildDsrInsert', () => {
  it('akzeptiert gueltigen Antrag und setzt status=received', () => {
    const v = ok(buildDsrInsert({ request_type: 'access', requester_email: ' a@b.de ' }));
    expect(v.status).toBe('received');
    expect(v.request_type).toBe('access');
    expect(v.requester_email).toBe('a@b.de'); // getrimmt
  });
  it('lehnt unbekannten request_type ab', () => {
    expect(buildDsrInsert({ request_type: 'nonsense', requester_email: 'a@b.de' })).toHaveProperty('error');
  });
  it('verlangt requester_email', () => {
    expect(buildDsrInsert({ request_type: 'erasure' })).toHaveProperty('error');
  });
  it('uebernimmt affected_assets als String-Array', () => {
    const v = ok(buildDsrInsert({ request_type: 'access', requester_email: 'a@b.de', affected_assets: ['x', 1] }));
    expect(v.affected_assets).toEqual(['x', '1']);
  });
});

describe('buildDsrPatch', () => {
  it('lehnt ungueltigen status ab', () => {
    expect(buildDsrPatch({ status: 'banana' })).toHaveProperty('error');
  });
  it('setzt completed_at bei status=completed automatisch', () => {
    const v = ok(buildDsrPatch({ status: 'completed' }));
    expect(v.status).toBe('completed');
    expect(typeof v.completed_at).toBe('string');
  });
  it('respektiert explizit uebergebenes completed_at', () => {
    const v = ok(buildDsrPatch({ status: 'completed', completed_at: '2026-01-01T00:00:00Z' }));
    expect(v.completed_at).toBe('2026-01-01T00:00:00Z');
  });
  it('lehnt leeres Patch ab', () => {
    expect(buildDsrPatch({})).toHaveProperty('error');
  });
});

describe('buildVendorInsert', () => {
  it('verlangt name', () => {
    expect(buildVendorInsert({})).toHaveProperty('error');
  });
  it('akzeptiert Vendor mit Enums', () => {
    const v = ok(buildVendorInsert({ name: 'Acme', dpa_status: 'signed', risk_level: 'high', transfer_mechanism: 'scc' }));
    expect(v.name).toBe('Acme');
    expect(v.dpa_status).toBe('signed');
    expect(v.risk_level).toBe('high');
  });
  it('lehnt ungueltiges dpa_status-Enum ab', () => {
    expect(buildVendorInsert({ name: 'Acme', dpa_status: 'maybe' })).toHaveProperty('error');
  });
  it('lehnt nicht-Array fuer data_types_processed ab', () => {
    expect(buildVendorInsert({ name: 'Acme', data_types_processed: 'email' })).toHaveProperty('error');
  });
});

describe('buildVendorPatch', () => {
  it('lehnt leeren Namen ab', () => {
    expect(buildVendorPatch({ name: '  ' })).toHaveProperty('error');
  });
  it('lehnt leeres Patch ab', () => {
    expect(buildVendorPatch({})).toHaveProperty('error');
  });
  it('lehnt ungueltiges risk_level ab', () => {
    expect(buildVendorPatch({ risk_level: 'extreme' })).toHaveProperty('error');
  });
  it('mappt erlaubte Felder', () => {
    const v = ok(buildVendorPatch({ country: 'DE', notes: 'ok', transfer_mechanism: 'adequacy' }));
    expect(v.country).toBe('DE');
    expect(v.transfer_mechanism).toBe('adequacy');
  });
});
