import type { SocialPublisher, SocialPost, PublishResult, SocialChannel } from './types';

/**
 * Browser-Adapter veroeffentlicht nicht.
 *
 * Der Versand laeuft im social-publisher-worker gegen die Posts API
 * (POST https://api.linkedin.com/rest/posts). Token und Autor-URN
 * kommen aus social_channel_connections, nicht aus diesem Modul.
 */
export class LinkedInPublisher implements SocialPublisher {
  public readonly channel: SocialChannel;

  constructor(channel: SocialChannel) {
    if (!channel.startsWith('linkedin.')) {
      throw new Error(`LinkedInPublisher: invalid channel '${channel}', must start with 'linkedin.'`);
    }
    this.channel = channel;
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
    return {
      ok: false,
      channel: this.channel,
      error: {
        code: 'LINKEDIN_WORKER_ONLY',
        message: 'LinkedIn publishing runs in social-publisher-worker (Posts API), not in the browser',
      },
    };
  }
}
