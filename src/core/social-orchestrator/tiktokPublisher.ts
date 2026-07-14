import type { SocialPublisher, SocialPost, PublishResult } from './types';

/**
 * TikTok Publisher — Real adapter for posting to TikTok.
 *
 * Uses TikTok for Business API (Content Post API):
 *   - Requires sandbox approval + OAuth 2.0 flow
 *   - POST /v0.1/post/publish/action/publish (in beta)
 *   - Text-only posts (captions); video attachment requires asset upload
 *   - Token rotation: access tokens expire; refresh token flow handles renewal
 *
 * Since this orchestrator generates text-only posts, we focus on caption posting.
 * Full video/Reel support would require asset upload integration.
 *
 * Requires: TIKTOK_ACCESS_TOKEN + TIKTOK_REFRESH_TOKEN in Supabase Vault.
 * Bearer token is refreshed on 401 response (refresh token → new access token).
 */
export class TikTokPublisher implements SocialPublisher {
  public readonly channel = 'tiktok.fast' as const;
  private accessToken: string;
  private refreshToken: string;

  constructor(accessToken: string, refreshToken: string) {
    this.accessToken = accessToken;
    this.refreshToken = refreshToken;
  }

  async publish(post: SocialPost): Promise<PublishResult> {
    if (post.channel !== 'tiktok.fast') {
      return {
        ok: false,
        channel: this.channel,
        error: {
          code: 'CHANNEL_MISMATCH',
          message: `post channel ${post.channel} != publisher channel tiktok.fast`,
        },
      };
    }

    const text = this.truncateForTikTok(post.body);

    return this.publishWithTokenRefresh(text);
  }

  private async publishWithTokenRefresh(text: string): Promise<PublishResult> {
    try {
      const response = await fetch('https://open.tiktok.com/v0.1/post/publish/action/publish', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          post_info: {
            description: text,
            disable_comment: false,
            disable_duet: false,
            disable_stitch: false,
          },
        }),
      });

      if (response.status === 401) {
        const refreshed = await this.refreshAccessToken();
        if (!refreshed) {
          return {
            ok: false,
            channel: this.channel,
            error: {
              code: 'TIKTOK_TOKEN_REFRESH_FAILED',
              message: 'Failed to refresh TikTok access token',
            },
          };
        }
        return this.publishWithTokenRefresh(text);
      }

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const errorObj = (errorData as Record<string, unknown>).error as Record<string, unknown> | undefined;
        const errorCode = `TIKTOK_${response.status}_${errorObj?.code as string ?? 'ERROR'}`;
        return {
          ok: false,
          channel: this.channel,
          error: {
            code: errorCode,
            message: (errorObj?.message as string) ?? `HTTP ${response.status}`,
          },
        };
      }

      const result = await response.json();
      const data = (result as Record<string, unknown>).data as Record<string, unknown> | undefined;
      const postId = data?.publish_id as string | undefined ?? `tiktok_${Date.now()}`;

      return {
        ok: true,
        channel: this.channel,
        externalId: postId,
        postedAt: new Date().toISOString(),
      };
    } catch (err) {
      return {
        ok: false,
        channel: this.channel,
        error: {
          code: 'TIKTOK_NETWORK_ERROR',
          message: (err as Error).message ?? 'Network or parsing error',
        },
      };
    }
  }

  private async refreshAccessToken(): Promise<boolean> {
    try {
      const response = await fetch('https://open.tiktok.com/v1/oauth/token/', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          grant_type: 'refresh_token',
          refresh_token: this.refreshToken,
        }).toString(),
      });

      if (!response.ok) {
        console.error('TikTok token refresh failed:', response.status);
        return false;
      }

      const result = await response.json();
      const newAccessToken = (result as Record<string, unknown>).access_token as string | undefined;

      if (!newAccessToken) {
        console.error('No access token in refresh response');
        return false;
      }

      this.accessToken = newAccessToken;
      return true;
    } catch (err) {
      console.error('TikTok token refresh error:', err);
      return false;
    }
  }

  private truncateForTikTok(body: string): string {
    const maxChars = 2200;
    if (body.length <= maxChars) return body;
    return body.substring(0, maxChars - 3) + '...';
  }
}
