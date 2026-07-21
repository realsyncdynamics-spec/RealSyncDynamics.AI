// Social Orchestrator — type definitions.
//
// Pipeline: RuntimeEvent → SocialEvent → SocialPost[] → QueueEntry[]
//
// Boundary contract: nothing internal-tenant-specific crosses the
// SocialEvent boundary. The normalizer strips PII, customer names,
// raw domains, financial figures, and anything in the blocked
// namespaces (see contentPolicy).

// ── Channels ───────────────────────────────────────────────────────

export type SocialChannel =
  | 'linkedin.enterprise'   // long-form B2B governance/audit angle
  | 'linkedin.legal'        // narrower DPO/legal-counsel framing
  | 'instagram.reel'        // hook-led visual storytelling
  | 'tiktok.fast'           // very short, hook-heavy
  | 'x.alert'               // datapoint + hashtag
  | 'wordpress.blog'        // long-form blog posts with embedded media
  | 'ghost.blog'            // ghost CMS hosted blog
  | 'webhook.custom'        // generic HTTP webhook for n8n/Zapier integration
  | 'email.newsletter';     // email distribution to subscriber lists

export const ALL_CHANNELS: readonly SocialChannel[] = [
  'linkedin.enterprise',
  'linkedin.legal',
  'instagram.reel',
  'tiktok.fast',
  'x.alert',
  'wordpress.blog',
  'ghost.blog',
  'webhook.custom',
  'email.newsletter',
] as const;

// ── Approval status ────────────────────────────────────────────────

export type ApprovalStatus = 'AUTO' | 'REVIEW' | 'BLOCKED';

// ── Severity ───────────────────────────────────────────────────────

export type Severity = 'low' | 'medium' | 'high' | 'critical';

// ── Runtime event (input from the platform) ────────────────────────

/**
 * A runtime event as published on the platform's event substrate.
 * Loose superset of the ESS envelope (`spec/runtime/event-specification.md`).
 * The orchestrator does not require ESS conformance — it is defensive
 * about missing/unexpected fields.
 */
export interface RuntimeEvent {
  /** Source event identifier — opaque to the orchestrator. */
  id: string;
  /** Dotted subject, e.g. 'tracker.detected', 'consent.missing'. */
  type: string;
  /** ISO-8601 timestamp of when the event occurred. */
  occurred_at: string;
  /** Tenant scope. Absent for platform-level events. */
  tenant_id?: string;
  /** Region tag, e.g. 'eu-central-1'. Optional. */
  region?: string;
  /** Severity hint. Defaults to 'medium' if omitted. */
  severity?: Severity | 'info';
  /** Free-shape payload. The orchestrator only reads documented fields
   *  (see eventNormalizer); unknown keys are ignored. */
  payload?: Record<string, unknown>;
  /** Optional numeric metrics. Forwarded after PII/over-precision filtering. */
  metrics?: Record<string, number>;
  /** Explicit operator consent that this event MAY surface customer-
   *  specific identifiers (domain, name) on social. Default false. */
  publicApproved?: boolean;
}

// ── Social event (orchestrator's internal anonymized form) ─────────

/**
 * The anonymized, public-safe shape of a runtime event. This is the
 * boundary: anything past this point may legitimately appear in a
 * customer-facing post. Fields with potential PII or customer
 * identity are scrubbed before this object exists.
 */
export interface SocialEvent {
  /** Orchestrator-assigned id (ULID-shaped). */
  id: string;
  /** SHA-256 hash of the source RuntimeEvent.id. Lets us correlate
   *  back to the source without exposing the real id on social. */
  sourceEventId: string;
  /** Same dotted subject as the source. */
  type: string;
  severity: Severity;
  /** True when the event payload passed the public-safety check
   *  (no PII, no blocked namespace, no customer-name leak). False
   *  when contentPolicy decided BLOCKED for any reason. */
  publicSafe: boolean;
  approvalStatus: ApprovalStatus;
  /** ISO-8601 timestamp set by the normalizer. */
  generatedAt: string;
  /** Region tag, only when present on the source AND not classified
   *  as PII (some regions can be small enough to be identifying). */
  region?: string;
  /** Filtered metrics. Numeric only, no over-precision. */
  metrics?: Record<string, number>;
  /** Human-readable, anonymized one-sentence summary. The post
   *  generator is allowed to use this verbatim or reframe it. */
  anonymizedSummary: string;
  /** Hashtags appropriate for ANY channel. Channel-specific hashtags
   *  are added by postTemplates per channel. */
  hashtags: string[];
}

// ── Generated post (per channel) ───────────────────────────────────

export interface SocialPost {
  /** Orchestrator-assigned post id. */
  id: string;
  /** The SocialEvent this post derives from. */
  socialEventId: string;
  channel: SocialChannel;
  approvalStatus: ApprovalStatus;
  /** The actual post text. Already includes any required hashtags
   *  inline, plus the per-channel hashtag block at the end. */
  body: string;
  /** Hashtags applied (channel-specific union the event-level set). */
  hashtags: string[];
  /** Convenience: body.length, useful for X (280) / Threads (500) limits. */
  charCount: number;
  generatedAt: string;
  /** Populated when approvalStatus is REVIEW or BLOCKED. */
  blockReasons?: string[];
}

// ── Approval decision (from contentPolicy) ─────────────────────────

export interface ApprovalDecision {
  status: ApprovalStatus;
  /** Human-readable reasons. UI surfaces these to reviewers. */
  reasons: string[];
}

// ── Distribution queue ─────────────────────────────────────────────

export type QueueStatus =
  | 'pending'    // awaiting review (only used for posts at REVIEW status)
  | 'approved'   // reviewer approved; ready to publish
  | 'rejected'   // reviewer rejected; will not publish
  | 'published'  // successfully published via SocialPublisher
  | 'failed'     // publisher attempt errored
  | 'auto';      // AUTO-status posts skip human review

export interface QueueEntry {
  id: string;
  post: SocialPost;
  status: QueueStatus;
  enqueuedAt: string;
  decidedAt?: string;
  reviewer?: string;
  publishedAt?: string;
  publishResult?: PublishResult;
}

// ── Publisher (channel adapter) ────────────────────────────────────

export interface PublishResult {
  ok: boolean;
  channel: SocialChannel;
  externalId?: string;
  postedAt?: string;
  error?: { code: string; message: string };
}

/**
 * A SocialPublisher is the adapter that actually pushes a post to the
 * external channel API. The orchestrator only knows the abstract
 * interface; concrete adapters for LinkedIn/Meta/TikTok/X land in a
 * follow-up — see distributionQueue.ts §"Real publishers".
 */
export interface SocialPublisher {
  channel: SocialChannel;
  publish(post: SocialPost): Promise<PublishResult>;
}

// ── Orchestrator output ────────────────────────────────────────────

export interface OrchestrationResult {
  socialEvent: SocialEvent;
  posts: SocialPost[];
  queueEntries: QueueEntry[];
}

// ── Metrics (exported from metrics.ts) ────────────────────────────
// Re-export here for convenience (import metrics types from types)
export type {
  PublishMetric,
  QueueMetric,
  VolumeMetric,
  AggregatedMetrics,
  ChannelMetrics,
  OverallMetrics,
} from './metrics';
