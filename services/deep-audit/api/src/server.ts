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
  // SSRF guard. The worker runs inside the audit-net Docker network and
  // can reach `redis`, `postgres`, cloud-provider link-local metadata
  // and any RFC1918 range a caller chooses to point at. Block those
  // before they hit the queue. Tenant-scoped auth on the endpoint is
  // the complementary defense — follow-up PR.
  let hostname: string;
  try { hostname = new URL(url).hostname; }
  catch { return reply.code(400).send({ error: { code: 'INVALID_URL', message: 'unparsable url' } }); }
  if (isPrivateOrInternalHost(hostname)) {
    return reply.code(400).send({
      error: {
        code:    'FORBIDDEN_TARGET',
        message: 'Private, loopback, link-local and unqualified internal hostnames are not scannable.',
      },
    });
  }

  const job = await scanQueue.add('scan-job', { url, email, tenant_id }, {
    removeOnComplete: { count: 1000 },
    removeOnFail:     { count: 1000 },
  });
  return { success: true, job_id: job.id };
});

/**
 * True if the hostname is a non-public destination: loopback, link-
 * local, RFC1918 / RFC4193 private space, CGN, multicast, or an
 * unqualified single-label name (which Docker resolves to a network-
 * internal service like `redis` / `postgres` / `worker`).
 *
 * Exported for unit tests.
 */
export function isPrivateOrInternalHost(hostname: string): boolean {
  if (!hostname) return true;
  const h = hostname.toLowerCase().replace(/\.$/, '');

  if (h === 'localhost' || h.endsWith('.localhost')) return true;
  if (h === '0.0.0.0') return true;

  // Unqualified single-label hostname (e.g. `redis`, `postgres`).
  // Docker service-name resolution targets here. Public hostnames
  // always have at least one dot.
  const isIPv6 = h.includes(':');
  if (!isIPv6 && !h.includes('.')) return true;

  // IPv4 literal
  const m = h.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (m) {
    const [a, b, c, d] = m.slice(1).map(Number);
    if ([a, b, c, d].some((n) => n < 0 || n > 255)) return true;
    if (a === 0)   return true;                                // 0.0.0.0/8
    if (a === 10)  return true;                                // 10.0.0.0/8
    if (a === 127) return true;                                // 127.0.0.0/8 loopback
    if (a === 169 && b === 254) return true;                   // 169.254.0.0/16 link-local + AWS metadata
    if (a === 172 && b >= 16 && b <= 31) return true;          // 172.16.0.0/12
    if (a === 192 && b === 168) return true;                   // 192.168.0.0/16
    if (a === 100 && b >= 64 && b <= 127) return true;         // 100.64.0.0/10 CGN
    if (a >= 224)  return true;                                // multicast / reserved
    return false;
  }

  // IPv6 literal
  if (isIPv6) {
    if (h === '::1' || h === '::') return true;                              // loopback / unspecified
    if (h.startsWith('fe80:') || h.startsWith('fe9') || h.startsWith('fea') || h.startsWith('feb')) return true; // link-local fe80::/10
    if (h.startsWith('fc') || h.startsWith('fd')) return true;               // ULA fc00::/7
    if (h.startsWith('ff'))  return true;                                    // multicast ff00::/8
    return false;
  }

  return false;
}

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
