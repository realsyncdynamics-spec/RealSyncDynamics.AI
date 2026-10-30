import { describe, expect, it } from 'vitest';
import {
  requiredApprovalLevel, toAgentDecisionInsert, validateProposal,
} from '../../supabase/functions/_shared/decision-proposal';

const opt = (label: string, recommended = false) => ({ label, rationale: `weil ${label}`, recommended });

describe('validateProposal', () => {
  it('akzeptiert 1–3 Optionen mit genau einer Empfehlung', () => {
    expect(validateProposal({ options: [opt('A', true)] }).ok).toBe(true);
    expect(validateProposal({ options: [opt('A', true), opt('B'), opt('C')] }).ok).toBe(true);
  });
  it('lehnt mehr als 3 Optionen ab', () => {
    expect(validateProposal({ options: [opt('A', true), opt('B'), opt('C'), opt('D')] })).toEqual({ ok: false, error: 'höchstens 3 Optionen' });
  });
  it('verlangt genau eine Empfehlung und Begründungen', () => {
    expect(validateProposal({ options: [opt('A'), opt('B')] }).ok).toBe(false);
    expect(validateProposal({ options: [opt('A', true), opt('B', true)] }).ok).toBe(false);
    expect(validateProposal({ options: [{ label: 'A', rationale: ' ', recommended: true }] }).ok).toBe(false);
  });
});

describe('requiredApprovalLevel', () => {
  it('Merge/Deploy/Preis/Zahlung → L4', () => {
    for (const t of ['Soll PR #1 gemergt werden?', 'Produktionsdeploy jetzt?', 'Stripe-Preis ändern?']) {
      expect(requiredApprovalLevel(t)).toBe('L4');
    }
  });
  it('irreversibel → immer L4', () => {
    expect(requiredApprovalLevel('Kleine Umbenennung?', 'irreversible')).toBe('L4');
  });
  it('Kosten/Secrets/RLS → L3, Architektur → L2, sonst L1', () => {
    expect(requiredApprovalLevel('Budget für Tool erhöhen?')).toBe('L3');
    expect(requiredApprovalLevel('Welche Architektur für Realtime?')).toBe('L2');
    expect(requiredApprovalLevel('Variablennamen vereinheitlichen?')).toBe('L1');
  });
});

describe('toAgentDecisionInsert', () => {
  it('Status immer proposed, Empfehlung = markierte Option', () => {
    const row = toAgentDecisionInsert({
      tenantId: 't', question: 'Merge?', proposedBy: 'grok:github-bot',
      proposal: { options: [opt('Erst CI prüfen', true), opt('Zurückstellen')] },
    });
    expect(row.status).toBe('proposed');
    expect(row.recommendation).toBe('Erst CI prüfen');
    expect(row.reason).toBe('weil Erst CI prüfen');
    expect(row.options).toHaveLength(2);
  });
});
