export type SkillState = 'ready' | 'needs_binding' | 'locked' | 'planned';

export type EntitlementRow = {
  key: string;
  value: boolean | number | string | null;
};

export type SkillRow = {
  id: string;
  status: 'available' | 'beta' | 'planned';
  n8n_workflow_id: string | null;
};

export interface AutomationProfileInput {
  orgType: string | null;
  aiSystems: string[];
  residencyPolicy: string | null;
  entitlements: EntitlementRow[];
}

export interface AutomationSkillSelection {
  skill_id: string;
  state: SkillState;
  reason: string;
  executor: 'n8n' | 'native' | null;
  /** Nur bei `executor: 'native'`: der bestehende RealSync-Pfad, über den der Skill läuft. */
  native_route?: string;
}

/**
 * Skills, die bereits über einen nativen RealSync-Pfad laufen — unabhängig von
 * n8n und von `ai.tool.automations`. Maßgeblich ist das Entitlement des
 * nativen Pfads selbst. Aufrufer müssen `executor: 'native'` an `native_route`
 * leiten, nicht an `automation-trigger` (der liefert dafür weiter NOT_BOUND).
 */
export const NATIVE_EXECUTORS: Record<string, { entitlement: string; route: string }> = {
  // Free Audit: /audit → Edge Function gdpr-audit
  'dsgvo-audit': { entitlement: 'website.scan', route: '/audit' },
};

export function granted(rows: EntitlementRow[], key: string): boolean {
  const value = rows.find((row) => row.key === key)?.value;
  return value === true || value === -1 || (typeof value === 'number' && value > 0);
}

export function dedupe(values: string[]): string[] {
  return [...new Set(values.filter(Boolean))];
}

export function recommendedSkillIds(input: AutomationProfileInput): string[] {
  const out: string[] = [];

  if (granted(input.entitlements, 'website.scan')) out.push('dsgvo-audit');

  if (
    granted(input.entitlements, 'reports.export') ||
    granted(input.entitlements, 'compliance.export')
  ) {
    out.push('dokumenten-skill');
  }

  if (input.aiSystems.length > 0 && granted(input.entitlements, 'ai.tool.automations')) {
    out.push('meeting-compliance');
  }

  if (input.orgType === 'agency' && granted(input.entitlements, 'ai.tool.automations')) {
    out.push('lead-risk', 'screenshot-feedback');
  }

  if (granted(input.entitlements, 'bots.enabled') && input.aiSystems.length > 0) {
    out.push('support-skill');
  }

  return dedupe(out);
}

export function resolveSkillSelections(args: {
  recommendedIds: string[];
  skills: SkillRow[];
  automationEntitled: boolean;
  entitlements?: EntitlementRow[];
}): AutomationSkillSelection[] {
  const byId = new Map(args.skills.map((skill) => [skill.id, skill]));

  return args.recommendedIds.map((id): AutomationSkillSelection => {
    const skill = byId.get(id);
    const native = NATIVE_EXECUTORS[id];
    // Ein gebundener n8n-Workflow hat Vorrang; sonst zählt der native Pfad,
    // sofern dessen eigenes Entitlement erteilt ist.
    if (skill && skill.status !== 'planned' && !skill.n8n_workflow_id && native
      && granted(args.entitlements ?? [], native.entitlement)) {
      return {
        skill_id: id,
        state: 'ready',
        reason: 'native_path_entitled',
        executor: 'native',
        native_route: native.route,
      };
    }
    let state: SkillState = 'locked';
    let reason = 'not_entitled';

    if (!skill) {
      state = 'locked';
      reason = 'catalog_missing';
    } else if (skill.status === 'planned') {
      state = 'planned';
      reason = 'catalog_planned';
    } else if (!args.automationEntitled) {
      state = 'locked';
      reason = 'automation_not_entitled';
    } else if (!skill.n8n_workflow_id) {
      state = 'needs_binding';
      reason = 'runtime_not_bound';
    } else {
      state = 'ready';
      reason = 'entitled_and_bound';
    }

    return {
      skill_id: id,
      state,
      reason,
      executor: skill?.n8n_workflow_id ? 'n8n' : null,
    };
  });
}
