// Distribution queue for the social orchestrator.
//
// In-memory queue. Each generated SocialPost becomes a QueueEntry
// with status:
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
// BLOCKED-status posts NEVER enter the queue. The orchestrator
// produces them as a record but they are not enqueueable here. A
// caller that wants to surface them in a UI uses them directly.
//
// Real publisher adapters for all social channels are imported
// from their respective files and available for registration.

import type {
  SocialPost,
  QueueEntry,
  QueueStatus,
  SocialChannel,
  SocialPublisher,
  PublishResult,
  ApprovalStatus,
} from './types';
import { LinkedInPublisher } from './linkedinPublisher';
import { XPublisher } from './xPublisher';
import { TikTokPublisher } from './tiktokPublisher';
import { MetaPublisher } from './metaPublisher';

let queueIdCounter = 0;
function nextQueueId(): string {
  queueIdCounter += 1;
  return `q_${Date.now().toString(36)}_${queueIdCounter.toString(36)}`;
}

/**
 * In-memory distribution queue. One instance per orchestrator process
 * is sufficient for v1. Persistence (Postgres / Redis-backed BullMQ)
 * is a follow-up — see DistributionQueue#persist hooks below.
 */
export class DistributionQueue {
  private entries: QueueEntry[] = [];
  private publishers: Map<SocialChannel, SocialPublisher> = new Map();

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
   */
  enqueue(post: SocialPost): QueueEntry | null {
    if (post.approvalStatus === 'BLOCKED') return null;
    const status: QueueStatus = post.approvalStatus === 'AUTO' ? 'auto' : 'pending';
    const entry: QueueEntry = {
      id: nextQueueId(),
      post,
      status,
      enqueuedAt: new Date().toISOString(),
    };
    this.entries.push(entry);
    return entry;
  }

  /**
   * Enqueue many posts in one call. BLOCKED posts are silently
   * skipped (the orchestrator already records them elsewhere).
   * Returns the list of created QueueEntries (excluding skipped).
   */
  enqueueMany(posts: SocialPost[]): QueueEntry[] {
    const out: QueueEntry[] = [];
    for (const p of posts) {
      const e = this.enqueue(p);
      if (e) out.push(e);
    }
    return out;
  }

  // ── Reviewer actions ────────────────────────────────────────────

  approve(queueId: string, reviewer: string): QueueEntry {
    const e = this.requireEntry(queueId);
    if (e.status !== 'pending') {
      throw new Error(`approve: queue entry ${queueId} is in status ${e.status}, expected pending`);
    }
    e.status = 'approved';
    e.decidedAt = new Date().toISOString();
    e.reviewer = reviewer;
    return e;
  }

  reject(queueId: string, reviewer: string): QueueEntry {
    const e = this.requireEntry(queueId);
    if (e.status !== 'pending') {
      throw new Error(`reject: queue entry ${queueId} is in status ${e.status}, expected pending`);
    }
    e.status = 'rejected';
    e.decidedAt = new Date().toISOString();
    e.reviewer = reviewer;
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
    if (result.ok) {
      e.status = 'published';
      e.publishedAt = result.postedAt ?? new Date().toISOString();
    } else {
      e.status = 'failed';
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

// LinkedInPublisher, XPublisher, TikTokPublisher, MetaPublisher
// are imported at the top of this file and re-exported below.

/**
 * WordPress Publisher — REST API (WP 4.7+)
 * Requires: WordPress site URL + application password in Supabase Vault
 * See: https://developer.wordpress.org/rest-api/
 */
export class WordPressPublisher extends BasePublisher {
  public readonly channel: SocialChannel = 'wordpress.blog';
  private siteUrl: string;
  private username: string;
  private appPassword: string;

  constructor(siteUrl: string, username?: string, appPassword?: string) {
    super();
    this.siteUrl = siteUrl.replace(/\/$/, ''); // Remove trailing slash
    this.username = username || '';
    this.appPassword = appPassword || '';
  }

  async publish(post: SocialPost): Promise<PublishResult> {
    this.logPublishAttempt(post, 'started', { siteUrl: this.siteUrl });

    if (!this.siteUrl || !this.username || !this.appPassword) {
      return {
        ok: false,
        channel: this.channel,
        error: { code: 'MISSING_CONFIG', message: 'WordPress site URL, username, or app password not configured' },
      };
    }

    try {
      const result = await this.retryWithBackoff(
        async () => {
          const auth = Buffer.from(`${this.username}:${this.appPassword}`).toString('base64');
          const excerpt = post.body.substring(0, 200);
          const slug = post.socialEventId.toLowerCase().replace(/[^a-z0-9-]/g, '-');

          const response = await fetch(`${this.siteUrl}/wp-json/wp/v2/posts`, {
            method: 'POST',
            headers: {
              'Authorization': `Basic ${auth}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              title: `Governance Alert: ${new Date().toISOString().split('T')[0]}`,
              content: post.body,
              excerpt,
              slug,
              status: 'publish',
              categories: [1], // Default category; customize per site
              meta: {
                source_event_id: post.socialEventId,
                published_via: 'realsyncdynamics_orchestrator',
              },
            }),
          });

          if (!response.ok) {
            const error = await response.json();
            throw new Error(`WP_${response.status}: ${error?.message || 'Unknown error'}`);
          }

          return response.json();
        },
        (attempt, error) => {
          console.warn(`WordPress publish attempt ${attempt} failed:`, error.message);
        }
      );

      this.logPublishAttempt(post, 'success', { postId: result.id, url: result.link });
      return {
        ok: true,
        channel: this.channel,
        externalId: String(result.id),
        postedAt: result.date_gmt || new Date().toISOString(),
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
 * Ghost Publisher — Ghost API v1
 * Requires: Ghost Admin API key (from Ghost settings) + admin URL
 * See: https://ghost.org/docs/admin-api/
 */
export class GhostPublisher extends BasePublisher {
  public readonly channel: SocialChannel = 'ghost.blog';
  private adminUrl: string;
  private adminApiKey: string;

  constructor(adminUrl: string, adminApiKey?: string) {
    super();
    this.adminUrl = adminUrl.replace(/\/$/, ''); // Remove trailing slash
    this.adminApiKey = adminApiKey || '';
  }

  async publish(post: SocialPost): Promise<PublishResult> {
    this.logPublishAttempt(post, 'started', { adminUrl: this.adminUrl });

    if (!this.adminUrl || !this.adminApiKey) {
      return {
        ok: false,
        channel: this.channel,
        error: { code: 'MISSING_CONFIG', message: 'Ghost admin URL or API key not configured' },
      };
    }

    try {
      const result = await this.retryWithBackoff(
        async () => {
          const [id, secret] = this.adminApiKey.split(':');
          if (!id || !secret) {
            throw new Error('Invalid Ghost API key format (expected id:secret)');
          }

          const response = await fetch(`${this.adminUrl}/ghost/api/admin/posts/?source=html`, {
            method: 'POST',
            headers: {
              'Authorization': `Ghost ${this.createGhostJwt(id, secret)}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              posts: [
                {
                  title: `Governance Update: ${new Date().toISOString().split('T')[0]}`,
                  html: post.body,
                  tags: [{ name: 'Governance' }, { name: 'Compliance' }],
                  status: 'published',
                  custom_excerpt: post.body.substring(0, 200),
                  meta_description: post.body.substring(0, 160),
                },
              ],
            }),
          });

          if (!response.ok) {
            const error = await response.json();
            throw new Error(`GHOST_${response.status}: ${error?.errors?.[0]?.message || 'Unknown error'}`);
          }

          return response.json();
        },
        (attempt, error) => {
          console.warn(`Ghost publish attempt ${attempt} failed:`, error.message);
        }
      );

      const publishedPost = result.posts?.[0];
      this.logPublishAttempt(post, 'success', { postId: publishedPost?.id, url: publishedPost?.url });

      return {
        ok: true,
        channel: this.channel,
        externalId: publishedPost?.id,
        postedAt: publishedPost?.published_at || new Date().toISOString(),
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

  private createGhostJwt(id: string, secret: string): string {
    const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64');
    const iat = Math.floor(Date.now() / 1000);
    const payload = Buffer.from(JSON.stringify({ iat, exp: iat + 60 })).toString('base64');

    const crypto = require('crypto');
    const signature = crypto
      .createHmac('sha256', Buffer.from(secret, 'hex'))
      .update(`${header}.${payload}`)
      .digest('base64');

    return `${header}.${payload}.${signature}`;
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

    if (!this.webhookUrl) {
      return {
        ok: false,
        channel: this.channel,
        error: { code: 'MISSING_URL', message: 'Webhook URL not configured' },
      };
    }

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
              socialEventId: post.socialEventId,
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

// ── Concrete publishers (extend BasePublisher) ────────────────────────

/**
 * Email Publisher — Send post as email newsletter via SendGrid/SES
 * Supports batch send to compliance-focused audiences.
 * Configured for SendGrid; can be adapted for AWS SES or others.
 */
export class EmailPublisher extends BasePublisher {
  public readonly channel: SocialChannel = 'email.newsletter';
  private fromAddress: string;
  private toAddresses: string[];
  private sendGridApiKey: string;
  private provider: 'sendgrid' | 'ses' = 'sendgrid';

  constructor(
    toAddresses: string[] = [],
    sendGridApiKey?: string,
    fromAddress?: string,
    provider?: 'sendgrid' | 'ses'
  ) {
    super();
    this.toAddresses = toAddresses;
    this.sendGridApiKey = sendGridApiKey || '';
    this.fromAddress = fromAddress || 'alerts@realsyncdynamics.ai';
    this.provider = provider || 'sendgrid';
  }

  async publish(post: SocialPost): Promise<PublishResult> {
    if (this.toAddresses.length === 0) {
      return {
        ok: false,
        channel: this.channel,
        error: { code: 'NO_RECIPIENTS', message: 'No email recipients configured' },
      };
    }

    if (!this.sendGridApiKey && this.provider === 'sendgrid') {
      return {
        ok: false,
        channel: this.channel,
        error: { code: 'MISSING_API_KEY', message: 'SendGrid API key not configured' },
      };
    }

    this.logPublishAttempt(post, 'started', { recipientCount: this.toAddresses.length, provider: this.provider });

    try {
      const result = await this.retryWithBackoff(
        async () => {
          if (this.provider === 'sendgrid') {
            return this.publishViaSendGrid(post);
          } else {
            return this.publishViaSes(post);
          }
        },
        (attempt, error) => {
          console.warn(`Email publish attempt ${attempt} failed:`, error.message);
        }
      );

      this.logPublishAttempt(post, 'success', { messageId: result.messageId, recipientCount: this.toAddresses.length });
      return {
        ok: true,
        channel: this.channel,
        externalId: result.messageId,
        postedAt: new Date().toISOString(),
      };
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      this.logPublishAttempt(post, 'failed', { error: errorMsg });

      return {
        ok: false,
        channel: this.channel,
        error: { code: 'EMAIL_SEND_FAILED', message: errorMsg },
      };
    }
  }

  private async publishViaSendGrid(post: SocialPost): Promise<{ messageId: string }> {
    const response = await fetch('https://api.sendgrid.com/v3/mail/send', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.sendGridApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        personalizations: this.toAddresses.map(email => ({
          to: [{ email }],
          subject: `Governance Alert: ${new Date().toLocaleDateString()}`,
        })),
        from: { email: this.fromAddress, name: 'RealSyncDynamics Alerts' },
        content: [
          {
            type: 'text/html',
            value: this.buildHtmlEmail(post),
          },
        ],
        trackingSettings: {
          clickTracking: { enable: true },
          openTracking: { enable: true },
        },
        customArgs: {
          source_event_id: post.socialEventId,
          channel: 'email.newsletter',
        },
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`SendGrid ${response.status}: ${error}`);
    }

    const messageId = response.headers.get('X-Message-ID') || `sg_${Date.now()}`;
    return { messageId };
  }

  private async publishViaSes(post: SocialPost): Promise<{ messageId: string }> {
    const response = await fetch(
      `${process.env.AWS_SES_ENDPOINT || 'https://email.amazonaws.com'}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-amz-json-1.1',
          'X-Amz-Target': 'AmazonSSM.SendEmail',
        },
        body: JSON.stringify({
          Source: this.fromAddress,
          Destination: { ToAddresses: this.toAddresses },
          Message: {
            Subject: { Data: `Governance Alert: ${new Date().toLocaleDateString()}` },
            Body: { Html: { Data: this.buildHtmlEmail(post) } },
          },
        }),
      }
    );

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`AWS SES ${response.status}: ${error}`);
    }

    const result = await response.json();
    return { messageId: result.MessageId };
  }

  private buildHtmlEmail(post: SocialPost): string {
    return `
<!DOCTYPE html>
<html>
  <head>
    <style>
      body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; color: #333; }
      .container { max-width: 600px; margin: 0 auto; padding: 20px; }
      .header { background: #0A0A0B; color: white; padding: 20px; border-radius: 4px; margin-bottom: 20px; }
      .content { line-height: 1.6; }
      .footer { color: #666; font-size: 12px; margin-top: 20px; border-top: 1px solid #eee; padding-top: 10px; }
    </style>
  </head>
  <body>
    <div class="container">
      <div class="header">
        <h2>🛡️ RealSyncDynamics Governance Alert</h2>
      </div>
      <div class="content">
        ${post.body}
        ${post.hashtags.length > 0 ? `<p><strong>Tags:</strong> ${post.hashtags.join(', ')}</p>` : ''}
      </div>
      <div class="footer">
        <p>This is an automated governance alert from RealSyncDynamics.AI</p>
        <p><a href="https://realsyncdynamics.ai/audit">View full audit report</a></p>
      </div>
    </div>
  </body>
</html>
    `.trim();
  }
}

// ── Publisher exports ──────────────────────────────────────────────────────
//
// All channel publishers are available for registration with the queue.
// Real implementations:
//   - LinkedInPublisher: supports linkedin.enterprise + linkedin.legal
//   - XPublisher: posts to X/Twitter (x.alert channel)
//   - TikTokPublisher: posts to TikTok (tiktok.fast channel)
//   - MetaPublisher: posts to Instagram (instagram.reel channel)
//   - WordPressPublisher: publishes to WordPress blogs
//   - GhostPublisher: publishes to Ghost CMS blogs
//   - WebhookPublisher: sends to generic webhook endpoints
//   - EmailPublisher: sends via SendGrid or AWS SES
//
// Example usage:
//   const queue = new DistributionQueue();
//   queue.registerPublisher(new XPublisher(xAccessToken));
//   queue.registerPublisher(new TikTokPublisher(tiktokToken, refreshToken));
//   queue.registerPublisher(new MetaPublisher(metaToken, igUserId, fallbackImageUrl));
//   queue.registerPublisher(new LinkedInPublisher('linkedin.enterprise', liToken, authorId, orgId));

export { LinkedInPublisher, XPublisher, TikTokPublisher, MetaPublisher };

// ── Distribution Queue Features ────────────────────────────────────────────

/**
 * Dead Letter Queue — handles failed publishing attempts with retry tracking.
 * In-memory storage; persistence to Postgres is a follow-up.
 *
 * Future schema (migration):
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
export interface DLQEntry {
  id: string;
  queueEntryId: string;
  errorCode: string;
  errorMessage: string;
  retryCount: number;
  nextRetryAt: string;
  createdAt: string;
  updatedAt: string;
}

export class DeadLetterQueue {
  private entries: DLQEntry[] = [];
  private maxRetries: number = 3;
  private baseRetryDelayMs: number = 1000;

  addEntry(
    queueEntryId: string,
    errorCode: string,
    errorMessage: string
  ): DLQEntry {
    const now = new Date();
    const nextRetryAt = new Date(now.getTime() + this.baseRetryDelayMs);

    const entry: DLQEntry = {
      id: `dlq_${Date.now().toString(36)}_${Math.random().toString(36).slice(2)}`,
      queueEntryId,
      errorCode,
      errorMessage,
      retryCount: 0,
      nextRetryAt: nextRetryAt.toISOString(),
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
    };

    this.entries.push(entry);
    return entry;
  }

  markRetried(dlqId: string): DLQEntry | null {
    const entry = this.entries.find((e) => e.id === dlqId);
    if (!entry) return null;

    entry.retryCount += 1;
    if (entry.retryCount < this.maxRetries) {
      const delay = this.baseRetryDelayMs * Math.pow(2, entry.retryCount - 1);
      entry.nextRetryAt = new Date(Date.now() + delay).toISOString();
    }
    entry.updatedAt = new Date().toISOString();
    return entry;
  }

  isRetryable(dlqId: string): boolean {
    const entry = this.entries.find((e) => e.id === dlqId);
    if (!entry) return false;
    return entry.retryCount < this.maxRetries && new Date() >= new Date(entry.nextRetryAt);
  }

  list(filter?: { errorCode?: string; channel?: SocialChannel }): DLQEntry[] {
    return this.entries.filter((e) => {
      if (filter?.errorCode && !e.errorCode.includes(filter.errorCode)) return false;
      return true;
    });
  }

  get(dlqId: string): DLQEntry | null {
    return this.entries.find((e) => e.id === dlqId) ?? null;
  }

  size(): number {
    return this.entries.length;
  }

  __resetForTests(): void {
    this.entries = [];
  }
}

/**
 * Queue Status & Metrics — tracks queue performance and observability.
 *
 * Metrics tracked:
 *   - Queue depth (pending, approved, published, failed)
 *   - Publishing latency (start → published)
 *   - Retry rate (per channel, per error code)
 *   - Error trends (detect repeated failures)
 */
export interface QueueMetrics {
  totalEnqueued: number;
  totalPublished: number;
  totalFailed: number;
  totalRejected: number;
  avgPublishLatencyMs: number;
  queueDepth: Record<QueueStatus, number>;
  channelMetrics: Record<SocialChannel, { attempted: number; succeeded: number; failed: number }>;
  errorCodes: Record<string, number>;
  lastUpdated: string;
}

export class QueueStatsCollector {
  private metrics: Omit<QueueMetrics, 'lastUpdated'>;

  constructor() {
    this.metrics = {
      totalEnqueued: 0,
      totalPublished: 0,
      totalFailed: 0,
      totalRejected: 0,
      avgPublishLatencyMs: 0,
      queueDepth: {
        auto: 0,
        pending: 0,
        approved: 0,
        rejected: 0,
        published: 0,
        failed: 0,
      },
      channelMetrics: {} as Record<SocialChannel, { attempted: number; succeeded: number; failed: number }>,
      errorCodes: {},
    };
  }

  private publishLatencies: number[] = [];

  recordEnqueued(): void {
    this.metrics.totalEnqueued += 1;
  }

  recordPublishAttempt(channel: SocialChannel): void {
    if (!this.metrics.channelMetrics[channel]) {
      this.metrics.channelMetrics[channel] = { attempted: 0, succeeded: 0, failed: 0 };
    }
    this.metrics.channelMetrics[channel].attempted += 1;
  }

  recordPublishSuccess(channel: SocialChannel, latencyMs: number): void {
    this.metrics.totalPublished += 1;
    this.publishLatencies.push(latencyMs);

    if (this.publishLatencies.length > 100) {
      this.publishLatencies = this.publishLatencies.slice(-100);
    }

    this.metrics.avgPublishLatencyMs = Math.round(
      this.publishLatencies.reduce((a, b) => a + b, 0) / this.publishLatencies.length
    );

    if (this.metrics.channelMetrics[channel]) {
      this.metrics.channelMetrics[channel].succeeded += 1;
    }
  }

  recordPublishFailure(channel: SocialChannel, errorCode: string): void {
    this.metrics.totalFailed += 1;
    this.metrics.errorCodes[errorCode] = (this.metrics.errorCodes[errorCode] ?? 0) + 1;

    if (this.metrics.channelMetrics[channel]) {
      this.metrics.channelMetrics[channel].failed += 1;
    }
  }

  recordRejected(): void {
    this.metrics.totalRejected += 1;
  }

  updateQueueDepth(depth: Record<QueueStatus, number>): void {
    this.metrics.queueDepth = depth;
  }

  getMetrics(): QueueMetrics {
    return {
      ...this.metrics,
      lastUpdated: new Date().toISOString(),
    };
  }

  reset(): void {
    this.metrics = {
      totalEnqueued: 0,
      totalPublished: 0,
      totalFailed: 0,
      totalRejected: 0,
      avgPublishLatencyMs: 0,
      queueDepth: {
        auto: 0,
        pending: 0,
        approved: 0,
        rejected: 0,
        published: 0,
        failed: 0,
      },
      channelMetrics: {} as Record<SocialChannel, { attempted: number; succeeded: number; failed: number }>,
      errorCodes: {},
    };
    this.publishLatencies = [];
  }
}

/**
 * Audit Logger — compliance audit trail for queue operations.
 * Wire to runtime_events table for full governance trail.
 *
 * Events logged:
 *   - publish_attempted(queue_id, channel, actor_id)
 *   - publish_succeeded(queue_id, channel, external_id)
 *   - publish_failed(queue_id, channel, error_code, retry_count)
 *   - dlq_entry_created(queue_id, reason)
 *   - approval_decision(queue_id, reviewer, decision)
 */
export interface AuditLogEntry {
  id: string;
  timestamp: string;
  eventType: string;
  queueEntryId: string;
  channel: SocialChannel;
  actor?: string;
  metadata: Record<string, unknown>;
}

export class AuditLogger {
  private logs: AuditLogEntry[] = [];

  logPublishAttempted(queueId: string, channel: SocialChannel, actor?: string): AuditLogEntry {
    return this.log('publish_attempted', queueId, channel, actor, { attempt: true });
  }

  logPublishSucceeded(queueId: string, channel: SocialChannel, externalId: string): AuditLogEntry {
    return this.log('publish_succeeded', queueId, channel, undefined, { externalId });
  }

  logPublishFailed(queueId: string, channel: SocialChannel, errorCode: string, retryCount: number): AuditLogEntry {
    return this.log('publish_failed', queueId, channel, undefined, { errorCode, retryCount });
  }

  logDLQEntryCreated(queueId: string, channel: SocialChannel, reason: string): AuditLogEntry {
    return this.log('dlq_entry_created', queueId, channel, undefined, { reason });
  }

  logApprovalDecision(queueId: string, channel: SocialChannel, reviewer: string, approved: boolean): AuditLogEntry {
    return this.log('approval_decision', queueId, channel, reviewer, { approved });
  }

  private log(
    eventType: string,
    queueId: string,
    channel: SocialChannel,
    actor: string | undefined,
    metadata: Record<string, unknown>
  ): AuditLogEntry {
    const entry: AuditLogEntry = {
      id: `audit_${Date.now().toString(36)}_${Math.random().toString(36).slice(2)}`,
      timestamp: new Date().toISOString(),
      eventType,
      queueEntryId: queueId,
      channel,
      actor,
      metadata,
    };

    this.logs.push(entry);
    return entry;
  }

  list(filter?: { eventType?: string; channel?: SocialChannel; queueEntryId?: string }): AuditLogEntry[] {
    return this.logs.filter((entry) => {
      if (filter?.eventType && entry.eventType !== filter.eventType) return false;
      if (filter?.channel && entry.channel !== filter.channel) return false;
      if (filter?.queueEntryId && entry.queueEntryId !== filter.queueEntryId) return false;
      return true;
    });
  }

  get(auditId: string): AuditLogEntry | null {
    return this.logs.find((e) => e.id === auditId) ?? null;
  }

  size(): number {
    return this.logs.length;
  }

  __resetForTests(): void {
    this.logs = [];
  }
}

/**
 * Recommended usage: Create queue with integrated observability.
 *
 * Example:
 *   const queue = new DistributionQueue();
 *   const dlq = new DeadLetterQueue();
 *   const metrics = new QueueStatsCollector();
 *   const audit = new AuditLogger();
 *
 *   // Register publishers
 *   queue.registerPublisher(new XPublisher(token));
 *
 *   // On enqueue
 *   const entry = queue.enqueue(post);
 *   if (entry) {
 *     metrics.recordEnqueued();
 *     audit.logPublishAttempted(entry.id, post.channel, 'user_123');
 *   }
 *
 *   // On publish
 *   const result = await queue.publish(entryId);
 *   if (result.publishResult?.ok) {
 *     metrics.recordPublishSuccess(result.post.channel, latency);
 *     audit.logPublishSucceeded(entryId, result.post.channel, result.publishResult.externalId);
 *   } else {
 *     metrics.recordPublishFailure(result.post.channel, error.code);
 *     dlq.addEntry(entryId, error.code, error.message);
 *     audit.logPublishFailed(entryId, result.post.channel, error.code, retries);
 *   }
 */
