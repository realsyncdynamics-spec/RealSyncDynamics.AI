import type { SocialPublisher, SocialPost, PublishResult } from './types';

/**
 * X (Twitter) Publisher — Real adapter for posting to X/Twitter.
 *
 * Uses X API v2 `/2/tweets` endpoint with OAuth 2.0.
 * Respects 280-character limit (the orchestrator pre-enforces 260).
 *
 * Requires: X_ACCESS_TOKEN in Supabase Vault.
 */
export class XPublisher implements SocialPublisher {
  public readonly channel = 'x' as const;
  private accessToken: string;

  constructor(accessToken: string) {
    this.accessToken = accessToken;
  }

  async publish(post: SocialPost): Promise<PublishResult> {
    if (post.channel !== 'x') {
      return {
        ok: false,
        channel: this.channel,
        error: {
          code: 'CHANNEL_MISMATCH',
          message: `post channel ${post.channel} != publisher channel x`,
        },
      };
    }

    if (post.body.length > 280) {
      return {
        ok: false,
        channel: this.channel,
        error: {
          code: 'TEXT_TOO_LONG',
          message: `Text exceeds 280 characters: ${post.body.length} chars`,
        },
      };
    }

    try {
      const response = await fetch('https://api.twitter.com/2/tweets', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          text: post.body,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const errorCode = `X_${response.status}_${(errorData as Record<string, unknown>).type ?? 'ERROR'}`;
        return {
          ok: false,
          channel: this.channel,
          error: {
            code: errorCode,
            message: Array.isArray((errorData as Record<string, unknown>).errors)
              ? ((errorData as Record<string, unknown>).errors as Array<Record<string, unknown>>)[0]?.message ?? 'Tweet creation failed'
              : (errorData as Record<string, unknown>).title ?? `HTTP ${response.status}`,
          },
        };
      }

      const result = await response.json();
      const data = (result as Record<string, unknown>).data as Record<string, unknown> | undefined;
      const tweetId = data?.id as string | undefined ?? `x_${Date.now()}`;

      return {
        ok: true,
        channel: this.channel,
        externalId: tweetId,
        postedAt: new Date().toISOString(),
      };
    } catch (err) {
      return {
        ok: false,
        channel: this.channel,
        error: {
          code: 'X_NETWORK_ERROR',
          message: (err as Error).message ?? 'Network or parsing error',
        },
      };
    }
  }
}
