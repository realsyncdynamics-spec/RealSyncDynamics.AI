/**
 * Google-Workspace-Eingang (`_shared/workspaceEvents.ts`): Validierung,
 * Aktionsstufen, Quellenbindung, Payload-Hash. Rein, ohne Netz/Datenbank.
 */
import { describe, expect, it } from 'vitest';
import {
  canonicalJson,
  decideWorkspaceAction,
  keySourceAllowsWorkspace,
  mapIngestRpcError,
  validateWorkspaceEvent,
  workspacePayloadHash,
  type WorkspaceEvent,
} from '../../supabase/functions/_shared/workspaceEvents';

const TENANT = '11111111-1111-4111-8111-111111111111';
const OTHER = '22222222-2222-4222-8222-222222222222';

const base = {
  schema_version: '1.0',
  event_id: 'evt-test-0001',
  agent_id: 'RSD-02',
  event_type: 'kdp.file.received',
  resource_id: 'drive-file-test-001',
  requested_action: 'create_review',
  requires_approval: false,
  metadata: { project_id: 'kdp-project-001', file_type: 'application/pdf' },
};

describe('validateWorkspaceEvent', () => {
  it('akzeptiert das Beispiel aus dem Masterplan', () => {
    const v = validateWorkspaceEvent(base);
    expect(v.ok).toBe(true);
  });

  it('weist tenant_id im Body ab (Mandant nur aus dem Schlüssel)', () => {
    const v = validateWorkspaceEvent({ ...base, tenant_id: TENANT });
    expect(v).toMatchObject({ ok: false, status: 403, code: 'TENANT_FROM_BODY' });
  });

  it('weist unbekannte Felder, falsche Version und ungültige IDs ab', () => {
    expect(validateWorkspaceEvent({ ...base, extra: 1 }).ok).toBe(false);
    expect(validateWorkspaceEvent({ ...base, schema_version: '2.0' }).ok).toBe(false);
    expect(validateWorkspaceEvent({ ...base, agent_id: 'RSD-99' }).ok).toBe(false);
    expect(validateWorkspaceEvent({ ...base, event_id: 'mit leerzeichen' }).ok).toBe(false);
    expect(validateWorkspaceEvent({ ...base, metadata: [] }).ok).toBe(false);
    expect(validateWorkspaceEvent(null).ok).toBe(false);
  });

  it('begrenzt metadata auf 4 KB (keine Mail- oder Dokumentinhalte)', () => {
    const v = validateWorkspaceEvent({ ...base, metadata: { text: 'x'.repeat(5000) } });
    expect(v.ok).toBe(false);
  });
});

describe('decideWorkspaceAction', () => {
  it('interne Aktionen laufen ohne Freigabe', () => {
    expect(decideWorkspaceAction('RSD-01', 'draft_reply')).toBe('allow');
    expect(decideWorkspaceAction('RSD-03', 'create_report')).toBe('allow');
  });

  it('Außenwirkung verlangt eine Freigabe', () => {
    expect(decideWorkspaceAction('RSD-01', 'send_email')).toBe('require_approval');
    expect(decideWorkspaceAction('RSD-04', 'send_offer')).toBe('require_approval');
  });

  it('löschen, bezahlen, veröffentlichen, mergen, deployen sind nie erlaubt', () => {
    for (const a of ['delete', 'pay', 'publish_kdp', 'upload_kdp', 'merge', 'deploy', 'post_social', 'send_invoice']) {
      for (const agent of ['RSD-01', 'RSD-02', 'RSD-03', 'RSD-04', 'RSD-05', 'RSD-06'] as const) {
        expect(decideWorkspaceAction(agent, a)).toBe('forbidden');
      }
    }
  });

  it('unbekannte oder agentenfremde Aktionen sind verboten (fail closed)', () => {
    expect(decideWorkspaceAction('RSD-03', 'send_email')).toBe('forbidden');
    expect(decideWorkspaceAction('RSD-06', 'whatever_action')).toBe('forbidden');
  });
});

describe('keySourceAllowsWorkspace', () => {
  it('verlangt die Quelle google_workspace ausdrücklich', () => {
    expect(keySourceAllowsWorkspace(['google_workspace'])).toBe(true);
    expect(keySourceAllowsWorkspace([])).toBe(false);
    expect(keySourceAllowsWorkspace(['sdk'])).toBe(false);
    expect(keySourceAllowsWorkspace(null)).toBe(false);
  });
});

describe('workspacePayloadHash', () => {
  const ev = validateWorkspaceEvent(base);
  if (!ev.ok) throw new Error('fixture invalid');
  const e: WorkspaceEvent = ev.event;

  it('ist unabhängig von der Schlüsselreihenfolge', async () => {
    const reordered = { ...e, metadata: { file_type: 'application/pdf', project_id: 'kdp-project-001' } };
    expect(await workspacePayloadHash(TENANT, e)).toBe(await workspacePayloadHash(TENANT, reordered));
    expect(canonicalJson({ b: 1, a: [2, { d: 3, c: 4 }] })).toBe('{"a":[2,{"c":4,"d":3}],"b":1}');
  });

  it('ändert sich bei jeder Nutzdatenänderung und je Mandant', async () => {
    const h = await workspacePayloadHash(TENANT, e);
    expect(h).toMatch(/^[0-9a-f]{64}$/);
    expect(await workspacePayloadHash(OTHER, e)).not.toBe(h);
    expect(await workspacePayloadHash(TENANT, { ...e, resource_id: 'other' })).not.toBe(h);
    expect(await workspacePayloadHash(TENANT, { ...e, metadata: { ...e.metadata, x: 1 } })).not.toBe(h);
  });
});

describe('mapIngestRpcError', () => {
  it('bildet Datenbankfehler fail-closed ab', () => {
    expect(mapIngestRpcError('workspace_key_invalid')).toEqual({ status: 401, code: 'UNAUTHORIZED' });
    expect(mapIngestRpcError('workspace_rate_limited')).toEqual({ status: 429, code: 'RATE_LIMITED' });
    expect(mapIngestRpcError('irgendwas')).toEqual({ status: 503, code: 'INGEST_FAILED' });
    expect(mapIngestRpcError(undefined)).toEqual({ status: 503, code: 'INGEST_FAILED' });
  });
});
