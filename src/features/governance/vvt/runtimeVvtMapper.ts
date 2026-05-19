// Mapper: Runtime-Events -> Runtime-VVT-Einträge.
//
// Tolerant gegenüber der Event-Form: erwartet ausschließlich ein `type`-Feld
// und nimmt weitere Felder per optionalem Lookup entgegen. So bleibt der
// Mapper unabhängig vom konkreten Event-Schema in `src/runtime` und kann
// mit Demo-Daten ebenso wie mit echten Runtime-Signalen umgehen.

import type {
  RuntimeVvtEntry,
  VvtAiActRelevance,
  VvtLegalBasisHint,
  VvtProcessingType,
  VvtRiskLevel,
  VvtTransferRiskHint,
  VvtVendor,
} from './types';

export interface RuntimeEvent {
  type:        string;
  id?:         string;
  tenant_id?:  string;
  source_url?: string;
  occurred_at?: string;
  evidence_refs?: string[];
  payload?:    Record<string, unknown>;
}

interface DraftEntry {
  processing_type:    VvtProcessingType;
  processing_name:    string;
  data_categories:    string[];
  affected_persons:   string[];
  purposes:           string[];
  legal_basis_hint:   VvtLegalBasisHint;
  ai_act_relevance:   VvtAiActRelevance;
  risk_level:         VvtRiskLevel;
  vendors:            VvtVendor[];
  review_status:      RuntimeVvtEntry['review_status'];
  third_country_transfer: boolean;
}

const SUPPORTED_EVENT_TYPES = new Set<string>([
  'tracker.pre_consent.detected',
  'form.email.detected',
  'ai.endpoint.found',
  'vendor.unknown.detected',
  'cookie.banner.detected',
]);

function readString(payload: Record<string, unknown> | undefined, key: string): string | undefined {
  const value = payload?.[key];
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

function readBoolean(payload: Record<string, unknown> | undefined, key: string): boolean | undefined {
  const value = payload?.[key];
  return typeof value === 'boolean' ? value : undefined;
}

function readStringArray(payload: Record<string, unknown> | undefined, key: string): string[] | undefined {
  const value = payload?.[key];
  if (!Array.isArray(value)) return undefined;
  return value.filter((entry): entry is string => typeof entry === 'string');
}

function vendorFromPayload(payload: Record<string, unknown> | undefined): VvtVendor | null {
  if (!payload) return null;
  const name        = readString(payload, 'vendor_name')   ?? readString(payload, 'name');
  const domain      = readString(payload, 'vendor_domain') ?? readString(payload, 'domain');
  if (!name && !domain) return null;
  const country     = readString(payload, 'country_hint')  ?? '';
  const transferRisk = inferTransferRisk(country);
  return {
    name:               name   ?? domain ?? 'Unbekannter Vendor',
    domain:             domain ?? '',
    category:           readString(payload, 'category') ?? 'unknown',
    country_hint:       country,
    dpa_required:       readBoolean(payload, 'dpa_required') ?? true,
    transfer_risk_hint: transferRisk,
  };
}

function inferTransferRisk(countryHint: string): VvtTransferRiskHint {
  const country = countryHint.trim().toUpperCase();
  if (!country) return 'unknown';
  // EU/EEA-Heuristik: keine abschließende Liste, nur Hinweis.
  const eea = new Set([
    'DE','AT','FR','IT','ES','NL','BE','LU','PT','IE','FI','SE','DK',
    'PL','CZ','SK','HU','SI','HR','EE','LV','LT','BG','RO','GR','MT','CY',
    'IS','LI','NO',
  ]);
  if (eea.has(country)) return 'low';
  if (country === 'US' || country === 'CN' || country === 'RU') return 'high';
  return 'medium';
}

function buildDraft(event: RuntimeEvent): DraftEntry | null {
  const payload = event.payload;

  switch (event.type) {
    case 'tracker.pre_consent.detected': {
      const vendorName = readString(payload, 'vendor_name') ?? readString(payload, 'vendor') ?? 'Tracker';
      return {
        processing_type:  'website_tracking',
        processing_name:  `Tracking vor Einwilligung: ${vendorName}`,
        data_categories:  readStringArray(payload, 'data_categories')  ?? ['device_id', 'ip_address', 'usage_data'],
        affected_persons: readStringArray(payload, 'affected_persons') ?? ['website_visitors'],
        purposes:         readStringArray(payload, 'purposes')         ?? ['Analyse', 'Reichweitenmessung'],
        legal_basis_hint: 'consent',
        ai_act_relevance: 'none',
        risk_level:       'high',
        vendors:          vendorFromPayload(payload) ? [vendorFromPayload(payload)!] : [],
        review_status:    'review_required',
        third_country_transfer: readBoolean(payload, 'third_country_transfer') ?? false,
      };
    }
    case 'form.email.detected': {
      const formName = readString(payload, 'form_name') ?? 'Formular mit E-Mail-Feld';
      return {
        processing_type:  'contact_form',
        processing_name:  formName,
        data_categories:  readStringArray(payload, 'data_categories')  ?? ['email', 'contact_data'],
        affected_persons: readStringArray(payload, 'affected_persons') ?? ['interessenten', 'kunden'],
        purposes:         readStringArray(payload, 'purposes')         ?? ['Kontaktaufnahme'],
        legal_basis_hint: 'unknown',
        ai_act_relevance: 'none',
        risk_level:       'medium',
        vendors:          vendorFromPayload(payload) ? [vendorFromPayload(payload)!] : [],
        review_status:    'review_required',
        third_country_transfer: readBoolean(payload, 'third_country_transfer') ?? false,
      };
    }
    case 'ai.endpoint.found': {
      const provider = readString(payload, 'provider') ?? readString(payload, 'vendor_name') ?? 'AI-Anbieter';
      return {
        processing_type:  'ai_endpoint',
        processing_name:  `AI-Endpunkt: ${provider}`,
        data_categories:  readStringArray(payload, 'data_categories')  ?? ['nutzeranfragen', 'prompt_inhalte'],
        affected_persons: readStringArray(payload, 'affected_persons') ?? ['nutzer:innen'],
        purposes:         readStringArray(payload, 'purposes')         ?? ['AI-gestützte Verarbeitung'],
        legal_basis_hint: 'unknown',
        ai_act_relevance: 'possible',
        risk_level:       'high',
        vendors:          vendorFromPayload(payload) ? [vendorFromPayload(payload)!] : [],
        review_status:    'review_required',
        third_country_transfer: readBoolean(payload, 'third_country_transfer') ?? false,
      };
    }
    case 'vendor.unknown.detected': {
      const vendor = vendorFromPayload(payload) ?? {
        name:               'Unbekannter Vendor',
        domain:             readString(payload, 'domain') ?? '',
        category:           'unknown',
        country_hint:       readString(payload, 'country_hint') ?? '',
        dpa_required:       true,
        transfer_risk_hint: 'unknown' as const,
      };
      const transferThird = readBoolean(payload, 'third_country_transfer')
        ?? (vendor.transfer_risk_hint === 'high' || vendor.transfer_risk_hint === 'medium');
      return {
        processing_type:  'third_party_script',
        processing_name:  `Drittanbieter-Skript: ${vendor.name}`,
        data_categories:  readStringArray(payload, 'data_categories')  ?? ['device_id', 'usage_data'],
        affected_persons: readStringArray(payload, 'affected_persons') ?? ['website_visitors'],
        purposes:         readStringArray(payload, 'purposes')         ?? ['Funktionalität / unklar'],
        legal_basis_hint: 'unknown',
        ai_act_relevance: 'none',
        risk_level:       'medium',
        vendors:          [{ ...vendor, dpa_required: true }],
        review_status:    'review_required',
        third_country_transfer: transferThird,
      };
    }
    case 'cookie.banner.detected': {
      return {
        processing_type:  'website_tracking',
        processing_name:  readString(payload, 'banner_name') ?? 'Consent-Banner erkannt',
        data_categories:  readStringArray(payload, 'data_categories')  ?? ['consent_state'],
        affected_persons: readStringArray(payload, 'affected_persons') ?? ['website_visitors'],
        purposes:         readStringArray(payload, 'purposes')         ?? ['Einwilligungsverwaltung'],
        legal_basis_hint: 'consent',
        ai_act_relevance: 'none',
        risk_level:       'low',
        vendors:          vendorFromPayload(payload) ? [vendorFromPayload(payload)!] : [],
        review_status:    'draft',
        third_country_transfer: false,
      };
    }
    default:
      return null;
  }
}

function nowIso(): string {
  return new Date().toISOString();
}

function entryId(event: RuntimeEvent, index: number): string {
  if (event.id) return `vvt_${event.id}`;
  return `vvt_${event.type.replace(/[^a-z0-9]+/gi, '_')}_${index}`;
}

/**
 * Aus einer Liste tolerant geformter Runtime-Events ableiten, welche
 * VVT-Einträge ein:e DSB prüfen sollte. Unbekannte Event-Typen werden
 * stillschweigend ignoriert.
 */
export function deriveVvtEntriesFromEvents(events: RuntimeEvent[]): RuntimeVvtEntry[] {
  const entries: RuntimeVvtEntry[] = [];
  events.forEach((event, index) => {
    if (!SUPPORTED_EVENT_TYPES.has(event.type)) return;
    const draft = buildDraft(event);
    if (!draft) return;
    const created = event.occurred_at ?? nowIso();
    entries.push({
      id:                       entryId(event, index),
      tenant_id:                event.tenant_id ?? 'unknown',
      source_url:               event.source_url ?? '',
      processing_name:          draft.processing_name,
      processing_type:          draft.processing_type,
      detected_from_event_ids:  event.id ? [event.id] : [],
      vendors:                  draft.vendors,
      data_categories:          draft.data_categories,
      affected_persons:         draft.affected_persons,
      purposes:                 draft.purposes,
      legal_basis_hint:         draft.legal_basis_hint,
      third_country_transfer:   draft.third_country_transfer,
      ai_act_relevance:         draft.ai_act_relevance,
      risk_level:               draft.risk_level,
      evidence_refs:            event.evidence_refs ?? [],
      review_status:            draft.review_status,
      created_at:               created,
      updated_at:               created,
    });
  });
  return entries;
}
