/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, expect } from 'vitest';

import {
  bucketForSeverity,
  summarizeSeverities,
  type OptimizerIssue,
} from '../../src/lib/optimizer/types';
import { normalizeUrl, domainFromUrl } from '../../src/lib/optimizer/state';

describe('bucketForSeverity', () => {
  it('mappt critical/high → kritisch', () => {
    expect(bucketForSeverity('critical')).toBe('kritisch');
    expect(bucketForSeverity('high')).toBe('kritisch');
  });
  it('mappt medium/low → wichtig', () => {
    expect(bucketForSeverity('medium')).toBe('wichtig');
    expect(bucketForSeverity('low')).toBe('wichtig');
  });
  it('mappt info → info', () => {
    expect(bucketForSeverity('info')).toBe('info');
  });
});

describe('summarizeSeverities', () => {
  const issues: OptimizerIssue[] = [
    { id: '1', severity: 'critical', title: 'a' },
    { id: '2', severity: 'high', title: 'b' },
    { id: '3', severity: 'medium', title: 'c' },
    { id: '4', severity: 'info', title: 'd' },
  ];

  it('liefert immer alle drei Buckets in fester Reihenfolge', () => {
    const summary = summarizeSeverities([]);
    expect(summary.map((s) => s.bucket)).toEqual(['kritisch', 'wichtig', 'info']);
    expect(summary.every((s) => s.count === 0)).toBe(true);
  });

  it('zählt korrekt je Bucket', () => {
    const summary = summarizeSeverities(issues);
    expect(summary.find((s) => s.bucket === 'kritisch')?.count).toBe(2);
    expect(summary.find((s) => s.bucket === 'wichtig')?.count).toBe(1);
    expect(summary.find((s) => s.bucket === 'info')?.count).toBe(1);
  });
});

describe('normalizeUrl', () => {
  it('ergänzt fehlendes Protokoll', () => {
    expect(normalizeUrl('example.de')).toBe('https://example.de');
    expect(normalizeUrl('  example.de  ')).toBe('https://example.de');
  });
  it('lässt vorhandenes Protokoll unangetastet', () => {
    expect(normalizeUrl('http://example.de')).toBe('http://example.de');
    expect(normalizeUrl('https://example.de')).toBe('https://example.de');
  });
});

describe('domainFromUrl', () => {
  it('extrahiert den Host', () => {
    expect(domainFromUrl('https://example.de/pfad?x=1')).toBe('example.de');
    expect(domainFromUrl('example.de')).toBe('example.de');
    expect(domainFromUrl('www.example.de/foo')).toBe('www.example.de');
  });
});
