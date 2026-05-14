import { Worker, type Job } from 'bullmq';
import IORedis from 'ioredis';
import path from 'node:path';
import fs from 'node:fs/promises';
import { runScan, type ScanResult } from './scanner/scan.js';

const REDIS_HOST = process.env.REDIS_HOST ?? 'redis';
const REDIS_PORT = Number(process.env.REDIS_PORT ?? 6379);

const SCREENSHOTS_DIR = process.env.SCREENSHOTS_DIR ?? '/app/screenshots';
const REPORTS_DIR = process.env.REPORTS_DIR ?? '/app/reports';

await fs.mkdir(SCREENSHOTS_DIR, { recursive: true }).catch(() => undefined);
await fs.mkdir(REPORTS_DIR,    { recursive: true }).catch(() => undefined);

const connection = new IORedis({
  host: REDIS_HOST,
  port: REDIS_PORT,
  maxRetriesPerRequest: null,
});

interface ScanJobData {
  url: string;
  email?: string;
  tenant_id?: string;
}

const worker = new Worker<ScanJobData, ScanResult>(
  'gdpr-scan',
  async (job: Job<ScanJobData>) => {
    const id = job.id ?? Date.now().toString();
    const screenshotPath = path.join(SCREENSHOTS_DIR, `${id}.png`);

    job.log(`scanning ${job.data.url}`).catch(() => undefined);

    const result = await runScan({
      url: job.data.url,
      screenshotPath,
    });

    // Persist a JSON copy of the result alongside the screenshot. The
    // API server can read this if it wants to re-score the scan later
    // without re-running Playwright.
    await fs.writeFile(
      path.join(REPORTS_DIR, `${id}.json`),
      JSON.stringify({ job_id: id, ...job.data, ...result }, null, 2),
      'utf-8',
    ).catch(() => undefined);

    return result;
  },
  { connection, concurrency: 2 },
);

worker.on('completed', (job) => {
  // eslint-disable-next-line no-console
  console.log(`[worker] job ${job.id} completed: ${job.data.url}`);
});

worker.on('failed', (job, err) => {
  // eslint-disable-next-line no-console
  console.error(`[worker] job ${job?.id} failed:`, err.message);
});

// eslint-disable-next-line no-console
console.log(`[worker] gdpr-scan worker online (redis=${REDIS_HOST}:${REDIS_PORT})`);
