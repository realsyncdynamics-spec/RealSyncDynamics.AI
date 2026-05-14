import Fastify from 'fastify';
import { Queue } from 'bullmq';
import IORedis from 'ioredis';
import { Pool } from 'pg';
import { calculateRisk, type ScanResult } from './risk-engine/rules.js';

const REDIS_HOST = process.env.REDIS_HOST ?? 'redis';
const REDIS_PORT = Number(process.env.REDIS_PORT ?? 6379);
const POSTGRES_URL = process.env.POSTGRES_URL ?? '';

const app = Fastify({ logger: true });

const connection = new IORedis({ host: REDIS_HOST, port: REDIS_PORT, maxRetriesPerRequest: null });
const scanQueue = new Queue('gdpr-scan', { connection });
const pg = POSTGRES_URL ? new Pool({ connectionString: POSTGRES_URL }) : null;

interface ScanRequestBody {
  url?: string;
  email?: string;
  tenant_id?: string;
}

// ── Routes ──────────────────────────────────────────────────────────────

app.get('/health', async () => ({
  ok: true,
  redis: REDIS_HOST,
  postgres: pg ? 'connected' : 'disabled',
}));

/** Queue a new deep scan. Returns a job id; clients poll /scan/:id. */
app.post<{ Body: ScanRequestBody }>('/scan', async (req, reply) => {
  const { url, email, tenant_id } = req.body ?? {};
  if (!url || typeof url !== 'string' || !/^https?:\/\//i.test(url)) {
    return reply.code(400).send({ error: { code: 'INVALID_URL', message: 'valid http(s) URL required' } });
  }
  const job = await scanQueue.add('scan-job', { url, email, tenant_id }, {
    removeOnComplete: { count: 1000 },
    removeOnFail:     { count: 1000 },
  });
  return { success: true, job_id: job.id };
});

/** Retrieve a queued/processing/completed scan by id. */
app.get<{ Params: { id: string } }>('/scan/:id', async (req, reply) => {
  const job = await scanQueue.getJob(req.params.id);
  if (!job) return reply.code(404).send({ error: { code: 'NOT_FOUND', message: 'no such job' } });
  const state = await job.getState();
  return {
    id: job.id,
    state,
    data: job.data,
    result: job.returnvalue ?? null,
    failed_reason: job.failedReason ?? null,
  };
});

/** Score a previously recorded scan result without queueing. Useful for
 *  re-classifying historical data when the risk-engine rules change. */
app.post<{ Body: { scan: ScanResult } }>('/score', async (req, reply) => {
  const scan = req.body?.scan;
  if (!scan || !Array.isArray(scan.requests)) {
    return reply.code(400).send({ error: { code: 'INVALID_BODY', message: 'scan with requests[] required' } });
  }
  return calculateRisk(scan);
});

// ── Boot ────────────────────────────────────────────────────────────────

const PORT = Number(process.env.PORT ?? 3000);
app.listen({ port: PORT, host: '0.0.0.0' })
  .then(() => app.log.info(`gdpr-audit-api listening on :${PORT}`))
  .catch((err) => {
    app.log.error(err);
    process.exit(1);
  });
