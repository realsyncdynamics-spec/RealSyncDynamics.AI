/**
 * Tenant-isolated project persistence.
 *
 * Keys are namespaced by tenantId. There is no global listing.
 * A caller who only knows tenant B cannot read tenant A's records —
 * even in the same browser.
 */

import type { AuditRecord, FileRecord } from './types';

export interface BuilderProject {
  id: string;
  tenantId: string;
  slug: string;
  title: string;
  files: Record<string, string>;
  merkle: string;
  audit: AuditRecord[];
  messages: { role: 'user' | 'assistant' | 'system'; text: string; at: string }[];
  updatedAt: string;
}

export interface ProjectMeta {
  id: string;
  slug: string;
  title: string;
  updatedAt: string;
  fileCount: number;
  merkle: string;
}

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

const PREFIX = 'rsd.builder.v1.';

let injected: StorageLike | null = null;

export function setProjectStorage(storage: StorageLike | null): void {
  injected = storage;
}

function backend(): StorageLike | null {
  if (injected) return injected;
  if (typeof globalThis !== 'undefined' && 'localStorage' in globalThis) {
    try {
      return (globalThis as { localStorage: StorageLike }).localStorage;
    } catch {
      return null;
    }
  }
  return null;
}

function keyFor(tenantId: string): string {
  if (!tenantId) throw new Error('tenantId required');
  return PREFIX + tenantId;
}

function readAll(tenantId: string): BuilderProject[] {
  const store = backend();
  if (!store) return [];
  try {
    const raw = store.getItem(keyFor(tenantId));
    if (!raw) return [];
    const parsed = JSON.parse(raw) as BuilderProject[];
    return Array.isArray(parsed) ? parsed.filter((p) => p.tenantId === tenantId) : [];
  } catch {
    return [];
  }
}

function writeAll(tenantId: string, projects: BuilderProject[]): void {
  const store = backend();
  if (!store) return;
  store.setItem(keyFor(tenantId), JSON.stringify(projects.filter((p) => p.tenantId === tenantId)));
}

export function listProjects(tenantId: string): ProjectMeta[] {
  if (!tenantId) return [];
  return readAll(tenantId)
    .map((p) => ({
      id: p.id,
      slug: p.slug,
      title: p.title,
      updatedAt: p.updatedAt,
      fileCount: Object.keys(p.files).length,
      merkle: p.merkle,
    }))
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export function loadProject(tenantId: string, id: string): BuilderProject | null {
  if (!tenantId || !id) return null;
  return readAll(tenantId).find((p) => p.id === id && p.tenantId === tenantId) ?? null;
}

export function saveProject(project: BuilderProject): void {
  if (!project.tenantId) throw new Error('tenantId required');
  const all = readAll(project.tenantId);
  const next = all.filter((p) => p.id !== project.id);
  next.push({ ...project, tenantId: project.tenantId, updatedAt: new Date().toISOString() });
  writeAll(project.tenantId, next);
}

export function deleteProject(tenantId: string, id: string): void {
  if (!tenantId) return;
  writeAll(
    tenantId,
    readAll(tenantId).filter((p) => p.id !== id),
  );
}

export function filesFromRecords(records: FileRecord[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (const r of records) out[r.path] = r.content;
  return out;
}
