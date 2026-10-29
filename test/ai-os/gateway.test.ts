// AI-OS-Gateway: Entscheidungsmatrix, Wissenspfade, Zugangsdaten-Muster.
import { describe, expect, it } from 'vitest';
import {
  authorizeAction,
  findSecretLikeContent,
  isAllowedKnowledgePath,
  TOOL_ACTIONS,
  type GatewayPrincipal,
} from '../../packages/ai-os-core/src/index';

const operator2fa: GatewayPrincipal = { isOperator: true, aal: 'aal2' };
const operator1fa: GatewayPrincipal = { isOperator: true, aal: 'aal1' };
const stranger: GatewayPrincipal = { isOperator: false, aal: 'aal2' };

describe('authorizeAction — Default-Deny', () => {
  it('lehnt unbekannte Aktionen ab', () => {
    const d = authorizeAction(operator2fa, { actionId: 'github.repo.delete', confirmed: true });
    expect(d).toMatchObject({ allow: false, reason: 'unknown_action' });
  });

  it('lehnt Nicht-Operatoren auch für Lesezugriffe ab', () => {
    const d = authorizeAction(stranger, { actionId: 'github.pulls.read', confirmed: false });
    expect(d).toMatchObject({ allow: false, reason: 'not_operator' });
  });

  it('erlaubt Operatoren Lesezugriffe ohne 2FA und ohne Protokollpflicht', () => {
    const d = authorizeAction(operator1fa, { actionId: 'github.pulls.read', confirmed: false });
    expect(d.allow).toBe(true);
    if (d.allow) expect(d.mustAudit).toBe(false);
  });

  it('führt keine einzige kritische Aktion aus — auch nicht mit 2FA und Bestätigung', () => {
    const critical = TOOL_ACTIONS.filter((a) => a.class === 'critical');
    expect(critical.length).toBeGreaterThan(0);
    for (const a of critical) {
      const d = authorizeAction(operator2fa, { actionId: a.id, confirmed: true });
      expect(d, a.id).toMatchObject({ allow: false, reason: 'critical_requires_release' });
    }
  });

  it('führt Aktionen anderer Kanäle (Claude-Sitzung, Routine) nicht im Server aus', () => {
    const d = authorizeAction(operator2fa, { actionId: 'github.pr.prepare', confirmed: true });
    expect(d).toMatchObject({ allow: false, reason: 'not_executable_here' });
    const r = authorizeAction(operator2fa, { actionId: 'github.routine.report', confirmed: true });
    expect(r).toMatchObject({ allow: false, reason: 'not_executable_here' });
  });

  it('verlangt für Schreibaktionen AAL2 vor der Bestätigung', () => {
    const d = authorizeAction(operator1fa, { actionId: 'github.workflow.dispatch', confirmed: true });
    expect(d).toMatchObject({ allow: false, reason: 'mfa_required' });
  });

  it('verlangt für Schreibaktionen eine ausdrückliche Bestätigung', () => {
    const d = authorizeAction(operator2fa, { actionId: 'github.workflow.dispatch', confirmed: false });
    expect(d).toMatchObject({ allow: false, reason: 'confirmation_required' });
  });

  it('erlaubt bestätigte Schreibaktionen mit 2FA und markiert sie protokollpflichtig', () => {
    const d = authorizeAction(operator2fa, { actionId: 'github.workflow.dispatch', agentId: 'development', confirmed: true });
    expect(d.allow).toBe(true);
    if (d.allow) expect(d.mustAudit).toBe(true);
  });

  it('prüft die Positivliste des Agenten', () => {
    const d = authorizeAction(operator2fa, { actionId: 'github.workflow.dispatch', agentId: 'business-ops', confirmed: true });
    expect(d).toMatchObject({ allow: false, reason: 'agent_not_allowed' });
    const k = authorizeAction(operator2fa, { actionId: 'github.knowledge.propose', agentId: 'development', confirmed: true });
    expect(k).toMatchObject({ allow: false, reason: 'agent_not_allowed' });
  });

  it('entscheidet die Rolle vor allem anderen — kein Hinweis auf Aktionsdetails für Fremde', () => {
    const d = authorizeAction(stranger, { actionId: 'github.pr.merge', confirmed: true });
    expect(d).toMatchObject({ allow: false, reason: 'not_operator' });
  });
});

describe('isAllowedKnowledgePath', () => {
  it.each([
    ['docs/ai-os/README.md', true],
    ['docs/ai-os/wissen/neue-notiz.md', true],
    ['docs/ai-os/../../src/App.tsx', false],
    ['docs/ai-os/wissen/x.ts', false],
    ['docs/other/x.md', false],
    ['docs/ai-os/.obsidian/x.md', false],
    ['docs/ai-os//x.md', false],
    ['docs/ai-os/Großbuchstaben.md', false],
    ['', false],
  ])('%s → %s', (path, expected) => {
    expect(isAllowedKnowledgePath(path)).toBe(expected);
  });
});

describe('findSecretLikeContent', () => {
  it('erkennt typische Zugangsdaten', () => {
    expect(findSecretLikeContent(`token ghp_${'a'.repeat(36)}`)).toContain('GitHub-Token');
    expect(findSecretLikeContent(`sk_live_${'A1'.repeat(12)}`)).toContain('Stripe-Schlüssel');
    expect(findSecretLikeContent('-----BEGIN RSA PRIVATE KEY-----')).toContain('Privater Schlüssel');
  });

  it('meldet normalen Text nicht', () => {
    expect(findSecretLikeContent('Secret-Name AI_OS_GITHUB_TOKEN in Supabase hinterlegen.')).toEqual([]);
  });
});
