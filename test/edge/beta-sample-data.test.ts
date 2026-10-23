/**
 * WP-4 — `beta-sample-data`: Beispieldaten für Beta-Mandanten
 * (docs/claude/BETA_V5_WORKPLAN.md).
 *
 * Zwei Ebenen wie bei beta-enroll:
 *  1. Die Logik (`logic.ts`) ist Deno-frei und wird direkt geprüft.
 *  2. Die Function selbst ist in vitest nicht ausführbar; am Quelltext wird
 *     geprüft, was Mandantentrennung und „nie echte Daten löschen“ trägt.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  SAMPLE_ASSETS,
  SAMPLE_FLAG,
  SAMPLE_NAME_PREFIX,
  decideLoad,
  isSampleAsset,
  parseAction,
  toInsertRow,
} from '../../supabase/functions/beta-sample-data/logic';
import { isSampleAsset as isSampleAssetClient, SAMPLE_FLAG as CLIENT_FLAG, SAMPLE_NAME_PREFIX as CLIENT_PREFIX } from '../../src/features/beta/sampleDataApi';

const root = (p: string) => resolve(__dirname, '../..', p);
const CODE = readFileSync(root('supabase/functions/beta-sample-data/index.ts'), 'utf8');
const ASSET_TYPES = ['website', 'ai_system', 'vendor', 'model', 'agent', 'api', 'dataset', 'repository', 'workflow'];
const AI_ACT_CLASSES = ['minimal', 'limited', 'high', 'prohibited', 'unknown'];

describe('Beispieldaten-Satz', () => {
  it('hält die CHECK-Constraints von governance_assets ein', () => {
    for (const a of SAMPLE_ASSETS) {
      expect(ASSET_TYPES).toContain(a.asset_type);
      expect(AI_ACT_CLASSES).toContain(a.ai_act_class);
      expect(a.risk_score).toBeGreaterThanOrEqual(0);
      expect(a.risk_score).toBeLessThanOrEqual(100);
      expect(a.name.length).toBeGreaterThan(3);
    }
  });

  it('enthält mindestens ein Hochrisiko-KI-System und keine Branchen-Sonderdaten', () => {
    expect(SAMPLE_ASSETS.some((a) => a.asset_type === 'ai_system' && a.ai_act_class === 'high')).toBe(true);
    for (const a of SAMPLE_ASSETS) {
      expect(a.data_types.join(',')).not.toMatch(/health|genetic|biometric|diagnosis/);
    }
  });

  it('streut die Risiko-Scores über mehrere Stufen (keine Ein-Säulen-Verteilung)', () => {
    const scores = SAMPLE_ASSETS.map((a) => a.risk_score);
    expect(Math.max(...scores) - Math.min(...scores)).toBeGreaterThanOrEqual(30);
  });
});

describe('toInsertRow / isSampleAsset', () => {
  it('markiert jede Zeile in den Metadaten UND im Namen', () => {
    for (const a of SAMPLE_ASSETS) {
      const row = toInsertRow(a, 'tenant-1');
      expect(row.tenant_id).toBe('tenant-1');
      expect((row.name as string).startsWith(SAMPLE_NAME_PREFIX)).toBe(true);
      expect((row.metadata as Record<string, unknown>)[SAMPLE_FLAG]).toBe(true);
      expect(isSampleAsset(row)).toBe(true);
      expect(row.status).toBe('active');
    }
  });

  it('erkennt echte Einträge nicht als Beispiel — auch nicht über den Namen', () => {
    expect(isSampleAsset({ metadata: {} })).toBe(false);
    expect(isSampleAsset({ metadata: null })).toBe(false);
    expect(isSampleAsset({})).toBe(false);
    expect(isSampleAsset({ metadata: { sample: 'true' } })).toBe(false);
  });

  it('Client und Function teilen Markierung und Präfix', () => {
    expect(CLIENT_FLAG).toBe(SAMPLE_FLAG);
    expect(CLIENT_PREFIX).toBe(SAMPLE_NAME_PREFIX);
    expect(isSampleAssetClient(toInsertRow(SAMPLE_ASSETS[0], 't'))).toBe(true);
  });
});

describe('decideLoad / parseAction', () => {
  it('lädt nur, wenn noch keine Beispiel-Einträge vorliegen (idempotent)', () => {
    expect(decideLoad(0)).toEqual({ kind: 'load' });
    expect(decideLoad(5)).toEqual({ kind: 'already', count: 5 });
  });

  it('akzeptiert nur load/remove', () => {
    expect(parseAction('load')).toBe('load');
    expect(parseAction('remove')).toBe('remove');
    expect(parseAction('delete')).toBeNull();
    expect(parseAction(undefined)).toBeNull();
  });
});

describe('beta-sample-data/index.ts — Mandantentrennung', () => {
  it('löst den Mandanten aus den Mitgliedschaften des Principals, nie aus dem Body allein', () => {
    expect(CODE).toMatch(/from\('memberships'\)[\s\S]*\.eq\('user_id', user\.id\)/);
    expect(CODE).toContain("memberships.find((m) => m.tenant_id === requested)");
    expect(CODE).toContain("'not a member of this tenant'");
  });

  it('erlaubt nur owner/admin', () => {
    expect(CODE).toMatch(/ALLOWED_ROLES = new Set\(\['owner', 'admin'\]\)/);
    expect(CODE).toContain('ALLOWED_ROLES.has(membership.role)');
  });

  it('entfernt ausschliesslich markierte Zeilen des eigenen Mandanten', () => {
    const del = CODE.slice(CODE.indexOf('.delete()'), CODE.indexOf('.delete()') + 300);
    expect(del).toContain(".eq('tenant_id', tenantId)");
    expect(del).toContain(`.eq(\`metadata->>${'${SAMPLE_FLAG}'}\`, 'true')`);
    expect(del).toContain(".in('id', existingIds)");
  });

  it('bleibt bei verify_jwt-Default (kein config.toml-Eintrag, der JWT abschaltet)', () => {
    const config = readFileSync(root('supabase/config.toml'), 'utf8');
    expect(config).not.toMatch(/\[functions\.beta-sample-data\][\s\S]{0,80}verify_jwt\s*=\s*false/);
  });
});
