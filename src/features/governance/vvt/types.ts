// Runtime-VVT — Types für das technisch generierte Web-&-AI-Verfahrensverzeichnis.
//
// Hinweis: Diese Strukturen modellieren Vorschläge aus Runtime-Signalen,
// keine rechtliche Bewertung. Felder mit "_hint" Suffix sind ausdrücklich
// Vorschläge, die ein:e Datenschutzbeauftragte:r bzw. Admin prüfen muss.

export type VvtProcessingType =
  | 'website_tracking'
  | 'contact_form'
  | 'newsletter_form'
  | 'ai_endpoint'
  | 'third_party_script'
  | 'analytics'
  | 'payment'
  | 'embedded_media'
  | 'unknown';

export type VvtLegalBasisHint =
  | 'consent'
  | 'contract'
  | 'legitimate_interest'
  | 'legal_obligation'
  | 'unknown';

export type VvtAiActRelevance =
  | 'none'
  | 'possible'
  | 'likely'
  | 'high_risk_review_required';

export type VvtRiskLevel = 'low' | 'medium' | 'high' | 'critical';

export type VvtReviewStatus = 'draft' | 'review_required' | 'approved' | 'rejected';

export type VvtTransferRiskHint = 'low' | 'medium' | 'high' | 'unknown';

export interface VvtVendor {
  name:                string;
  domain:              string;
  category:            string;
  country_hint:        string;
  dpa_required:        boolean;
  transfer_risk_hint:  VvtTransferRiskHint;
}

export interface RuntimeVvtEntry {
  id:                          string;
  tenant_id:                   string;
  source_url:                  string;
  processing_name:             string;
  processing_type:             VvtProcessingType;
  detected_from_event_ids:     string[];
  vendors:                     VvtVendor[];
  data_categories:             string[];
  affected_persons:            string[];
  purposes:                    string[];
  legal_basis_hint:            VvtLegalBasisHint;
  third_country_transfer:      boolean;
  ai_act_relevance:            VvtAiActRelevance;
  risk_level:                  VvtRiskLevel;
  evidence_refs:               string[];
  review_status:               VvtReviewStatus;
  created_at:                  string;
  updated_at:                  string;
}
