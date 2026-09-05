export interface MctAuthContext {
  keyId: string;
  tenantId: string;
  scopes: string[];
}

export interface EvidenceSnapshot {
  id: string;
  tenantId: string;
  subjectRef: string;
  label?: string;
  version: number;
  contentSha256: string;
  prevHash?: string;
  eventHash: string;
  signature?: string;
  retentionClass: string;
  retainedUntil?: Date;
  createdBy?: string;
  createdAt: Date;
  onHold?: boolean;
}

/**
 * Ein Control aus dem globalen Katalog.
 *
 * Bewusst **ohne** `status` und ohne `tenantId`: Der Katalog beschreibt, was
 * ein Framework fordert — nicht, wie weit ein Tenant es erfüllt. Der
 * Erfüllungsstand steht in `framework_implementations` und ist heute für
 * keinen Tenant erfasst. Ein Feld `status` an dieser Stelle würde ein Modell
 * dazu verleiten, den Katalog als Befund zu lesen.
 */
export interface FrameworkControl {
  id: string;
  /** Kennung innerhalb des Frameworks, z. B. „Art.10" oder „A.5.1". */
  controlCode: string;
  name: string;
  description?: string;
  guidance?: string;
  category?: string;
  severity?: string;
  /** Auflösbarer Framework-Schlüssel, z. B. `iso42001`. */
  framework: string;
  /**
   * Welcher der beiden Zuordnungswege diese Zeile geliefert hat — `relation`
   * über `framework_id`, `label` über die Textspalte. Offengelegt, weil sich
   * die beiden Bestände inhaltlich unterscheiden.
   */
  source: 'relation' | 'label';
}

export interface GovernanceControl {
  id: string;
  tenantId: string;
  controlId: string;
  name: string;
  description?: string;
  category: string;
  status: 'compliant' | 'non_compliant' | 'in_progress';
  riskLevel: 'critical' | 'high' | 'medium' | 'low';
  lastReviewedAt?: Date;
  updatedAt: Date;
}

export interface ComplianceStatus {
  tenantId: string;
  frameworkId: string;
  score: number;
  compliantControls: number;
  totalControls: number;
  criticalIssues: number;
  lastUpdated: Date;
}
