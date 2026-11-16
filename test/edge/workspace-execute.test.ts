/**
 * workspace-execute / workspace-approvals (`_shared/workspaceExecute.ts`):
 * Eingabeprüfung und Bewertung einer Freigabe. Rein, ohne Netz/Datenbank.
 * Dazu ein Strukturnachweis: workspace-execute löst nichts ein.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  evaluateApproval,
  mapDecideRpcError,
  validateApprovalsRequest,
  validateExecuteRequest,
  type ApprovalRow,
} from '../../supabase/functions/_shared/workspaceExecute';

const TENANT = '11111111-1111-4111-8111-111111111111';
const OTHER = '22222222-2222-4222-8222-222222222222';
const APPROVAL = '33333333-3333-4333-8333-333333333333';
const HASH = 'a'.repeat(64);
const NOW = Date.parse('2026-11-16T03:00:00Z');

const row = (over: Partial<ApprovalRow> = {}): ApprovalRow => ({
  id: APPROVAL,
  tenant_id: TENANT,
  agent_id: 'RSD-01',
  action_type: 'send_email',
  target_resource: 'gmail:draft/1',
  payload_hash: HASH,
  status: 'APPROVED',
  expires_at: '2026-11-17T03:00:00Z',
  ...over,
});

describe('validateExecuteRequest', () => {
  const ok = { schema_version: '1.0', approval_id: APPROVAL, payload_hash: HASH };
  it('setzt dry_run als Standard', () => {
    expect(validateExecuteRequest(ok)).toEqual({ ok: true, request: { approval_id: APPROVAL, payload_hash: HASH, mode: 'dry_run' } });
  });
  it('weist tenant_id im Body mit 403 ab', () => {
    expect(validateExecuteRequest({ ...ok, tenant_id: OTHER })).toMatchObject({ ok: false, status: 403, code: 'TENANT_FROM_BODY' });
  });
  it.each([
    ['kein Objekt', [ok]],
    ['falsches Schema', { ...ok, schema_version: '2.0' }],
    ['approval_id kein UUID', { ...ok, approval_id: 'x' }],
    ['payload_hash kein Hash', { ...ok, payload_hash: 'A'.repeat(64) }],
    ['unbekannter Modus', { ...ok, mode: 'run' }],
    ['unbekanntes Feld', { ...ok, execution_id: 'x' }],
  ])('lehnt ab: %s', (_n, body) => {
    expect(validateExecuteRequest(body)).toMatchObject({ ok: false, status: 400 });
  });
});

describe('evaluateApproval', () => {
  it('meldet eine freigegebene, passende Freigabe als bereit', () => {
    expect(evaluateApproval(row(), TENANT, HASH, NOW)).toEqual({
      ready: true, agent_id: 'RSD-01', action_type: 'send_email', target_resource: 'gmail:draft/1', expires_at: '2026-11-17T03:00:00Z',
    });
  });
  it('unterscheidet unbekannt und fremden Mandanten nicht', () => {
    const unknown = evaluateApproval(null, TENANT, HASH, NOW);
    const foreign = evaluateApproval(row({ tenant_id: OTHER }), TENANT, HASH, NOW);
    expect(unknown).toEqual(foreign);
    expect(unknown).toMatchObject({ ready: false, status: 404 });
  });
  it.each(['PENDING', 'REJECTED', 'EXECUTED', 'CANCELLED', 'FAILED'])('lehnt Status %s ab', (status) => {
    expect(evaluateApproval(row({ status }), TENANT, HASH, NOW)).toMatchObject({ ready: false, status: 409, code: 'APPROVAL_NOT_APPROVED' });
  });
  it('lehnt abgelaufene Freigaben ab, auch wenn der Status noch APPROVED ist', () => {
    expect(evaluateApproval(row({ expires_at: '2026-11-16T03:00:00Z' }), TENANT, HASH, NOW)).toMatchObject({ ready: false, code: 'APPROVAL_EXPIRED' });
    expect(evaluateApproval(row({ status: 'EXPIRED' }), TENANT, HASH, NOW)).toMatchObject({ ready: false, code: 'APPROVAL_EXPIRED' });
    expect(evaluateApproval(row({ expires_at: 'kein-datum' }), TENANT, HASH, NOW)).toMatchObject({ ready: false, code: 'APPROVAL_EXPIRED' });
  });
  it('lehnt einen anderen payload_hash ab', () => {
    expect(evaluateApproval(row(), TENANT, 'b'.repeat(64), NOW)).toMatchObject({ ready: false, status: 409, code: 'PAYLOAD_MISMATCH' });
  });
  it('lehnt ab, wenn die Aktion für den Agenten nicht (mehr) freigabefähig ist', () => {
    // send_email ist nur für RSD-01 freigabefähig; publish ist immer verboten.
    expect(evaluateApproval(row({ agent_id: 'RSD-02' }), TENANT, HASH, NOW)).toMatchObject({ ready: false, status: 403, code: 'ACTION_FORBIDDEN' });
    expect(evaluateApproval(row({ action_type: 'publish' }), TENANT, HASH, NOW)).toMatchObject({ ready: false, status: 403 });
    expect(evaluateApproval(row({ action_type: 'draft_reply' }), TENANT, HASH, NOW)).toMatchObject({ ready: false, status: 403 });
    expect(evaluateApproval(row({ agent_id: 'RSD-99' }), TENANT, HASH, NOW)).toMatchObject({ ready: false, status: 403 });
  });
});

describe('validateApprovalsRequest', () => {
  it('list: Standard PENDING, tenant_id nur als Filter', () => {
    expect(validateApprovalsRequest({ op: 'list' })).toEqual({ ok: true, request: { op: 'list', status: 'PENDING', tenant_id: null } });
    expect(validateApprovalsRequest({ op: 'list', status: 'APPROVED', tenant_id: TENANT }))
      .toEqual({ ok: true, request: { op: 'list', status: 'APPROVED', tenant_id: TENANT } });
  });
  it('approve / reject brauchen eine approval_id', () => {
    expect(validateApprovalsRequest({ op: 'approve', approval_id: APPROVAL })).toEqual({ ok: true, request: { op: 'approve', approval_id: APPROVAL } });
    expect(validateApprovalsRequest({ op: 'reject', approval_id: 'x' })).toMatchObject({ ok: false });
  });
  it.each([
    ['unbekannte op', { op: 'execute', approval_id: APPROVAL }],
    ['Status klein geschrieben', { op: 'list', status: 'pending' }],
    ['tenant_id kein UUID', { op: 'list', tenant_id: 'x' }],
    ['kein Objekt', null],
  ])('lehnt ab: %s', (_n, body) => {
    expect(validateApprovalsRequest(body)).toMatchObject({ ok: false });
  });
});

describe('mapDecideRpcError', () => {
  it('bildet die Fehler der Datenbankfunktion ab und fällt sonst auf 503', () => {
    expect(mapDecideRpcError('workspace_unauthenticated')).toEqual({ status: 401, code: 'UNAUTHORIZED' });
    expect(mapDecideRpcError('ERROR: workspace_approval_not_found')).toEqual({ status: 404, code: 'APPROVAL_NOT_FOUND' });
    expect(mapDecideRpcError('workspace_approval_not_pending')).toEqual({ status: 409, code: 'APPROVAL_NOT_PENDING' });
    expect(mapDecideRpcError(undefined)).toEqual({ status: 503, code: 'DECISION_FAILED' });
  });
});

describe('Strukturnachweis: keine Einlösung, keine Service-Role im Freigabe-Endpunkt', () => {
  const src = (fn: string) =>
    readFileSync(join(process.cwd(), 'supabase/functions', fn, 'index.ts'), 'utf8')
      .split('\n').filter((l) => !l.trim().startsWith('//')).join('\n');

  it('workspace-execute ruft consume_workspace_approval nicht auf und schreibt nichts', () => {
    const code = src('workspace-execute');
    expect(code).not.toMatch(/consume_workspace_approval/);
    expect(code).not.toMatch(/\.(insert|update|upsert|delete)\(/);
    expect(code).not.toMatch(/\bfetch\(/);
    // Der einzige rpc-Aufruf ist die Signaturprüfung.
    expect(code.match(/\.rpc\(/g)).toHaveLength(1);
  });
  it('workspace-execute verlangt die Signatur immer (required = true)', () => {
    expect(src('workspace-execute')).toMatch(/'workspace-execute',\s*true,/);
  });
  it('workspace-approvals nutzt keinen Service-Role-Key', () => {
    expect(src('workspace-approvals')).not.toMatch(/SERVICE_ROLE/);
  });
});
