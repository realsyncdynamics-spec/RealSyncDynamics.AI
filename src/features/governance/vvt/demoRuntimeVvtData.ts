/**
 * Demo-Daten fuer den Runtime-VVT-View. Wird nur geladen, wenn kein
 * echter Tenant verbunden ist — sodass die /governance/vvt-Page auch
 * fuer Demo-/Sales-Zwecke renderbar bleibt.
 *
 * Wichtig: die Demo-Daten sind als „simulated · demo runtime" gelabelt;
 * der View MUSS sichtbar darauf hinweisen, dass es sich um Beispieldaten
 * handelt — keine echte Tenant-Konfiguration.
 */

import { deriveVvtEntriesFromEvents } from './runtimeVvtMapper';
import type { RuntimeEvent, RuntimeVvtEntry } from './types';

export const DEMO_TENANT_ID = 'demo-tenant-vvt';
export const DEMO_SOURCE_URL = 'https://demo.realsyncdynamicsai.de';

export const DEMO_RUNTIME_EVENTS: RuntimeEvent[] = [
  {
    id: 'evt-001',
    tenantId: DEMO_TENANT_ID,
    sourceUrl: DEMO_SOURCE_URL,
    type: 'tracker.pre_consent.detected',
    occurredAt: '2026-05-19T08:14:11.000Z',
    metadata: {
      vendor_name: 'Google Tag Manager',
      vendor_domain: 'googletagmanager.com',
      vendor_category: 'tag_manager',
      vendor_country: 'US',
    },
  },
  {
    id: 'evt-002',
    tenantId: DEMO_TENANT_ID,
    sourceUrl: DEMO_SOURCE_URL,
    type: 'tracker.pre_consent.detected',
    occurredAt: '2026-05-19T08:14:11.000Z',
    metadata: {
      vendor_name: 'Meta Pixel',
      vendor_domain: 'connect.facebook.net',
      vendor_category: 'marketing_pixel',
      vendor_country: 'US',
    },
  },
  {
    id: 'evt-003',
    tenantId: DEMO_TENANT_ID,
    sourceUrl: DEMO_SOURCE_URL,
    type: 'cookie.banner.detected',
    occurredAt: '2026-05-19T08:14:12.000Z',
    metadata: { vendor_name: 'Eigene CMP', vendor_domain: 'self', vendor_category: 'cmp', vendor_country: 'DE' },
  },
  {
    id: 'evt-004',
    tenantId: DEMO_TENANT_ID,
    sourceUrl: DEMO_SOURCE_URL,
    type: 'form.email.detected',
    occurredAt: '2026-05-19T08:14:14.000Z',
    metadata: { vendor_name: 'eigenes Formular', vendor_domain: 'self', vendor_category: 'form', vendor_country: 'DE' },
  },
  {
    id: 'evt-005',
    tenantId: DEMO_TENANT_ID,
    sourceUrl: DEMO_SOURCE_URL,
    type: 'form.newsletter.detected',
    occurredAt: '2026-05-19T08:14:14.000Z',
    metadata: { vendor_name: 'Resend', vendor_domain: 'resend.com', vendor_category: 'email_provider', vendor_country: 'EU' },
  },
  {
    id: 'evt-006',
    tenantId: DEMO_TENANT_ID,
    sourceUrl: DEMO_SOURCE_URL,
    type: 'ai.endpoint.found',
    occurredAt: '2026-05-19T08:14:16.000Z',
    metadata: { vendor_name: 'Anthropic API', vendor_domain: 'api.anthropic.com', vendor_category: 'ai_provider', vendor_country: 'US' },
  },
  {
    id: 'evt-007',
    tenantId: DEMO_TENANT_ID,
    sourceUrl: DEMO_SOURCE_URL,
    type: 'ai.endpoint.found',
    occurredAt: '2026-05-19T08:14:16.000Z',
    metadata: { vendor_name: 'Ollama (self-hosted)', vendor_domain: 'ollama.local', vendor_category: 'ai_provider', vendor_country: 'DE' },
  },
  {
    id: 'evt-008',
    tenantId: DEMO_TENANT_ID,
    sourceUrl: DEMO_SOURCE_URL,
    type: 'vendor.unknown.detected',
    occurredAt: '2026-05-19T08:14:18.000Z',
    metadata: { vendor_domain: 'cdn.unbekannt-anbieter.io', vendor_category: 'unknown', vendor_country: 'unbekannt' },
  },
  {
    id: 'evt-009',
    tenantId: DEMO_TENANT_ID,
    sourceUrl: DEMO_SOURCE_URL,
    type: 'payment.endpoint.detected',
    occurredAt: '2026-05-19T08:14:20.000Z',
    metadata: { vendor_name: 'Stripe', vendor_domain: 'stripe.com', vendor_category: 'payment', vendor_country: 'EU' },
  },
  {
    id: 'evt-010',
    tenantId: DEMO_TENANT_ID,
    sourceUrl: DEMO_SOURCE_URL,
    type: 'media.embedded.detected',
    occurredAt: '2026-05-19T08:14:22.000Z',
    metadata: { vendor_name: 'YouTube', vendor_domain: 'youtube.com', vendor_category: 'embedded_media', vendor_country: 'US' },
  },
];

export const DEMO_VVT_ENTRIES: RuntimeVvtEntry[] = deriveVvtEntriesFromEvents(DEMO_RUNTIME_EVENTS);
