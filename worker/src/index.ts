/**
 * RealSync Audit Worker — main loop.
 *
 * Hört auf Postgres-LISTEN/NOTIFY-Channel `audit_job_queued`, claimed Jobs
 * via FOR UPDATE SKIP LOCKED, führt Real-Browser-Audit aus, persistiert
 * Findings + Evidence, marked Job complete.
 *
 * Status: Scaffold. Aktivierung siehe worker/README.md.
 */
import { Client } from 'pg';
import { createClient } from '@supabase/supabase-js';
import { runAudit } from './crawler';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const DATABASE_URL = process.env.DATABASE_URL || process.env.SUPABASE_DB_URL;
const WORKER_ID = process.env.WORKER_ID || `worker-${Math.random().toString(36).slice(2, 8)}`;
const POLL_INTERVAL_MS = Number(process.env.POLL_INTERVAL_MS || 5000);

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY || !DATABASE_URL) {
  console.error('[worker] Missing required env: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, DATABASE_URL');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

interface ClaimedJob {
  id: string;
  tenant_id: string;
  domain: string;
  scan_options: Record<string, unknown>;
  attempts: number;
}

async function processNextJob(pgClient: Client): Promise<boolean> {
  // Atomic claim via DB-RPC
  const { data, error } = await supabase.rpc('audit_jobs_claim_next', { p_worker_id: WORKER_ID });
  if (error) {
    console.error('[worker] claim_next failed:', error.message);
    return false;
  }
  const job: ClaimedJob | undefined = Array.isArray(data) && data.length > 0 ? data[0] : undefined;
  if (!job) {
    return false; // queue leer
  }

  console.log(`[worker] picked up job ${job.id} for ${job.domain} (attempt ${job.attempts})`);

  try {
    const result = await runAudit({
      jobId: job.id,
      tenantId: job.tenant_id,
      domain: job.domain,
      options: job.scan_options,
      supabase,
    });

    await supabase.rpc('audit_jobs_complete', {
      p_job_id: job.id,
      p_status: 'success',
      p_audit_id: result.audit_id,
      p_summary: {
        score: result.score,
        finding_count: result.findings.length,
        methodology_version: result.methodology_version,
      },
    });

    console.log(`[worker] job ${job.id} success — score ${result.score}, ${result.findings.length} findings`);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[worker] job ${job.id} failed:`, message);
    await supabase.rpc('audit_jobs_complete', {
      p_job_id: job.id,
      p_status: 'failed',
      p_error: message,
    });
  }

  return true;
}

async function main() {
  console.log(`[worker] starting as ${WORKER_ID}`);

  // Postgres LISTEN für Push-Wake-Ups
  const pgClient = new Client({ connectionString: DATABASE_URL });
  await pgClient.connect();
  await pgClient.query('LISTEN audit_job_queued');
  console.log('[worker] listening on channel audit_job_queued');

  let processing = false;
  const drainQueue = async () => {
    if (processing) return;
    processing = true;
    try {
      // Drain alle wartenden Jobs
      while (await processNextJob(pgClient)) {
        // empty body — loop solange Jobs anliegen
      }
    } finally {
      processing = false;
    }
  };

  pgClient.on('notification', (msg) => {
    if (msg.channel === 'audit_job_queued') {
      void drainQueue();
    }
  });

  pgClient.on('error', (err) => {
    console.error('[worker] pg client error:', err.message);
    process.exit(1); // Container restart
  });

  // Polling-Fallback: alle POLL_INTERVAL_MS sicherheitshalber draninieren
  setInterval(() => void drainQueue(), POLL_INTERVAL_MS);

  // Initial drain (Jobs die schon vor Worker-Start in Queue waren)
  void drainQueue();
}

void main().catch((err) => {
  console.error('[worker] fatal error:', err);
  process.exit(1);
});
