import { describe, expect, it } from 'vitest';
import { mapKodeeGatewayError } from '../../../src/features/kodee/KodeeView';
import type { GatewayResult } from '../../../src/core/ai-gateway/gateway';

function failure(overrides: Partial<GatewayResult>): GatewayResult {
  return {
    success: false,
    error: 'BAD_REQUEST: generic',
    errorCode: 'BAD_REQUEST',
    status: 400,
    ...overrides,
  };
}

describe('Kodee gateway error mapping', () => {
  it('maps missing tenant to a dedicated German message without retry', () => {
    const mapped = mapKodeeGatewayError(failure({
      error: 'BAD_REQUEST: tenant_id is required',
    }));
    expect(mapped.retryable).toBe(false);
    expect(mapped.text).toMatch(/Mandant/i);
  });

  it('maps 401 to re-login guidance', () => {
    const mapped = mapKodeeGatewayError(failure({ status: 401, errorCode: 'UNAUTHORIZED' }));
    expect(mapped.retryable).toBe(false);
    expect(mapped.text).toMatch(/anmelden/i);
  });

  it('maps 403 to permissions guidance', () => {
    const mapped = mapKodeeGatewayError(failure({ status: 403, errorCode: 'FORBIDDEN' }));
    expect(mapped.retryable).toBe(false);
    expect(mapped.text).toMatch(/Berechtigung/i);
  });

  it('maps 429 with retryAfter to retryable output', () => {
    const mapped = mapKodeeGatewayError(failure({
      status: 429,
      errorCode: 'RATE_LIMITED',
      retryAfter: 12,
    }));
    expect(mapped.retryable).toBe(true);
    expect(mapped.text).toMatch(/12s/);
  });

  it('maps policy and approval gate errors', () => {
    const blocked = mapKodeeGatewayError(failure({ status: 403, errorCode: 'POLICY_BLOCKED' }));
    const approval = mapKodeeGatewayError(failure({ status: 403, errorCode: 'APPROVAL_REQUIRED' }));
    expect(blocked.retryable).toBe(false);
    expect(blocked.text).toMatch(/Richtlinie/i);
    expect(approval.retryable).toBe(false);
    expect(approval.text).toMatch(/Freigabe/i);
  });

  it('maps unknown failures to generic retryable message', () => {
    const mapped = mapKodeeGatewayError(failure({
      status: 502,
      errorCode: 'UPSTREAM_UNAVAILABLE',
      error: 'UPSTREAM_UNAVAILABLE: gateway HTTP 502',
    }));
    expect(mapped.retryable).toBe(true);
    expect(mapped.text).toMatch(/fehlgeschlagen/i);
  });
});
