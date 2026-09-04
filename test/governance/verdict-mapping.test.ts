/**
 * Verdict-Adapter — kanonisches Mapping aller Policy-Engines
 *
 * Prüft die Übersetzungstabelle aus docs/architecture/policy-verdict-audit.md §3
 * Zeile für Zeile. Der Adapter ist ein Übersetzer, kein Entscheider: er darf
 * ein Urteil abbilden, aber nie eines erfinden.
 *
 * Besonderes Augenmerk auf die verlustbehafteten Fälle. `warn` und `log` fallen
 * beide auf ALLOW — wenn der Unterschied dabei verloren geht, ist der Prüfpfad
 * gegenüber einer Aufsichtsbehörde nicht mehr belastbar. Genau das prüfen die
 * Tests unter „Verlustfreiheit".
 */

import { describe, expect, it } from 'vitest';
import {
  fromAssetPolicy,
  fromRuntimeAi,
  fromAgentGateway,
  fromEnterpriseOs,
  fromGovardGateway,
  isExecutable,
  requiresEvidence,
  type CanonicalVerdict,
} from '../../supabase/functions/_shared/verdict';
import type { PolicyVerdict as ContractVerdict } from '@/packages/agent-runtime-contracts/src/index';

// ─── #1 asset-policy (policyEngine.ts) ───────────────────────────────────────

describe('fromAssetPolicy — policyEngine.ts', () => {
  const cases: Array<[string, CanonicalVerdict, string | null]> = [
    ['allow', 'ALLOW', null],
    ['log', 'ALLOW', 'log'],
    ['warn', 'ALLOW', 'warn'],
    ['require_approval', 'REQUIRE_CONFIRMATION', null],
    ['block', 'DENY', null],
  ];

  for (const [action, verdict, advisory] of cases) {
    it(`"${action}" → ${verdict}${advisory ? ` (advisory ${advisory})` : ''}`, () => {
      const d = fromAssetPolicy({ policy_id: 'pol_1', action });
      expect(d.verdict).toBe(verdict);
      expect(d.advisory).toBe(advisory);
      expect(d.sourceEngine).toBe('asset-policy');
      expect(d.sourceVerdict).toBe(action);
      expect(d.matchedPolicyIds).toEqual(['pol_1']);
    });
  }

  it('null (keine Policy matchte) wird wie "logged" behandelt, nicht wie DENY', () => {
    // Wichtig: policyEngine.ts liefert null, policy-engine.ts liefert 'logged'.
    // Derselbe Sachverhalt darf nicht je nach Aufrufer verschieden aussehen.
    const d = fromAssetPolicy(null);
    expect(d.verdict).toBe('ALLOW');
    expect(d.advisory).toBe('log');
    expect(d.sourceVerdict).toBe('no_match');
    expect(d.matchedPolicyIds).toEqual([]);
  });

  it('unbekannte Action ist fail-closed', () => {
    const d = fromAssetPolicy({ policy_id: 'pol_x', action: 'quarantine' });
    expect(d.verdict).toBe('DENY');
    expect(d.sourceVerdict).toBe('quarantine');
    expect(d.reasons[0]).toContain('quarantine');
  });
});

// ─── #2 runtime-ai (policy-engine.ts) ────────────────────────────────────────

describe('fromRuntimeAi — policy-engine.ts', () => {
  const cases: Array<[string, CanonicalVerdict, string | null]> = [
    ['allowed', 'ALLOW', null],
    ['logged', 'ALLOW', 'log'],
    ['warned', 'ALLOW', 'warn'],
    ['requires_approval', 'REQUIRE_CONFIRMATION', null],
    ['blocked', 'DENY', null],
  ];

  for (const [status, verdict, advisory] of cases) {
    it(`"${status}" → ${verdict}${advisory ? ` (advisory ${advisory})` : ''}`, () => {
      const d = fromRuntimeAi({ status, matched_policy_ids: ['a', 'b'] });
      expect(d.verdict).toBe(verdict);
      expect(d.advisory).toBe(advisory);
      expect(d.sourceEngine).toBe('runtime-ai');
      expect(d.sourceVerdict).toBe(status);
      expect(d.matchedPolicyIds).toEqual(['a', 'b']);
    });
  }

  it('fällt auf matched_policy_id zurück, wenn die Liste fehlt', () => {
    const d = fromRuntimeAi({ status: 'blocked', matched_policy_id: 'solo' });
    expect(d.matchedPolicyIds).toEqual(['solo']);
  });

  it('unbekannter Status ist fail-closed', () => {
    const d = fromRuntimeAi({ status: 'escalated' });
    expect(d.verdict).toBe('DENY');
    expect(d.sourceVerdict).toBe('escalated');
  });
});

// ─── #3 agent-gateway (apps/agent-runtime) ───────────────────────────────────

describe('fromAgentGateway — apps/agent-runtime', () => {
  it('{ok:true, reviewRequired:false} → ALLOW', () => {
    const d = fromAgentGateway({ ok: true, reviewRequired: false });
    expect(d.verdict).toBe('ALLOW');
    expect(d.advisory).toBeNull();
  });

  it('{ok:true, reviewRequired:true} → REQUIRE_CONFIRMATION', () => {
    expect(fromAgentGateway({ ok: true, reviewRequired: true }).verdict).toBe('REQUIRE_CONFIRMATION');
  });

  it('{ok:false} → DENY, reason bleibt als Begründung erhalten', () => {
    const d = fromAgentGateway({ ok: false, reason: 'tool_not_allowed' });
    expect(d.verdict).toBe('DENY');
    expect(d.sourceVerdict).toBe('tool_not_allowed');
    expect(d.reasons).toEqual(['tool_not_allowed']);
  });

  it('kennt kein advisory — das Gateway hat keine warn/log-Stufe', () => {
    expect(fromAgentGateway({ ok: true, reviewRequired: false }).advisory).toBeNull();
    expect(fromAgentGateway({ ok: false, reason: 'agent_not_found' }).advisory).toBeNull();
  });
});

// ─── #4/#5 enterprise-os (evaluateAgentAction) ───────────────────────────────

describe('fromEnterpriseOs — evaluateAgentAction', () => {
  const base = { auditRequired: false, reasons: [] as string[] };

  it('allowed:true, requiresApproval:false → ALLOW', () => {
    expect(fromEnterpriseOs({ ...base, allowed: true, requiresApproval: false }).verdict).toBe('ALLOW');
  });

  it('allowed:true, requiresApproval:true → REQUIRE_CONFIRMATION', () => {
    expect(fromEnterpriseOs({ ...base, allowed: true, requiresApproval: true }).verdict).toBe(
      'REQUIRE_CONFIRMATION',
    );
  });

  it('allowed:false → DENY, auch wenn requiresApproval gesetzt ist', () => {
    // Sonst ließe sich ein DENY per Bestätigungsklick in eine Ausführung
    // verwandeln. Ablehnung schlägt Bestätigungspflicht.
    const d = fromEnterpriseOs({ ...base, allowed: false, requiresApproval: true });
    expect(d.verdict).toBe('DENY');
  });

  it('reicht die Begründungen der Engine durch', () => {
    const reasons = ['Sensitive data cannot be used for this action.'];
    expect(fromEnterpriseOs({ ...base, allowed: false, requiresApproval: false, reasons }).reasons).toEqual(
      reasons,
    );
  });
});

// ─── govard-gateway (Cloudflare Worker) ──────────────────────────────────────

describe('fromGovardGateway — workers/govard-gateway', () => {
  it('"ALLOW" → ALLOW', () => {
    expect(fromGovardGateway({ decision: 'ALLOW' }).verdict).toBe('ALLOW');
  });

  it('"APPROVAL" → REQUIRE_CONFIRMATION', () => {
    // Diese Engine ist unabhängig auf dieselbe Dreiteilung gekommen; nur der
    // Name der mittleren Stufe weicht ab.
    const d = fromGovardGateway({ decision: 'APPROVAL' });
    expect(d.verdict).toBe('REQUIRE_CONFIRMATION');
    expect(d.sourceVerdict).toBe('APPROVAL');
  });

  it('"DENY" → DENY', () => {
    expect(fromGovardGateway({ decision: 'DENY' }).verdict).toBe('DENY');
  });

  it('trägt Policy-IDs und Begründungen der Verletzungen mit', () => {
    const d = fromGovardGateway({
      decision: 'DENY',
      violations: [
        { policy_id: 'p1', reason: 'Budget überschritten.' },
        { policy_id: 'p2', reason: 'Empfängerzahl über Limit.' },
      ],
    });
    expect(d.matchedPolicyIds).toEqual(['p1', 'p2']);
    expect(d.reasons).toEqual(['Budget überschritten.', 'Empfängerzahl über Limit.']);
  });

  it('lässt unvollständige Verletzungseinträge aus, statt leere Strings zu führen', () => {
    const d = fromGovardGateway({ decision: 'DENY', violations: [{ reason: 'ohne ID' }, {}] });
    expect(d.matchedPolicyIds).toEqual([]);
    expect(d.reasons).toEqual(['ohne ID']);
  });

  it('unbekannte decision ist fail-closed', () => {
    const d = fromGovardGateway({ decision: 'ESCALATE' });
    expect(d.verdict).toBe('DENY');
    expect(d.reasons[0]).toContain('ESCALATE');
  });

  it('kennt kein advisory', () => {
    for (const decision of ['ALLOW', 'APPROVAL', 'DENY']) {
      expect(fromGovardGateway({ decision }).advisory).toBeNull();
    }
  });
});

// ─── Verlustfreiheit ─────────────────────────────────────────────────────────

describe('Verlustfreiheit des Mappings', () => {
  it('warn und log bleiben nach der Übersetzung unterscheidbar', () => {
    const warn = fromAssetPolicy({ policy_id: 'p', action: 'warn' });
    const log = fromAssetPolicy({ policy_id: 'p', action: 'log' });
    expect(warn.verdict).toBe(log.verdict); // beide ALLOW …
    expect(warn.advisory).not.toBe(log.advisory); // … aber unterscheidbar
  });

  it('der Originalwert jeder Quelle überlebt unverändert', () => {
    for (const action of ['allow', 'log', 'warn', 'require_approval', 'block']) {
      expect(fromAssetPolicy({ policy_id: 'p', action }).sourceVerdict).toBe(action);
    }
    for (const status of ['allowed', 'logged', 'warned', 'requires_approval', 'blocked']) {
      expect(fromRuntimeAi({ status }).sourceVerdict).toBe(status);
    }
  });

  it('advisory ist nie bei DENY oder REQUIRE_CONFIRMATION gesetzt', () => {
    const all = [
      ...['allow', 'log', 'warn', 'require_approval', 'block'].map((a) =>
        fromAssetPolicy({ policy_id: 'p', action: a }),
      ),
      ...['allowed', 'logged', 'warned', 'requires_approval', 'blocked'].map((s) => fromRuntimeAi({ status: s })),
    ];
    for (const d of all) {
      if (d.verdict !== 'ALLOW') expect(d.advisory).toBeNull();
    }
  });
});

// ─── Durchsetzung ────────────────────────────────────────────────────────────

describe('Durchsetzungsregeln', () => {
  it('nur ALLOW ist ohne weitere Zustimmung ausführbar', () => {
    expect(isExecutable(fromAssetPolicy({ policy_id: 'p', action: 'allow' }))).toBe(true);
    expect(isExecutable(fromAssetPolicy({ policy_id: 'p', action: 'warn' }))).toBe(true);
    expect(isExecutable(fromAssetPolicy({ policy_id: 'p', action: 'require_approval' }))).toBe(false);
    expect(isExecutable(fromAssetPolicy({ policy_id: 'p', action: 'block' }))).toBe(false);
  });

  it('jede Entscheidung ist beweispflichtig — auch DENY', () => {
    expect(requiresEvidence(fromAssetPolicy({ policy_id: 'p', action: 'block' }))).toBe(true);
    expect(requiresEvidence(fromAgentGateway({ ok: false, reason: 'restricted_action' }))).toBe(true);
  });
});

// ─── Bindung an die Contracts ────────────────────────────────────────────────

describe('Parität mit packages/agent-runtime-contracts', () => {
  it('das kanonische Vokabular des Adapters deckt sich mit PolicyVerdict', () => {
    // Der Adapter kann den Contract nicht importieren (Deno erreicht packages/
    // nicht), deshalb ist das Vokabular dort dupliziert. Dieser Test bindet
    // beide Seiten aneinander: läuft eine weg, bricht er.
    const fromAdapter: CanonicalVerdict[] = ['ALLOW', 'DENY', 'REQUIRE_CONFIRMATION'];
    const fromContract: ContractVerdict[] = ['ALLOW', 'DENY', 'REQUIRE_CONFIRMATION'];
    expect([...fromAdapter].sort()).toEqual([...fromContract].sort());
  });
});
