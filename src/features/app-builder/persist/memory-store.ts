/**
 * In-memory store with the same isolation rules as the Edge handler.
 * Used by unit tests and as the Grok-preview server Map. Production
 * writes go through siteos/code-persist + Postgres.
 */

import type {
  BuilderProjectRecord,
  PersistAuthz,
  PersistDenial,
  PersistOp,
  ProjectListItem,
} from './contract';
import { authorizePersist, bindTenant, validateFiles } from './contract';
import { merkleOfFiles } from '../bolt/hash';

export class MemoryProjectStore {
  #byTenant = new Map<string, BuilderProjectRecord[]>();

  private rows(tenantId: string): BuilderProjectRecord[] {
    return this.#byTenant.get(tenantId) ?? [];
  }

  private gate(authz: PersistAuthz, op: PersistOp): PersistDenial | null {
    const a = authorizePersist(authz, op);
    return a.ok ? null : a;
  }

  list(authz: PersistAuthz): ProjectListItem[] | PersistDenial {
    const denied = this.gate(authz, 'list');
    if (denied) return denied;
    const latest = new Map<string, BuilderProjectRecord>();
    for (const row of this.rows(authz.tenantId)) {
      if (row.status === 'archived') continue;
      if (row.tenantId !== authz.tenantId) continue;
      const prev = latest.get(row.slug);
      if (!prev || row.version > prev.version) latest.set(row.slug, row);
    }
    return [...latest.values()]
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
      .map((p) => ({
        id: p.id,
        slug: p.slug,
        title: p.title,
        updatedAt: p.updatedAt,
        fileCount: Object.keys(p.files).length,
        merkle: p.merkle,
        version: p.version,
      }));
  }

  load(authz: PersistAuthz, id: string): BuilderProjectRecord | null | PersistDenial {
    const denied = this.gate(authz, 'load');
    if (denied) return denied;
    if (!id) return { ok: false, status: 400, code: 'BAD_REQUEST', message: 'id required' };
    const row = this.rows(authz.tenantId).find((p) => p.id === id && p.tenantId === authz.tenantId);
    return row ?? { ok: false, status: 404, code: 'NOT_FOUND', message: 'project not found' };
  }

  async save(
    authz: PersistAuthz,
    incoming: Omit<BuilderProjectRecord, 'id' | 'tenantId' | 'createdBy' | 'version' | 'prevHash' | 'createdAt' | 'updatedAt' | 'status'> &
      Partial<Pick<BuilderProjectRecord, 'id' | 'status'>>,
  ): Promise<BuilderProjectRecord | PersistDenial> {
    const denied = this.gate(authz, 'save');
    if (denied) return denied;
    const bound = bindTenant(authz, incoming);
    const filesOk = validateFiles(bound.files);
    if (!filesOk.ok) return filesOk;
    const files = bound.files ?? {};
    const computed = await merkleOfFiles(files);
    if (bound.merkle && bound.merkle !== computed) {
      return { ok: false, status: 400, code: 'BAD_REQUEST', message: 'merkle does not match files' };
    }
    const now = new Date().toISOString();
    const existing = this.rows(authz.tenantId).filter(
      (p) => p.slug === bound.slug && p.tenantId === authz.tenantId && p.status !== 'archived',
    );
    const latest = existing.sort((a, b) => b.version - a.version)[0];
    if (latest && latest.merkle === computed) {
      return latest;
    }
    const row: BuilderProjectRecord = {
      id: crypto.randomUUID(),
      tenantId: authz.tenantId,
      createdBy: authz.actorId,
      slug: bound.slug,
      title: bound.title,
      files,
      merkle: computed,
      audit: bound.audit.slice(-80),
      messages: bound.messages.slice(-24),
      version: (latest?.version ?? 0) + 1,
      prevHash: latest?.merkle && latest.merkle.length === 64 ? latest.merkle : null,
      status: 'draft',
      createdAt: latest?.createdAt ?? now,
      updatedAt: now,
    };
    const bucket = this.#byTenant.get(authz.tenantId) ?? [];
    bucket.push(row);
    this.#byTenant.set(authz.tenantId, bucket);
    return row;
  }

  delete(authz: PersistAuthz, id: string): { ok: true } | PersistDenial {
    const denied = this.gate(authz, 'delete');
    if (denied) return denied;
    const bucket = this.rows(authz.tenantId);
    const row = bucket.find((p) => p.id === id && p.tenantId === authz.tenantId);
    if (!row) return { ok: false, status: 404, code: 'NOT_FOUND', message: 'project not found' };
    row.status = 'archived';
    row.updatedAt = new Date().toISOString();
    return { ok: true };
  }
}

export function isDenial(v: unknown): v is PersistDenial {
  return Boolean(v) && typeof v === 'object' && (v as PersistDenial).ok === false;
}
