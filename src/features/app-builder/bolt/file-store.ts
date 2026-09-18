import type { FileRecord, FileSnapshot } from './types';
import { merkleOf, sha256Hex } from './hash';
import { normalizeProjectPath } from './path-guard';

export class FileStore {
  #files = new Map<string, FileRecord>();

  list(): FileRecord[] {
    return [...this.#files.values()].sort((a, b) => a.path.localeCompare(b.path));
  }

  get(path: string): FileRecord | undefined {
    const n = normalizeProjectPath(path);
    return n ? this.#files.get(n) : undefined;
  }

  tree(): { path: string; kind: 'file' }[] {
    return this.list().map((f) => ({ path: f.path, kind: 'file' as const }));
  }

  async write(path: string, content: string): Promise<FileRecord> {
    const n = normalizeProjectPath(path);
    if (!n) throw new Error(`Rejected path: ${path}`);
    const prev = this.#files.get(n);
    const rec: FileRecord = {
      path: n,
      content,
      sha256: await sha256Hex(content),
      updatedAt: new Date().toISOString(),
      revision: (prev?.revision ?? 0) + 1,
    };
    this.#files.set(n, rec);
    return rec;
  }

  remove(path: string): boolean {
    const n = normalizeProjectPath(path);
    if (!n) return false;
    return this.#files.delete(n);
  }

  clear(): void {
    this.#files.clear();
  }

  async snapshot(): Promise<FileSnapshot> {
    const files: Record<string, FileRecord> = {};
    const hashes: Record<string, string> = {};
    for (const rec of this.list()) {
      files[rec.path] = rec;
      hashes[rec.path] = rec.sha256;
    }
    return {
      files,
      merkle: await merkleOf(hashes),
      capturedAt: new Date().toISOString(),
    };
  }
}
