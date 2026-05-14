// Pure state machine for the Steuerberater Review Layer.
//
// Positioning lock: this module describes a WORKFLOW between the
// requester (Geschäftsführung / Owner) and an external Steuerberater.
// It does NOT contain any tax assessment logic. The Steuerberater's
// actual evaluation happens offline; the requester transcribes the
// outcome into the comment thread and flips the status accordingly.

export type ReviewStatus =
  | 'requested'    // Anfrage geschickt, Steuerberater hat noch nicht reagiert
  | 'in_review'    // Steuerberater hat Erhalt bestätigt / arbeitet daran
  | 'confirmed'    // Steuerberater bestätigt das Paket inhaltlich
  | 'rejected'     // Steuerberater lehnt das Paket ab (Nacharbeit nötig)
  | 'completed';   // Workflow ist geschlossen (z. B. Steuerberater hat Akte abgeschlossen)

export type ReviewSubjectType =
  | 'tax_evidence_export'
  | 'tax_year'
  | 'annual_financials';

export type ReviewAuthorLabel = 'owner' | 'steuerberater' | 'system';

export const STATUS_LABEL: Record<ReviewStatus, string> = {
  requested: 'Angefragt',
  in_review: 'In Bearbeitung',
  confirmed: 'Bestätigt',
  rejected:  'Abgelehnt',
  completed: 'Erledigt',
};

export const SUBJECT_TYPE_LABEL: Record<ReviewSubjectType, string> = {
  tax_evidence_export: 'Exportpaket',
  tax_year:            'Jahresordner',
  annual_financials:   'Jahresabschluss',
};

export const AUTHOR_LABEL_TEXT: Record<ReviewAuthorLabel, string> = {
  owner:         'Geschäftsführung',
  steuerberater: 'Steuerberater',
  system:        'System',
};

/**
 * The disclaimer that MUST appear on every review-related UI surface.
 * Encoded here so any UI rendering it picks up the same wording.
 */
export const REVIEW_DISCLAIMER =
  'Dieses Review-Tracking dokumentiert nur den Workflow zwischen ' +
  'Geschäftsführung und Steuerberater. Es ersetzt keine Steuerberatung ' +
  'und übermittelt keine verbindlichen Aussagen über die steuerliche Bewertung.';

// ── State machine ────────────────────────────────────────────────

/**
 * Allowed transitions from each status. The graph:
 *
 *   requested → in_review → confirmed → completed
 *                       \→ rejected  → requested (re-submit)
 *                                    → completed
 *   requested → rejected     (abort early)
 *   requested → completed    (abandoned)
 *   in_review → completed    (advisor closed without verdict)
 *
 * Terminal: 'completed'. Anything else can move forward.
 */
const TRANSITIONS: Record<ReviewStatus, readonly ReviewStatus[]> = {
  requested: ['in_review', 'rejected', 'completed'],
  in_review: ['confirmed', 'rejected', 'completed'],
  confirmed: ['completed'],
  rejected:  ['requested', 'completed'],
  completed: [],
};

export function allowedNextStatuses(current: ReviewStatus): readonly ReviewStatus[] {
  return TRANSITIONS[current];
}

export function canTransition(from: ReviewStatus, to: ReviewStatus): boolean {
  return TRANSITIONS[from].includes(to);
}

export function isTerminal(status: ReviewStatus): boolean {
  return TRANSITIONS[status].length === 0;
}

/**
 * Computes the side-effect timestamps that should be written on a
 * status change. Caller still does the DB update; this just keeps
 * the side-effect rules out of the data layer so they can be tested
 * deterministically.
 */
export function statusChangeTimestamps(
  to: ReviewStatus,
  now: () => string = () => new Date().toISOString(),
): { decided_at?: string; completed_at?: string } {
  const ts = now();
  if (to === 'confirmed' || to === 'rejected') return { decided_at: ts };
  if (to === 'completed') return { completed_at: ts };
  return {};
}

// ── Sorting / filtering helpers ──────────────────────────────────

/**
 * Buckets reviews into "open" vs "closed" piles for UI rendering.
 * `completed` is closed; anything else is open.
 */
export function isOpenReview(status: ReviewStatus): boolean {
  return status !== 'completed';
}

/**
 * The user-visible priority order for badges. Lower number = more
 * urgent for the requester to look at.
 */
export const STATUS_PRIORITY: Record<ReviewStatus, number> = {
  rejected:  0,  // requires rework
  in_review: 1,  // waiting on advisor
  requested: 2,  // initial state
  confirmed: 3,  // advisor said OK, requester should close
  completed: 4,
};

export function compareByPriority(a: ReviewStatus, b: ReviewStatus): number {
  return STATUS_PRIORITY[a] - STATUS_PRIORITY[b];
}

/**
 * Returns the badge tone class fragments for a status — kept here
 * (not in the React component) so frontend + e-mail templates can
 * share the same palette.
 */
export function statusToneOf(status: ReviewStatus): 'neutral' | 'attention' | 'success' | 'warning' {
  switch (status) {
    case 'requested':  return 'neutral';
    case 'in_review':  return 'attention';
    case 'confirmed':  return 'success';
    case 'rejected':   return 'warning';
    case 'completed':  return 'success';
  }
}
