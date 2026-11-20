-- REVIEW DRAFT ONLY. DO NOT APPLY IN PRODUCTION.
-- Reuses distribution_queue_entries as the durable outbox instead of creating a second queue.
-- External delivery is NOT atomic with PostgreSQL: after any ambiguous response,
-- reconciliation (not blind retry) is mandatory. This script intentionally disables
-- legacy publisher RPCs until a V2, reviewed worker is deployed and tested.
BEGIN;

DO $preflight$
BEGIN
  IF to_regclass('public.distribution_queue_entries') IS NULL
     OR to_regclass('public.distribution_audit_log') IS NULL
     OR to_regclass('public.memberships') IS NULL THEN
    RAISE EXCEPTION 'Media publish gate prerequisite missing: distribution queue/audit/memberships';
  END IF;
END;
$preflight$;

ALTER TABLE public.distribution_queue_entries
  ADD COLUMN IF NOT EXISTS publish_payload_hash text,
  ADD COLUMN IF NOT EXISTS publish_lease_token uuid,
  ADD COLUMN IF NOT EXISTS publish_lease_expires_at timestamptz;

-- Only a real tenant owner can make an approval through the authenticated RPC.
-- No browser-side client may submit an already-approved queue entry.
DROP POLICY IF EXISTS "distribution_queue_tenant_insert" ON public.distribution_queue_entries;
REVOKE INSERT, UPDATE, DELETE ON public.distribution_queue_entries FROM PUBLIC, anon, authenticated;

CREATE TABLE IF NOT EXISTS public.distribution_publish_approvals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  queue_entry_id uuid NOT NULL UNIQUE REFERENCES public.distribution_queue_entries(id) ON DELETE RESTRICT,
  tenant_id uuid NOT NULL,
  channel text NOT NULL,
  payload_hash text NOT NULL,
  approved_by uuid NOT NULL,
  approved_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  CONSTRAINT dist_publish_approval_hash CHECK (payload_hash ~ '^[0-9a-f]{64}$'),
  CONSTRAINT dist_publish_approval_expiry CHECK (expires_at > approved_at)
);

ALTER TABLE public.distribution_publish_approvals ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.distribution_publish_approvals FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT ON public.distribution_publish_approvals TO service_role;
DROP POLICY IF EXISTS "dist_publish_approvals_service" ON public.distribution_publish_approvals;
CREATE POLICY "dist_publish_approvals_service" ON public.distribution_publish_approvals
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Append-only approval receipt (even service-role cannot quietly rewrite decisions).
CREATE OR REPLACE FUNCTION public.distribution_publish_approvals_immutable()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $fn$
BEGIN
  RAISE EXCEPTION 'Distribution approval receipts are immutable';
END;
$fn$;
DROP TRIGGER IF EXISTS trg_distribution_publish_approvals_immutable ON public.distribution_publish_approvals;
CREATE TRIGGER trg_distribution_publish_approvals_immutable
  BEFORE UPDATE OR DELETE ON public.distribution_publish_approvals
  FOR EACH ROW EXECUTE FUNCTION public.distribution_publish_approvals_immutable();
REVOKE ALL ON FUNCTION public.distribution_publish_approvals_immutable() FROM PUBLIC, anon, authenticated;

-- The queue itself is the durable transactional outbox: its approved status and
-- corresponding approval receipt are committed together or not at all.
-- Claiming is leased; expired leases require reconciliation, not auto-replay.
CREATE INDEX IF NOT EXISTS idx_dist_queue_publish_lease
  ON public.distribution_queue_entries(publish_lease_expires_at)
  WHERE publish_lease_token IS NOT NULL;

CREATE OR REPLACE FUNCTION public.distribution_queue_approve_for_publish_v2(p_queue_entry_id uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $fn$
DECLARE
  v_actor uuid := auth.uid();
  v_queue public.distribution_queue_entries%ROWTYPE;
  v_digest text;
  v_approval_id uuid;
BEGIN
  IF v_actor IS NULL OR COALESCE(auth.jwt()->>'role','') <> 'authenticated'
     OR COALESCE(auth.jwt()->>'is_anonymous','false') = 'true' THEN
    RAISE EXCEPTION 'Human authentication required' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_queue FROM public.distribution_queue_entries
    WHERE id = p_queue_entry_id FOR UPDATE;
  IF NOT FOUND OR v_queue.status <> 'pending' OR v_queue.approval_status <> 'pending'
     OR v_queue.attempts <> 0 OR v_queue.decided_at IS NOT NULL
     OR v_queue.published_at IS NOT NULL THEN
    RAISE EXCEPTION 'Queue entry not eligible for approval' USING ERRCODE = 'P0001';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.memberships m
    WHERE m.tenant_id = v_queue.tenant_id AND m.user_id = v_actor AND m.role = 'owner'
  ) THEN
    RAISE EXCEPTION 'Not an authorized tenant approver' USING ERRCODE = '42501';
  END IF;

  -- Bind approval to exact per-channel immutable publication bytes.
  v_digest := encode(sha256(convert_to(jsonb_build_object(
    'tenant_id',v_queue.tenant_id,'post_id',v_queue.post_id,
    'channel',v_queue.channel,'body',v_queue.body,
    'hashtags',v_queue.hashtags,'post_data',v_queue.post_data
  )::text, 'UTF8')), 'hex');

  INSERT INTO public.distribution_publish_approvals
    (queue_entry_id,tenant_id,channel,payload_hash,approved_by,expires_at)
    VALUES (v_queue.id,v_queue.tenant_id,v_queue.channel,v_digest,v_actor,now() + interval '48 hours')
    RETURNING id INTO v_approval_id;

  UPDATE public.distribution_queue_entries
    SET status = 'approved',approval_status = 'approved',
        reviewer = v_actor::text, decided_at = now(),
        publish_payload_hash = v_digest, updated_at = now()
    WHERE id = v_queue.id;

  INSERT INTO public.distribution_audit_log(queue_entry_id,tenant_id,event_type,channel,message,metadata)
    VALUES (v_queue.id,v_queue.tenant_id,'approved',v_queue.channel,
            'Owner-approved exact publication payload',
            jsonb_build_object('approval_id',v_approval_id,'payload_hash',v_digest));
  RETURN v_approval_id;
END;
$fn$;
REVOKE ALL ON FUNCTION public.distribution_queue_approve_for_publish_v2(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.distribution_queue_approve_for_publish_v2(uuid) TO authenticated;

-- Only claim rows that have a matching, unexpired, committed approval.
-- Note: lease expiration is deliberately excluded, since the provider outcome
-- may be unknown; reconciliation must be explicit before another send.
CREATE OR REPLACE FUNCTION public.distribution_queue_claim_approved_v2(p_channel text)
RETURNS TABLE (
  id uuid, tenant_id uuid, post_id text, channel text, body text,
  hashtags text[], status text, claim_token uuid, idempotency_key text
) LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $fn$
DECLARE
  v_id uuid;
  v_token uuid := gen_random_uuid();
BEGIN
  IF p_channel IS NULL OR btrim(p_channel) = '' THEN
    RAISE EXCEPTION 'Channel required' USING ERRCODE='22023';
  END IF;

  SELECT q.id INTO v_id
    FROM public.distribution_queue_entries q
    JOIN public.distribution_publish_approvals a ON a.queue_entry_id = q.id
   WHERE q.channel = p_channel
     AND q.status IN ('approved','failed')
     AND q.approval_status = 'approved'
     AND q.publish_lease_token IS NULL
     AND (q.next_retry_at IS NULL OR q.next_retry_at <= now())
     AND q.attempts < q.max_attempts
     AND a.tenant_id = q.tenant_id AND a.channel = q.channel
     AND a.approved_at <= now() AND a.expires_at > now()
     AND a.approved_by::text = q.reviewer
     AND q.publish_payload_hash = a.payload_hash
     AND q.publish_payload_hash = encode(sha256(convert_to(jsonb_build_object(
       'tenant_id',q.tenant_id,'post_id',q.post_id,
       'channel',q.channel,'body',q.body,
       'hashtags',q.hashtags,'post_data',q.post_data
     )::text, 'UTF8')), 'hex')
   ORDER BY q.created_at, q.id
   FOR UPDATE OF q SKIP LOCKED LIMIT 1;

  IF v_id IS NULL THEN RETURN; END IF;
  UPDATE public.distribution_queue_entries q
     SET publish_lease_token = v_token,
         publish_lease_expires_at = now() + interval '5 minutes',
         attempts = q.attempts + 1, updated_at = now()
   WHERE q.id = v_id;

  INSERT INTO public.distribution_audit_log(queue_entry_id,tenant_id,event_type,channel,message)
    SELECT q.id,q.tenant_id,'publish_started',q.channel,'Claim V2 with lease'
      FROM public.distribution_queue_entries q WHERE q.id=v_id;

  RETURN QUERY SELECT q.id,q.tenant_id,q.post_id,q.channel,q.body,q.hashtags,q.status,
     q.publish_lease_token,
     'rsd:publish:' || q.id::text || ':' || substr(q.publish_payload_hash,1,24)
    FROM public.distribution_queue_entries q WHERE q.id = v_id;
END;
$fn$;
REVOKE ALL ON FUNCTION public.distribution_queue_claim_approved_v2(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.distribution_queue_claim_approved_v2(text) TO service_role;

-- Complete only after a verifiable provider receipt; the claim token prevents
-- stale workers from acknowledging another worker's claim.
CREATE OR REPLACE FUNCTION public.distribution_queue_complete_v2(
  p_queue_entry_id uuid, p_claim_token uuid, p_provider_receipt text
) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $fn$
DECLARE v_queue public.distribution_queue_entries%ROWTYPE;
BEGIN
  IF p_provider_receipt IS NULL OR btrim(p_provider_receipt) = ''
     OR p_provider_receipt ~ '^(mock_|email_[0-9]|webhook_[0-9])' THEN
    RAISE EXCEPTION 'Real provider receipt required' USING ERRCODE = '22023';
  END IF;
  SELECT * INTO v_queue FROM public.distribution_queue_entries
    WHERE id = p_queue_entry_id FOR UPDATE;
  IF NOT FOUND OR v_queue.publish_lease_token IS DISTINCT FROM p_claim_token
     OR v_queue.publish_lease_expires_at IS NULL
     OR v_queue.publish_lease_expires_at < now()
     OR v_queue.status NOT IN ('approved','failed') THEN
    RAISE EXCEPTION 'No active matching claim' USING ERRCODE = 'P0001';
  END IF;
  -- Approval and digest also checked immediately before the successful ack.
  IF NOT EXISTS (SELECT 1 FROM public.distribution_publish_approvals a
    WHERE a.queue_entry_id = v_queue.id AND a.tenant_id = v_queue.tenant_id
      AND a.channel = v_queue.channel AND a.payload_hash = v_queue.publish_payload_hash
      AND a.expires_at > now() AND a.approved_by::text = v_queue.reviewer
      AND a.payload_hash = encode(sha256(convert_to(jsonb_build_object(
        'tenant_id',v_queue.tenant_id,'post_id',v_queue.post_id,
        'channel',v_queue.channel,'body',v_queue.body,
        'hashtags',v_queue.hashtags,'post_data',v_queue.post_data
      )::text, 'UTF8')), 'hex')) THEN
    RAISE EXCEPTION 'Approval invalid at completion' USING ERRCODE = 'P0001';
  END IF;
  UPDATE public.distribution_queue_entries
    SET status='published',external_id=p_provider_receipt,published_at=now(),
        publish_lease_token=NULL,publish_lease_expires_at=NULL,updated_at=now()
    WHERE id = v_queue.id;
  INSERT INTO public.distribution_audit_log(queue_entry_id,tenant_id,event_type,channel,message)
    VALUES (v_queue.id,v_queue.tenant_id,'publish_success',v_queue.channel,
            'Delivery receipt recorded');
  RETURN true;
END;
$fn$;
REVOKE ALL ON FUNCTION public.distribution_queue_complete_v2(uuid,uuid,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.distribution_queue_complete_v2(uuid,uuid,text) TO service_role;

-- Distinguish a confirmed no-delivery from an ambiguous result (timeout).
-- Ambiguous sends are quarantined; NEVER automatically retried.
CREATE OR REPLACE FUNCTION public.distribution_queue_fail_v2(
  p_queue_entry_id uuid, p_claim_token uuid, p_error text,
  p_confirmed_not_sent boolean DEFAULT false
) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $fn$
DECLARE
  v_queue public.distribution_queue_entries%ROWTYPE;
  v_retry boolean;
BEGIN
  SELECT * INTO v_queue FROM public.distribution_queue_entries
    WHERE id=p_queue_entry_id FOR UPDATE;
  IF NOT FOUND OR v_queue.publish_lease_token IS DISTINCT FROM p_claim_token
     OR v_queue.publish_lease_expires_at IS NULL THEN
    RAISE EXCEPTION 'No matching claim' USING ERRCODE='P0001';
  END IF;
  v_retry := p_confirmed_not_sent AND v_queue.attempts < v_queue.max_attempts;
  UPDATE public.distribution_queue_entries
    SET status='failed',last_error=left(coalesce(p_error,'unspecified'),500),
        next_retry_at=CASE WHEN v_retry THEN now() + make_interval(secs => 30 * (2 ^ LEAST(v_queue.attempts,6))::integer)
                           ELSE NULL END,
        -- Keep lease on an ambiguous outcome: prevents automatic replay.
        publish_lease_token=CASE WHEN v_retry THEN NULL ELSE v_queue.publish_lease_token END,
        publish_lease_expires_at=CASE WHEN v_retry THEN NULL ELSE v_queue.publish_lease_expires_at END,
        updated_at=now()
    WHERE id=v_queue.id;
  INSERT INTO public.distribution_audit_log(queue_entry_id,tenant_id,event_type,channel,message,metadata)
    VALUES (v_queue.id,v_queue.tenant_id,
            CASE WHEN v_retry THEN 'retry_scheduled' ELSE 'publish_failed' END,
            v_queue.channel,'V2 delivery outcome; manual reconciliation if ambiguous',
            jsonb_build_object('confirmed_not_sent',p_confirmed_not_sent,'requires_reconciliation',NOT p_confirmed_not_sent));
  RETURN v_retry;
END;
$fn$;
REVOKE ALL ON FUNCTION public.distribution_queue_fail_v2(uuid,uuid,text,boolean) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.distribution_queue_fail_v2(uuid,uuid,text,boolean) TO service_role;

-- Fail closed: old worker cannot claim, ack or retry through pre-V2 RPCs.
REVOKE EXECUTE ON FUNCTION public.distribution_queue_claim_next(text)
  FROM PUBLIC, anon, authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.distribution_queue_mark_published(uuid,text,timestamptz)
  FROM PUBLIC, anon, authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.distribution_queue_mark_failed(uuid,text)
  FROM PUBLIC, anon, authenticated, service_role;

COMMENT ON TABLE public.distribution_publish_approvals IS
  'Append-only human approval receipts. Queue state + approval + audit share one PG transaction.';
COMMENT ON COLUMN public.distribution_queue_entries.publish_lease_token IS
  'V2 publish outbox lease; a retained lease after ambiguous provider response means manual reconciliation.';

COMMIT;