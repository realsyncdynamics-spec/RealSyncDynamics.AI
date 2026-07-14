/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, expect } from 'vitest';

import { prioritizedPlan, projectedScore } from '../../src/lib/optimizer/plan';
import { capabilitiesForPlan } from '../../src/lib/optimizer/entitlement';
import type { OptimizerIssue } from '../../src/lib/optimizer/types';

const issues: OptimizerIssue[] = [
  { id: 'a', severity: 'info', title: 'Alt-Tags' },
  { id: 'b', severity: 'critical', title: 'Kein HTTPS' },
  { id: 'c', severity: 'medium', title: 'Langsame LCP' },
  { id: 'd', severity: 'high', title: 'Tracking ohne Consent' },
];

describe('prioritizedPlan', () => {
  it('sortiert nach Schwere absteigend (kritisch zuerst)', () => {
    expect(prioritizedPlan(issues).map((p) => p.id)).toEqual(['b', 'd', 'c', 'a']);
  });
  it('ist stabil bei gleicher Schwere', () => {
    const same: OptimizerIssue[] = [
      { id: 'x', severity: 'medium', title: 'x' },
      { id: 'y', severity: 'medium', title: 'y' },
    ];
    expect(prioritizedPlan(same).map((p) => p.id)).toEqual(['x', 'y']);
  });
});

describe('projectedScore', () => {
  it('addiert schwere-gewichtetes Potenzial, gedeckelt bei 100', () => {
    // critical(8)+high(5)+medium(3)+info(0) = 16
    expect(projectedScore(50, issues)).toBe(66);
    expect(projectedScore(95, issues)).toBe(100);
  });
  it('bleibt bei leerer Liste unverändert', () => {
    expect(projectedScore(42, [])).toBe(42);
  });
});

describe('capabilitiesForPlan', () => {
  it('free/null hat keine bezahlten Fähigkeiten', () => {
    const caps = capabilitiesForPlan(null);
    expect(caps).toEqual({ fullReport: false, autoOptimize: false, monitoring: false });
  });
  it('starter schaltet den vollständigen Bericht frei, aber keine Auto-Optimierung', () => {
    const caps = capabilitiesForPlan('starter');
    expect(caps.fullReport).toBe(true);
    expect(caps.autoOptimize).toBe(false);
  });
  it('growth schaltet Auto-Optimierung + Monitoring frei', () => {
    const caps = capabilitiesForPlan('growth');
    expect(caps.fullReport).toBe(true);
    expect(caps.autoOptimize).toBe(true);
    expect(caps.monitoring).toBe(true);
  });
});
