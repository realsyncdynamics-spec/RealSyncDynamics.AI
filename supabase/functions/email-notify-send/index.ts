import { serve } from 'https://deno.land/std@0.208.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

/**
 * Email Notification Function
 *
 * Scheduled to run every 5 minutes
 * Processes pending email notifications and sends via Resend or similar
 */

interface EmailNotification {
  id: string;
  tenant_id: string;
  recipient_email: string;
  event_type: string;
  subject: string;
  body: string;
  created_at: string;
}

interface SupabaseAdminClient {
  from(table: string): {
    update(obj: Record<string, unknown>): {
      eq(col: string, val: unknown): Promise<{ error: unknown }>;
    };
  };
}

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');
const FROM_EMAIL = 'alerts@realsyncdynamics.ai';
const RESEND_API_URL = 'https://api.resend.com/emails';

serve(async () => {
  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!supabaseUrl || !supabaseServiceRoleKey) {
      throw new Error('Missing Supabase configuration');
    }

    const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

    // Fetch pending email notifications
    const { data: pendingEmails, error: fetchErr } = await supabase
      .from('email_notifications')
      .select('*')
      .is('sent_at', null)
      .order('created_at', { ascending: true })
      .limit(50);

    if (fetchErr) {
      throw fetchErr;
    }

    if (!pendingEmails || pendingEmails.length === 0) {
      return new Response(
        JSON.stringify({ success: true, sent: 0, message: 'No pending emails' }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Send emails
    const results = await Promise.allSettled(
      pendingEmails.map(email => sendEmail(supabase, email as EmailNotification))
    );

    const successful = results.filter(r => r.status === 'fulfilled').length;
    const failed = results.filter(r => r.status === 'rejected').length;

    return new Response(
      JSON.stringify({
        success: true,
        processed: pendingEmails.length,
        successful,
        failed,
        timestamp: new Date().toISOString(),
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Email notification error:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Internal server error',
        timestamp: new Date().toISOString(),
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
});

async function sendEmail(supabase: SupabaseAdminClient, email: EmailNotification): Promise<void> {
  try {
    if (!RESEND_API_KEY) {
      throw new Error('RESEND_API_KEY not configured');
    }

    // Send via Resend API
    const response = await fetch(RESEND_API_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: FROM_EMAIL,
        to: email.recipient_email,
        subject: email.subject,
        html: formatEmailBody(email.body, email.event_type),
      }),
    });

    if (!response.ok) {
      const errorData = await response.text();
      throw new Error(`Resend API error: ${response.status} - ${errorData}`);
    }

    // Mark as sent
    await supabase
      .from('email_notifications')
      .update({
        sent_at: new Date().toISOString(),
      })
      .eq('id', email.id);
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Unknown error';
    console.error(`Failed to send email ${email.id}:`, error);

    // Log error
    await supabase
      .from('email_notifications')
      .update({
        error_message: errorMsg,
        sent_at: new Date().toISOString(), // Mark as "sent" to stop retries
      })
      .eq('id', email.id);
  }
}

function formatEmailBody(body: string, eventType: string): string {
  const colors = {
    quota_warning: '#FFA500',
    quota_exceeded: '#FF4444',
    rate_limit_warning: '#FF8800',
    suspicious_activity: '#FF0000',
  };

  const color = colors[eventType as keyof typeof colors] || '#0052FF';

  return `
    <html>
      <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; color: #333; line-height: 1.6;">
        <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="border-left: 4px solid ${color}; padding-left: 16px; margin-bottom: 20px;">
            <p style="margin: 0; font-size: 16px; font-weight: 600;">${body}</p>
          </div>
          <div style="background: #f5f5f5; padding: 16px; border-radius: 8px; margin: 20px 0;">
            <p style="margin: 0; font-size: 14px; color: #666;">
              This is an automated alert from RealSyncDynamics.AI. Please review your API usage and quota settings in your dashboard.
            </p>
          </div>
          <div style="text-align: center; padding-top: 20px; border-top: 1px solid #eee;">
            <a href="https://realsyncdynamics-ai.de/app/api" style="color: #0052FF; text-decoration: none; font-weight: 600;">
              View API Dashboard
            </a>
          </div>
        </div>
      </body>
    </html>
  `;
}
