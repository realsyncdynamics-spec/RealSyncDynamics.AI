// Distribution queue for the social orchestrator.
//
// Hybrid: in-memory queue with optional Postgres persistence.
//
// In-memory: Each generated SocialPost becomes a QueueEntry with status:
//   - 'auto'      — AUTO-status posts skip review and are immediately
//                   eligible for publishing. Default reviewer flow
//                   marks them ready-to-publish.
//   - 'pending'   — REVIEW-status posts wait for an explicit operator
//                   approve/reject decision via approve()/reject().
//   - 'rejected'  — operator decided no.
//   - 'approved'  — operator decided yes; ready to publish.
//   - 'published' — publish() was called and succeeded.
//   - 'failed'    — publish() was called and the publisher errored.
//
// Persistence: If a Supabase client is provided, all mutations are
// persisted to public.distribution_queue_entries. LISTEN/NOTIFY
// wakes workers when new entries are ready.
//
// BLOCKED-status posts NEVER enter the queue. The orchestrator
// produces them as a record but they are not enqueueable here. A
// caller that wants to surface them in a UI uses them directly.

import type {
  SocialPost,
  QueueEntry,
  QueueStatus,
  SocialChannel,
  SocialPublisher,
  PublishResult,
  ApprovalStatus,
} from './types';
import type { SupabaseClient } from '@supabase/supabase-js';
import { recordPublishMetric, recordQueueMetric } from './metrics';

let queueIdCounter = 0;
function nextQueueId(): string {
  queueIdCounter += 1;
  return `q_${Date.now().toString(36)}_${queueIdCounter.toString(36)}`;
}

export interface DistributionQueueOptions {
  /** Optional Supabase client for persistence. If omitted, queue is in-memory only. */
  supabase?: SupabaseClient;
  /** Tenant ID for multi-tenant isolation. Required if using persistence. */
  tenantId?: string;
}

/**
 * Hybrid in-memory + optional Postgres-backed distribution queue.
 * - Without Supabase: pure in-memory queue (good for tests)
 * - With Supabase: persists to distribution_queue_entries table, uses LISTEN/NOTIFY
 */
export class DistributionQueue {
  private entries: QueueEntry[] = [];
  private publishers: Map<SocialChannel, SocialPublisher> = new Map();
  private supabase?: SupabaseClient;
  private tenantId?: string;

  constructor(opts?: DistributionQueueOptions) {
    this.supabase = opts?.supabase;
    this.tenantId = opts?.tenantId;
  }

  // ── Publisher registry ──────────────────────────────────────────

  registerPublisher(p: SocialPublisher): void {
    this.publishers.set(p.channel, p);
  }

  unregisterPublisher(channel: SocialChannel): void {
    this.publishers.delete(channel);
  }

  // ── Enqueue ─────────────────────────────────────────────────────

  /**
   * Enqueue a SocialPost. Returns the QueueEntry, or null if the post
   * was BLOCKED (BLOCKED posts MUST NOT enter the queue).
   * If persistence is configured, also writes to database.
   */
  async enqueue(post: SocialPost): Promise<QueueEntry | null> {
    if (post.approvalStatus === 'BLOCKED') return null;
    const status: QueueStatus = post.approvalStatus === 'AUTO' ? 'auto' : 'pending';
    const entry: QueueEntry = {
      id: nextQueueId(),
      post,
      status,
      enqueuedAt: new Date().toISOString(),
    };
    this.entries.push(entry);

    // Persist to database if configured
    if (this.supabase && this.tenantId) {
      await this.persistEntry(entry);
      await this.logAuditEvent('enqueued', entry.id, post.channel, `Post enqueued with status: ${status}`);
    }

    return entry;
  }

  /**
   * Enqueue many posts in one call. BLOCKED posts are silently
   * skipped (the orchestrator already records them elsewhere).
   * Returns the list of created QueueEntries (excluding skipped).
   */
  async enqueueMany(posts: SocialPost[]): Promise<QueueEntry[]> {
    const out: QueueEntry[] = [];
    for (const p of posts) {
      const e = await this.enqueue(p);
      if (e) out.push(e);
    }
    return out;
  }

  // ── Reviewer actions ────────────────────────────────────────────

  async approve(queueId: string, reviewer: string): Promise<QueueEntry> {
    const e = this.requireEntry(queueId);
    if (e.status !== 'pending') {
      throw new Error(`approve: queue entry ${queueId} is in status ${e.status}, expected pending`);
    }
    e.status = 'approved';
    e.decidedAt = new Date().toISOString();
    e.reviewer = reviewer;
    await this.persistStatusChange(queueId, 'approved', reviewer);
    await this.logAuditEvent('approved', queueId, e.post.channel, `Approved by ${reviewer}`);
    return e;
  }

  async reject(queueId: string, reviewer: string): Promise<QueueEntry> {
    const e = this.requireEntry(queueId);
    if (e.status !== 'pending') {
      throw new Error(`reject: queue entry ${queueId} is in status ${e.status}, expected pending`);
    }
    e.status = 'rejected';
    e.decidedAt = new Date().toISOString();
    e.reviewer = reviewer;
    await this.persistStatusChange(queueId, 'rejected', reviewer);
    await this.logAuditEvent('rejected', queueId, e.post.channel, `Rejected by ${reviewer}`);
    return e;
  }

  // ── Publishing ──────────────────────────────────────────────────

  /**
   * Publish a single QueueEntry through its registered publisher.
   * Only entries in status 'auto' or 'approved' are publishable.
   * Returns the updated entry.
   */
  async publish(queueId: string): Promise<QueueEntry> {
    const e = this.requireEntry(queueId);
    const startTime = Date.now();

    if (e.status !== 'auto' && e.status !== 'approved') {
      throw new Error(`publish: entry ${queueId} not publishable (status=${e.status})`);
    }
    const pub = this.publishers.get(e.post.channel);
    if (!pub) {
      e.status = 'failed';
      e.publishResult = {
        ok: false,
        channel: e.post.channel,
        error: { code: 'NO_PUBLISHER', message: `no publisher registered for ${e.post.channel}` },
      };
      recordPublishMetric({
        channel: e.post.channel,
        status: 'failure',
        latencyMs: Date.now() - startTime,
        errorCode: 'NO_PUBLISHER',
        errorMessage: 'no publisher registered',
        timestamp: new Date().toISOString(),
      });
      return e;
    }
    let result: PublishResult;
    try {
      result = await pub.publish(e.post);
    } catch (err) {
      result = {
        ok: false,
        channel: e.post.channel,
        error: { code: 'PUBLISH_THREW', message: (err as Error).message },
      };
    }
    e.publishResult = result;
    const latency = Date.now() - startTime;

    if (result.ok) {
      e.status = 'published';
      e.publishedAt = result.postedAt ?? new Date().toISOString();
      await this.persistPublished(queueId, result);
      await this.logAuditEvent('publish_success', queueId, e.post.channel, `Published with external ID: ${result.externalId}`);
      recordPublishMetric({
        channel: e.post.channel,
        status: 'success',
        latencyMs: latency,
        externalId: result.externalId,
        timestamp: new Date().toISOString(),
      });
    } else {
      e.status = 'failed';
      const errorMsg = result.error?.message || 'Unknown error';
      await this.persistFailed(queueId, errorMsg);
      await this.logAuditEvent('publish_failed', queueId, e.post.channel, `Publish failed: ${errorMsg}`);
      recordPublishMetric({
        channel: e.post.channel,
        status: 'failure',
        latencyMs: latency,
        errorCode: result.error?.code,
        errorMessage: errorMsg,
        timestamp: new Date().toISOString(),
      });
    }
    return e;
  }

  /**
   * Publish every entry currently in 'auto' or 'approved'. Returns
   * the list of attempted entries (including failures).
   */
  async publishAllReady(): Promise<QueueEntry[]> {
    const ready = this.entries.filter(e => e.status === 'auto' || e.status === 'approved');
    return Promise.all(ready.map(e => this.publish(e.id)));
  }

  // ── Read accessors ──────────────────────────────────────────────

  list(filter?: { status?: QueueStatus; channel?: SocialChannel; approvalStatus?: ApprovalStatus }): QueueEntry[] {
    return this.entries.filter(e => {
      if (filter?.status && e.status !== filter.status) return false;
      if (filter?.channel && e.post.channel !== filter.channel) return false;
      if (filter?.approvalStatus && e.post.approvalStatus !== filter.approvalStatus) return false;
      return true;
    });
  }

  get(queueId: string): QueueEntry | null {
    return this.entries.find(e => e.id === queueId) ?? null;
  }

  size(): number {
    return this.entries.length;
  }

  // ── Dead Letter Queue (DLQ) ────────────────────────────────────────

  /**
   * Get all failed entries that have exhausted retries.
   * Only available if persistence is configured.
   */
  async listDLQ(): Promise<any[]> {
    if (!this.supabase || !this.tenantId) return [];

    try {
      const { data, error } = await this.supabase
        .from('distribution_dlq')
        .select('*')
        .eq('tenant_id', this.tenantId)
        .order('failed_at', { ascending: false });

      if (error) throw error;
      return data || [];
    } catch (err) {
      console.error('Failed to query DLQ:', err);
      return [];
    }
  }

  /**
   * Move a failed entry to DLQ after exhausting all retries.
   * Called internally by persistFailed() when max_attempts is exceeded.
   */
  private async moveToDLQ(queueId: string, error: string): Promise<void> {
    if (!this.supabase || !this.tenantId) return;

    try {
      const { data: entry } = await this.supabase
        .from('distribution_queue_entries')
        .select('*')
        .eq('id', queueId)
        .eq('tenant_id', this.tenantId)
        .single();

      if (!entry) return;

      // Insert into DLQ
      await this.supabase.from('distribution_dlq').insert({
        queue_entry_id: queueId,
        tenant_id: this.tenantId,
        channel: entry.channel,
        final_error: error,
        attempts_made: entry.attempts,
      });

      // Log to audit trail
      await this.logAuditEvent('dlq_moved', queueId, entry.channel, `Moved to DLQ after ${entry.attempts} attempts`);
    } catch (err) {
      console.error('Failed to move entry to DLQ:', err);
    }
  }

  /**
   * Archive a DLQ entry (mark as reviewed/handled).
   */
  async archiveDLQEntry(dlqId: string): Promise<void> {
    if (!this.supabase || !this.tenantId) return;

    try {
      await this.supabase
        .from('distribution_dlq')
        .update({ moved_to_dlq_at: new Date().toISOString() })
        .eq('id', dlqId)
        .eq('tenant_id', this.tenantId);
    } catch (err) {
      console.error('Failed to archive DLQ entry:', err);
    }
  }

  /**
   * Re-queue a DLQ entry (attempt to publish again).
   * Resets retry counter and puts it back into pending status.
   */
  async requeueDLQEntry(dlqId: string): Promise<void> {
    if (!this.supabase || !this.tenantId) return;

    try {
      const { data: dlqEntry } = await this.supabase
        .from('distribution_dlq')
        .select('queue_entry_id')
        .eq('id', dlqId)
        .eq('tenant_id', this.tenantId)
        .single();

      if (!dlqEntry) return;

      // Reset the queue entry
      await this.supabase
        .from('distribution_queue_entries')
        .update({
          status: 'pending',
          attempts: 0,
          last_error: null,
          next_retry_at: null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', dlqEntry.queue_entry_id)
        .eq('tenant_id', this.tenantId);

      // Remove from DLQ
      await this.supabase
        .from('distribution_dlq')
        .delete()
        .eq('id', dlqId)
        .eq('tenant_id', this.tenantId);

      await this.logAuditEvent('requeued_from_dlq', dlqEntry.queue_entry_id, 'unknown', 'Entry re-queued from DLQ');
    } catch (err) {
      console.error('Failed to re-queue DLQ entry:', err);
    }
  }

  // ── Audit logging ──────────────────────────────────────────────────

  private async logAuditEvent(
    eventType: string,
    queueId: string,
    channel: string,
    message: string,
    metadata?: Record<string, unknown>
  ): Promise<void> {
    if (!this.supabase || !this.tenantId) return;

    try {
      await this.supabase.from('distribution_audit_log').insert({
        queue_entry_id: queueId,
        tenant_id: this.tenantId,
        event_type: eventType,
        channel,
        message,
        metadata: metadata || {},
      });
    } catch (err) {
      console.error('Failed to log audit event:', err);
    }
  }

  // ── Persistence helpers (optional Postgres backend) ──────────────

  private async persistEntry(entry: QueueEntry): Promise<void> {
    if (!this.supabase || !this.tenantId) return;

    try {
      await this.supabase.from('distribution_queue_entries').insert({
        id: entry.id,
        tenant_id: this.tenantId,
        post_id: entry.post.id,
        channel: entry.post.channel,
        body: entry.post.body,
        hashtags: entry.post.hashtags,
        status: entry.status,
        approval_status: entry.post.approvalStatus,
        post_data: entry.post,
        enqueued_at: entry.enqueuedAt,
      });
    } catch (err) {
      console.error('Failed to persist queue entry:', err);
    }
  }

  async persistStatusChange(queueId: string, newStatus: QueueStatus, reviewer?: string): Promise<void> {
    if (!this.supabase || !this.tenantId) return;

    try {
      const updates: Record<string, unknown> = {
        status: newStatus,
        updated_at: new Date().toISOString(),
      };

      if (reviewer) {
        updates.reviewer = reviewer;
        updates.decided_at = new Date().toISOString();
      }

      await this.supabase
        .from('distribution_queue_entries')
        .update(updates)
        .eq('id', queueId)
        .eq('tenant_id', this.tenantId);
    } catch (err) {
      console.error('Failed to update queue entry status:', err);
    }
  }

  async persistPublished(queueId: string, result: PublishResult): Promise<void> {
    if (!this.supabase || !this.tenantId) return;

    try {
      await this.supabase
        .from('distribution_queue_entries')
        .update({
          status: 'published',
          external_id: result.externalId,
          published_at: result.postedAt ?? new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', queueId)
        .eq('tenant_id', this.tenantId);
    } catch (err) {
      console.error('Failed to persist published entry:', err);
    }
  }

  async persistFailed(queueId: string, error: string): Promise<void> {
    if (!this.supabase || !this.tenantId) return;

    try {
      // Get current entry to check retry state
      const { data: entry } = await this.supabase
        .from('distribution_queue_entries')
        .select('*')
        .eq('id', queueId)
        .eq('tenant_id', this.tenantId)
        .single();

      if (!entry) return;

      const nextAttempts = entry.attempts + 1;
      const shouldMoveToDLQ = nextAttempts >= entry.max_attempts;

      if (shouldMoveToDLQ) {
        // Exhausted retries — move to DLQ
        await this.supabase
          .from('distribution_queue_entries')
          .update({
            status: 'failed',
            last_error: error,
            attempts: nextAttempts,
            updated_at: new Date().toISOString(),
          })
          .eq('id', queueId)
          .eq('tenant_id', this.tenantId);

        await this.moveToDLQ(queueId, error);
      } else {
        // Schedule retry with exponential backoff: 2^attempts seconds
        const backoffSeconds = Math.pow(2, entry.attempts);
        const nextRetryAt = new Date(Date.now() + backoffSeconds * 1000).toISOString();

        await this.supabase
          .from('distribution_queue_entries')
          .update({
            status: 'failed',
            last_error: error,
            attempts: nextAttempts,
            next_retry_at: nextRetryAt,
            updated_at: new Date().toISOString(),
          })
          .eq('id', queueId)
          .eq('tenant_id', this.tenantId);

        await this.logAuditEvent('retry_scheduled', queueId, entry.channel, `Retry scheduled in ${backoffSeconds}s`);
      }
    } catch (err) {
      console.error('Failed to persist failed entry:', err);
    }
  }

  // ── Load from persistence ─────────────────────────────────────────

  async loadFromDatabase(): Promise<void> {
    if (!this.supabase || !this.tenantId) return;

    try {
      const { data, error } = await this.supabase
        .from('distribution_queue_entries')
        .select('*')
        .eq('tenant_id', this.tenantId)
        .in('status', ['pending', 'auto', 'approved', 'failed']);

      if (error) throw error;

      if (data) {
        this.entries = data.map((row: any): QueueEntry => {
          const post = row.post_data as SocialPost || {
            id: row.post_id,
            channel: row.channel as SocialChannel,
            body: row.body,
            hashtags: row.hashtags || [],
            approvalStatus: (row.approval_status as ApprovalStatus) || 'AUTO',
            socialEventId: '',
            charCount: (row.body || '').length,
            generatedAt: row.created_at,
          };
          const entry: QueueEntry = {
            id: row.id,
            post,
            status: row.status as QueueStatus,
            enqueuedAt: row.enqueued_at,
          };
          if (row.decided_at) entry.decidedAt = row.decided_at;
          if (row.reviewer) entry.reviewer = row.reviewer;
          if (row.published_at) entry.publishedAt = row.published_at;
          if (row.external_id) {
            entry.publishResult = {
              ok: true,
              channel: row.channel as SocialChannel,
              externalId: row.external_id,
              postedAt: row.published_at,
            };
          }
          return entry;
        });
      }
    } catch (err) {
      console.error('Failed to load queue from database:', err);
    }
  }

  // ── Listen for notifications ────────────────────────────────────

  subscribeToNotifications(onReady?: (data: any) => void): (() => void) | null {
    if (!this.supabase) return null;

    const channel = this.supabase.channel('distribution_queue_ready').on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'distribution_queue_entries',
      },
      (payload) => {
        if (onReady) onReady(payload);
      }
    );

    void channel.subscribe();

    return () => {
      void channel.unsubscribe();
    };
  }

  /** Test-only: drop everything. NOT exposed to a UI. */
  __resetForTests(): void {
    this.entries = [];
    this.publishers.clear();
    queueIdCounter = 0;
  }

  // ── Private ─────────────────────────────────────────────────────

  private requireEntry(id: string): QueueEntry {
    const e = this.get(id);
    if (!e) throw new Error(`queue entry ${id} not found`);
    return e;
  }
}

// ── Mock publisher (for tests) ─────────────────────────────────────

/**
 * MockPublisher logs the post to memory and returns a deterministic
 * external id. Used by the test suite. NOT for production use.
 */
export class MockPublisher implements SocialPublisher {
  public readonly channel: SocialChannel;
  public readonly published: SocialPost[] = [];
  private succeed: boolean;

  constructor(channel: SocialChannel, opts: { succeed?: boolean } = {}) {
    this.channel = channel;
    this.succeed = opts.succeed ?? true;
  }

  async publish(post: SocialPost): Promise<PublishResult> {
    if (!this.succeed) {
      return {
        ok: false,
        channel: this.channel,
        error: { code: 'MOCK_FAIL', message: 'mock publisher configured to fail' },
      };
    }
    this.published.push(post);
    return {
      ok: true,
      channel: this.channel,
      externalId: `mock_${this.published.length}`,
      postedAt: new Date().toISOString(),
    };
  }
}

// ── Publisher infrastructure (with retry, audit, DLQ) ─────────────────────

/**
 * Base Publisher with retry logic, audit logging, and error handling.
 * Subclasses implement channel-specific APIs.
 */
abstract class BasePublisher implements SocialPublisher {
  abstract channel: SocialChannel;
  protected maxRetries: number = 3;
  protected retryDelayMs: number = 1000;

  abstract publish(post: SocialPost): Promise<PublishResult>;

  protected async retryWithBackoff<T>(
    fn: () => Promise<T>,
    onRetry?: (attempt: number, error: Error) => void
  ): Promise<T> {
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
      try {
        return await fn();
      } catch (err) {
        lastError = err instanceof Error ? err : new Error(String(err));
        if (onRetry) onRetry(attempt, lastError);

        if (attempt < this.maxRetries) {
          const delay = this.retryDelayMs * Math.pow(2, attempt - 1);
          await new Promise((resolve) => setTimeout(resolve, delay));
        }
      }
    }

    throw lastError || new Error('Retry exhausted');
  }

  protected logPublishAttempt(
    post: SocialPost,
    status: 'started' | 'success' | 'failed',
    metadata: Record<string, unknown> = {}
  ) {
    console.log(JSON.stringify({
      timestamp: new Date().toISOString(),
      channel: this.channel,
      postId: post.id,
      status,
      bodyLength: post.body.length,
      ...metadata,
    }));
  }
}

// ── Real publishers (placeholder implementations) ──────────────────────────

/**
 * LinkedIn Publisher (placeholder) — OAuth 2.0 + REST API
 * See: https://learn.microsoft.com/en-us/linkedin/marketing/integrations/community-management/shares/ugc-post-api
 *
 * ⚠️ This is a placeholder/reference implementation for testing/documentation.
 * The real production implementation is in ./linkedinPublisher.ts which:
 * - Accepts accessToken + authorId as constructor parameters
 * - Caller (Edge Function) loads token from Supabase Vault
 * - Supports per-profile author IDs (linkedin.enterprise, linkedin.legal, etc)
 */
export class LinkedInPublisher extends BasePublisher {
  public readonly channel: SocialChannel = 'linkedin.enterprise';
  private accessToken: string = '';
  private profileId: string = '';

  async publish(post: SocialPost): Promise<PublishResult> {
    this.logPublishAttempt(post, 'started', { apiEndpoint: '/v2/ugcPosts' });

    if (!this.accessToken || !this.profileId) {
      return {
        ok: false,
        channel: this.channel,
        error: { code: 'NO_TOKEN', message: 'LinkedIn access token or profile ID not configured' },
      };
    }

    const personUrn = this.profileMap.get(post.channel);
    if (!personUrn) {
      return {
        ok: false,
        channel: this.channel,
        error: { code: 'NO_PROFILE', message: `No LinkedIn profile configured for channel ${post.channel}` },
      };
    }

    try {
      const result = await this.retryWithBackoff(
        async () => {
          const response = await fetch('https://api.linkedin.com/v2/ugcPosts', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${this.accessToken}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              author: `urn:li:person:${this.profileId}`,
              lifecycleState: 'PUBLISHED',
              specificContent: {
                'com.linkedin.ugc.PublishContent': {
                  shareCommentary: { text: post.body },
                  shareMediaCategory: 'ARTICLE',
                },
              },
            }),
          });

          if (response.status === 429) {
            throw new Error('LINKEDIN_429_RATE_LIMIT');
          }
          if (!response.ok) {
            const error = await response.text();
            throw new Error(`LINKEDIN_${response.status}: ${error}`);
          }

          const data = await response.json();
          return data;
        },
        (attempt, error) => {
          console.warn(`LinkedIn publish attempt ${attempt} failed:`, error.message);
        }
      );

      this.logPublishAttempt(post, 'success', { externalId: result.id });
      return {
        ok: true,
        channel: this.channel,
        externalId: result.id,
        postedAt: new Date().toISOString(),
      };
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      this.logPublishAttempt(post, 'failed', { error: errorMsg });

      return {
        ok: false,
        channel: this.channel,
        error: { code: 'LINKEDIN_API_ERROR', message: errorMsg },
      };
    }
  }
}

/**
 * WordPress Publisher — REST API (WP 4.7+)
 *
 * Caller (Edge Function) is responsible for loading siteUrl and apiToken
 * from configuration and Supabase Vault, then passing them to constructor.
 *
 * Supports both:
 * - Application passwords (recommended for headless/automated publishing)
 * - OAuth tokens (for user-authenticated posting)
 *
 * See: https://developer.wordpress.org/plugins/authentication/
 */
export class WordPressPublisher extends BasePublisher {
  public readonly channel: SocialChannel = 'wordpress.blog';
  private siteUrl: string;
  private apiToken: string;

  constructor(siteUrl: string, apiToken: string) {
    super();
    this.siteUrl = siteUrl.replace(/\/$/, ''); // strip trailing slash
    this.apiToken = apiToken;
  }

  async publish(post: SocialPost): Promise<PublishResult> {
    this.logPublishAttempt(post, 'started', { siteUrl: this.siteUrl });

    if (!this.siteUrl || !this.apiToken) {
      return {
        ok: false,
        channel: this.channel,
        error: { code: 'NO_CONFIG', message: 'WordPress site URL or API token not configured' },
      };
    }

    try {
      const result = await this.retryWithBackoff(
        async () => {
          const response = await fetch(`${this.siteUrl}/wp-json/wp/v2/posts`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${this.apiToken}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              title: this.extractTitle(post.body),
              content: post.body,
              status: 'publish',
              // Store hashtags as tags
              tags: post.hashtags.length > 0 ? post.hashtags.map(h => h.replace('#', '')) : [],
            }),
          });

          if (response.status === 401) {
            throw new Error('WORDPRESS_401_UNAUTHORIZED');
          }
          if (response.status === 403) {
            throw new Error('WORDPRESS_403_FORBIDDEN');
          }
          if (!response.ok) {
            const error = await response.json().catch(() => ({}));
            throw new Error(`WORDPRESS_${response.status}: ${(error as Record<string, unknown>).message ?? 'Unknown error'}`);
          }

          return response.json();
        },
        (attempt, error) => {
          console.warn(`WordPress publish attempt ${attempt} failed:`, error.message);
        }
      );

      this.logPublishAttempt(post, 'success', { externalId: (result as Record<string, unknown>).id });
      return {
        ok: true,
        channel: this.channel,
        externalId: String((result as Record<string, unknown>).id),
        postedAt: new Date().toISOString(),
      };
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      this.logPublishAttempt(post, 'failed', { error: errorMsg });

      return {
        ok: false,
        channel: this.channel,
        error: { code: 'WORDPRESS_API_ERROR', message: errorMsg },
      };
    }
  }

  private extractTitle(body: string): string {
    // Use first line as title, or first 60 chars if no line break
    const lines = body.split('\n');
    const firstLine = lines[0]?.trim() ?? '';
    if (firstLine.length > 0 && firstLine.length <= 100) {
      return firstLine;
    }
    return body.substring(0, 60).trim() + (body.length > 60 ? '…' : '');
  }
}

/**
 * Ghost Publisher — Ghost API (v3+)
 *
 * Caller (Edge Function) is responsible for loading adminUrl and adminApiKey
 * from configuration and Supabase Vault, then passing them to constructor.
 *
 * Uses Ghost Admin API for direct post publishing. Requires:
 * - Ghost v3.0+
 * - Admin API key (not Content API key)
 * - Full Ghost URL (e.g., https://blog.example.com)
 *
 * See: https://ghost.org/docs/admin-api/
 */
export class GhostPublisher extends BasePublisher {
  public readonly channel: SocialChannel = 'ghost.blog';
  private adminUrl: string;
  private adminApiKey: string;

  constructor(adminUrl: string, adminApiKey: string) {
    super();
    this.adminUrl = adminUrl.replace(/\/$/, ''); // strip trailing slash
    this.adminApiKey = adminApiKey;
  }

  async publish(post: SocialPost): Promise<PublishResult> {
    this.logPublishAttempt(post, 'started', { adminUrl: this.adminUrl });

    if (!this.adminUrl || !this.adminApiKey) {
      return {
        ok: false,
        channel: this.channel,
        error: { code: 'NO_CONFIG', message: 'Ghost admin URL or API key not configured' },
      };
    }

    try {
      const result = await this.retryWithBackoff(
        async () => {
          const response = await fetch(`${this.adminUrl}/ghost/api/admin/posts/?source=html`, {
            method: 'POST',
            headers: {
              'Authorization': `Ghost ${this.adminApiKey}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              posts: [
                {
                  title: this.extractTitle(post.body),
                  html: this.markdownToHtml(post.body),
                  status: 'published',
                  tags: post.hashtags.length > 0 ? post.hashtags.map(h => ({ name: h.replace('#', '') })) : [],
                },
              ],
            }),
          });

          if (response.status === 401) {
            throw new Error('GHOST_401_UNAUTHORIZED');
          }
          if (response.status === 403) {
            throw new Error('GHOST_403_FORBIDDEN');
          }
          if (!response.ok) {
            const error = await response.json().catch(() => ({}));
            throw new Error(`GHOST_${response.status}: ${(error as Record<string, unknown>).message ?? 'Unknown error'}`);
          }

          return response.json();
        },
        (attempt, error) => {
          console.warn(`Ghost publish attempt ${attempt} failed:`, error.message);
        }
      );

      const posts = (result as Record<string, unknown>).posts as Array<Record<string, unknown>>;
      const postId = posts?.[0]?.id;
      this.logPublishAttempt(post, 'success', { externalId: postId });

      return {
        ok: true,
        channel: this.channel,
        externalId: String(postId),
        postedAt: new Date().toISOString(),
      };
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      this.logPublishAttempt(post, 'failed', { error: errorMsg });

      return {
        ok: false,
        channel: this.channel,
        error: { code: 'GHOST_API_ERROR', message: errorMsg },
      };
    }
  }

  private extractTitle(body: string): string {
    const lines = body.split('\n');
    const firstLine = lines[0]?.trim() ?? '';
    if (firstLine.length > 0 && firstLine.length <= 200) {
      return firstLine;
    }
    return body.substring(0, 200).trim() + (body.length > 200 ? '…' : '');
  }

  private markdownToHtml(md: string): string {
    // Very basic markdown to HTML conversion (handles common patterns)
    let html = md
      .replace(/^### (.*?)$/gm, '<h3>$1</h3>')
      .replace(/^## (.*?)$/gm, '<h2>$1</h2>')
      .replace(/^# (.*?)$/gm, '<h1>$1</h1>')
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.*?)\*/g, '<em>$1</em>')
      .replace(/\n\n/g, '</p><p>')
      .replace(/\n/g, '<br>');
    return `<p>${html}</p>`;
  }
}

/**
 * Webhook Publisher — Generic HTTP POST to custom endpoint
 * Useful for integration with n8n, Zapier, or internal systems
 */
export class WebhookPublisher extends BasePublisher {
  public readonly channel: SocialChannel = 'webhook.custom';
  private webhookUrl: string;

  constructor(webhookUrl: string) {
    super();
    this.webhookUrl = webhookUrl;
  }

  async publish(post: SocialPost): Promise<PublishResult> {
    this.logPublishAttempt(post, 'started', { webhookUrl: this.webhookUrl });

    try {
      const result = await this.retryWithBackoff(
        async () => {
          const response = await fetch(this.webhookUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              channel: post.channel,
              body: post.body,
              hashtags: post.hashtags,
              timestamp: new Date().toISOString(),
            }),
          });

          if (!response.ok) {
            throw new Error(`HTTP_${response.status}`);
          }

          return response.json();
        },
        (attempt, error) => {
          console.warn(`Webhook publish attempt ${attempt} failed:`, error.message);
        }
      );

      this.logPublishAttempt(post, 'success', { webhookStatus: 'sent' });
      return {
        ok: true,
        channel: this.channel,
        externalId: `webhook_${Date.now()}`,
        postedAt: new Date().toISOString(),
      };
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      this.logPublishAttempt(post, 'failed', { error: errorMsg });

      return {
        ok: false,
        channel: this.channel,
        error: { code: 'WEBHOOK_ERROR', message: errorMsg },
      };
    }
  }
}

/**
 * Email Publisher — SendGrid SMTP API integration
 *
 * Caller (Edge Function) is responsible for loading API key from Supabase Vault
 * and recipient list from configuration, then passing to constructor.
 *
 * Supports:
 * - Bulk sending to multiple recipients
 * - HTML and plain-text formatting
 * - Tracking metadata (for bounce/delivery monitoring)
 * - Retry with exponential backoff
 *
 * See: https://sendgrid.com/docs/api-reference/
 */
export class EmailPublisher extends BasePublisher {
  public readonly channel: SocialChannel = 'email.newsletter';
  private fromAddress: string;
  private toAddresses: string[];
  private sendgridApiKey: string;

  constructor(fromAddress: string, toAddresses: string[], sendgridApiKey: string) {
    super();
    this.fromAddress = fromAddress;
    this.toAddresses = toAddresses;
    this.sendgridApiKey = sendgridApiKey;
  }

  async publish(post: SocialPost): Promise<PublishResult> {
    if (this.toAddresses.length === 0) {
      return {
        ok: false,
        channel: this.channel,
        error: { code: 'NO_RECIPIENTS', message: 'No email recipients configured' },
      };
    }

    if (!this.sendgridApiKey) {
      return {
        ok: false,
        channel: this.channel,
        error: { code: 'NO_API_KEY', message: 'SendGrid API key not configured' },
      };
    }

    this.logPublishAttempt(post, 'started', { recipientCount: this.toAddresses.length });

    try {
      const result = await this.retryWithBackoff(
        async () => {
          const response = await fetch('https://api.sendgrid.com/v3/mail/send', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${this.sendgridApiKey}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              personalizations: this.toAddresses.map(email => ({
                to: [{ email }],
              })),
              from: { email: this.fromAddress, name: 'RealSync Governance' },
              subject: this.extractTitle(post.body),
              content: [
                {
                  type: 'text/html',
                  value: this.formatAsHtml(post.body),
                },
                {
                  type: 'text/plain',
                  value: post.body,
                },
              ],
              tracking_settings: {
                click_tracking: { enabled: true },
                open_tracking: { enabled: true },
              },
              custom_args: {
                source: 'RealSyncGovernance',
                postId: post.id,
                eventType: post.socialEventId,
              },
            }),
          });

          if (response.status === 401) {
            throw new Error('SENDGRID_401_UNAUTHORIZED');
          }
          if (response.status === 429) {
            throw new Error('SENDGRID_429_RATE_LIMIT');
          }
          if (!response.ok) {
            const error = await response.json().catch(() => ({}));
            throw new Error(`SENDGRID_${response.status}: ${(error as Record<string, unknown>).message ?? 'Unknown error'}`);
          }

          return { ok: true };
        },
        (attempt, error) => {
          console.warn(`SendGrid publish attempt ${attempt} failed:`, error.message);
        }
      );

      this.logPublishAttempt(post, 'success', { recipients: this.toAddresses.length });
      return {
        ok: true,
        channel: this.channel,
        externalId: `sendgrid_${Date.now()}`,
        postedAt: new Date().toISOString(),
      };
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      this.logPublishAttempt(post, 'failed', { error: errorMsg });

      return {
        ok: false,
        channel: this.channel,
        error: { code: 'SENDGRID_API_ERROR', message: errorMsg },
      };
    }
  }

  private extractTitle(body: string): string {
    const lines = body.split('\n');
    const firstLine = lines[0]?.trim() ?? '';
    if (firstLine.length > 0 && firstLine.length <= 100) {
      return firstLine;
    }
    return body.substring(0, 100).trim() + (body.length > 100 ? '…' : '');
  }

  private formatAsHtml(text: string): string {
    const escaped = text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');

    let html = escaped
      .replace(/^### (.*?)$/gm, '<h3>$1</h3>')
      .replace(/^## (.*?)$/gm, '<h2>$1</h2>')
      .replace(/^# (.*?)$/gm, '<h1>$1</h1>')
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.*?)\*/g, '<em>$1</em>')
      .replace(/\n\n/g, '</p><p>')
      .replace(/\n/g, '<br>');

    return `<html><body style="font-family: sans-serif; line-height: 1.6;"><p>${html}</p></body></html>`;
  }
}

// ── Distribution Queue Features (present & future) ──────────────────────────

/**
 * Dead Letter Queue — for failed publishing attempts.
 * In-memory implementation. Persistence to Postgres is a follow-up PR.
 *
 * Schema (future migration):
 *   CREATE TABLE distribution_dlq (
 *     id uuid primary key,
 *     queue_entry_id uuid references queue_entries(id),
 *     error_code text,
 *     error_message text,
 *     retry_count int,
 *     next_retry_at timestamptz,
 *     created_at timestamptz,
 *     updated_at timestamptz
 *   );
 */
export interface DeadLetterQueueEntry {
  id: string;
  queueEntryId: string;
  channel: SocialChannel;
  errorCode: string;
  errorMessage: string;
  retryCount: number;
  nextRetryAt: string;
  createdAt: string;
  updatedAt: string;
}

export class DeadLetterQueue {
  private entries: DeadLetterQueueEntry[] = [];

  enqueue(queueEntryId: string, channel: SocialChannel, errorCode: string, errorMessage: string, retryCount: number): DeadLetterQueueEntry {
    const entry: DeadLetterQueueEntry = {
      id: `dlq_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      queueEntryId,
      channel,
      errorCode,
      errorMessage,
      retryCount,
      nextRetryAt: new Date(Date.now() + Math.pow(2, retryCount) * 1000).toISOString(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    this.entries.push(entry);
    return entry;
  }

  list(): DeadLetterQueueEntry[] {
    return [...this.entries];
  }

  retry(dlqId: string): DeadLetterQueueEntry | null {
    const entry = this.entries.find(e => e.id === dlqId);
    if (entry) {
      entry.retryCount += 1;
      entry.nextRetryAt = new Date(Date.now() + Math.pow(2, entry.retryCount) * 1000).toISOString();
      entry.updatedAt = new Date().toISOString();
    }
    return entry ?? null;
  }

  remove(dlqId: string): void {
    this.entries = this.entries.filter(e => e.id !== dlqId);
  }
}

/**
 * Queue Status & Metrics — for observability.
 * In-memory implementation. Time-series persistence is a follow-up PR.
 *
 * Metrics tracked:
 *   - Queue depth (pending, approved, published, failed)
 *   - Publishing latency (start → published)
 *   - Retry rate (per channel, per error code)
 *   - Error trends (detect repeated failures)
 */
export interface QueueMetrics {
  queueDepth: Record<QueueStatus, number>;
  publishingLatency: { min: number; max: number; avg: number };
  retryRateByChannel: Record<SocialChannel, number>;
  errorCodeFrequency: Record<string, number>;
  timestamp: string;
}

export class QueueMetricsCollector {
  private publishTimes: Map<string, number> = new Map();
  private retryAttempts: Map<string, number> = new Map();
  private errors: Map<string, number> = new Map();

  recordPublishStart(queueId: string): void {
    this.publishTimes.set(queueId, Date.now());
  }

  recordPublishEnd(queueId: string, success: boolean, errorCode?: string): void {
    if (success) {
      this.publishTimes.delete(queueId);
    } else if (errorCode) {
      this.errors.set(errorCode, (this.errors.get(errorCode) ?? 0) + 1);
      this.retryAttempts.set(queueId, (this.retryAttempts.get(queueId) ?? 0) + 1);
    }
  }

  getMetrics(queue: DistributionQueue): QueueMetrics {
    const entries = queue.list();
    const queueDepth: Record<QueueStatus, number> = {
      pending: 0,
      approved: 0,
      rejected: 0,
      published: 0,
      failed: 0,
      auto: 0,
    };

    for (const entry of entries) {
      queueDepth[entry.status] = (queueDepth[entry.status] ?? 0) + 1;
    }

    const latencies = Array.from(this.publishTimes.values()).map(start => Date.now() - start);
    const avgLatency = latencies.length > 0 ? latencies.reduce((a, b) => a + b, 0) / latencies.length : 0;

    const retryRateByChannel: Record<SocialChannel, number> = {} as Record<SocialChannel, number>;
    for (const entry of entries) {
      retryRateByChannel[entry.post.channel] = (retryRateByChannel[entry.post.channel] ?? 0) + (this.retryAttempts.get(entry.id) ?? 0);
    }

    return {
      queueDepth,
      publishingLatency: {
        min: latencies.length > 0 ? Math.min(...latencies) : 0,
        max: latencies.length > 0 ? Math.max(...latencies) : 0,
        avg: avgLatency,
      },
      retryRateByChannel,
      errorCodeFrequency: Object.fromEntries(this.errors),
      timestamp: new Date().toISOString(),
    };
  }
}

/**
 * Audit Logging — for compliance and governance trail.
 * In-memory implementation. Wired to runtime_events table is a follow-up PR.
 *
 * Events logged:
 *   - publish_attempted(queueId, channel, status)
 *   - publish_succeeded(queueId, channel, externalId)
 *   - publish_failed(queueId, channel, errorCode, errorMessage)
 *   - dlq_entry_created(queueId, reason)
 */
export interface AuditLogEntry {
  id: string;
  eventType: string;
  queueId: string;
  channel: SocialChannel;
  status: string;
  metadata: Record<string, unknown>;
  timestamp: string;
}

export class AuditLogger {
  private entries: AuditLogEntry[] = [];

  logPublishAttempted(queueId: string, channel: SocialChannel): AuditLogEntry {
    return this.log('publish_attempted', queueId, channel, 'pending', { action: 'publish_attempt' });
  }

  logPublishSucceeded(queueId: string, channel: SocialChannel, externalId: string): AuditLogEntry {
    return this.log('publish_succeeded', queueId, channel, 'published', { externalId });
  }

  logPublishFailed(queueId: string, channel: SocialChannel, errorCode: string, errorMessage: string): AuditLogEntry {
    return this.log('publish_failed', queueId, channel, 'failed', { errorCode, errorMessage });
  }

  logDlqEntryCreated(queueId: string, channel: SocialChannel, reason: string): AuditLogEntry {
    return this.log('dlq_entry_created', queueId, channel, 'dlq', { reason });
  }

  private log(eventType: string, queueId: string, channel: SocialChannel, status: string, metadata: Record<string, unknown>): AuditLogEntry {
    const entry: AuditLogEntry = {
      id: `audit_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      eventType,
      queueId,
      channel,
      status,
      metadata,
      timestamp: new Date().toISOString(),
    };
    this.entries.push(entry);
    return entry;
  }

  getEntries(filter?: { queueId?: string; eventType?: string }): AuditLogEntry[] {
    return this.entries.filter(e => {
      if (filter?.queueId && e.queueId !== filter.queueId) return false;
      if (filter?.eventType && e.eventType !== filter.eventType) return false;
      return true;
    });
  }
}
