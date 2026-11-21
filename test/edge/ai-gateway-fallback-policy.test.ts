/**
 * Fix 1 (MP-0 Nachtrag, Codex P1 governance-router:215):
 * Die Fallback-Freigabe muss fallback-spezifisch sein.
 *
 * Vorher genuegte eine gewoehnliche `model_usage`-Allow-Regel mit
 * `vendors: ['openai']`, um OpenAI als automatischen Fallback freizuschalten:
 * `matchAiPolicy` wertete `action.verb` nicht aus, und `explicitlyAllowed`
 * pruefte nur, DASS eine Regel traf — nicht WELCHE.
 *
 * Geprueft wird Ende zu Ende: Policy-Zeile → buildSnapshot → evaluateSnapshot
 * → fallbackExplicitlyAllowed, also genau der Pfad aus `allowedFallbacks`.
 */
import { describe, it, expect } from 'vitest';
import {
  buildSnapshot,
  evaluateSnapshot,
  matchCompiledPolicy,
  compileAiPolicies,
  type AiPolicyRowInput,
  type DecisionRequest,
} from '../../supabase/functions/_shared/pdp/core';
import { fallbackExplicitlyAllowed } from '../../supabase/functions/_shared/aiGateway/pdpGuard';

const TENANT = 'tenant-1';
const OTHER_TENANT = 'tenant-2';

function aiRow(overrides: Partial<AiPolicyRowInput> = {}): AiPolicyRowInput {
  return {
    id: 'p1',
    name: 'Modellfreigabe',
    rule_type: 'model_usage',
    action: 'allow',
    enabled: true,
    condition: { vendors: ['openai'] },
    tenant_id: null,
    ...overrides,
  };
}

/** Die Abfrage, die `allowedFallbacks` im governance-router stellt. */
function fallbackRequest(vendor = 'openai'): DecisionRequest {
  return {
    contract: 'v1',
    tenant_id: TENANT,
    principal: { type: 'service' },
    action: { verb: 'provider_fallback', channel: 'ai_gateway' },
    target: { model: 'governance-brief', vendor },
    context: { feature: 'governance_router' },
  } as DecisionRequest;
}

/** Entscheidet wie `allowedFallbacks`: Snapshot bauen, bewerten, Guard fragen. */
function fallbackAllowed(rows: AiPolicyRowInput[], vendor = 'openai'): boolean {
  const snapshot = buildSnapshot(TENANT, rows, []);
  const result = evaluateSnapshot(snapshot, fallbackRequest(vendor));
  return fallbackExplicitlyAllowed(result, TENANT);
}

describe('Fallback-Freigabe verlangt Mandant und Verb', () => {
  it('globale model_usage-Allow-Regel mit vendors [openai] gibt KEINEN Fallback frei', () => {
    // Der gemeldete Bypass: allgemeine Modellfreigabe, global, kein Verb.
    expect(fallbackAllowed([aiRow({ tenant_id: null })])).toBe(false);
  });

  it('mandantenspezifische model_usage-Regel ohne verb provider_fallback gibt KEINEN Fallback frei', () => {
    expect(fallbackAllowed([aiRow({ tenant_id: TENANT })])).toBe(false);
  });

  it('mandantenspezifische Regel mit verb provider_fallback und passendem Anbieter erlaubt den Fallback', () => {
    const row = aiRow({
      tenant_id: TENANT,
      condition: { vendors: ['openai'], verbs: ['provider_fallback'] },
    });
    expect(fallbackAllowed([row])).toBe(true);
  });

  it('Regel fuer einen anderen Tenant gibt KEINEN Fallback frei', () => {
    const row = aiRow({
      tenant_id: OTHER_TENANT,
      condition: { vendors: ['openai'], verbs: ['provider_fallback'] },
    });
    expect(fallbackAllowed([row])).toBe(false);
  });

  it('verbgebundene Regel greift nicht fuer einen anderen Anbieter', () => {
    const row = aiRow({
      tenant_id: TENANT,
      condition: { vendors: ['openai'], verbs: ['provider_fallback'] },
    });
    expect(fallbackAllowed([row], 'anthropic')).toBe(false);
  });

  it('ohne Mandanten gibt es nie eine Freigabe', () => {
    const row = aiRow({
      tenant_id: TENANT,
      condition: { vendors: ['openai'], verbs: ['provider_fallback'] },
    });
    const snapshot = buildSnapshot(TENANT, [row], []);
    const result = evaluateSnapshot(snapshot, fallbackRequest());
    expect(fallbackExplicitlyAllowed(result, null)).toBe(false);
    expect(fallbackExplicitlyAllowed(result, '')).toBe(false);
  });

  it('ohne Policy-Treffer gibt der PDP-Default allow keine Freigabe', () => {
    expect(fallbackAllowed([])).toBe(false);
  });
});

describe('Verb-Gate aendert bestehendes Verhalten nicht', () => {
  const invoke: DecisionRequest = {
    contract: 'v1',
    tenant_id: TENANT,
    action: { verb: 'invoke', channel: 'ai_gateway', event_type: 'prompt_sent' },
    target: { model: 'gpt-4o', vendor: 'openai' },
  } as DecisionRequest;

  it('Regel ohne verbs matcht weiter verbunabhaengig (model_usage unveraendert)', () => {
    const [p] = compileAiPolicies([aiRow({ tenant_id: TENANT })]);
    expect(p.verb_scoped).toBe(false);
    expect(matchCompiledPolicy(invoke, p)).toBe(true);
    // ... und ebenso fuer die Fallback-Abfrage: der Treffer bleibt, nur die
    // Freigabe-Auswertung im Guard verlangt jetzt mehr.
    expect(matchCompiledPolicy(fallbackRequest(), p)).toBe(true);
  });

  it('Regel mit verbs matcht nur beim passenden Verb', () => {
    const [p] = compileAiPolicies([aiRow({
      tenant_id: TENANT,
      condition: { vendors: ['openai'], verbs: ['provider_fallback'] },
    })]);
    expect(p.verb_scoped).toBe(true);
    expect(matchCompiledPolicy(invoke, p)).toBe(false);
    expect(matchCompiledPolicy(fallbackRequest(), p)).toBe(true);
  });

  it('verbs wird case-insensitiv verglichen', () => {
    const [p] = compileAiPolicies([aiRow({
      tenant_id: TENANT,
      condition: { vendors: ['openai'], verbs: ['Provider_Fallback'] },
    })]);
    expect(matchCompiledPolicy(fallbackRequest(), p)).toBe(true);
  });

  it('leeres verbs-Array gilt als nicht gesetzt (kein stilles Blockieren)', () => {
    const [p] = compileAiPolicies([aiRow({
      tenant_id: TENANT,
      condition: { vendors: ['openai'], verbs: [] },
    })]);
    expect(p.verb_scoped).toBe(false);
    expect(matchCompiledPolicy(invoke, p)).toBe(true);
  });
});

describe('Policy-Mandant wird mitgefuehrt', () => {
  it('compileAiPolicies uebernimmt tenant_id, fehlend = global', () => {
    const [specific] = compileAiPolicies([aiRow({ tenant_id: TENANT })]);
    expect(specific.tenant_id).toBe(TENANT);
    const [global] = compileAiPolicies([{ ...aiRow(), tenant_id: undefined }]);
    expect(global.tenant_id).toBeNull();
  });

  it('evaluateSnapshot liefert policy_tenant_id und verb_scoped im Grund', () => {
    const row = aiRow({
      tenant_id: TENANT,
      condition: { vendors: ['openai'], verbs: ['provider_fallback'] },
    });
    const result = evaluateSnapshot(buildSnapshot(TENANT, [row], []), fallbackRequest());
    const primary = result.reasons.find((r) => r.policy_id === result.primary_policy_id);
    expect(primary?.policy_tenant_id).toBe(TENANT);
    expect(primary?.verb_scoped).toBe(true);
  });
});
