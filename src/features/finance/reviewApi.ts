import { getSupabase } from '../../lib/supabase';
import {
  canTransition,
  statusChangeTimestamps,
  type ReviewStatus,
  type ReviewSubjectType,
  type ReviewAuthorLabel,
} from './reviewWorkflow';

// ── Types (mirror of DB columns) ──────────────────────────────────

export interface TaxAdvisorReview {
  id: string;
  tenant_id: string;
  subject_type: ReviewSubjectType;
  subject_id: string;
  title: string;
  notes: string | null;
  assigned_to_name: string | null;
  assigned_to_email: string | null;
  status: ReviewStatus;
  requested_by: string | null;
  decided_at: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface TaxAdvisorReviewComment {
  id: string;
  tenant_id: string;
  review_id: string;
  author_user_id: string | null;
  author_label: ReviewAuthorLabel;
  body: string;
  created_at: string;
}

// ── Audit helper (same pattern as src/features/finance/api.ts) ────

async function logReviewEvent(input: {
  tenant_id: string;
  event_type: string;
  entity_id: string;
  before_state?: Record<string, unknown> | null;
  after_state?: Record<string, unknown> | null;
}): Promise<void> {
  const sb = getSupabase();
  await sb.from('tax_audit_events').insert({
    tenant_id:    input.tenant_id,
    event_type:   input.event_type,
    entity_type:  'tax_advisor_review',
    entity_id:    input.entity_id,
    before_state: input.before_state ?? null,
    after_state:  input.after_state ?? null,
    source:       'ui',
  });
}

// ── Reviews CRUD ─────────────────────────────────────────────────

export async function listReviews(
  tenantId: string, opts?: { openOnly?: boolean; subjectId?: string },
): Promise<TaxAdvisorReview[]> {
  const sb = getSupabase();
  let q = sb.from('tax_advisor_reviews').select('*').eq('tenant_id', tenantId);
  if (opts?.subjectId) q = q.eq('subject_id', opts.subjectId);
  if (opts?.openOnly)  q = q.neq('status', 'completed');
  const { data } = await q.order('created_at', { ascending: false });
  return (data as TaxAdvisorReview[] | null) ?? [];
}

export async function createReview(tenantId: string, payload: {
  subject_type: ReviewSubjectType;
  subject_id: string;
  title: string;
  notes?: string;
  assigned_to_name?: string;
  assigned_to_email?: string;
}): Promise<TaxAdvisorReview> {
  const sb = getSupabase();
  const { data, error } = await sb.from('tax_advisor_reviews').insert({
    tenant_id:         tenantId,
    subject_type:      payload.subject_type,
    subject_id:        payload.subject_id,
    title:             payload.title,
    notes:             payload.notes ?? null,
    assigned_to_name:  payload.assigned_to_name ?? null,
    assigned_to_email: payload.assigned_to_email ?? null,
    status:            'requested',
  }).select('*').single();
  if (error) throw new Error(error.message);
  const row = data as TaxAdvisorReview;
  await logReviewEvent({
    tenant_id: tenantId,
    event_type: 'review.created',
    entity_id: row.id,
    after_state: row as unknown as Record<string, unknown>,
  });
  // Drop a system comment so the audit-thread starts non-empty.
  await postComment(tenantId, row.id, {
    author_label: 'system',
    body: `Review-Anfrage erstellt für ${payload.subject_type}. Status: requested.`,
  });
  return row;
}

export async function transitionReview(
  tenantId: string, reviewId: string, next: ReviewStatus,
): Promise<TaxAdvisorReview> {
  const sb = getSupabase();
  const { data: current, error: readErr } = await sb.from('tax_advisor_reviews')
    .select('*').eq('id', reviewId).single();
  if (readErr || !current) {
    throw new Error(readErr?.message ?? 'review not found');
  }
  const currentRow = current as TaxAdvisorReview;
  if (!canTransition(currentRow.status, next)) {
    throw new Error(`Statuswechsel ${currentRow.status} → ${next} ist nicht erlaubt.`);
  }
  const sideEffects = statusChangeTimestamps(next);
  const { data: updated, error: updErr } = await sb.from('tax_advisor_reviews')
    .update({ status: next, ...sideEffects })
    .eq('tenant_id', tenantId).eq('id', reviewId)
    .select('*').single();
  if (updErr) throw new Error(updErr.message);
  const updatedRow = updated as TaxAdvisorReview;

  await logReviewEvent({
    tenant_id: tenantId,
    event_type: `review.${next}`,
    entity_id: reviewId,
    before_state: { status: currentRow.status },
    after_state:  { status: next, ...sideEffects },
  });
  await postComment(tenantId, reviewId, {
    author_label: 'system',
    body: `Status: ${currentRow.status} → ${next}.`,
  });
  return updatedRow;
}

// ── Comments ─────────────────────────────────────────────────────

export async function listComments(reviewId: string): Promise<TaxAdvisorReviewComment[]> {
  const sb = getSupabase();
  const { data } = await sb.from('tax_advisor_review_comments')
    .select('*')
    .eq('review_id', reviewId)
    .order('created_at', { ascending: true });
  return (data as TaxAdvisorReviewComment[] | null) ?? [];
}

export async function postComment(
  tenantId: string, reviewId: string, payload: {
    author_label: ReviewAuthorLabel;
    body: string;
  },
): Promise<TaxAdvisorReviewComment> {
  const sb = getSupabase();
  const trimmed = payload.body.trim();
  if (!trimmed) throw new Error('Kommentar darf nicht leer sein.');
  if (trimmed.length > 8000) throw new Error('Kommentar zu lang (max 8000 Zeichen).');
  const { data, error } = await sb.from('tax_advisor_review_comments').insert({
    tenant_id:     tenantId,
    review_id:     reviewId,
    author_label:  payload.author_label,
    body:          trimmed,
  }).select('*').single();
  if (error) throw new Error(error.message);
  return data as TaxAdvisorReviewComment;
}
