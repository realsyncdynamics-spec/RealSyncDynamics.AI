import { describe, expect, it } from 'vitest';
import {
  buildSkillManifest,
  runtimeSkillId,
} from '../../../../src/core/runtime/bindings/mapping';
import { ALL_SKILLS, SKILL_REGISTRY } from '../../../../src/lib/skills/registry';

describe('runtimeSkillId', () => {
  it('translates kebab-case keys to dot-namespaced snake_case IDs', () => {
    expect(runtimeSkillId('marketing-performance-analytics'))
      .toBe('skills.marketing_performance_analytics');
    expect(runtimeSkillId('data-exploration')).toBe('skills.data_exploration');
  });

  it('output matches the runtime manifest id regex', () => {
    const ID_RE = /^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)+$/;
    for (const skill of ALL_SKILLS) {
      expect(ID_RE.test(runtimeSkillId(skill.key))).toBe(true);
    }
  });
});

describe('buildSkillManifest', () => {
  it('every skill yields a structurally valid manifest', () => {
    for (const skill of ALL_SKILLS) {
      const m = buildSkillManifest(skill);
      expect(m.version).toBe(1);
      expect(m.title).toBe(skill.label);
      expect(m.description).toBe(skill.description);
      expect(m.capabilities.length).toBeGreaterThan(0);
      expect(m.idempotent).toBe(true);
    }
  });

  it('reviewRequired skills are never auto-approve', () => {
    for (const skill of ALL_SKILLS) {
      if (!skill.reviewRequired) continue;
      expect(buildSkillManifest(skill).auto_approve, skill.key).toBe(false);
    }
  });

  it('high-risk skills are never auto-approve', () => {
    for (const skill of ALL_SKILLS) {
      const m = buildSkillManifest(skill);
      if (m.risk_level === 'high') {
        expect(m.auto_approve, skill.key).toBe(false);
      }
    }
  });

  it('auto-approve manifests have no write/pii capabilities', () => {
    for (const skill of ALL_SKILLS) {
      const m = buildSkillManifest(skill);
      if (!m.auto_approve) continue;
      for (const cap of m.capabilities) {
        expect(cap.startsWith('write:'), `${skill.key}/${cap}`).toBe(false);
        expect(cap.startsWith('pii:'), `${skill.key}/${cap}`).toBe(false);
        expect(cap, `${skill.key}`).not.toBe('consent:write');
      }
    }
  });

  it('sales-draft-outreach gets a high-risk override + write capability', () => {
    const m = buildSkillManifest(SKILL_REGISTRY['sales-draft-outreach']);
    expect(m.risk_level).toBe('high');
    expect(m.auto_approve).toBe(false);
    expect(m.capabilities).toContain('write:outreach_drafts');
  });

  it('legal-compliance gets the network:external capability for web research', () => {
    const m = buildSkillManifest(SKILL_REGISTRY['legal-compliance']);
    expect(m.capabilities).toContain('network:external');
  });
});
