import { describe, expect, it } from 'vitest';
import {
  deriveVvtEntriesFromEvents,
  type RuntimeEvent,
} from '../../../../src/features/governance/vvt/runtimeVvtMapper';
import {
  buildExportPayload,
  exportFileName,
} from '../../../../src/features/governance/vvt/RuntimeVvtExportButton';

describe('deriveVvtEntriesFromEvents', () => {
  it('mappt tracker.pre_consent.detected zu website_tracking mit consent-Hinweis', () => {
    const events: RuntimeEvent[] = [
      {
        id:         'evt_1',
        type:       'tracker.pre_consent.detected',
        tenant_id:  'tenant_a',
        source_url: 'https://www.example.com/',
        payload: { vendor_name: 'Google Analytics', vendor_domain: 'google-analytics.com', country_hint: 'US' },
      },
    ];
    const result = deriveVvtEntriesFromEvents(events);
    expect(result).toHaveLength(1);
    const entry = result[0];
    expect(entry.processing_type).toBe('website_tracking');
    expect(entry.legal_basis_hint).toBe('consent');
    expect(entry.risk_level).toBe('high');
    expect(entry.review_status).toBe('review_required');
    expect(entry.vendors[0].name).toBe('Google Analytics');
    expect(entry.vendors[0].transfer_risk_hint).toBe('high');
    expect(entry.detected_from_event_ids).toEqual(['evt_1']);
  });

  it('mappt ai.endpoint.found zu ai_endpoint mit KI-Relevanz „möglich"', () => {
    const events: RuntimeEvent[] = [
      {
        id:        'evt_ai',
        type:      'ai.endpoint.found',
        tenant_id: 'tenant_a',
        payload:   { provider: 'OpenAI', country_hint: 'US' },
      },
    ];
    const [entry] = deriveVvtEntriesFromEvents(events);
    expect(entry.processing_type).toBe('ai_endpoint');
    expect(entry.ai_act_relevance).toBe('possible');
    expect(entry.review_status).toBe('review_required');
    expect(entry.processing_name).toContain('OpenAI');
  });

  it('ignoriert unbekannte Event-Typen', () => {
    const events: RuntimeEvent[] = [
      { type: 'something.weird.happened', tenant_id: 'tenant_a' },
      { type: 'noise.detected',           tenant_id: 'tenant_a' },
    ];
    expect(deriveVvtEntriesFromEvents(events)).toEqual([]);
  });

  it('markiert unbekannte Vendoren mit dpa_required=true', () => {
    const events: RuntimeEvent[] = [
      {
        id:        'evt_v',
        type:      'vendor.unknown.detected',
        tenant_id: 'tenant_a',
        payload:   { vendor_name: 'cdn-pixel.io', vendor_domain: 'cdn-pixel.io' },
      },
    ];
    const [entry] = deriveVvtEntriesFromEvents(events);
    expect(entry.vendors[0].dpa_required).toBe(true);
    expect(entry.review_status).toBe('review_required');
  });
});

describe('VVT-Export', () => {
  it('erzeugt validen JSON mit Disclaimer und Schema-Tag', () => {
    const entries = deriveVvtEntriesFromEvents([
      { id: 'evt_1', type: 'form.email.detected', tenant_id: 'tenant_a', payload: { form_name: 'Kontakt' } },
    ]);
    const json = buildExportPayload(entries);
    const parsed = JSON.parse(json);
    expect(parsed.schema).toBe('realsync.runtime-vvt.v1');
    expect(parsed.entry_count).toBe(1);
    expect(parsed.disclaimer).toMatch(/Human Review/);
    expect(Array.isArray(parsed.entries)).toBe(true);
  });

  it('Dateiname enthält Datum im YYYY-MM-DD-Format', () => {
    expect(exportFileName()).toMatch(/^realsync-runtime-vvt-export-\d{4}-\d{2}-\d{2}\.json$/);
  });
});
