import { describe, it, expect } from 'vitest';
import {
  CLASSIFICATION_CONFIDENCE_THRESHOLD,
  classifyFromDataTypes,
  classifyFromSignals,
  detectSignals,
  resolveClassification,
  strictestClassification,
} from '../../supabase/functions/_shared/pdp/classify';
import {
  buildSnapshot,
  evaluateSnapshot,
  policyUsesClassification,
  type DecisionRequest,
} from '../../supabase/functions/_shared/pdp/core';

function request(overrides: Partial<DecisionRequest> = {}): DecisionRequest {
  return {
    contract: 'v1',
    tenant_id: 'tenant-1',
    action: { verb: 'transfer', channel: 'test', event_type: 'file_upload' },
    ...overrides,
  };
}

describe('Signal-Erkennung (P1-2)', () => {
  it('gibt Signalnamen und Anzahl zurueck — niemals den Inhalt', () => {
    const hits = detectSignals('Bitte an max.mustermann@example.com senden, IBAN DE89 3704 0044 0532 0130 00');
    const names = hits.map((h) => h.signal).sort();
    expect(names).toContain('email');
    expect(names).toContain('iban');
    const serialized = JSON.stringify(hits);
    expect(serialized).not.toContain('mustermann');
    expect(serialized).not.toContain('DE89');
  });

  it('ist zustandslos ueber Aufrufe hinweg (globale RegExp-Falle)', () => {
    const text = 'a@b.de und c@d.de';
    expect(detectSignals(text)).toEqual(detectSignals(text));
    expect(detectSignals(text)[0].count).toBe(2);
  });

  it('leerer Text liefert keine Signale', () => {
    expect(detectSignals('')).toEqual([]);
    expect(classifyFromSignals([])).toEqual({ classification: 'unknown', confidence: 0 });
  });

  it('Gesundheitsbegriffe fuehren zu Art.-9-Stufe, nicht nur personenbezogen', () => {
    const hits = detectSignals('Anbei die Diagnose des Mitarbeiters.');
    expect(classifyFromSignals(hits).classification).toBe('special_category');
  });

  it('starke Formatmerkmale wiegen schwerer als schwache', () => {
    const iban = classifyFromSignals(detectSignals('IBAN DE89 3704 0044 0532 0130 00'));
    const phone = classifyFromSignals(detectSignals('Tel 030 123456'));
    expect(iban.confidence).toBeGreaterThan(phone.confidence);
    expect(phone.confidence).toBeLessThan(CLASSIFICATION_CONFIDENCE_THRESHOLD);
  });
});

describe('Ableitung aus Stammdaten', () => {
  it('mappt bekannte data_types, ignoriert unbekannte', () => {
    expect(classifyFromDataTypes(['customer_data']).classification).toBe('personal_data');
    expect(classifyFromDataTypes(['health_data']).classification).toBe('special_category');
    expect(classifyFromDataTypes(['voellig_unbekannt'])).toEqual({ classification: 'unknown', confidence: 0 });
    expect(classifyFromDataTypes(undefined).classification).toBe('unknown');
  });

  it('unvollstaendige Stammdaten senken die Guete', () => {
    const komplett = classifyFromDataTypes(['customer_data']);
    const halb = classifyFromDataTypes(['customer_data', 'unbekannt']);
    expect(halb.confidence).toBeLessThan(komplett.confidence);
  });
});

describe('Aufloesung der Klassifikation', () => {
  it('Strengste Quelle gewinnt: Deklaration kann nicht abschwaechen', () => {
    const res = resolveClassification({
      declared: 'public',
      signals: detectSignals('IBAN DE89 3704 0044 0532 0130 00'),
    });
    expect(res.classification).toBe('personal_data');
    expect(res.source).toBe('signals');
  });

  it('Deklaration kann verschaerfen', () => {
    const res = resolveClassification({ declared: 'special_category', dataTypes: ['telemetry'] });
    expect(res.classification).toBe('special_category');
    expect(res.source).toBe('declared');
    expect(res.uncertain).toBe(false);
  });

  it('ohne jede Quelle: unknown, unsicher, Quelle none', () => {
    const res = resolveClassification({});
    expect(res).toMatchObject({ classification: 'unknown', source: 'none', uncertain: true });
  });

  it('schwaches Einzelsignal bleibt unsicher', () => {
    const res = resolveClassification({ signals: detectSignals('Tel 030 123456') });
    expect(res.classification).toBe('personal_data');
    expect(res.uncertain).toBe(true);
  });

  it('strictestClassification ordnet nach Schutzbedarf', () => {
    expect(strictestClassification('internal', 'personal_data')).toBe('personal_data');
    expect(strictestClassification('special_category', 'personal_data')).toBe('special_category');
    // unknown ist kein Schutz und verliert gegen jede bekannte Stufe
    expect(strictestClassification('unknown', 'public')).toBe('public');
  });
});

describe('Unsicherheit schwaecht ab (K5) — aber nur klassifikationsbasierte Regeln', () => {
  const snapClassification = buildSnapshot('t', [
    { id: 'p-pii', name: 'PII extern', rule_type: 'data_transfer', action: 'block', enabled: true,
      condition: { data_classes: ['personal_data'], to_external_vendor: true } },
  ], []);

  const snapVendor = buildSnapshot('t', [
    { id: 'p-vendor', name: 'Vendor gesperrt', rule_type: 'vendor_restriction', action: 'block', enabled: true,
      condition: { blocked_vendors: ['openai'] } },
  ], []);

  it('unsichere Klassifikation macht aus block eine warn — mit Ausweis', () => {
    const res = evaluateSnapshot(snapClassification, request({
      target: { vendor: 'openai' },
      data: { classification: 'personal_data', classification_confidence: 0.45, classification_uncertain: true },
    }));
    expect(res.decision).toBe('warn');
    expect(res.classification?.downgraded_from).toBe('block');
    expect(res.reasons[0].rule).toBe('classification_uncertain');
    expect(res.ttl_ms).toBe(0);
  });

  it('sichere Klassifikation blockiert weiterhin', () => {
    const res = evaluateSnapshot(snapClassification, request({
      target: { vendor: 'openai' },
      data: { classification: 'personal_data', classification_confidence: 0.9, classification_uncertain: false },
    }));
    expect(res.decision).toBe('block');
    expect(res.classification?.downgraded_from).toBeUndefined();
  });

  it('Vendor-Sperre bleibt hart, auch bei unsicherer Klassifikation', () => {
    const res = evaluateSnapshot(snapVendor, request({
      target: { vendor: 'openai' },
      data: { classification: 'personal_data', classification_confidence: 0.3, classification_uncertain: true },
    }));
    expect(res.decision).toBe('block');
    expect(policyUsesClassification(snapVendor.policies[0])).toBe(false);
  });

  it('K1-Schutz: ohne Guete-Felder bleibt das Ergebnis unveraendert', () => {
    const ohne = evaluateSnapshot(snapClassification, request({
      target: { vendor: 'openai' },
      data: { classification: 'personal_data' },
    }));
    expect(ohne.decision).toBe('block');
    // Alt-Pfade setzen die Felder nie — kein classification-Block, kein Downgrade
    const ganzOhne = evaluateSnapshot(snapClassification, request({ target: { vendor: 'openai' } }));
    expect(ganzOhne.classification).toBeUndefined();
  });
});
