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
 * LinkedIn Publisher — OAuth 2.0 + REST API
 * Requires token in Supabase Vault: linkedin_access_token
 * Supports multiple LinkedIn profiles (enterprise vs. legal framing)
 * See: https://learn.microsoft.com/en-us/linkedin/marketing/integrations/community-management/shares/ugc-post-api
 */
export class LinkedInPublisher extends BasePublisher {
  public readonly channel: SocialChannel = 'linkedin.enterprise';
  private accessToken: string;
  private profileMap: Map<SocialChannel, string>;

  /**
   * Create a LinkedIn publisher with OAuth token and profile URNs.
   * @param accessToken LinkedIn OAuth 2.0 access token (loaded from Supabase Vault in production)
   * @param profileMap Map of LinkedIn channel → LinkedIn Person URN (e.g., "urn:li:person:ABC123")
   */
  constructor(accessToken: string, profileMap?: Map<SocialChannel, string>) {
    super();
    this.accessToken = accessToken;
    this.profileMap = profileMap ?? new Map([
      ['linkedin.enterprise', 'urn:li:person:ABC123'],
      ['linkedin.legal', 'urn:li:person:XYZ789'],
    ]);
  }

  async publish(post: SocialPost): Promise<PublishResult> {
    this.logPublishAttempt(post, 'started', { apiEndpoint: '/v2/ugcPosts' });

    if (!this.accessToken) {
      return {
        ok: false,
        channel: this.channel,
        error: { code: 'NO_TOKEN', message: 'LinkedIn access token not configured' },
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
              author: personUrn,
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
 * WordPress Publisher — REST API publishing
 *
 * In production, siteUrl and apiToken are loaded from environment variables
 * (which are sourced from Supabase Vault during Edge Function deployment).
 * See: supabase/functions/social-publisher-worker/index.ts for complete implementation.
 */
export class WordPressPublisher extends BasePublisher {
  public readonly channel: SocialChannel = 'wordpress.blog';
  private siteUrl: string;
  private apiToken: string;

  constructor(siteUrl: string, apiToken: string) {
    super();
    this.siteUrl = siteUrl;
    this.apiToken = apiToken;
  }

  async publish(post: SocialPost): Promise<PublishResult> {
    this.logPublishAttempt(post, 'started', { siteUrl: this.siteUrl });

    if (!this.apiToken) {
      return {
        ok: false,
        channel: this.channel,
        error: { code: 'NO_TOKEN', message: 'WordPress API token not configured' },
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
              title: post.body.split('\n')[0]?.substring(0, 100) || 'Governance Update',
              content: post.body,
              status: 'publish',
              tags: post.hashtags.map(h => h.replace('#', '')).slice(0, 5),
              excerpt: post.body.substring(0, 160),
            }),
          });

          if (!response.ok) {
            const error = await response.text();
            throw new Error(`WORDPRESS_${response.status}: ${error}`);
          }

          return response.json();
        },
        (attempt, error) => {
          console.warn(`WordPress publish attempt ${attempt} failed:`, error.message);
        }
      );

      this.logPublishAttempt(post, 'success', { postId: result.id });
      return {
        ok: true,
        channel: this.channel,
        externalId: String(result.id),
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
}

/**
 * Ghost Publisher — Ghost CMS API (v3+)
 *
 * In production, adminUrl and adminApiKey are loaded from environment variables
 * (which are sourced from Supabase Vault during Edge Function deployment).
 * See: supabase/functions/social-publisher-worker/index.ts for complete implementation.
 */
export class GhostPublisher extends BasePublisher {
  public readonly channel: SocialChannel = 'ghost.blog';
  private adminUrl: string;
  private adminApiKey: string;

  constructor(adminUrl: string, adminApiKey: string) {
    super();
    this.adminUrl = adminUrl;
    this.adminApiKey = adminApiKey;
  }

  async publish(post: SocialPost): Promise<PublishResult> {
    this.logPublishAttempt(post, 'started', { adminUrl: this.adminUrl });

    if (!this.adminApiKey) {
      return {
        ok: false,
        channel: this.channel,
        error: { code: 'NO_TOKEN', message: 'Ghost Admin API key not configured' },
      };
    }

    try {
      const result = await this.retryWithBackoff(
        async () => {
          const response = await fetch(`${this.adminUrl}/ghost/api/v3/admin/posts/?source=html`, {
            method: 'POST',
            headers: {
              'Authorization': `Ghost ${this.adminApiKey}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              posts: [
                {
                  title: post.body.split('\n')[0]?.substring(0, 100) || 'Governance Update',
                  html: post.body.replace(/\n/g, '<br/>'),
                  tags: post.hashtags.map(h => ({ name: h.replace('#', '') })).slice(0, 5),
                  status: 'published',
                },
              ],
            }),
          });

          if (!response.ok) {
            const error = await response.text();
            throw new Error(`GHOST_${response.status}: ${error}`);
          }

          return response.json();
        },
        (attempt, error) => {
          console.warn(`Ghost publish attempt ${attempt} failed:`, error.message);
        }
      );

      const createdPost = (result.posts && result.posts[0]) || result;
      this.logPublishAttempt(post, 'success', { postId: createdPost.id });
      return {
        ok: true,
        channel: this.channel,
        externalId: createdPost.id,
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
 * Email Publisher — Send post as email newsletter
 * Supports SendGrid, AWS SES, and Mailgun via pluggable adapters.
 * In production, credentials are loaded from Supabase Vault via environment variables.
 */
export class EmailPublisher extends BasePublisher {
  public readonly channel: SocialChannel = 'email.newsletter';
  private fromAddress: string;
  private toAddresses: string[];
  private adapter: EmailAdapter;

  constructor(
    fromAddress: string,
    toAddresses: string[] = [],
    emailService: 'sendgrid' | 'ses' | 'mailgun' = 'sendgrid',
    adapterConfig?: Record<string, string>
  ) {
    super();
    this.fromAddress = fromAddress || 'noreply@realsync.ai';
    this.toAddresses = toAddresses;
    this.adapter = this.createAdapter(emailService, adapterConfig || {});
  }

  private createAdapter(service: string, config: Record<string, string>): EmailAdapter {
    switch (service) {
      case 'sendgrid':
        return new SendGridAdapter(config.sendgridApiKey || process.env.SENDGRID_API_KEY || '');
      case 'ses':
        return new AWSSESAdapter(
          config.awsRegion || 'us-east-1',
          config.awsAccessKey || process.env.AWS_ACCESS_KEY_ID || '',
          config.awsSecretKey || process.env.AWS_SECRET_ACCESS_KEY || ''
        );
      case 'mailgun':
        return new MailgunAdapter(
          config.mailgunDomain || process.env.MAILGUN_DOMAIN || '',
          config.mailgunApiKey || process.env.MAILGUN_API_KEY || ''
        );
      default:
        return new SendGridAdapter(config.sendgridApiKey || process.env.SENDGRID_API_KEY || '');
    }
  }

  async publish(post: SocialPost): Promise<PublishResult> {
    if (this.toAddresses.length === 0) {
      return {
        ok: false,
        channel: this.channel,
        error: { code: 'NO_RECIPIENTS', message: 'No email recipients configured' },
      };
    }

    this.logPublishAttempt(post, 'started', { recipientCount: this.toAddresses.length });

    try {
      const result = await this.retryWithBackoff(
        async () => {
          const title = post.body.split('\n')[0] || 'Governance Update';
          const emailBody = `
<html>
<head><meta charset="utf-8"/></head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; line-height: 1.6; color: #333;">
<h2>${this.escapeHtml(title)}</h2>
<div>${post.body.replace(/\n/g, '<br/>')}</div>
${post.hashtags.length > 0 ? `<p style="margin-top: 2em; color: #666; font-size: 0.9em;">${post.hashtags.map(h => this.escapeHtml(h)).join(' ')}</p>` : ''}
<hr style="margin-top: 2em; border: none; border-top: 1px solid #ddd;">
<p style="font-size: 0.85em; color: #999;">This email was sent as part of compliance monitoring. <a href="#">Manage preferences</a></p>
</body>
</html>
`;

          return this.adapter.send({
            fromAddress: this.fromAddress,
            toAddresses: this.toAddresses,
            subject: title,
            htmlBody: emailBody,
          });
        },
        (attempt, error) => {
          console.warn(`Email publish attempt ${attempt} failed:`, error.message);
        }
      );

      if (result.ok) {
        this.logPublishAttempt(post, 'success', { recipients: this.toAddresses.length });
        return {
          ok: true,
          channel: this.channel,
          externalId: result.messageId || `email_${Date.now()}`,
          postedAt: new Date().toISOString(),
        };
      } else {
        throw new Error(result.error || 'Email send failed');
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      this.logPublishAttempt(post, 'failed', { error: errorMsg });

      return {
        ok: false,
        channel: this.channel,
        error: { code: 'EMAIL_SEND_ERROR', message: errorMsg },
      };
    }
  }

  private escapeHtml(text: string): string {
    const map: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' };
    return text.replace(/[&<>"']/g, m => map[m]!);
  }
}

// ── Email Service Adapters ────────────────────────────────────────────────

interface EmailAdapter {
  send(params: {
    fromAddress: string;
    toAddresses: string[];
    subject: string;
    htmlBody: string;
  }): Promise<{ ok: boolean; messageId?: string; error?: string }>;
}

class SendGridAdapter implements EmailAdapter {
  constructor(private apiKey: string) {}

  async send(params: {
    fromAddress: string;
    toAddresses: string[];
    subject: string;
    htmlBody: string;
  }): Promise<{ ok: boolean; messageId?: string; error?: string }> {
    try {
      const response = await fetch('https://api.sendgrid.com/v3/mail/send', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          personalizations: params.toAddresses.map(to => ({ to: [{ email: to }] })),
          from: { email: params.fromAddress, name: 'RealSync Governance' },
          subject: params.subject,
          content: [{ type: 'text/html', value: params.htmlBody }],
          reply_to: { email: params.fromAddress },
          tracking_settings: {
            click_tracking: { enable: true },
            open_tracking: { enable: true },
          },
        }),
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`SENDGRID_${response.status}: ${error}`);
      }

      const data = await response.json() as Record<string, string>;
      return { ok: true, messageId: `email_${Date.now()}` };
    } catch (err) {
      return { ok: false, error: String(err) };
    }
  }
}

class AWSSESAdapter implements EmailAdapter {
  constructor(private region: string, private accessKey: string, private secretKey: string) {}

  async send(params: {
    fromAddress: string;
    toAddresses: string[];
    subject: string;
    htmlBody: string;
  }): Promise<{ ok: boolean; messageId?: string; error?: string }> {
    try {
      const response = await fetch(`https://email.${this.region}.amazonaws.com/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Authorization': this.buildAWSAuthHeader('ses', this.region),
        },
        body: this.buildSESPayload(params),
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`SES_${response.status}: ${error}`);
      }

      const data = await response.text();
      const messageIdMatch = data.match(/<MessageId>([^<]+)<\/MessageId>/);
      return { ok: true, messageId: messageIdMatch?.[1] || `email_${Date.now()}` };
    } catch (err) {
      return { ok: false, error: String(err) };
    }
  }

  private buildAWSAuthHeader(service: string, region: string): string {
    return `AWS4-HMAC-SHA256 Credential=${this.accessKey}/${new Date().toISOString().split('T')[0]}/${region}/${service}/aws4_request`;
  }

  private buildSESPayload(params: {
    fromAddress: string;
    toAddresses: string[];
    subject: string;
    htmlBody: string;
  }): string {
    const parts = [
      `Action=SendEmail`,
      `Source=${encodeURIComponent(params.fromAddress)}`,
      `Destination.ToAddresses.member=${params.toAddresses.map(a => encodeURIComponent(a)).join('&Destination.ToAddresses.member=')}`,
      `Message.Subject.Data=${encodeURIComponent(params.subject)}`,
      `Message.Body.Html.Data=${encodeURIComponent(params.htmlBody)}`,
    ];
    return parts.join('&');
  }
}

class MailgunAdapter implements EmailAdapter {
  constructor(private domain: string, private apiKey: string) {}

  async send(params: {
    fromAddress: string;
    toAddresses: string[];
    subject: string;
    htmlBody: string;
  }): Promise<{ ok: boolean; messageId?: string; error?: string }> {
    try {
      const formData = new FormData();
      formData.append('from', `RealSync Governance <${params.fromAddress}>`);
      params.toAddresses.forEach(to => formData.append('to', to));
      formData.append('subject', params.subject);
      formData.append('html', params.htmlBody);
      formData.append('o:tracking-clicks', 'yes');
      formData.append('o:tracking-opens', 'yes');

      const response = await fetch(`https://api.mailgun.net/v3/${this.domain}/messages`, {
        method: 'POST',
        headers: {
          'Authorization': `Basic ${btoa(`api:${this.apiKey}`)}`,
        },
        body: formData,
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`MAILGUN_${response.status}: ${error}`);
      }

      const data = await response.json() as Record<string, string>;
      return { ok: true, messageId: data.id };
    } catch (err) {
      return { ok: false, error: String(err) };
    }
  }
}

// ── Distribution Queue Features (present & future) ──────────────────────────

/**
 * Dead Letter Queue — for failed publishing attempts.
 * ✅ IMPLEMENTED: See migration 20260720081352_social_distribution_queue_persistence.sql
 *
 * Captures all entries that exhaust max retries:
 *   - Table: distribution_dlq
 *   - References: distribution_queue_entries
 *   - Automatic move via distribution_queue_mark_failed() when attempts exhausted
 *   - Indexed for querying failed entries per tenant/channel
 */

/**
 * Queue Status & Metrics — for observability.
 * ✅ IMPLEMENTED: See migration 20260720130000_distribution_queue_metrics.sql
 *
 * Real-time views:
 *   - vw_distribution_queue_metrics: aggregated per channel/tenant
 *   - vw_distribution_queue_errors: error frequency analysis
 *
 * Time-series persistence (daily snapshots):
 *   - Table: distribution_queue_daily_metrics
 *   - compute_daily_metrics(): scheduled nightly snapshot
 *   - get_queue_metrics_recent(): retrieve last N days for dashboards
 *
 * Tracked metrics:
 *   - Queue depth (pending, approved, published, failed, rejected)
 *   - Publishing latency (avg, p95)
 *   - Retry rate (% of entries requiring > 1 attempt)
 *   - Error trends (distinct error types, frequency)
 *   - Success rates, bounce/complaint counts
 */

/**
 * Audit Logging — for compliance.
 * ✅ IMPLEMENTED: See migrations:
 *   - 20260720081352: distribution_audit_log table (primary audit trail)
 *   - 20260720140000: automatic sync to runtime_events (compliance consolidation)
 *
 * Distribution queue audit trail (distribution_audit_log table):
 *   - enqueued: initial queue entry creation
 *   - approved/rejected: approval workflow decisions
 *   - publish_started: publishing attempt initiated
 *   - publish_success: external_id assigned
 *   - publish_failed: error captured, retry scheduled or DLQ moved
 *   - dlq_moved: entry exhausted retries
 *
 * Runtime Events Integration:
 *   - Trigger: sync_distribution_audit_to_runtime()
 *   - Prefix: 'distribution_queue.{event_type}'
 *   - Payload: queue_entry_id, channel, message, metadata, audit_id, timestamp
 *   - Query unified trail: SELECT * FROM runtime_events WHERE name LIKE 'distribution_queue.%'
 */
