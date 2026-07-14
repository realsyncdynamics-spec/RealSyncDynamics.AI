import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4';

interface NotificationEvent {
  userId: string;
  tenantId: string;
  eventType: 'member_invited' | 'approval_pending' | 'approval_approved' | 'approval_rejected' | 'member_joined';
  email: string;
  data: Record<string, unknown>;
}

const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
const sendgridApiKey = Deno.env.get('SENDGRID_API_KEY') || '';

const supabase = createClient(supabaseUrl, supabaseServiceKey);

const EMAIL_TEMPLATES: Record<string, { subject: string; template: string }> = {
  member_invited: {
    subject: 'Du bist eingeladen — RealSync Dynamics Terminal Session',
    template: 'member-invited.html',
  },
  approval_pending: {
    subject: 'Action erforderlich: Audit wartet auf Genehmigung',
    template: 'approval-pending.html',
  },
  approval_approved: {
    subject: 'Dein Audit wurde genehmigt ✓',
    template: 'approval-approved.html',
  },
  approval_rejected: {
    subject: 'Dein Audit wurde abgelehnt',
    template: 'approval-rejected.html',
  },
  member_joined: {
    subject: 'Neues Teamitglied beigetreten',
    template: 'member-joined.html',
  },
};

async function getNotificationPreferences(userId: string, tenantId: string) {
  const { data, error } = await supabase
    .from('notification_preferences')
    .select('*')
    .eq('user_id', userId)
    .eq('tenant_id', tenantId)
    .single();

  if (error) {
    console.error('Error fetching notification preferences:', error);
    return null;
  }
  return data;
}

function shouldSendNotification(
  eventType: string,
  preferences: Record<string, unknown>
): boolean {
  const preferenceMap: Record<string, string> = {
    member_invited: 'email_on_invite',
    approval_pending: 'email_on_approval_pending',
    approval_approved: 'email_on_approval_action',
    approval_rejected: 'email_on_approval_action',
    member_joined: 'email_on_member_join',
  };

  const prefKey = preferenceMap[eventType];
  return prefKey && preferences[prefKey] === true;
}

async function sendEmail(
  to: string,
  subject: string,
  htmlContent: string
): Promise<boolean> {
  try {
    const response = await fetch('https://api.sendgrid.com/v3/mail/send', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${sendgridApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        personalizations: [
          {
            to: [{ email: to }],
            subject,
          },
        ],
        from: {
          email: 'noreply@realsyncdynamics.ai',
          name: 'RealSync Dynamics',
        },
        content: [
          {
            type: 'text/html',
            value: htmlContent,
          },
        ],
      }),
    });

    return response.ok;
  } catch (error) {
    console.error('Error sending email via SendGrid:', error);
    return false;
  }
}

function renderEmailTemplate(
  templateName: string,
  data: Record<string, unknown>
): string {
  // HTML email templates (simplified for now, can be expanded)
  const templates: Record<string, string> = {
    'member-invited.html': `
      <h2>Du bist eingeladen!</h2>
      <p>Du wurdest eingeladen, an einer Terminal-Session beizutreten als <strong>${data.role}</strong>.</p>
      <p>Session: <code>${data.sessionId}</code></p>
      <p><a href="${data.acceptLink}" style="background: #06B6D4; color: white; padding: 10px 20px; text-decoration: none; border-radius: 6px; display: inline-block;">Session akzeptieren</a></p>
    `,
    'approval-pending.html': `
      <h2>Action erforderlich!</h2>
      <p>Ein Audit erwartet Ihre Genehmigung.</p>
      <p>Audit: <code>${data.auditId}</code></p>
      <p>Angefordert von: <strong>${data.requestedBy}</strong></p>
      <p><a href="${data.approvalLink}" style="background: #06B6D4; color: white; padding: 10px 20px; text-decoration: none; border-radius: 6px; display: inline-block;">Zur Genehmigung</a></p>
    `,
    'approval-approved.html': `
      <h2>Genehmigt ✓</h2>
      <p>Ihr Audit wurde genehmigt.</p>
      <p>Audit: <code>${data.auditId}</code></p>
      <p>Genehmigt von: <strong>${data.approvedBy}</strong></p>
    `,
    'approval-rejected.html': `
      <h2>Abgelehnt</h2>
      <p>Ihr Audit wurde abgelehnt.</p>
      <p>Audit: <code>${data.auditId}</code></p>
      <p>Grund: <em>${data.reason || 'Keine Begründung angegeben'}</em></p>
    `,
    'member-joined.html': `
      <h2>Neues Teamitglied</h2>
      <p><strong>${data.memberName}</strong> ist der Session beigetreten.</p>
      <p>Rolle: <strong>${data.role}</strong></p>
    `,
  };

  return templates[templateName] || '<p>Email template not found</p>';
}

async function handleNotificationEvent(event: NotificationEvent): Promise<void> {
  // 1. Get user notification preferences
  const preferences = await getNotificationPreferences(event.userId, event.tenantId);

  if (!preferences) {
    console.log(`No preferences found for user ${event.userId}`);
    return;
  }

  // 2. Check if user wants this notification
  if (!shouldSendNotification(event.eventType, preferences)) {
    console.log(`User ${event.userId} has disabled ${event.eventType} notifications`);
    return;
  }

  // 3. Get email template
  const emailConfig = EMAIL_TEMPLATES[event.eventType];
  if (!emailConfig) {
    console.error(`No email template for event type: ${event.eventType}`);
    return;
  }

  // 4. Render HTML content
  const htmlContent = renderEmailTemplate(emailConfig.template, event.data);

  // 5. Send email
  const sent = await sendEmail(event.email, emailConfig.subject, htmlContent);

  // 6. Log the notification event
  const status = sent ? 'sent' : 'failed';
  await supabase.from('notification_events').insert({
    user_id: event.userId,
    tenant_id: event.tenantId,
    event_type: event.eventType,
    channel: 'email',
    status,
    email_address: event.email,
    sent_at: sent ? new Date().toISOString() : null,
  });

  console.log(`${status} ${event.eventType} notification to ${event.email}`);
}

serve(async (req) => {
  // Health check
  if (req.method === 'GET') {
    return new Response('OK', { status: 200 });
  }

  // Handle notification events
  if (req.method === 'POST') {
    try {
      const body = await req.json();
      const event: NotificationEvent = body;

      // Validate required fields
      if (!event.userId || !event.tenantId || !event.eventType || !event.email) {
        return new Response('Missing required fields', { status: 400 });
      }

      await handleNotificationEvent(event);

      return new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    } catch (error) {
      console.error('Error handling notification event:', error);
      return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }
  }

  return new Response('Method not allowed', { status: 405 });
});
