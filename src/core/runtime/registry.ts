import type { SkillManifest } from './types';

/**
 * In-memory registry of skill manifests. Phase 0 only — no persistence,
 * no hot reload. A skill is registered once at boot and never mutated.
 */
export class SkillRegistry {
  readonly #skills = new Map<string, SkillManifest>();

  register(manifest: SkillManifest): void {
    if (this.#skills.has(manifest.id)) {
      throw new Error(`Skill already registered: ${manifest.id}`);
    }
    const issues = validateManifestShape(manifest);
    if (issues.length > 0) {
      throw new Error(
        `Invalid skill manifest ${manifest.id}: ${issues.join('; ')}`,
      );
    }
    this.#skills.set(manifest.id, Object.freeze({ ...manifest }));
  }

  get(id: string): SkillManifest | undefined {
    return this.#skills.get(id);
  }

  has(id: string): boolean {
    return this.#skills.has(id);
  }

  list(): readonly SkillManifest[] {
    return Array.from(this.#skills.values());
  }

  /** Test helper. Not for production use. */
  clear(): void {
    this.#skills.clear();
  }
}

function validateManifestShape(m: SkillManifest): string[] {
  const issues: string[] = [];
  if (!m.id || !/^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)+$/.test(m.id)) {
    issues.push('id must be dot-namespaced lowercase, e.g. "audit.cookie_scan"');
  }
  if (m.version !== 1) issues.push('version must be 1');
  if (!m.title?.trim()) issues.push('title is required');
  if (!m.description?.trim()) issues.push('description is required');
  if (!Array.isArray(m.capabilities)) issues.push('capabilities must be an array');
  if (m.auto_approve) {
    const writes = m.capabilities.some((c) =>
      c.startsWith('write:') || c.startsWith('consent:write') || c.startsWith('pii:'),
    );
    if (writes) {
      issues.push('auto_approve is forbidden when capabilities include writes or PII');
    }
    if (m.risk_level !== 'low') {
      issues.push('auto_approve requires risk_level "low"');
    }
  }
  return issues;
}
