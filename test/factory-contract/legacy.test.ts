import { describe, expect, it } from 'vitest';
import {
  FACTORY_JOB_STATUSES,
  NO_AUTHORITY,
  PR2346_STATUS_MAP,
  SF006_STATUS_MAP,
  importPr2346Job,
  importSf006Job,
} from '../../packages/factory-contract/src/index.ts';
import { binding, HASH, pr2346Snapshot, REVIEW_EVIDENCE, SHA_B, sf006Snapshot } from './fixtures.ts';

describe('factory-contract: Linie A (SF-006/SF-000)', () => {
  it('bildet einen ruhenden Job mit Bindung ab und übernimmt keine Events', () => {
    const { job, authority } = importSf006Job(sf006Snapshot({ events: [{}, {}] }), binding());
    expect(authority).toEqual(NO_AUTHORITY);
    expect(job.status).toBe('queued');
    expect(job.branch).toBe('sf-demo-job');
    expect(job.budget).toEqual({ currency: 'EUR', maxCents: 500, spentCents: 0 });
    expect(job.events).toEqual([]);
    expect(job.provenance).toEqual({
      source: 'legacy-sf006', legacyStatus: 'queued', legacyEventCount: 2, importedAt: '2026-11-25T10:00:00Z',
    });
  });

  it('bildet jeden Legacy-Status auf einen kanonischen Status ab', () => {
    for (const mapping of [...Object.values(SF006_STATUS_MAP), ...Object.values(PR2346_STATUS_MAP)]) {
      expect(FACTORY_JOB_STATUSES).toContain(mapping.status);
      expect(mapping.phase === null).toBe(mapping.status !== 'running');
    }
  });

  it('importiert keine aktiven Jobs', () => {
    for (const status of ['analyzing', 'planning', 'implementing', 'validating']) {
      expect(() => importSf006Job(sf006Snapshot({ status }), binding())).toThrow('legacy_job_active_pause_first');
    }
  });

  it('lehnt abweichende Basis-SHA ab', () => {
    expect(() => importSf006Job(sf006Snapshot({ baseRef: SHA_B }), binding())).toThrow('base_commit_divergence');
  });

  it('verlangt einen gebundenen Arbeitsbranch', () => {
    expect(() => importSf006Job(sf006Snapshot(), binding({ branch: null }))).toThrow('binding_branch_required');
  });

  it('lehnt Budgetabweichungen zur Bindung ab', () => {
    expect(() => importSf006Job(sf006Snapshot(), binding({ budgetMaxCents: 501 }))).toThrow('budget_divergence');
  });

  it('lehnt draft_pr_ready ohne Nachweise ab und akzeptiert es mit Nachweisen', () => {
    expect(() => importSf006Job(sf006Snapshot({ status: 'draft_pr_ready' }), binding())).toThrow('review_evidence_missing');
    const { job } = importSf006Job(sf006Snapshot({ status: 'draft_pr_ready' }), binding({ evidence: REVIEW_EVIDENCE }));
    expect(job.status).toBe('review_required');
  });

  it('lehnt mitgelieferte Actor-Felder ab', () => {
    expect(() => importSf006Job(sf006Snapshot({ actorKind: 'operator' }), binding())).toThrow('legacy_actor_not_accepted');
  });

  it('lehnt unbekannte Status wie completed ab', () => {
    expect(() => importSf006Job(sf006Snapshot({ status: 'completed' }), binding())).toThrow('legacy_status_unknown');
  });
});

describe('factory-contract: Linie B (PR #2346/#2347)', () => {
  const cents = { budgetMaxCents: 1234, budgetSpentCents: 10 };

  it('übernimmt Version und Branch, Budget nur aus gebundenen Cent-Werten', () => {
    const { job, authority } = importPr2346Job(pr2346Snapshot(), binding(cents));
    expect(authority).toEqual(NO_AUTHORITY);
    expect(job.version).toBe(4);
    expect(job.budget).toEqual({ currency: 'EUR', maxCents: 1234, spentCents: 10 });
    expect(job.attempts).toEqual({ max: 3, used: 1 });
    expect(job.provenance.legacyEventCount).toBe(2);
  });

  it('konvertiert EUR nie automatisch', () => {
    expect(() => importPr2346Job(pr2346Snapshot(), binding())).toThrow('budget_cents_binding_required');
  });

  it('lehnt EUR/Cent-Abweichungen und Bruchteile von Cent ab', () => {
    expect(() => importPr2346Job(pr2346Snapshot(), binding({ ...cents, budgetMaxCents: 1235 }))).toThrow('budget_divergence');
    const fractional = pr2346Snapshot({ budget: { maxCostEur: 12.345, spentCostEur: 0.1, maxAttempts: 3, attempts: 1 } });
    expect(() => importPr2346Job(fractional, binding(cents))).toThrow('budget_divergence');
  });

  it('lehnt Branch-Abweichungen zur Bindung ab', () => {
    expect(() => importPr2346Job(pr2346Snapshot(), binding({ ...cents, branch: 'sf-other' }))).toThrow('branch_divergence');
  });

  it('übernimmt scopeApproved nicht, prüft es aber auf Widersprüche', () => {
    expect(() => importPr2346Job(pr2346Snapshot({ scopeApproved: false }), binding(cents))).toThrow('legacy_scope_inconsistent');
  });

  it('lehnt TrustedActor-Objekte im Snapshot ab', () => {
    const snapshot = pr2346Snapshot({ trustedActor: { kind: 'operator', id: 'x', isOperator: true, aal: 'aal2' } });
    expect(() => importPr2346Job(snapshot, binding(cents))).toThrow('legacy_actor_not_accepted');
  });

  it('bildet canceled auf cancelled ab und importiert running nicht', () => {
    expect(importPr2346Job(pr2346Snapshot({ status: 'canceled' }), binding(cents)).job.status).toBe('cancelled');
    expect(() => importPr2346Job(pr2346Snapshot({ status: 'running' }), binding(cents))).toThrow('legacy_job_active_pause_first');
  });

  it('lehnt manipulierte Nachweise in der Bindung ab', () => {
    const evidence = [{ kind: 'tests', ref: 'evidence://x', sha256: HASH.slice(1) }];
    expect(() => importPr2346Job(pr2346Snapshot(), binding({ ...cents, evidence }))).toThrow('evidence_sha256_invalid');
  });
});
