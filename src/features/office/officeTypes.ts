// officeTypes.ts — TypeScript-Typen passend zum office_*-Schema
// (Migration 20260626000000_office_os_schema.sql).
import type { OfficeAreaId } from './officeAreas';

/** Entspricht office_artifacts.kind (= OfficeAreaId). */
export type OfficeArtifactKind = OfficeAreaId;

/** Entspricht office_artifacts.status. */
export type OfficeArtifactStatus =
  | 'entwurf'
  | 'pruefung'
  | 'freigegeben'
  | 'abgelaufen'
  | 'archiviert';

/** Entspricht office_artifacts.classification (DB nutzt 'oeffentlich'). */
export type OfficeClassification = 'oeffentlich' | 'intern' | 'vertraulich';

/** Entspricht office_audit_log.action. */
export type OfficeAuditAction =
  | 'created'
  | 'updated'
  | 'status_changed'
  | 'version_published'
  | 'classified'
  | 'exported'
  | 'viewed'
  | 'deleted';

export interface OfficeArtifact {
  id: string;
  tenant_id: string;
  kind: OfficeArtifactKind;
  title: string;
  status: OfficeArtifactStatus;
  classification: OfficeClassification;
  version: string;
  owner: string | null;
  /** Bereichsspezifische Felder (slides, renewal_date, review_cycle …). */
  data: Record<string, unknown>;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface OfficeArtifactVersion {
  id: string;
  tenant_id: string;
  artifact_id: string;
  version: string;
  snapshot: Record<string, unknown>;
  content_hash: string | null;
  changed_by: string | null;
  created_at: string;
}

export interface OfficeAuditEntry {
  id: string;
  tenant_id: string;
  artifact_id: string | null;
  action: OfficeAuditAction;
  actor: string | null;
  detail: Record<string, unknown>;
  created_at: string;
}

/** Eingabe zum Anlegen eines Artefakts (tenant_id wird vom Aufrufer gesetzt). */
export interface NewOfficeArtifact {
  tenant_id: string;
  kind: OfficeArtifactKind;
  title: string;
  status?: OfficeArtifactStatus;
  classification?: OfficeClassification;
  version?: string;
  owner?: string | null;
  data?: Record<string, unknown>;
  created_by?: string | null;
}
