/**
 * governance-resources — Prüfung der KI-Register-Felder (create_asset /
 * update_asset). Nur bekannte Werte, nur vorhandene Schlüssel, nie Mandant,
 * Asset-Typ, AI-Act-Klasse oder Score über update_asset.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  parseRegistryFields,
  sanitizeAssetMetadata,
} from '../../supabase/functions/governance-resources/registryFields';

describe('parseRegistryFields — create', () => {
  it('übernimmt gültige Werte, trimmt Text, leert mit null/""', () => {
    const r = parseRegistryFields({
      ai_system_type: 'local_ai', deployment_model: 'local_device', data_residency: 'eu',
      model_name: '  granite4.2:8b ', intended_purpose: '', name: 'ignored-in-create',
    }, 'create');
    expect(r).toEqual({ ok: true, patch: {
      ai_system_type: 'local_ai', deployment_model: 'local_device', data_residency: 'eu',
      model_name: 'granite4.2:8b', intended_purpose: null,
    } });
  });

  it('fehlende Schlüssel bleiben weg (kein stilles Leeren)', () => {
    expect(parseRegistryFields({}, 'create')).toEqual({ ok: true, patch: {} });
  });

  it.each([
    ['ai_system_type', 'quantum'],
    ['deployment_model', 'mars'],
    ['data_residency', 'eu-ish'],
    ['model_name', 'x'.repeat(201)],
    ['intended_purpose', 42],
  ])('lehnt %s = %j ab', (key, value) => {
    const r = parseRegistryFields({ [key]: value }, 'create');
    expect(r.ok).toBe(false);
  });
});

describe('parseRegistryFields — update', () => {
  it('Stammdaten und Status, aber kein archived', () => {
    expect(parseRegistryFields({ name: ' Copilot ', status: 'under_review', owner_email: 'a@b.de' }, 'update'))
      .toEqual({ ok: true, patch: { name: 'Copilot', status: 'under_review', owner_email: 'a@b.de' } });
    expect(parseRegistryFields({ status: 'archived' }, 'update').ok).toBe(false);
  });

  it('Name darf nicht leer werden, E-Mail muss eine sein', () => {
    expect(parseRegistryFields({ name: '   ' }, 'update').ok).toBe(false);
    expect(parseRegistryFields({ owner_email: 'kein-mail' }, 'update').ok).toBe(false);
    expect(parseRegistryFields({ owner_email: null }, 'update')).toEqual({ ok: true, patch: { owner_email: null } });
  });

  it('ignoriert Mandant, Typ, Klasse und Score; ohne Feld → Fehler', () => {
    const r = parseRegistryFields({ tenant_id: 'x', asset_type: 'website', ai_act_class: 'minimal', risk_score: 1 }, 'update');
    expect(r).toEqual({ ok: false, error: 'no editable fields' });
  });
});

describe('sanitizeAssetMetadata', () => {
  it('entfernt system_type — die Durchsetzbarkeits-Klasse wird abgeleitet, nie eingegeben', () => {
    expect(sanitizeAssetMetadata({ system_type: 'ai_gateway', source: 'onboarding' })).toEqual({ source: 'onboarding' });
    expect(sanitizeAssetMetadata(null)).toEqual({});
    expect(sanitizeAssetMetadata(['x'])).toEqual({});
  });
});

describe('governance-resources — Verdrahtung (Quelltext)', () => {
  const code = readFileSync(resolve(__dirname, '../../supabase/functions/governance-resources/index.ts'), 'utf8');

  it('update_asset: Mandant aus der Zeile, owner/admin, nicht archiviert, nur geprüfte Felder', () => {
    const start = code.indexOf('async function updateAsset(');
    expect(start).toBeGreaterThan(-1);
    const body = code.slice(start, code.indexOf('async function archiveAsset('));
    expect(body).toContain("isOwnerOrAdmin(admin, userId, row.tenant_id)");
    expect(body).toContain("ASSET_ARCHIVED");
    expect(body).toContain("parseRegistryFields(b, 'update')");
    expect(body).toMatch(/\.update\(fields\.patch\)/);
    expect(body).not.toMatch(/b\.tenant_id/);
  });

  it('create_asset: Register-Felder geprüft, Client-Metadaten bereinigt', () => {
    expect(code).toContain("parseRegistryFields(b, 'create')");
    expect(code).toContain('metadata: sanitizeAssetMetadata(b.metadata)');
  });
});
