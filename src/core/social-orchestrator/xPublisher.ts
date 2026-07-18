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
  public readonly channel = 'x.alert' as const;
  private accessToken: string;

  constructor(accessToken: string) {
    this.accessToken = accessToken;
  }

  async publish(post: SocialPost): Promise<PublishResult> {
    if (post.channel !== 'x.alert') {
      return {
        ok: false,
        channel: this.channel,
        error: {
          code: 'CHANNEL_MISMATCH',
          message: `post channel ${post.channel} != publisher channel x.alert`,
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
        const errorData = (await response.json().catch(() => ({}))) as Record<string, unknown>;
        const errorType = String(errorData.type ?? 'ERROR');
        const errorCode = `X_${response.status}_${errorType}`;

        let errorMessage = `HTTP ${response.status}`;
        if (Array.isArray(errorData.errors)) {
          const firstError = (errorData.errors as Array<Record<string, unknown>>)[0];
          errorMessage = String(firstError?.message ?? errorMessage);
        } else if (typeof errorData.title === 'string') {
          errorMessage = errorData.title;
        }

        return {
          ok: false,
          channel: this.channel,
          error: {
            code: errorCode,
            message: errorMessage,
          },
        };
      }

      const result = (await response.json()) as Record<string, unknown>;
      const data = result.data as Record<string, unknown> | undefined;
      const tweetId = (typeof data?.id === 'string' ? data.id : null) ?? `x_${Date.now()}`;

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
