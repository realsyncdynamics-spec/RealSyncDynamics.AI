import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  recommendedSkillIds,
  resolveSkillSelections,
  type EntitlementRow,
  type SkillRow,
} from '../../supabase/functions/onboarding-automation-profile/profile';

const ent = (key: string, value: number | boolean): EntitlementRow => ({ key, value });

describe('AI onboarding automation profile', () => {
  it('recommends the free website audit without inventing paid skills', () => {
    const ids = recommendedSkillIds({
      orgType: 'sme',
      aiSystems: [],
      residencyPolicy: null,
      entitlements: [
        ent('website.scan', 1),
        ent('ai.tool.automations', 0),
        ent('reports.export', 0),
        ent('bots.enabled', 0),
      ],
    });

    expect(ids).toEqual(['dsgvo-audit']);
  });

  it('adds agency automation skills only when automation is entitled', () => {
    const base = {
      orgType: 'agency',
      aiSystems: ['chatgpt'],
      residencyPolicy: 'user_choice',
    };

    const locked = recommendedSkillIds({
      ...base,
      entitlements: [ent('website.scan', 1), ent('ai.tool.automations', 0)],
    });
    expect(locked).toEqual(['dsgvo-audit']);

    const enabled = recommendedSkillIds({
      ...base,
      entitlements: [
        ent('website.scan', 1),
        ent('ai.tool.automations', 1),
      ],
    });
    expect(enabled).toEqual([
      'dsgvo-audit',
      'meeting-compliance',
      'lead-risk',
      'screenshot-feedback',
    ]);
  });

  it('never marks an unbound runtime as ready', () => {
    const skills: SkillRow[] = [
      { id: 'dsgvo-audit', status: 'available', n8n_workflow_id: null },
      { id: 'lead-risk', status: 'available', n8n_workflow_id: 'lead-risk-v1' },
      { id: 'support-skill', status: 'planned', n8n_workflow_id: null },
    ];

    expect(resolveSkillSelections({
      recommendedIds: ['dsgvo-audit', 'lead-risk', 'support-skill'],
      skills,
      automationEntitled: true,
    })).toEqual([
      {
        skill_id: 'dsgvo-audit',
        state: 'needs_binding',
        reason: 'runtime_not_bound',
        executor: null,
      },
      {
        skill_id: 'lead-risk',
        state: 'ready',
        reason: 'entitled_and_bound',
        executor: 'n8n',
      },
      {
        skill_id: 'support-skill',
        state: 'planned',
        reason: 'catalog_planned',
        executor: null,
      },
    ]);
  });

  it('fails closed when the automation entitlement is missing', () => {
    expect(resolveSkillSelections({
      recommendedIds: ['lead-risk'],
      skills: [{ id: 'lead-risk', status: 'available', n8n_workflow_id: 'lead-risk-v1' }],
      automationEntitled: false,
    })[0]).toMatchObject({
      state: 'locked',
      reason: 'automation_not_entitled',
    });
  });
});

describe('SetupAssistant integration', () => {
  const source = readFileSync(
    resolve(__dirname, '../../src/features/onboarding/SetupAssistant.tsx'),
    'utf8',
  );

  it('generates the automation profile from explicit setup choices', () => {
    expect(source).toContain("'onboarding-automation-profile'");
    expect(source).toContain('tenant_id: activeTenantId');
    expect(source).toContain('ai_systems: state.ai_systems');
    expect(source).toContain('state.residency_chosen ? state.residency_policy : null');
  });

  it('does not block onboarding if profile generation is temporarily unavailable', () => {
    expect(source).toContain("console.warn('Setup: Automation-Profil nicht erzeugt:'");
    expect(source).toContain('await refresh();');
  });
});
