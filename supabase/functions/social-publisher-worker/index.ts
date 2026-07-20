/**
 * Social Publisher Worker — Edge Function for async distribution queue processing.
 *
 * Role: Polls distribution queue, claims jobs atomically, publishes via registered
 * publishers, and updates status back to database.
 *
 * Deployment:
 *   supabase functions deploy social-publisher-worker
 *
 * Listening:
 *   - Supabase realtime: channel 'distribution_queue_ready' for LISTEN/NOTIFY
 *   - Fallback: cron job every 30 seconds if realtime unavailable
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

// ── Publisher registry ────────────────────────────────────────────

interface PublishConfig {
  linkedinToken?: string;
  wordpressUrl?: string;
  wordpressToken?: string;
  ghostUrl?: string;
  ghostToken?: string;
  webhookUrl?: string;
  emailFrom?: string;
  emailService?: 'sendgrid' | 'mailgun';
}

const config: PublishConfig = {
  linkedinToken: Deno.env.get('LINKEDIN_ACCESS_TOKEN'),
  wordpressUrl: Deno.env.get('WORDPRESS_URL'),
  wordpressToken: Deno.env.get('WORDPRESS_API_TOKEN'),
  ghostUrl: Deno.env.get('GHOST_URL'),
  ghostToken: Deno.env.get('GHOST_ADMIN_API_KEY'),
  webhookUrl: Deno.env.get('WEBHOOK_URL'),
  emailFrom: Deno.env.get('EMAIL_FROM_ADDRESS'),
  emailService: (Deno.env.get('EMAIL_SERVICE') as 'sendgrid' | 'mailgun') || 'sendgrid',
};

// ── Job processor ──────────────────────────────────────────────────

interface QueueJob {
  id: string;
  tenant_id: string;
  channel: string;
  body: string;
  hashtags: string[];
  post_data: Record<string, unknown>;
}

/**
 * Claim the next job from the queue for a specific channel.
 * Uses atomic FOR UPDATE SKIP LOCKED to prevent duplicate processing.
 */
async function claimNextJob(channel: string): Promise<QueueJob | null> {
  try {
    const { data, error } = await supabase.rpc('distribution_queue_claim_next', {
      p_channel: channel,
    });

    if (error) {
      console.error(`[${channel}] Failed to claim job:`, error);
      return null;
    }

    return data?.[0] as QueueJob | null;
  } catch (err) {
    console.error(`[${channel}] Exception claiming job:`, err);
    return null;
  }
}

/**
 * Publish via channel-specific adapter.
 * Returns { ok: true, externalId } or { ok: false, error }.
 */
async function publishViaChannel(
  job: QueueJob,
  channel: string
): Promise<{ ok: boolean; externalId?: string; error?: string }> {
  switch (channel) {
    case 'linkedin.enterprise':
    case 'linkedin.legal':
      return publishLinkedIn(job);

    case 'wordpress.blog':
      return publishWordPress(job);

    case 'ghost.blog':
      return publishGhost(job);

    case 'webhook.custom':
      return publishWebhook(job);

    case 'email.newsletter':
      return publishEmail(job);

    // TODO: instagram.reel, tiktok.fast, x.alert publishers

    default:
      return { ok: false, error: `Unknown channel: ${channel}` };
  }
}

// ── LinkedIn Publisher ─────────────────────────────────────────────

async function publishLinkedIn(job: QueueJob): Promise<{ ok: boolean; externalId?: string; error?: string }> {
  if (!config.linkedinToken) {
    return { ok: false, error: 'LinkedIn token not configured' };
  }

  const personUrn = job.channel === 'linkedin.legal'
    ? 'urn:li:person:XYZ789'
    : 'urn:li:person:ABC123';

  try {
    const response = await fetch('https://api.linkedin.com/v2/ugcPosts', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${config.linkedinToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        author: personUrn,
        lifecycleState: 'PUBLISHED',
        specificContent: {
          'com.linkedin.ugc.PublishContent': {
            shareCommentary: { text: job.body },
            shareMediaCategory: 'ARTICLE',
          },
        },
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      return { ok: false, error: `LinkedIn ${response.status}: ${error}` };
    }

    const data = await response.json();
    return { ok: true, externalId: data.id };
  } catch (err) {
    return { ok: false, error: String(err) };
  }
}

// ── WordPress Publisher ────────────────────────────────────────────

async function publishWordPress(job: QueueJob): Promise<{ ok: boolean; externalId?: string; error?: string }> {
  if (!config.wordpressUrl || !config.wordpressToken) {
    return { ok: false, error: 'WordPress config not set' };
  }

  try {
    const title = job.body.split('\n')[0]?.substring(0, 100) || 'Governance Update';
    const tags = job.hashtags.map(h => h.replace('#', '')).slice(0, 5);

    const response = await fetch(`${config.wordpressUrl}/wp-json/wp/v2/posts`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${config.wordpressToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        title,
        content: job.body,
        status: 'publish',
        tags,
        excerpt: job.body.substring(0, 160),
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      return { ok: false, error: `WordPress ${response.status}: ${error}` };
    }

    const data = await response.json();
    return { ok: true, externalId: String(data.id) };
  } catch (err) {
    return { ok: false, error: String(err) };
  }
}

// ── Ghost Publisher ────────────────────────────────────────────────

async function publishGhost(job: QueueJob): Promise<{ ok: boolean; externalId?: string; error?: string }> {
  if (!config.ghostUrl || !config.ghostToken) {
    return { ok: false, error: 'Ghost config not set' };
  }

  try {
    const title = job.body.split('\n')[0]?.substring(0, 100) || 'Governance Update';
    const tags = job.hashtags.map(h => ({ name: h.replace('#', '') })).slice(0, 5);

    const response = await fetch(`${config.ghostUrl}/ghost/api/v3/admin/posts/?source=html`, {
      method: 'POST',
      headers: {
        'Authorization': `Ghost ${config.ghostToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        posts: [
          {
            title,
            html: job.body.replace(/\n/g, '<br/>'),
            tags,
            status: 'published',
          },
        ],
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      return { ok: false, error: `Ghost ${response.status}: ${error}` };
    }

    const data = await response.json();
    const postId = data.posts?.[0]?.id || data.id;
    return { ok: true, externalId: postId };
  } catch (err) {
    return { ok: false, error: String(err) };
  }
}

// ── Webhook Publisher ──────────────────────────────────────────────

async function publishWebhook(job: QueueJob): Promise<{ ok: boolean; externalId?: string; error?: string }> {
  if (!config.webhookUrl) {
    return { ok: false, error: 'Webhook URL not configured' };
  }

  try {
    const response = await fetch(config.webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        channel: job.channel,
        body: job.body,
        hashtags: job.hashtags,
        timestamp: new Date().toISOString(),
      }),
    });

    if (!response.ok) {
      return { ok: false, error: `HTTP ${response.status}` };
    }

    return { ok: true, externalId: `webhook_${Date.now()}` };
  } catch (err) {
    return { ok: false, error: String(err) };
  }
}

// ── Email Publisher ────────────────────────────────────────────────

async function publishEmail(job: QueueJob): Promise<{ ok: boolean; externalId?: string; error?: string }> {
  if (!config.emailFrom || !config.emailService) {
    return { ok: false, error: 'Email config not set' };
  }

  if (config.emailService === 'sendgrid') {
    return publishEmailViaSendGrid(job);
  }

  return { ok: false, error: 'Email service not implemented' };
}

async function publishEmailViaSendGrid(job: QueueJob): Promise<{ ok: boolean; externalId?: string; error?: string }> {
  const apiKey = Deno.env.get('SENDGRID_API_KEY');
  if (!apiKey) {
    return { ok: false, error: 'SendGrid API key not configured' };
  }

  try {
    const title = job.body.split('\n')[0] || 'Governance Update';
    const recipients = Deno.env.get('EMAIL_RECIPIENTS')?.split(',') || [];

    if (recipients.length === 0) {
      return { ok: false, error: 'No email recipients configured' };
    }

    const emailBody = `
<html>
<head><meta charset="utf-8"/></head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; line-height: 1.6; color: #333;">
<h2>${escapeHtml(title)}</h2>
<div>${job.body.replace(/\n/g, '<br/>')}</div>
${job.hashtags.length > 0 ? `<p style="margin-top: 2em; color: #666; font-size: 0.9em;">${job.hashtags.map(escapeHtml).join(' ')}</p>` : ''}
<hr style="margin-top: 2em; border: none; border-top: 1px solid #ddd;">
<p style="font-size: 0.85em; color: #999;">This email was sent as part of compliance monitoring.</p>
</body>
</html>
    `;

    const response = await fetch('https://api.sendgrid.com/v3/mail/send', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        personalizations: recipients.map(to => ({ to: [{ email: to.trim() }] })),
        from: { email: config.emailFrom, name: 'RealSync Governance' },
        subject: title,
        content: [{ type: 'text/html', value: emailBody }],
        reply_to: { email: config.emailFrom },
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      return { ok: false, error: `SendGrid ${response.status}: ${error}` };
    }

    return { ok: true, externalId: `email_${Date.now()}` };
  } catch (err) {
    return { ok: false, error: String(err) };
  }
}

// ── Helpers ────────────────────────────────────────────────────────

function escapeHtml(text: string): string {
  const map: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' };
  return text.replace(/[&<>"']/g, m => map[m]!);
}

/**
 * Mark a job as published in the database.
 */
async function markPublished(jobId: string, externalId: string): Promise<void> {
  const { error } = await supabase.rpc('distribution_queue_mark_published', {
    p_id: jobId,
    p_external_id: externalId,
    p_published_at: new Date().toISOString(),
  });

  if (error) {
    console.error(`Failed to mark job ${jobId} as published:`, error);
  }
}

/**
 * Mark a job as failed (triggers retry scheduling or DLQ).
 */
async function markFailed(jobId: string, error: string): Promise<void> {
  const { error: err } = await supabase.rpc('distribution_queue_mark_failed', {
    p_id: jobId,
    p_error: error,
  });

  if (err) {
    console.error(`Failed to mark job ${jobId} as failed:`, err);
  }
}

// ── Main worker loop ───────────────────────────────────────────────

/**
 * Process one job from the specified channel.
 */
async function processJob(channel: string): Promise<boolean> {
  const job = await claimNextJob(channel);
  if (!job) return false;

  try {
    console.log(`[${channel}] Publishing job ${job.id}...`);

    const result = await publishViaChannel(job, channel);

    if (result.ok) {
      console.log(`[${channel}] ✓ Job ${job.id} published: ${result.externalId}`);
      await markPublished(job.id, result.externalId!);
      return true;
    } else {
      console.error(`[${channel}] ✗ Job ${job.id} failed: ${result.error}`);
      await markFailed(job.id, result.error!);
      return false;
    }
  } catch (err) {
    console.error(`[${channel}] Exception processing job ${job.id}:`, err);
    await markFailed(job.id, String(err));
    return false;
  }
}

/**
 * Process all channels (one job per channel per invocation).
 */
async function processAllChannels(): Promise<void> {
  const channels = [
    'linkedin.enterprise',
    'linkedin.legal',
    'wordpress.blog',
    'ghost.blog',
    'webhook.custom',
    'email.newsletter',
    // TODO: instagram.reel, tiktok.fast, x.alert
  ];

  const results = await Promise.allSettled(
    channels.map(channel => processJob(channel))
  );

  const succeeded = results.filter(r => r.status === 'fulfilled' && r.value).length;
  console.log(`[worker] Processed ${succeeded}/${channels.length} channels`);
}

// ── HTTP handler (invoked by Supabase) ────────────────────────────

Deno.serve(async (req: Request) => {
  // Only accept POST
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  try {
    // Process jobs
    await processAllChannels();

    return new Response(JSON.stringify({ ok: true }), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('[worker] Fatal error:', err);
    return new Response(JSON.stringify({ ok: false, error: String(err) }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
});
