import type { SocialPublisher, SocialPost, PublishResult, SocialChannel } from './types';

/**
 * LinkedIn Publisher — Real adapter for publishing to LinkedIn.
 *
 * Supports two distinct profiles:
 * - linkedin.enterprise: posts to LinkedIn company page
 * - linkedin.personal: posts as individual author (DPO signature)
 *
 * Requires: LINKEDIN_ACCESS_TOKEN in Supabase Vault + associated
 * user/company IDs per profile.
 */
export class LinkedInPublisher implements SocialPublisher {
  public readonly channel: SocialChannel;
  private accessToken: string;
  private authorId: string; // linkedin user ID or linkedin.entity URN
  private organisationId?: string; // for company page posting

  constructor(
    channel: SocialChannel,
    accessToken: string,
    authorId: string,
    organisationId?: string
  ) {
    if (!channel.startsWith('linkedin.')) {
      throw new Error(`LinkedInPublisher: invalid channel '${channel}', must start with 'linkedin.'`);
    }
    this.channel = channel;
    this.accessToken = accessToken;
    this.authorId = authorId;
    this.organisationId = organisationId;
  }

  async publish(post: SocialPost): Promise<PublishResult> {
    if (post.channel !== this.channel) {
      return {
        ok: false,
        channel: this.channel,
        error: {
          code: 'CHANNEL_MISMATCH',
          message: `post channel ${post.channel} != publisher channel ${this.channel}`,
        },
      };
    }

    const text = this.truncateForLinkedIn(post.body);

    const payload = this.buildUGCPostPayload(text);

    try {
      const response = await fetch('https://api.linkedin.com/v2/ugcPosts', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.accessToken}`,
          'Content-Type': 'application/json',
          'LinkedIn-Version': '202305',
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const errorCode = `LINKEDIN_${response.status}_${errorData.code ?? 'UNKNOWN'}`;
        return {
          ok: false,
          channel: this.channel,
          error: {
            code: errorCode,
            message: errorData.message ?? `HTTP ${response.status}`,
          },
        };
      }

      const result = await response.json();
      const externalId = result.id ?? `linkedin_${Date.now()}`;

      return {
        ok: true,
        channel: this.channel,
        externalId,
        postedAt: new Date().toISOString(),
      };
    } catch (err) {
      return {
        ok: false,
        channel: this.channel,
        error: {
          code: 'LINKEDIN_NETWORK_ERROR',
          message: (err as Error).message ?? 'Network or parsing error',
        },
      };
    }
  }

  private truncateForLinkedIn(body: string): string {
    const maxChars = 1500;
    if (body.length <= maxChars) return body;
    return body.substring(0, maxChars - 3) + '...';
  }

  private buildUGCPostPayload(text: string): Record<string, unknown> {
    if (this.channel === 'linkedin.enterprise' && this.organisationId) {
      return {
        author: `urn:li:organization:${this.organisationId}`,
        lifecycleState: 'PUBLISHED',
        specificContent: {
          'com.linkedin.ugc.PublishText': {
            shareCommentary: {
              text,
            },
          },
        },
        visibility: {
          'com.linkedin.ugc.MemberNetworkVisibility': 'PUBLIC',
        },
      };
    }

    return {
      author: `urn:li:person:${this.authorId}`,
      lifecycleState: 'PUBLISHED',
      specificContent: {
        'com.linkedin.ugc.PublishText': {
          shareCommentary: {
            text,
          },
        },
      },
      visibility: {
        'com.linkedin.ugc.MemberNetworkVisibility': 'PUBLIC',
      },
    };
  }
}
