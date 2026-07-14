import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.0";

/**
 * Seed Pre-Built Integrations
 *
 * Initializes the integrations table with default entries.
 * Called during deployment or tenant setup.
 */

const supabase = createClient(
  Deno.env.get("SUPABASE_URL") || "",
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || ""
);

const INTEGRATIONS = [
  {
    slug: "slack",
    name: "Slack",
    description: "Send compliance alerts to Slack channels",
    auth_type: "oauth2",
    enabled: true,
  },
  {
    slug: "microsoft-teams",
    name: "Microsoft Teams",
    description: "Post notifications to Teams channels",
    auth_type: "oauth2",
    enabled: true,
  },
  {
    slug: "zapier",
    name: "Zapier",
    description: "Connect to 5000+ apps via Zapier",
    auth_type: "api_key",
    enabled: true,
  },
  {
    slug: "n8n",
    name: "n8n",
    description: "Internal workflow automation",
    auth_type: "webhook",
    enabled: true,
  },
  {
    slug: "pagerduty",
    name: "PagerDuty",
    description: "Trigger incidents for critical compliance issues",
    auth_type: "api_key",
    enabled: true,
  },
];

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  try {
    // Upsert integrations
    const { data, error } = await supabase
      .from("integrations")
      .upsert(INTEGRATIONS, { onConflict: "slug" })
      .select();

    if (error) {
      console.error("Error seeding integrations:", error);
      return new Response(
        JSON.stringify({ error: error.message }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }

    console.log(`Seeded ${data?.length || 0} integrations`);

    return new Response(
      JSON.stringify({
        success: true,
        message: `Seeded ${data?.length || 0} integrations`,
        data,
      }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("Unexpected error:", err);
    return new Response(
      JSON.stringify({ error: String(err) }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
});
