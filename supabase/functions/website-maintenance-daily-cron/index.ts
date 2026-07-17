// website-maintenance-daily-cron — Scheduled daily maintenance for all live websites
// Cron: 0 2 * * * (Daily at 2 AM UTC)
//
// Triggers: website-maintenance-agent with action='run-daily-maintenance'
// Scans all 'live' websites for: performance, SEO, broken links, security
// Generates AI suggestions for each project

import { createClient } from 'jsr:@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SRK = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const FUNCTIONS_URL = Deno.env.get('SUPABASE_FUNCTIONS_URL') || SUPABASE_URL;

const admin = createClient(SUPABASE_URL, SRK, { auth: { persistSession: false } });

interface CronRequest {
  schedule: string; // Cron expression from Edge Functions
}

Deno.serve(async (req) => {
  // Only accept POST from Supabase
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  try {
    console.log('Starting daily website maintenance...');

    // Call maintenance-agent
    const response = await fetch(`${FUNCTIONS_URL}/functions/v1/website-maintenance-agent`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${SRK}`,
      },
      body: JSON.stringify({
        action: 'run-daily-maintenance',
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error('Maintenance failed:', error);
      return new Response(JSON.stringify({ error: 'Maintenance failed', details: error }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const result = await response.json();

    // Log completion
    console.log(`✓ Maintenance complete: ${result.data?.scanned} projects scanned`);

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Daily maintenance completed',
        data: result.data,
      }),
      {
        headers: { 'Content-Type': 'application/json' },
      }
    );
  } catch (err) {
    console.error('Cron job error:', err);
    return new Response(
      JSON.stringify({
        error: err instanceof Error ? err.message : 'Unknown error',
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
});
