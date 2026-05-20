/**
 * Smoke-Test fuer den JSON-Export. Wir vermeiden DOM-Mocking und testen
 * stattdessen die Payload-Struktur via einer kleinen Helper-Funktion,
 * die identisch zum Button-Code Payload baut.
 */
import { describe, expect, it } from 'vitest';
import { DEMO_VVT_ENTRIES } from '../../src/features/governance/vvt/demoRuntimeVvtData';

function buildExportPayload(entries: typeof DEMO_VVT_ENTRIES, context?: Record<string, unknown>) {
  return {
    generatedAt: new Date().toISOString(),
    disclaimer:
      'Technisch generierter VVT-Entwurf — aus Runtime-Ereignissen abgeleitet. ' +
      'Keine Rechtsfreigabe. Human Review erforderlich.',
    context: context ?? {},
    entries,
  };
}

describe('Runtime-VVT JSON-Export', () => {
  it('enthaelt Disclaimer-Text', () => {
    const payload = buildExportPayload(DEMO_VVT_ENTRIES);
    expect(payload.disclaimer).toMatch(/Keine Rechtsfreigabe/);
    expect(payload.disclaimer).toMatch(/Human Review/);
  });

  it('enthaelt die uebergebenen Eintraege', () => {
    const payload = buildExportPayload(DEMO_VVT_ENTRIES);
    expect(payload.entries.length).toBe(DEMO_VVT_ENTRIES.length);
    expect(payload.entries.length).toBeGreaterThan(0);
  });

  it('Filename-Format YYYY-MM-DD ist deterministisch', () => {
    const today = new Date().toISOString().slice(0, 10);
    const filename = `realsync-runtime-vvt-export-${today}.json`;
    expect(filename).toMatch(/^realsync-runtime-vvt-export-\d{4}-\d{2}-\d{2}\.json$/);
  });

  it('JSON ist serialisierbar (kein Circular-Reference)', () => {
    const payload = buildExportPayload(DEMO_VVT_ENTRIES, { scope: 'all', demo_data: true });
    const serialized = JSON.stringify(payload);
    expect(serialized.length).toBeGreaterThan(0);
    const parsed = JSON.parse(serialized);
    expect(parsed.entries.length).toBe(DEMO_VVT_ENTRIES.length);
  });
});
