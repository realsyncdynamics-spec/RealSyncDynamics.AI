/**
 * Typen fuer das Runtime-VVT (Verfahrensverzeichnis aus Runtime-Events).
 *
 * Quelle: Ableitung aus Runtime-Ereignissen (tracker.pre_consent.detected,
 * form.email.detected, ai.endpoint.found, vendor.unknown.detected, ...).
 * Das Ergebnis ist KEIN finales VVT, sondern ein technisch generierter
 * Entwurf, der Human Review erfordert. Jedes Feld mit „...Hint" ist
 * explizit als Hinweis markiert, nicht als Rechtsaussage.
 */

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

export type VvtReviewStatus =
  | 'draft'
  | 'review_required'
  | 'approved'
  | 'rejected';

export type VvtTransferRiskHint = 'low' | 'medium' | 'high' | 'unknown';

/**
 * Anbieter / Drittpartei, die im Kontext eines Verfahrens auftaucht.
 * Werte sind Heuristik-getrieben — z. B. `category` ergibt sich aus
 * der Domain (google-analytics → analytics), kein verifiziertes
 * Vendor-Stammdaten-System.
 */
export interface VvtVendor {
  name: string;
  domain: string;
  category: string;
  countryHint: string;
  dpaRequired: boolean;
  transferRiskHint: VvtTransferRiskHint;
}

/**
 * Ein technisch erkanntes Verfahren — kandidat fuer einen VVT-Eintrag
 * nach Art. 30 DSGVO. Muss von einem DSB/Verantwortlichen freigegeben
 * werden, bevor er als „echter" VVT-Eintrag gilt.
 */
export interface RuntimeVvtEntry {
  id: string;
  tenantId: string;
  sourceUrl: string;

  processingName: string;
  processingType: VvtProcessingType;

  /** Welche Runtime-Events haben diesen Eintrag entstehen lassen. */
  detectedFromEventIds: string[];

  vendors: VvtVendor[];
  dataCategories: string[];
  affectedPersons: string[];
  purposes: string[];

  /** Hinweis auf eine plausible Rechtsgrundlage — keine Rechtsfreigabe. */
  legalBasisHint: VvtLegalBasisHint;

  thirdCountryTransfer: boolean;

  aiActRelevance: VvtAiActRelevance;
  riskLevel: VvtRiskLevel;

  /** Pointer in das Evidence-System (Hash, Pfad, oder ID). */
  evidenceRefs: string[];

  reviewStatus: VvtReviewStatus;

  createdAt: string;
  updatedAt: string;
}

/**
 * Eingangsformat des Mappers — passend zu Runtime-Events, die das
 * Audit-/Drift-System erzeugt. Nur die fuer Mapping relevanten Felder
 * sind hier hart typisiert; `metadata` ist offen.
 */
export interface RuntimeEvent {
  id: string;
  tenantId: string;
  sourceUrl: string;
  type: string;
  occurredAt: string;
  metadata?: Record<string, unknown>;
}
