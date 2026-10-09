/**
 * KI-Register: dieselben Wertelisten an drei Stellen — Datenbank (CHECK),
 * Edge Function (Prüfung) und Oberfläche (Auswahl, Ampel). Eine einseitige
 * Änderung ließe die Oberfläche Werte anbieten, die der Server ablehnt, oder
 * umgekehrt.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import * as fn from '../../supabase/functions/governance-resources/registryFields';
import * as ui from '../../src/features/governance/ai-registry/registryModel';

const sql = readFileSync(
  resolve(__dirname, '../../supabase/migrations/20261005130000_governance_assets_ai_registry_fields.sql'),
  'utf8',
);

/** Werte aus `CHECK (… <column> IN ('a', 'b'))`. */
function checkValues(column: string): string[] {
  const m = sql.match(new RegExp(`OR ${column} IN \\(([^)]*)\\)`));
  expect(m, `CHECK für ${column} fehlt`).not.toBeNull();
  return m![1]!.split(',').map((s) => s.trim().replace(/'/g, ''));
}

describe('KI-Register — Parität DB ↔ Edge Function ↔ Oberfläche', () => {
  it.each([
    ['ai_system_type', fn.AI_SYSTEM_TYPES, ui.AI_SYSTEM_TYPES],
    ['deployment_model', fn.DEPLOYMENT_MODELS, ui.DEPLOYMENT_MODELS],
    ['data_residency', fn.DATA_RESIDENCIES, ui.DATA_RESIDENCIES],
  ] as const)('%s', (column, server, client) => {
    expect([...server]).toEqual([...client]);
    expect(checkValues(column)).toEqual([...server]);
  });

  it('Auftrag §14: genau diese Systemtypen', () => {
    expect([...ui.AI_SYSTEM_TYPES]).toEqual(['external_ai', 'local_ai', 'agent', 'bot', 'workflow', 'browser_agent']);
  });

  it('bearbeitbare Status gleich; archiviert nur über archive_asset', () => {
    expect([...fn.EDITABLE_STATUSES]).toEqual([...ui.EDITABLE_STATUSES]);
    expect(fn.EDITABLE_STATUSES).not.toContain('archived');
  });

  it('jede Option hat eine Beschriftung in DE und EN', () => {
    for (const [values, labels] of [
      [ui.AI_SYSTEM_TYPES, ui.AI_SYSTEM_TYPE_LABEL],
      [ui.DEPLOYMENT_MODELS, ui.DEPLOYMENT_MODEL_LABEL],
      [ui.DATA_RESIDENCIES, ui.DATA_RESIDENCY_LABEL],
    ] as const) {
      for (const v of values) {
        const l = (labels as Record<string, { de: string; en: string }>)[v];
        expect(l?.de, v).toBeTruthy();
        expect(l?.en, v).toBeTruthy();
      }
    }
  });
});
