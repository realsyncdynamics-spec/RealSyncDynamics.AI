import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  SYSTEM_CLASSIFICATIONS,
  enforcementClassOf as sharedClassOf,
  verdictIsHonest as sharedVerdictIsHonest,
  type EnforcementClass,
  type Verdict,
} from '../../shared/enforcement-classes';
import {
  derivePolicyEnforcementClass,
  enforcementClassOf,
  normalizePolicyAction,
  validatePolicyUpdate,
  verdictIsHonest,
} from '../../supabase/functions/governance-resources/policyUpdate';
import {
  FALLBACK_PACK_TEMPLATES,
  inferPolicySystemType,
  planPackControlMappings,
  planPackPolicySeeding,
  type ExistingAssetControlMappingRow,
  type ExistingGovernancePolicyRow,
  type FrameworkControlRow,
  type PackControlRow,
  type PolicyRuleTemplateRow,
  type TenantAssetForAutoMap,
} from '../../supabase/functions/policy-packs/packActivation';

describe('governance-resources / update_policy Validierung & verdictIsHonest', () => {
  it('hält enforcementClassOf und verdictIsHonest synchron zu shared/enforcement-classes.ts', () => {
    for (const s of SYSTEM_CLASSIFICATIONS) {
      expect(enforcementClassOf(s.systemType)).toBe(sharedClassOf(s.systemType));
    }
    expect(enforcementClassOf('')).toBe(sharedClassOf(''));

    const classes: EnforcementClass[] = ['A', 'B', 'C', 'D'];
    const verdicts: Verdict[] = ['allow', 'log_only', 'warn', 'block', 'require_approval', 'react'];
    for (const k of classes) {
      for (const v of verdicts) {
        expect(verdictIsHonest(k, v), `${k}:${v}`).toBe(sharedVerdictIsHonest(k, v));
      }
    }
  });

  it('erlaubt block/require_approval/allow/log/warn für Klasse A (ai_gateway) und B (siteos_publish)', () => {
    for (const sys of ['ai_gateway', 'agent_runtime', 'siteos_publish']) {
      for (const action of ['allow', 'log', 'warn', 'block', 'require_approval'] as const) {
        const res = validatePolicyUpdate({ action }, { system_type: sys });
        expect(res.ok, `${sys} -> ${action}`).toBe(true);
        if (res.ok) {
          expect(res.patch.action).toBe(action);
          expect(res.patch.enforce_action).toBe(action);
        }
      }
    }
  });

  it('normalisiert UI-Verdikt log_only auf DB-Action log', () => {
    expect(normalizePolicyAction('log_only')).toBe('log');
    const res = validatePolicyUpdate({ action: 'log_only' }, { system_type: 'microsoft365' });
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.patch.action).toBe('log');
      expect(res.verdict).toBe('log_only');
      expect(res.klasse).toBe('C');
    }
  });

  it('weist unehrliche Verdikte (block, require_approval, allow) auf Klasse C und D mit 422 ab', () => {
    for (const action of ['block', 'require_approval', 'allow']) {
      const resC = validatePolicyUpdate({ action }, { system_type: 'microsoft365' });
      expect(resC.ok).toBe(false);
      if (!resC.ok) {
        expect(resC.status).toBe(422);
        expect(resC.code).toBe('UNHONEST_VERDICT');
      }
    }
    const resD = validatePolicyUpdate({ action: 'warn' }, { system_type: 'browser_direct' });
    expect(resD.ok).toBe(false);
    if (!resD.ok) {
      expect(resD.status).toBe(422);
      expect(resD.code).toBe('UNHONEST_VERDICT');
    }
  });

  it('erlaubt isoliertes enabled-Update auch auf Klasse C/D und weist leere Payloads ab', () => {
    const resEnabled = validatePolicyUpdate({ enabled: false }, { system_type: 'browser_direct' });
    expect(resEnabled.ok).toBe(true);
    if (resEnabled.ok) {
      expect(resEnabled.patch).toEqual({ enabled: false });
    }

    const resEmpty = validatePolicyUpdate({}, { system_type: 'ai_gateway' });
    expect(resEmpty.ok).toBe(false);
    if (!resEmpty.ok) {
      expect(resEmpty.status).toBe(400);
    }
  });

  it('leitet Klasse A aus event_source=agent_runtime ab, wenn system_type fehlt', () => {
    expect(derivePolicyEnforcementClass({ event_source: 'agent_runtime' })).toBe('A');
    expect(derivePolicyEnforcementClass({})).toBe('C');
  });
});

describe('policy-packs / idempotentes Policy-Seeding & computeAutoMappings bei activate', () => {
  const TENANT_ID = 'e6b3c8dd-d91a-42ca-b12f-d77a1bfd59fc';

  it('legt fehlende Standard-Policies idempotent an und ergänzt condition.system_type', () => {
    const dbTemplates: PolicyRuleTemplateRow[] = [
      {
        template_id: 'dsgvo-art9-special-categories-block',
        pack_id: 'dsgvo-essentials',
        version: 1,
        name: 'DSGVO Art. 9 Block',
        description: 'Blockiert Art. 9 Daten',
        policy_type: 'gdpr',
        severity: 'critical',
        condition: { event_source: 'agent_runtime', contains_special_category_pii: true },
        action: 'block',
        enabled_by_default: true,
      },
      {
        template_id: 'tdddg-analytics-without-consent-block',
        pack_id: 'tdddg-consent',
        version: 1,
        name: 'TDDDG Analytics Block',
        description: null,
        policy_type: 'gdpr',
        severity: 'high',
        condition: { consent_analytics: false, tracker_category: 'analytics' },
        action: 'block',
        enabled_by_default: true,
      },
    ];

    const first = planPackPolicySeeding(
      TENANT_ID,
      ['dsgvo-essentials', 'tdddg-consent', 'dora-financial'],
      dbTemplates,
      [],
    );
    // 2 aus DB + 1 Fallback für dora-financial
    expect(first.toInsert).toHaveLength(3);
    expect(first.toInsert[0].condition.system_type).toBe('agent_runtime');
    expect(first.toInsert[1].condition.system_type).toBe('siteos_publish');
    expect(first.toInsert[2].condition.system_type).toBe('ai_gateway');

    // Zweiter Lauf mit bestehenden Policies ist 100% idempotent (0 neue Zeilen)
    const existing: ExistingGovernancePolicyRow[] = first.toInsert.map((r, i) => ({
      id: `pol-${i}`,
      source_template_id: r.source_template_id,
      source_pack_id: r.source_pack_id,
      name: r.name,
      condition: r.condition,
    }));
    const second = planPackPolicySeeding(
      TENANT_ID,
      ['dsgvo-essentials', 'tdddg-consent', 'dora-financial'],
      dbTemplates,
      existing,
    );
    expect(second.toInsert).toHaveLength(0);
    expect(second.toUpgradeCondition).toHaveLength(0);
  });

  it('deckt alle 8 Katalog-Packs über FALLBACK_PACK_TEMPLATES mit ehrlichem system_type ab', () => {
    const allPackIds = [
      'dsgvo-essentials',
      'eu-ai-act-high-risk',
      'iso-27001-foundation',
      'nis2-cybersecurity',
      'tdddg-consent',
      'dora-financial',
      'fintech-compliance',
      'tisax-automotive',
    ];
    for (const packId of allPackIds) {
      const plan = planPackPolicySeeding(TENANT_ID, [packId], [], []);
      expect(plan.toInsert.length, `Templates für ${packId}`).toBeGreaterThan(0);
      for (const row of plan.toInsert) {
        const cls = derivePolicyEnforcementClass(row.condition);
        expect(['A', 'B']).toContain(cls);
      }
    }
    expect(FALLBACK_PACK_TEMPLATES.length).toBeGreaterThanOrEqual(13);
    expect(inferPolicySystemType('tdddg-consent', {})).toBe('siteos_publish');
  });

  it('führt computeAutoMappings aus, ergänzt fehlende Pack-Controls auf gap und schützt manual-Mappings', () => {
    const assets: TenantAssetForAutoMap[] = [
      {
        id: 'asset-1',
        asset_type: 'website',
        ai_act_class: 'minimal',
        data_types: ['email_metadata'],
      },
    ];
    const frameworkControls: FrameworkControlRow[] = [
      { id: 'ctrl-gdpr-32', framework: 'GDPR', control_code: 'Art.32' },
      { id: 'ctrl-nis2-21', framework: 'NIS2', control_code: 'Art.21' },
      { id: 'ctrl-ai-9', framework: 'EU_AI_ACT', control_code: 'Art.9' },
    ];
    const packControls: PackControlRow[] = [
      { pack_id: 'dsgvo-essentials', framework: 'GDPR', control_code: 'Art.32', required: true },
      { pack_id: 'nis2-cybersecurity', framework: 'NIS2', control_code: 'Art.21', required: true },
    ];
    const existingMappings: ExistingAssetControlMappingRow[] = [
      {
        asset_id: 'asset-1',
        control_id: 'ctrl-gdpr-32',
        status: 'implemented',
        source: 'manual',
      },
    ];

    const planned = planPackControlMappings(
      assets,
      packControls,
      frameworkControls,
      existingMappings,
      '2026-10-26T20:00:00.000Z',
    );

    // Manuell gesetztes GDPR Art.32 darf NICHT überschrieben werden
    expect(planned.find((m) => m.control_id === 'ctrl-gdpr-32')).toBeUndefined();
    // EU_AI_ACT Art.9 wird durch computeAutoMappings für website als not_applicable abgeleitet
    const aiMapping = planned.find((m) => m.control_id === 'ctrl-ai-9');
    expect(aiMapping?.status).toBe('not_applicable');
    // NIS2 Art.21 wird über das aktivierte Pack als initiales gap-Mapping angelegt
    const nis2Mapping = planned.find((m) => m.control_id === 'ctrl-nis2-21');
    expect(nis2Mapping?.status).toBe('gap');
    expect(nis2Mapping?.source).toBe('auto');
  });
});

describe('governance-resources & policy-packs source wiring', () => {
  it('wires update_policy in governance-resources behind isOwnerOrAdmin, gateFeature(policy.packs), validatePolicyUpdate, and audit(policy.update)', () => {
    const src = readFileSync('supabase/functions/governance-resources/index.ts', 'utf8');
    expect(src).toMatch(/from ['"]\.\.\/_shared\/entitlements\.ts['"]/);
    expect(src).toContain("case 'update_policy':");
    const updateFn = src.slice(
      src.indexOf('async function updatePolicy('),
      src.indexOf('async function upsertMapping('),
    );
    expect(updateFn).toContain('isOwnerOrAdmin(admin, userId, row.tenant_id)');
    expect(updateFn).toContain('gateFeature(');
    expect(updateFn).toContain("'policy.packs'");
    expect(updateFn).toContain('validatePolicyUpdate(');
    expect(updateFn).toContain("action: 'policy.update'");
  });

  it('wires syncActivatedPackResources on op === activate in policy-packs', () => {
    const src = readFileSync('supabase/functions/policy-packs/index.ts', 'utf8');
    expect(src).toContain('syncActivatedPackResources(admin, tenantId, [packId])');
    expect(src).toContain('planPackPolicySeeding');
    expect(src).toContain('planPackControlMappings');
  });
});
