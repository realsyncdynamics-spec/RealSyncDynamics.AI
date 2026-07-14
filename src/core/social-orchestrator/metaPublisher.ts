import type { SocialPublisher, SocialPost, PublishResult } from './types';

/**
 * Meta Publisher — Real adapter for posting to Instagram (and Threads).
 *
 * Uses Meta Graph API:
 *   - POST /{ig-user-id}/media to upload content
 *   - POST /{ig-media-id}/publish to publish
 *   - For Reels: video upload with thumbnail + caption
 *   - For Feed: image/carousel upload + caption
 *
 * Since this orchestrator generates text-only posts (no asset handling),
 * the publisher is configured with a fallback image asset ID or URL.
 * In a full implementation, the orchestrator would pass asset references
 * and the publisher would re-upload or reference them.
 *
 * Requires: META_ACCESS_TOKEN in Supabase Vault + IG_USER_ID config.
 */
export class MetaPublisher implements SocialPublisher {
  public readonly channel = 'instagram.reel' as const;
  private accessToken: string;
  private igUserId: string;
  private fallbackImageUrl: string;

  constructor(accessToken: string, igUserId: string, fallbackImageUrl: string) {
    this.accessToken = accessToken;
    this.igUserId = igUserId;
    this.fallbackImageUrl = fallbackImageUrl;
  }

  async publish(post: SocialPost): Promise<PublishResult> {
    if (post.channel !== 'instagram.reel') {
      return {
        ok: false,
        channel: this.channel,
        error: {
          code: 'CHANNEL_MISMATCH',
          message: `post channel ${post.channel} != publisher channel instagram.reel`,
        },
      };
    }

    const text = this.truncateForInstagram(post.body);

    try {
      // Step 1: Create media object (carousel or single image)
      // For v1, we use a simple image post with fallback asset
      const createResponse = await fetch(
        `https://graph.instagram.com/v18.0/${this.igUserId}/media`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            image_url: this.fallbackImageUrl,
            caption: text,
            access_token: this.accessToken,
          }),
        }
      );

      if (!createResponse.ok) {
        const errorData = await createResponse.json().catch(() => ({}));
        const errorCode = `INSTAGRAM_${createResponse.status}_${(errorData as Record<string, unknown>).error?.type ?? 'ERROR'}`;
        return {
          ok: false,
          channel: this.channel,
          error: {
            code: errorCode,
            message: (errorData as Record<string, unknown>).error?.message ?? `HTTP ${createResponse.status}`,
          },
        };
      }

      const createResult = await createResponse.json();
      const mediaId = (createResult as Record<string, unknown>).id as string | undefined;

      if (!mediaId) {
        return {
          ok: false,
          channel: this.channel,
          error: {
            code: 'INSTAGRAM_NO_MEDIA_ID',
            message: 'Failed to create media: no ID returned',
          },
        };
      }

      // Step 2: Publish the media
      const publishResponse = await fetch(
        `https://graph.instagram.com/v18.0/${mediaId}/publish`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            access_token: this.accessToken,
          }),
        }
      );

      if (!publishResponse.ok) {
        const errorData = await publishResponse.json().catch(() => ({}));
        const errorCode = `INSTAGRAM_${publishResponse.status}_${(errorData as Record<string, unknown>).error?.type ?? 'ERROR'}`;
        return {
          ok: false,
          channel: this.channel,
          error: {
            code: errorCode,
            message: (errorData as Record<string, unknown>).error?.message ?? `HTTP ${publishResponse.status}`,
          },
        };
      }

      const publishResult = await publishResponse.json();
      const igMediaId = (publishResult as Record<string, unknown>).id as string | undefined ?? `instagram_${Date.now()}`;

      return {
        ok: true,
        channel: this.channel,
        externalId: igMediaId,
        postedAt: new Date().toISOString(),
      };
    } catch (err) {
      return {
        ok: false,
        channel: this.channel,
        error: {
          code: 'INSTAGRAM_NETWORK_ERROR',
          message: (err as Error).message ?? 'Network or parsing error',
        },
      };
    }
  }

  private truncateForInstagram(body: string): string {
    const maxChars = 2200;
    if (body.length <= maxChars) return body;
    return body.substring(0, maxChars - 3) + '...';
  }
}
