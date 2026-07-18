import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DistributionQueue, LinkedInPublisher, WordPressPublisher, GhostPublisher, EmailPublisher, WebhookPublisher, MockPublisher } from '../../src/core/social-orchestrator/distributionQueue';
import type { SocialPost } from '../../src/core/social-orchestrator/types';

describe('Social Publishers', () => {
  describe('LinkedInPublisher', () => {
    it('should publish to LinkedIn with author URN', async () => {
      global.fetch = vi.fn(() =>
        Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({ id: 'urn:li:ugcPost:123' }),
        })
      ) as any;

      const publisher = new LinkedInPublisher('test_token');
      const post: SocialPost = {
        id: 'p1',
        socialEventId: 'e1',
        channel: 'linkedin.enterprise',
        approvalStatus: 'AUTO',
        body: 'Test governance alert',
        hashtags: [],
        charCount: 20,
        generatedAt: new Date().toISOString(),
        linkedInMetadata: { authorUrn: 'urn:li:person:ABC123' },
      };

      const result = await publisher.publish(post);

      expect(result.ok).toBe(true);
      expect(result.externalId).toBe('urn:li:ugcPost:123');
      expect(result.channel).toBe('linkedin.enterprise');
    });

    it('should fail without access token', async () => {
      const publisher = new LinkedInPublisher('');
      const post: SocialPost = {
        id: 'p1',
        socialEventId: 'e1',
        channel: 'linkedin.enterprise',
        approvalStatus: 'AUTO',
        body: 'Test',
        hashtags: [],
        charCount: 4,
        generatedAt: new Date().toISOString(),
      };

      const result = await publisher.publish(post);

      expect(result.ok).toBe(false);
      expect(result.error?.code).toBe('NO_TOKEN');
    });

    it('should fail without author URN', async () => {
      const publisher = new LinkedInPublisher('test_token');
      const post: SocialPost = {
        id: 'p1',
        socialEventId: 'e1',
        channel: 'linkedin.enterprise',
        approvalStatus: 'AUTO',
        body: 'Test',
        hashtags: [],
        charCount: 4,
        generatedAt: new Date().toISOString(),
      };

      const result = await publisher.publish(post);

      expect(result.ok).toBe(false);
      expect(result.error?.code).toBe('NO_AUTHOR');
    });
  });

  describe('WordPressPublisher', () => {
    it('should publish to WordPress', async () => {
      global.fetch = vi.fn(() =>
        Promise.resolve({
          ok: true,
          status: 201,
          json: async () => ({ id: 42, link: 'https://example.com/posts/42' }),
        })
      ) as any;

      const publisher = new WordPressPublisher('https://example.com', 'user', 'apppassword');
      const post: SocialPost = {
        id: 'p1',
        socialEventId: 'e1',
        channel: 'wordpress.blog',
        approvalStatus: 'AUTO',
        body: 'Test governance alert for blog',
        hashtags: ['governance'],
        charCount: 30,
        generatedAt: new Date().toISOString(),
      };

      const result = await publisher.publish(post);

      expect(result.ok).toBe(true);
      expect(result.externalId).toBe('42');
      expect(result.channel).toBe('wordpress.blog');
    });

    it('should fail without configuration', async () => {
      const publisher = new WordPressPublisher('');
      const post: SocialPost = {
        id: 'p1',
        socialEventId: 'e1',
        channel: 'wordpress.blog',
        approvalStatus: 'AUTO',
        body: 'Test',
        hashtags: [],
        charCount: 4,
        generatedAt: new Date().toISOString(),
      };

      const result = await publisher.publish(post);

      expect(result.ok).toBe(false);
      expect(result.error?.code).toBe('MISSING_CONFIG');
    });
  });

  describe('GhostPublisher', () => {
    it('should publish to Ghost', async () => {
      global.fetch = vi.fn(() =>
        Promise.resolve({
          ok: true,
          status: 201,
          json: async () => ({
            posts: [
              {
                id: 'ghost_id_123',
                url: 'https://ghost.example.com/post/',
                published_at: new Date().toISOString(),
              },
            ],
          }),
        })
      ) as any;

      const publisher = new GhostPublisher('https://ghost.example.com', 'id:secret');
      const post: SocialPost = {
        id: 'p1',
        socialEventId: 'e1',
        channel: 'ghost.blog',
        approvalStatus: 'AUTO',
        body: 'Test governance alert for Ghost',
        hashtags: [],
        charCount: 33,
        generatedAt: new Date().toISOString(),
      };

      const result = await publisher.publish(post);

      expect(result.ok).toBe(true);
      expect(result.externalId).toBe('ghost_id_123');
      expect(result.channel).toBe('ghost.blog');
    });
  });

  describe('EmailPublisher', () => {
    it('should send email newsletter', async () => {
      global.fetch = vi.fn(() =>
        Promise.resolve({
          ok: true,
          status: 202,
          headers: new Map([['X-Message-ID', 'sg_msg_123']]),
          json: async () => ({}),
        })
      ) as any;

      const publisher = new EmailPublisher(
        ['recipient@example.com'],
        'sendgrid_key',
        'alerts@example.com'
      );
      const post: SocialPost = {
        id: 'p1',
        socialEventId: 'e1',
        channel: 'email.newsletter',
        approvalStatus: 'AUTO',
        body: 'Test governance alert via email',
        hashtags: [],
        charCount: 32,
        generatedAt: new Date().toISOString(),
      };

      const result = await publisher.publish(post);

      expect(result.ok).toBe(true);
      expect(result.externalId).toBe('sg_msg_123');
      expect(result.channel).toBe('email.newsletter');
    });

    it('should fail without recipients', async () => {
      const publisher = new EmailPublisher([]);
      const post: SocialPost = {
        id: 'p1',
        socialEventId: 'e1',
        channel: 'email.newsletter',
        approvalStatus: 'AUTO',
        body: 'Test',
        hashtags: [],
        charCount: 4,
        generatedAt: new Date().toISOString(),
      };

      const result = await publisher.publish(post);

      expect(result.ok).toBe(false);
      expect(result.error?.code).toBe('NO_RECIPIENTS');
    });
  });

  describe('WebhookPublisher', () => {
    it('should post to webhook', async () => {
      global.fetch = vi.fn(() =>
        Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({ success: true }),
        })
      ) as any;

      const publisher = new WebhookPublisher('https://n8n.example.com/webhook/governance');
      const post: SocialPost = {
        id: 'p1',
        socialEventId: 'e1',
        channel: 'webhook.custom',
        approvalStatus: 'AUTO',
        body: 'Test webhook post',
        hashtags: [],
        charCount: 17,
        generatedAt: new Date().toISOString(),
      };

      const result = await publisher.publish(post);

      expect(result.ok).toBe(true);
      expect(result.channel).toBe('webhook.custom');
    });

    it('should fail without webhook URL', async () => {
      const publisher = new WebhookPublisher('');
      const post: SocialPost = {
        id: 'p1',
        socialEventId: 'e1',
        channel: 'webhook.custom',
        approvalStatus: 'AUTO',
        body: 'Test',
        hashtags: [],
        charCount: 4,
        generatedAt: new Date().toISOString(),
      };

      const result = await publisher.publish(post);

      expect(result.ok).toBe(false);
      expect(result.error?.code).toBe('MISSING_URL');
    });
  });

  describe('DistributionQueue', () => {
    let queue: DistributionQueue;

    beforeEach(() => {
      queue = new DistributionQueue();
      queue.__resetForTests();
    });

    it('should enqueue and publish via mock publisher', async () => {
      const mockPub = new MockPublisher('x.alert', { succeed: true });
      queue.registerPublisher(mockPub);

      const post: SocialPost = {
        id: 'p1',
        socialEventId: 'e1',
        channel: 'x.alert',
        approvalStatus: 'AUTO',
        body: 'Test alert',
        hashtags: [],
        charCount: 10,
        generatedAt: new Date().toISOString(),
      };

      const entry = queue.enqueue(post);
      expect(entry).not.toBeNull();
      expect(entry!.status).toBe('auto');

      const published = await queue.publish(entry!.id);
      expect(published.status).toBe('published');
      expect(published.publishResult?.ok).toBe(true);
    });

    it('should handle multiple channels', async () => {
      queue.registerPublisher(new MockPublisher('x.alert'));
      queue.registerPublisher(new MockPublisher('linkedin.enterprise'));
      queue.registerPublisher(new MockPublisher('wordpress.blog'));

      const posts: SocialPost[] = [
        {
          id: 'p1',
          socialEventId: 'e1',
          channel: 'x.alert',
          approvalStatus: 'AUTO',
          body: 'Tweet',
          hashtags: [],
          charCount: 5,
          generatedAt: new Date().toISOString(),
        },
        {
          id: 'p2',
          socialEventId: 'e2',
          channel: 'linkedin.enterprise',
          approvalStatus: 'AUTO',
          body: 'LinkedIn post',
          hashtags: [],
          charCount: 13,
          generatedAt: new Date().toISOString(),
        },
        {
          id: 'p3',
          socialEventId: 'e3',
          channel: 'wordpress.blog',
          approvalStatus: 'AUTO',
          body: 'Blog post',
          hashtags: [],
          charCount: 9,
          generatedAt: new Date().toISOString(),
        },
      ];

      const entries = queue.enqueueMany(posts);
      expect(entries).toHaveLength(3);

      const results = await queue.publishAllReady();
      expect(results).toHaveLength(3);
      expect(results.every(r => r.status === 'published')).toBe(true);
    });
  });
});
