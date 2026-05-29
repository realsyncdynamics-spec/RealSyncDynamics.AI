import { describe, expect, it } from 'vitest';
import {
  featuresForPlan,
  hasFeature,
  PlanAccessError,
  requireFeature,
} from '../../src/lib/billing/planAccess';

describe('planAccess', () => {
  it('free hat nur one_time_scan', () => {
    expect(hasFeature('free', 'one_time_scan')).toBe(true);
    expect(hasFeature('free', 'monthly_scan')).toBe(false);
    expect(hasFeature('free', 'daily_monitoring')).toBe(false);
  });

  it('starter hat die Starter-Features, aber keine Growth-Features', () => {
    expect(hasFeature('starter', 'monthly_scan')).toBe(true);
    expect(hasFeature('starter', 'dse_generator')).toBe(true);
    expect(hasFeature('starter', 'basic_alerts')).toBe(true);
    expect(hasFeature('starter', 'daily_monitoring')).toBe(false);
  });

  it('growth erbt Starter-Features (Inheritance)', () => {
    expect(hasFeature('growth', 'monthly_scan')).toBe(true);
    expect(hasFeature('growth', 'daily_monitoring')).toBe(true);
    expect(hasFeature('growth', 'fix_snippets')).toBe(true);
    expect(hasFeature('growth', 'multi_tenant')).toBe(false);
  });

  it('agency hat alles bis Growth + eigene Features', () => {
    expect(hasFeature('agency', 'multi_tenant')).toBe(true);
    expect(hasFeature('agency', 'monthly_scan')).toBe(true);
    expect(hasFeature('agency', 'daily_monitoring')).toBe(true);
    expect(hasFeature('agency', 'fifty_clients')).toBe(false);
  });

  it('scale erbt agency und ergaenzt fifty_clients/custom_subdomain', () => {
    expect(hasFeature('scale', 'fifty_clients')).toBe(true);
    expect(hasFeature('scale', 'custom_subdomain')).toBe(true);
    expect(hasFeature('scale', 'multi_tenant')).toBe(true);
    expect(hasFeature('scale', 'dedicated_runtime')).toBe(false);
  });

  it('enterprise hat alle Enterprise-Features + Agency-Inheritance', () => {
    expect(hasFeature('enterprise', 'dedicated_runtime')).toBe(true);
    expect(hasFeature('enterprise', 'sla')).toBe(true);
    expect(hasFeature('enterprise', 'evidence_vault')).toBe(true);
    expect(hasFeature('enterprise', 'multi_tenant')).toBe(true);
    // Enterprise erbt von Agency, nicht von Scale — fifty_clients ist Scale-only.
    expect(hasFeature('enterprise', 'fifty_clients')).toBe(false);
  });

  it('null/undefined Plan -> kein Zugriff (defensiv)', () => {
    expect(hasFeature(null, 'one_time_scan')).toBe(false);
    expect(hasFeature(undefined, 'monthly_scan')).toBe(false);
  });

  it('requireFeature wirft PlanAccessError bei fehlendem Zugriff', () => {
    expect(() => requireFeature('starter', 'multi_tenant')).toThrow(PlanAccessError);
    expect(() => requireFeature('agency',  'multi_tenant')).not.toThrow();
  });

  it('featuresForPlan ist deterministisch und enthaelt geerbte Features', () => {
    const growth = featuresForPlan('growth');
    expect(growth.has('monthly_scan')).toBe(true);    // von starter
    expect(growth.has('daily_monitoring')).toBe(true); // direkt
    expect(growth.has('multi_tenant')).toBe(false);
  });
});
