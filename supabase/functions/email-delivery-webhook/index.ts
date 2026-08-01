/**
 * Email Delivery Webhook Handler
 *
 * Receives webhook events from email service providers (SendGrid, Mailgun, AWS SES)
 * and logs delivery/bounce/complaint events to email_delivery_events table.
 *
 * Supports:
 * - SendGrid Event Webhook (POST /email-delivery-webhook/sendgrid)
 * - Mailgun Webhooks (POST /email-delivery-webhook/mailgun)
 * - AWS SES SNS (POST /email-delivery-webhook/ses)
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

interface WebhookRequest {
  provider: "sendgrid" | "mailgun" | "ses";
  rawBody: string;
  signature?: string;
}

async function verifySendGridSignature(
  body: string,
  signature: string,
  timestamp: string
): Promise<boolean> {
  // SendGrid signature verification (HMAC-SHA256)
  const webhookSigningKey = Deno.env.get("SENDGRID_WEBHOOK_KEY") || "";
  if (!webhookSigningKey) return true; // Skip if not configured

  const signed_content = `${timestamp}${body}`;
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(webhookSigningKey),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );

  const signed = await crypto.subtle.sign(
    "HMAC",
    key,
    encoder.encode(signed_content)
  );

  const expectedSignature = btoa(String.fromCharCode(...new Uint8Array(signed)));
  return signature === expectedSignature;
}

async function processSendGridEvent(event: Record<string, unknown>): Promise<void> {
  const externalId = event.sg_message_id as string;
  const eventType = event.event as string;
  const recipient = event.email as string;

  let mappedEventType = eventType;
  let bounceType: string | undefined;
  let bounceReason: string | undefined;

  if (eventType === "bounce") {
    bounceType = event.type === "permanent" ? "permanent" : "temporary";
    bounceReason = event.reason as string;
    mappedEventType = "bounce";
  } else if (eventType === "complaint" || eventType === "spamreport") {
    mappedEventType = "complaint";
  } else if (eventType === "delivered") {
    mappedEventType = "delivered";
  } else if (eventType === "open") {
    mappedEventType = "open";
  } else if (eventType === "click") {
    mappedEventType = "click";
  } else if (eventType === "unsubscribe") {
    mappedEventType = "unsubscribe";
  } else if (eventType === "deferred") {
    mappedEventType = "deferred";
  }

  await supabase.rpc("process_email_delivery_event", {
    p_external_id: externalId,
    p_recipient: recipient,
    p_event_type: mappedEventType,
    p_email_provider: "sendgrid",
    p_bounce_type: bounceType,
    p_raw_event: event,
  });
}

async function processMailgunEvent(event: Record<string, unknown>): Promise<void> {
  const externalId = event["message-id"] as string;
  const eventType = event.event as string;
  const recipient = event.recipient as string;

  let mappedEventType = eventType;
  let bounceType: string | undefined;
  let bounceReason: string | undefined;

  if (eventType === "failed") {
    bounceType = event.severity === "permanent" ? "permanent" : "temporary";
    bounceReason = event.description as string;
    mappedEventType = "bounce";
  } else if (eventType === "complained") {
    mappedEventType = "complaint";
  } else if (eventType === "delivered") {
    mappedEventType = "delivered";
  } else if (eventType === "opened") {
    mappedEventType = "open";
  } else if (eventType === "clicked") {
    mappedEventType = "click";
  } else if (eventType === "unsubscribed") {
    mappedEventType = "unsubscribe";
  } else if (eventType === "deferred") {
    mappedEventType = "deferred";
  }

  await supabase.rpc("process_email_delivery_event", {
    p_external_id: externalId,
    p_recipient: recipient,
    p_event_type: mappedEventType,
    p_email_provider: "mailgun",
    p_bounce_type: bounceType,
    p_raw_event: event,
  });
}

async function processSESEvent(event: Record<string, unknown>): Promise<void> {
  const sns = event;
  const message = JSON.parse(sns["Message"] as string);
  const eventType = message.eventType as string;

  if (eventType === "Bounce") {
    const bounceSubType = (message.bounce.bounceType as string).toLowerCase();
    const recipients = message.bounce.bouncedRecipients as Array<{
      emailAddress: string;
      status: string;
    }>;

    for (const recipient of recipients) {
      await supabase.rpc("process_email_delivery_event", {
        p_external_id: message.mail.messageId,
        p_recipient: recipient.emailAddress,
        p_event_type: "bounce",
        p_email_provider: "ses",
        p_bounce_type: bounceSubType === "permanent" ? "permanent" : "temporary",
        p_raw_event: message,
      });
    }
  } else if (eventType === "Complaint") {
    const recipients = message.complaint.complainedRecipients as Array<{
      emailAddress: string;
    }>;

    for (const recipient of recipients) {
      await supabase.rpc("process_email_delivery_event", {
        p_external_id: message.mail.messageId,
        p_recipient: recipient.emailAddress,
        p_event_type: "complaint",
        p_email_provider: "ses",
        p_raw_event: message,
      });
    }
  } else if (eventType === "Delivery") {
    const recipients = message.delivery.recipients as string[];
    for (const recipient of recipients) {
      await supabase.rpc("process_email_delivery_event", {
        p_external_id: message.mail.messageId,
        p_recipient: recipient,
        p_event_type: "delivered",
        p_email_provider: "ses",
        p_raw_event: message,
      });
    }
  } else if (eventType === "Open") {
    await supabase.rpc("process_email_delivery_event", {
      p_external_id: message.mail.messageId,
      p_recipient: message.open.userAgent ? "unknown" : "unknown",
      p_event_type: "open",
      p_email_provider: "ses",
      p_raw_event: message,
    });
  } else if (eventType === "Click") {
    await supabase.rpc("process_email_delivery_event", {
      p_external_id: message.mail.messageId,
      p_recipient: "unknown",
      p_event_type: "click",
      p_email_provider: "ses",
      p_raw_event: message,
    });
  }
}

async function handleRequest(req: Request): Promise<Response> {
  try {
    // Route based on path
    const url = new URL(req.url);
    const path = url.pathname;

    if (req.method !== "POST") {
      return new Response(JSON.stringify({ error: "POST only" }), { status: 405 });
    }

    const rawBody = await req.text();

    if (path.includes("/sendgrid")) {
      const events = JSON.parse(rawBody) as Array<Record<string, unknown>>;
      const signature = req.headers.get("X-Twilio-Email-Event-Webhook-Signature");
      const timestamp = req.headers.get("X-Twilio-Email-Event-Webhook-Timestamp");

      if (signature && timestamp) {
        const isValid = await verifySendGridSignature(rawBody, signature, timestamp);
        if (!isValid) {
          return new Response(JSON.stringify({ error: "Invalid signature" }), { status: 403 });
        }
      }

      for (const event of events) {
        await processSendGridEvent(event);
      }

      return new Response(JSON.stringify({ status: "received" }), { status: 200 });
    } else if (path.includes("/mailgun")) {
      const event = JSON.parse(rawBody) as Record<string, unknown>;
      await processMailgunEvent(event);
      return new Response(JSON.stringify({ status: "received" }), { status: 200 });
    } else if (path.includes("/ses")) {
      const event = JSON.parse(rawBody) as Record<string, unknown>;
      await processSESEvent(event);
      return new Response(JSON.stringify({ status: "received" }), { status: 200 });
    } else {
      return new Response(JSON.stringify({ error: "Unknown provider" }), { status: 400 });
    }
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    console.error("Webhook processing error:", errorMsg);
    return new Response(JSON.stringify({ error: errorMsg }), { status: 500 });
  }
}

Deno.serve(handleRequest);
