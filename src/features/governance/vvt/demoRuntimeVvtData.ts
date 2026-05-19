// Demo-Daten für den Runtime-VVT-Slice.
//
// Diese Daten dienen ausschließlich der UI-Vorschau. Sie sind als
// `source: 'demo'` markiert und beschreiben keine reale Verarbeitung.

import { deriveVvtEntriesFromEvents, type RuntimeEvent } from './runtimeVvtMapper';
import type { RuntimeVvtEntry } from './types';

const DEMO_TENANT = 'demo-tenant';

export const DEMO_RUNTIME_EVENTS: RuntimeEvent[] = [
  {
    id:          'evt_demo_001',
    type:        'tracker.pre_consent.detected',
    tenant_id:   DEMO_TENANT,
    source_url:  'https://www.example.com/',
    occurred_at: '2026-05-12T10:14:22.000Z',
    evidence_refs: ['evidence/demo/tracker-pre-consent-001.json'],
    payload: {
      vendor_name:   'Google Analytics',
      vendor_domain: 'google-analytics.com',
      category:      'analytics',
      country_hint:  'US',
      third_country_transfer: true,
    },
  },
  {
    id:          'evt_demo_002',
    type:        'form.email.detected',
    tenant_id:   DEMO_TENANT,
    source_url:  'https://www.example.com/kontakt',
    occurred_at: '2026-05-12T10:18:03.000Z',
    evidence_refs: ['evidence/demo/contact-form-001.json'],
    payload: {
      form_name: 'Kontaktformular',
    },
  },
  {
    id:          'evt_demo_003',
    type:        'ai.endpoint.found',
    tenant_id:   DEMO_TENANT,
    source_url:  'https://api.example.com/v1/assistant',
    occurred_at: '2026-05-12T10:22:41.000Z',
    evidence_refs: ['evidence/demo/ai-endpoint-001.json'],
    payload: {
      provider:      'OpenAI',
      vendor_name:   'OpenAI',
      vendor_domain: 'api.openai.com',
      category:      'ai_provider',
      country_hint:  'US',
      third_country_transfer: true,
    },
  },
  {
    id:          'evt_demo_004',
    type:        'vendor.unknown.detected',
    tenant_id:   DEMO_TENANT,
    source_url:  'https://www.example.com/',
    occurred_at: '2026-05-12T10:27:55.000Z',
    evidence_refs: ['evidence/demo/unknown-vendor-001.json'],
    payload: {
      vendor_name:   'cdn-pixel.io',
      vendor_domain: 'cdn-pixel.io',
      category:      'third_party_script',
      country_hint:  '',
    },
  },
];

export const DEMO_VVT_ENTRIES: RuntimeVvtEntry[] = deriveVvtEntriesFromEvents(DEMO_RUNTIME_EVENTS);

export const DEMO_SOURCE_LABEL = 'demo' as const;
