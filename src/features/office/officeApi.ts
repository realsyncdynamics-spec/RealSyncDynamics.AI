// officeApi.ts — typisierter Supabase-Zugriff auf die Office-OS-Tabellen.
// RLS stellt sicher, dass nur Tenant-Mitglieder lesen/schreiben; jede
// schreibende Aktion wird zusaetzlich im office_audit_log (Pruefpfad) vermerkt.
import { getSupabase } from '../../lib/supabase';
import type {
  OfficeArtifact,
  OfficeArtifactKind,
  OfficeArtifactStatus,
  OfficeArtifactVersion,
  OfficeAuditAction,
  OfficeAuditEntry,
  NewOfficeArtifact,
} from './officeTypes';

const ARTIFACTS = 'office_artifacts';
const VERSIONS = 'office_artifact_versions';
const AUDIT = 'office_audit_log';

/** Listet Artefakte eines Mandanten, optional nach Bereich gefiltert. */
export async function listArtifacts(
  tenantId: string,
  kind?: OfficeArtifactKind,
): Promise<OfficeArtifact[]> {
  let query = getSupabase()
    .from(ARTIFACTS)
    .select('*')
    .eq('tenant_id', tenantId)
    .order('updated_at', { ascending: false });
  if (kind) query = query.eq('kind', kind);

  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as OfficeArtifact[];
}

/** Lädt ein einzelnes Artefakt. */
export async function getArtifact(id: string): Promise<OfficeArtifact | null> {
  const { data, error } = await getSupabase()
    .from(ARTIFACTS)
    .select('*')
    .eq('id', id)
    .maybeSingle();
  if (error) throw error;
  return (data as OfficeArtifact) ?? null;
}

/** Legt ein Artefakt an und schreibt einen 'created'-Pruefpfad-Eintrag. */
export async function createArtifact(input: NewOfficeArtifact): Promise<OfficeArtifact> {
  const { data, error } = await getSupabase()
    .from(ARTIFACTS)
    .insert(input)
    .select('*')
    .single();
  if (error) throw error;
  const artifact = data as OfficeArtifact;
  await logAudit(artifact.tenant_id, 'created', {
    artifactId: artifact.id,
    detail: { kind: artifact.kind, title: artifact.title },
  });
  return artifact;
}

/** Aktualisiert Felder eines Artefakts und protokolliert die Änderung. */
export async function updateArtifact(
  id: string,
  patch: Partial<Pick<OfficeArtifact, 'title' | 'status' | 'classification' | 'version' | 'owner' | 'data'>>,
): Promise<OfficeArtifact> {
  const { data, error } = await getSupabase()
    .from(ARTIFACTS)
    .update(patch)
    .eq('id', id)
    .select('*')
    .single();
  if (error) throw error;
  const artifact = data as OfficeArtifact;
  const action: OfficeAuditAction = patch.status ? 'status_changed' : 'updated';
  await logAudit(artifact.tenant_id, action, { artifactId: artifact.id, detail: patch });
  return artifact;
}

/**
 * Veröffentlicht eine neue Version: schreibt einen append-only Versions-Snapshot
 * und vermerkt 'version_published' im Pruefpfad.
 */
export async function publishVersion(
  artifact: OfficeArtifact,
  snapshot: Record<string, unknown>,
  contentHash?: string,
): Promise<OfficeArtifactVersion> {
  const { data, error } = await getSupabase()
    .from(VERSIONS)
    .insert({
      tenant_id: artifact.tenant_id,
      artifact_id: artifact.id,
      version: artifact.version,
      snapshot,
      content_hash: contentHash ?? null,
    })
    .select('*')
    .single();
  if (error) throw error;
  const version = data as OfficeArtifactVersion;
  await logAudit(artifact.tenant_id, 'version_published', {
    artifactId: artifact.id,
    detail: { version: version.version, contentHash: version.content_hash },
  });
  return version;
}

/** Liest die Versionshistorie eines Artefakts (neueste zuerst). */
export async function listVersions(artifactId: string): Promise<OfficeArtifactVersion[]> {
  const { data, error } = await getSupabase()
    .from(VERSIONS)
    .select('*')
    .eq('artifact_id', artifactId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as OfficeArtifactVersion[];
}

/** Schreibt einen append-only Pruefpfad-Eintrag. */
export async function logAudit(
  tenantId: string,
  action: OfficeAuditAction,
  opts: { artifactId?: string | null; detail?: Record<string, unknown> } = {},
): Promise<void> {
  const { error } = await getSupabase().from(AUDIT).insert({
    tenant_id: tenantId,
    artifact_id: opts.artifactId ?? null,
    action,
    detail: opts.detail ?? {},
  });
  if (error) throw error;
}

/** Liest den Pruefpfad eines Mandanten, optional auf ein Artefakt gefiltert. */
export async function listAudit(
  tenantId: string,
  artifactId?: string,
): Promise<OfficeAuditEntry[]> {
  let query = getSupabase()
    .from(AUDIT)
    .select('*')
    .eq('tenant_id', tenantId)
    .order('created_at', { ascending: false });
  if (artifactId) query = query.eq('artifact_id', artifactId);

  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as OfficeAuditEntry[];
}

/** Aggregierte Kennzahlen pro Status für die Bereichs-Metriken. */
export function countByStatus(
  artifacts: OfficeArtifact[],
): Record<OfficeArtifactStatus, number> {
  const base: Record<OfficeArtifactStatus, number> = {
    entwurf: 0, pruefung: 0, freigegeben: 0, abgelaufen: 0, archiviert: 0,
  };
  for (const a of artifacts) base[a.status] += 1;
  return base;
}
