import { describe, expect, it } from 'vitest';
import {
  featuresForPlan,
  hasFeature,
  minimumPlanForFeature,
  PlanAccessError,
  requireFeature,
} from '../../src/lib/billing/planAccess';
import { PLAN_ORDER } from '../../shared/pricing';

describe('planAccess', () => {
  it('free hat nur den einmaligen Scan', () => {
    expect(hasFeature('free', 'one_time_scan')).toBe(true);
    expect(hasFeature('free', 'monthly_scan')).toBe(false);
    expect(hasFeature('free', 'daily_monitoring')).toBe(false);
    expect(hasFeature('free', 'evidence_export')).toBe(false);
  });

  it('starter hat die Starter-Features, aber keine Growth-Features', () => {
    expect(hasFeature('starter', 'monthly_scan')).toBe(true);
    expect(hasFeature('starter', 'dse_generator')).toBe(true);
    expect(hasFeature('starter', 'basic_alerts')).toBe(true);
    expect(hasFeature('starter', 'daily_monitoring')).toBe(false);
  });

  it('growth ergaenzt Monitoring, Drift und Risk Register', () => {
    expect(hasFeature('growth', 'monthly_scan')).toBe(true);
    expect(hasFeature('growth', 'daily_monitoring')).toBe(true);
    expect(hasFeature('growth', 'fix_snippets')).toBe(true);
    expect(hasFeature('growth', 'multi_tenant')).toBe(false);
    expect(hasFeature('growth', 'api_webhooks')).toBe(false);
  });

  it('agency schaltet API, Scheduler, Bulk und White-Label frei', () => {
    expect(hasFeature('agency', 'api_webhooks')).toBe(true);
    expect(hasFeature('agency', 'scheduler')).toBe(true);
    expect(hasFeature('agency', 'bulk_jobs')).toBe(true);
    expect(hasFeature('agency', 'white_label_reports')).toBe(true);
    expect(hasFeature('agency', 'provenance')).toBe(true);
    // Multi-Tenant beginnt erst bei Enterprise.
    expect(hasFeature('agency', 'multi_tenant')).toBe(false);
  });

  it('enterprise schaltet Multi-Tenant, SSO und SLA frei', () => {
    expect(hasFeature('enterprise', 'multi_tenant')).toBe(true);
    expect(hasFeature('enterprise', 'sso')).toBe(true);
    expect(hasFeature('enterprise', 'sla')).toBe(true);
    expect(hasFeature('enterprise', 'evidence_vault')).toBe(true);
  });

  it('partner hat alles, was enterprise hat', () => {
    for (const feature of featuresForPlan('enterprise')) {
      expect(hasFeature('partner', feature), `partner fehlt ${feature}`).toBe(true);
    }
  });

  it('akzeptiert Altdaten `scale` als Partner', () => {
    expect(hasFeature('scale', 'multi_tenant')).toBe(true);
    expect(featuresForPlan('scale')).toEqual(featuresForPlan('partner'));
  });

  it('evidence_export ist die Kaufbegruendung des ersten zahlenden Plans', () => {
    expect(hasFeature('free', 'evidence_export')).toBe(false);
    for (const plan of PLAN_ORDER.filter((p) => p !== 'free')) {
      expect(hasFeature(plan, 'evidence_export'), `${plan}`).toBe(true);
    }
  });

  it('Feature-Zugriff ist entlang der Plan-Reihenfolge monoton', () => {
    // Ein hoeherer Plan darf niemals weniger koennen als ein niedrigerer.
    for (let i = 1; i < PLAN_ORDER.length; i++) {
      const lower = featuresForPlan(PLAN_ORDER[i - 1]);
      const higher = featuresForPlan(PLAN_ORDER[i]);
      for (const feature of lower) {
        expect(
          higher.has(feature),
          `${PLAN_ORDER[i]} verliert "${feature}" gegenueber ${PLAN_ORDER[i - 1]}`,
        ).toBe(true);
      }
    }
  });

  it('null/undefined Plan -> kein Zugriff (defensiv)', () => {
    expect(hasFeature(null, 'one_time_scan')).toBe(false);
    expect(hasFeature(undefined, 'monthly_scan')).toBe(false);
    expect(hasFeature('gibt-es-nicht', 'monthly_scan')).toBe(false);
  });

  it('requireFeature wirft PlanAccessError mit erforderlichem Plan', () => {
    expect(() => requireFeature('starter', 'multi_tenant')).toThrow(PlanAccessError);
    expect(() => requireFeature('enterprise', 'multi_tenant')).not.toThrow();

    try {
      requireFeature('starter', 'multi_tenant');
      expect.unreachable('requireFeature haette werfen muessen');
    } catch (error) {
      expect(error).toBeInstanceOf(PlanAccessError);
      expect((error as PlanAccessError).requiredPlan).toBe('enterprise');
    }
  });

  it('minimumPlanForFeature liefert den niedrigsten passenden Plan', () => {
    expect(minimumPlanForFeature('one_time_scan')).toBe('free');
    expect(minimumPlanForFeature('evidence_export')).toBe('starter');
    expect(minimumPlanForFeature('daily_monitoring')).toBe('growth');
    expect(minimumPlanForFeature('api_webhooks')).toBe('agency');
    expect(minimumPlanForFeature('multi_tenant')).toBe('enterprise');
  });
});
