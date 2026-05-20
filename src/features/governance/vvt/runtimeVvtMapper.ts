/**
 * runtimeVvtMapper — leitet aus Runtime-Events VVT-Entwurfseintraege ab.
 *
 * Regel: jeder Mapping-Ausgang ist ein HINWEIS, keine Rechtsaussage.
 * Im Zweifel: reviewStatus='review_required', legalBasisHint='unknown',
 * aiActRelevance='possible' — niemals 'approved'.
 *
 * Mapping-Tabelle (Auszug, vollstaendig in der README):
 *   tracker.pre_consent.detected → website_tracking, legalBasis=consent, risk=high
 *   form.email.detected          → contact_form, legalBasis=unknown,  risk=medium
 *   ai.endpoint.found            → ai_endpoint, aiActRelevance=possible
 *   vendor.unknown.detected      → third_party_script, vendor.dpaRequired=true
 *   cookie.banner.detected       → website_tracking, legalBasis=consent
 *
 * Aggregation:
 *   Mehrere Events mit gleicher (sourceUrl, processingType, vendor.domain)
 *   werden zu EINEM Entry zusammengefasst — alle Event-IDs landen in
 *   `detectedFromEventIds`, alle Vendors werden dedupliziert.
 */

import type {
  RuntimeEvent,
  RuntimeVvtEntry,
  VvtAiActRelevance,
  VvtLegalBasisHint,
  VvtProcessingType,
  VvtRiskLevel,
  VvtVendor,
} from './types';

interface MappingSeed {
  processingType: VvtProcessingType;
  processingName: string;
  legalBasisHint: VvtLegalBasisHint;
  riskLevel: VvtRiskLevel;
  aiActRelevance: VvtAiActRelevance;
  dataCategories: string[];
  affectedPersons: string[];
  purposes: string[];
  vendorDpaRequired: boolean;
}

function seedForEvent(event: RuntimeEvent): MappingSeed {
  switch (event.type) {
    case 'tracker.pre_consent.detected':
      return {
        processingType: 'website_tracking',
        processingName: 'Website-Tracking vor Consent',
        legalBasisHint: 'consent',
        riskLevel: 'high',
        aiActRelevance: 'none',
        dataCategories: ['nutzungsdaten', 'geraete_id', 'ip_adresse'],
        affectedPersons: ['website_besucher'],
        purposes: ['analyse', 'reichweitenmessung'],
        vendorDpaRequired: true,
      };
    case 'cookie.banner.detected':
      return {
        processingType: 'website_tracking',
        processingName: 'Consent-Banner (CMP)',
        legalBasisHint: 'consent',
        riskLevel: 'medium',
        aiActRelevance: 'none',
        dataCategories: ['einwilligungs_status'],
        affectedPersons: ['website_besucher'],
        purposes: ['einwilligungs_management'],
        vendorDpaRequired: false,
      };
    case 'form.email.detected':
      return {
        processingType: 'contact_form',
        processingName: 'Kontaktformular',
        legalBasisHint: 'unknown',
        riskLevel: 'medium',
        aiActRelevance: 'none',
        dataCategories: ['email', 'kontaktdaten', 'nachrichten_inhalt'],
        affectedPersons: ['interessenten', 'kunden'],
        purposes: ['kommunikation'],
        vendorDpaRequired: false,
      };
    case 'form.newsletter.detected':
      return {
        processingType: 'newsletter_form',
        processingName: 'Newsletter-Anmeldung',
        legalBasisHint: 'consent',
        riskLevel: 'medium',
        aiActRelevance: 'none',
        dataCategories: ['email', 'einwilligungs_status'],
        affectedPersons: ['interessenten'],
        purposes: ['marketing_kommunikation'],
        vendorDpaRequired: true,
      };
    case 'ai.endpoint.found':
      return {
        processingType: 'ai_endpoint',
        processingName: 'Aufruf eines KI-Endpunkts',
        legalBasisHint: 'unknown',
        riskLevel: 'high',
        aiActRelevance: 'possible',
        dataCategories: ['frei_text', 'kontext_daten'],
        affectedPersons: ['nutzer', 'mitarbeiter'],
        purposes: ['ki_inferenz'],
        vendorDpaRequired: true,
      };
    case 'vendor.unknown.detected':
      return {
        processingType: 'third_party_script',
        processingName: 'Unbekannter Drittanbieter',
        legalBasisHint: 'unknown',
        riskLevel: 'high',
        aiActRelevance: 'possible',
        dataCategories: ['unbekannt'],
        affectedPersons: ['website_besucher'],
        purposes: ['unbekannt'],
        vendorDpaRequired: true,
      };
    case 'payment.endpoint.detected':
      return {
        processingType: 'payment',
        processingName: 'Zahlungsabwicklung',
        legalBasisHint: 'contract',
        riskLevel: 'medium',
        aiActRelevance: 'none',
        dataCategories: ['zahlungsdaten', 'rechnungsadresse'],
        affectedPersons: ['kunden'],
        purposes: ['vertragsabwicklung'],
        vendorDpaRequired: true,
      };
    case 'media.embedded.detected':
      return {
        processingType: 'embedded_media',
        processingName: 'Eingebettetes Medium (Drittquelle)',
        legalBasisHint: 'consent',
        riskLevel: 'medium',
        aiActRelevance: 'none',
        dataCategories: ['nutzungsdaten', 'ip_adresse'],
        affectedPersons: ['website_besucher'],
        purposes: ['inhalts_bereitstellung'],
        vendorDpaRequired: true,
      };
    case 'analytics.endpoint.detected':
      return {
        processingType: 'analytics',
        processingName: 'Analytics-Endpunkt',
        legalBasisHint: 'consent',
        riskLevel: 'medium',
        aiActRelevance: 'none',
        dataCategories: ['nutzungsdaten', 'geraete_id'],
        affectedPersons: ['website_besucher'],
        purposes: ['analyse'],
        vendorDpaRequired: true,
      };
    default:
      return {
        processingType: 'unknown',
        processingName: 'Unbekanntes Verfahren',
        legalBasisHint: 'unknown',
        riskLevel: 'medium',
        aiActRelevance: 'possible',
        dataCategories: ['unbekannt'],
        affectedPersons: ['unbekannt'],
        purposes: ['unbekannt'],
        vendorDpaRequired: true,
      };
  }
}

function vendorFromMetadata(event: RuntimeEvent, dpaRequired: boolean): VvtVendor | null {
  const meta = event.metadata ?? {};
  const domain = typeof meta.vendor_domain === 'string' ? meta.vendor_domain : null;
  if (!domain) return null;
  const name = typeof meta.vendor_name === 'string' ? meta.vendor_name : domain;
  const category = typeof meta.vendor_category === 'string' ? meta.vendor_category : 'unbekannt';
  const countryHint = typeof meta.vendor_country === 'string' ? meta.vendor_country : 'unbekannt';
  const transferRiskHint =
    countryHint === 'DE' || countryHint === 'EU' ? 'low' :
    countryHint === 'US' ? 'high' :
    countryHint === 'unbekannt' ? 'unknown' : 'medium';
  return { name, domain, category, countryHint, dpaRequired, transferRiskHint };
}

function aggregationKey(sourceUrl: string, type: VvtProcessingType, vendorDomain: string): string {
  return `${sourceUrl}::${type}::${vendorDomain}`;
}

function mergeVendors(existing: VvtVendor[], incoming: VvtVendor | null): VvtVendor[] {
  if (!incoming) return existing;
  if (existing.some((v) => v.domain === incoming.domain)) return existing;
  return [...existing, incoming];
}

function unique(values: string[]): string[] {
  return Array.from(new Set(values));
}

/**
 * Hauptfunktion: Events → VVT-Entwurfseintraege.
 *
 * Deterministisch — gleiches Input liefert gleiches Output. Reihenfolge
 * der Eintraege bleibt stabil entlang der ersten Event-Reihenfolge je
 * Aggregationsschluessel.
 */
export function deriveVvtEntriesFromEvents(events: RuntimeEvent[]): RuntimeVvtEntry[] {
  const byKey = new Map<string, RuntimeVvtEntry>();

  for (const event of events) {
    const seed = seedForEvent(event);
    const vendor = vendorFromMetadata(event, seed.vendorDpaRequired);
    const vendorDomain = vendor?.domain ?? 'no_vendor';
    const key = aggregationKey(event.sourceUrl, seed.processingType, vendorDomain);

    const thirdCountry = vendor?.countryHint && !['DE', 'EU', 'unbekannt'].includes(vendor.countryHint);

    const existing = byKey.get(key);
    if (existing) {
      existing.detectedFromEventIds.push(event.id);
      existing.vendors = mergeVendors(existing.vendors, vendor);
      existing.dataCategories = unique([...existing.dataCategories, ...seed.dataCategories]);
      existing.affectedPersons = unique([...existing.affectedPersons, ...seed.affectedPersons]);
      existing.purposes = unique([...existing.purposes, ...seed.purposes]);
      // riskLevel: monotone Eskalation — einmal high, bleibt high.
      existing.riskLevel = escalateRisk(existing.riskLevel, seed.riskLevel);
      existing.aiActRelevance = escalateAiActRelevance(existing.aiActRelevance, seed.aiActRelevance);
      existing.thirdCountryTransfer = existing.thirdCountryTransfer || Boolean(thirdCountry);
      existing.updatedAt = event.occurredAt;
      continue;
    }

    const entry: RuntimeVvtEntry = {
      id: `vvt-draft-${key.replace(/[^a-z0-9]/gi, '-').toLowerCase()}`,
      tenantId: event.tenantId,
      sourceUrl: event.sourceUrl,
      processingName: seed.processingName,
      processingType: seed.processingType,
      detectedFromEventIds: [event.id],
      vendors: vendor ? [vendor] : [],
      dataCategories: seed.dataCategories.slice(),
      affectedPersons: seed.affectedPersons.slice(),
      purposes: seed.purposes.slice(),
      legalBasisHint: seed.legalBasisHint,
      thirdCountryTransfer: Boolean(thirdCountry),
      aiActRelevance: seed.aiActRelevance,
      riskLevel: seed.riskLevel,
      evidenceRefs: [],
      reviewStatus: 'review_required',
      createdAt: event.occurredAt,
      updatedAt: event.occurredAt,
    };
    byKey.set(key, entry);
  }

  return Array.from(byKey.values());
}

function escalateRisk(a: VvtRiskLevel, b: VvtRiskLevel): VvtRiskLevel {
  const order: VvtRiskLevel[] = ['low', 'medium', 'high', 'critical'];
  return order[Math.max(order.indexOf(a), order.indexOf(b))];
}

function escalateAiActRelevance(a: VvtAiActRelevance, b: VvtAiActRelevance): VvtAiActRelevance {
  const order: VvtAiActRelevance[] = ['none', 'possible', 'likely', 'high_risk_review_required'];
  return order[Math.max(order.indexOf(a), order.indexOf(b))];
}
