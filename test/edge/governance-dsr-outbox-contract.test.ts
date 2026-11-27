import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

const migration = readFileSync('supabase/migrations/20261120040000_dsr_evidence_outbox.sql', 'utf8');
const handler = readFileSync('supabase/functions/governance-dsr/index.ts', 'utf8');
const worker = readFileSync('supabase/functions/governance-dsr-outbox/index.ts', 'utf8');
const subjectHelper = readFileSync('supabase/functions/_shared/dsrSubjectRef.ts', 'utf8');
const config = readFileSync('supabase/config.toml', 'utf8');

describe('Phase 3 DSR transactional evidence contract (static)', () => {
  it('queues an event from every DSR insert and update in the original transaction', () => {
    expect(migration).toMatch(/AFTER INSERT OR UPDATE ON public\.dsr_requests/);
    expect(migration).toMatch(/INSERT INTO public\.dsr_evidence_outbox/);
    expect(migration).toMatch(/INSERT INTO public\.governance_admin_log/);
  });

  it('blocks DSR writes if the outbox readiness RPC cannot be verified', () => {
    expect(handler).toContain("admin.rpc('dsr_outbox_ready')");
    expect(handler.match(/EVIDENCE_UNAVAILABLE/g)?.length).toBe(4);
    expect(handler.match(/await outboxReady\(admin\)/g)?.length).toBe(4);
  });

  it('does not write duplicate direct DSR evidence on the four mutation paths', () => {
    expect(handler).not.toContain("eventType: 'dsr.created'");
    expect(handler).not.toContain("eventType: 'dsr.updated'");
    expect(handler).not.toContain("eventType: 'dsr.assigned'");
    expect(handler).not.toContain("eventType: 'dsr.closed'");
  });

  it('does not make the outbox writable to authenticated clients', () => {
    expect(migration).toContain('GRANT SELECT ON TABLE public.dsr_evidence_outbox TO authenticated');
    expect(migration).not.toMatch(/GRANT (INSERT|UPDATE|DELETE) ON TABLE public\.dsr_evidence_outbox TO authenticated/);
    expect(migration).toContain("auth.role() IS DISTINCT FROM 'service_role'");
    expect(migration).toContain('FOR UPDATE SKIP LOCKED');
  });

  it('binds event append and delivery marking within the same guarded RPC', () => {
    expect(migration).toContain('INSERT INTO public.runtime_events');
    expect(migration).toContain("SET state = 'delivered'");
    expect(migration).toContain('EXCEPTION WHEN OTHERS THEN');
    expect(migration).toContain("SET state = 'failed'");
  });

  it('exposes the worker only behind a cron-only bearer and explicit config', () => {
    expect(worker).toContain("requireCronKey(req, 'CRON_DSR_OUTBOX_KEY', 'cron_dsr_outbox_key'");
    expect(worker).toContain("admin.rpc('dsr_outbox_drain'");
    expect(config).toContain('[functions.governance-dsr-outbox]\nverify_jwt = false');
  });
  it('reuses the HMAC identity helper for DSR intake and cron recovery', () => {
    expect(handler).toContain("import { ensureSubjectRef } from '../_shared/dsrSubjectRef.ts'");
    expect(worker).toContain("import { ensureSubjectRef } from '../_shared/dsrSubjectRef.ts'");
    expect(subjectHelper).toContain("admin.rpc('subject_ref_compute'");
  });

  it('blocks evidence completion without a durable tenant subject mapping', () => {
    expect(migration).toContain('CREATE OR REPLACE FUNCTION public.dsr_outbox_subject_pending');
    expect(migration).toContain('CREATE OR REPLACE FUNCTION public.dsr_outbox_subject_link');
    expect(migration).toContain("public.subject_ref_compute(");
    expect(migration).toContain("RAISE EXCEPTION 'subject linkage pending'");
    expect(worker).toContain("'dsr_outbox_subject_pending'");
    expect(worker).toContain("admin.rpc('dsr_outbox_subject_link'");
  });

  it('enqueues erasure evidence atomically and never logs database error messages', () => {
    expect(migration).toContain("'dsr.erasure_requested'");
    expect(migration).toContain("deletion_requested_at IS NULL");
    expect(migration).toContain("last_error = 'SQLSTATE_' || SQLSTATE");
    expect(handler).not.toContain('await enqueueErasure(');
    expect(handler).not.toContain('await upsertMapping(');
    expect(handler).not.toContain('async function emitEvidence(');
  });

});
