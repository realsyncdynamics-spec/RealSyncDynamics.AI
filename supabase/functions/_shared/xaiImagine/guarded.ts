/**
 * Paid-call coordinator around the EXISTING bot AI budget ledger.
 *
 * No independent billing/tenant table and no unauthenticated endpoint.
 * This module is a library only. The future Edge route must verify tenant,
 * entitlement, consent, PDP and persistent job ownership BEFORE invoking it.
 */
import type { AiBudgetGuard } from '../bot-budget.ts';
import { estimatedProviderUsd, parseImageRequest, parseVideoRequest } from './contract.ts';
import type { ImageResult, VideoResult, XaiImagineTransport } from './client.ts';

export class ImagineBudgetConfigurationError extends Error {
  constructor() { super('server-side xAI budget policy unavailable'); }
}

function validCeiling(quotedMaxUsd: number, estimateUsd: number): number {
  // A deliberately conservative server-side cap with a minimum 2x cushion
  // against the documented base price. This is NOT a price guarantee.
  if (!Number.isFinite(quotedMaxUsd) || quotedMaxUsd <= 0 || quotedMaxUsd > 100 ||
      quotedMaxUsd + 1e-6 < estimateUsd * 2) {
    throw new ImagineBudgetConfigurationError();
  }
  return quotedMaxUsd;
}

async function mustReserve(budget: AiBudgetGuard, maxUsd: number): Promise<string> {
  const reservationId = await budget.reserve(maxUsd);
  if (!reservationId) throw new ImagineBudgetConfigurationError();
  return reservationId;
}

async function settle(budget: AiBudgetGuard, reservationId: string, costUsd: number | null, op: string): Promise<void> {
  const evidence = { provider: 'xai', operation: op };
  if (costUsd === null) {
    await budget.settleUnknown(reservationId, evidence);
  } else {
    await budget.settleMeasured(reservationId, costUsd, evidence);
  }
}

export async function generateImageWithBudget(args: {
  input: unknown;
  /** A reviewed, SERVER-SIDE ceiling, never taken from the request body. */
  quotedMaxUsd: number;
  transport: Pick<XaiImagineTransport, 'generateImage'>;
  budget: AiBudgetGuard;
}): Promise<ImageResult> {
  const input = parseImageRequest(args.input);
  const ceiling = validCeiling(args.quotedMaxUsd, estimatedProviderUsd(input));
  const reservationId = await mustReserve(args.budget, ceiling);
  try {
    const image = await args.transport.generateImage(input);
    await settle(args.budget, reservationId, image.costUsd, 'image');
    return image;
  } catch (error) {
    // Unknown upstream state: provider may already have billed this call.
    await args.budget.settleUnknown(reservationId, { provider: 'xai', operation: 'image', outcome: 'unknown' });
    throw error;
  }
}

export interface VideoJobReceipt {
  requestId: string;
  reservationId: string;
}

/**
 * Durable recording is MANDATORY. A successful xAI start is not returned to
 * the caller until a tenant-scoped durable job has been saved.
 */
export async function startVideoWithBudget(args: {
  input: unknown;
  quotedMaxUsd: number;
  transport: Pick<XaiImagineTransport, 'startVideo'>;
  budget: AiBudgetGuard;
  persistJob: (job: VideoJobReceipt) => Promise<void>;
}): Promise<VideoJobReceipt> {
  const input = parseVideoRequest(args.input);
  const ceiling = validCeiling(args.quotedMaxUsd, estimatedProviderUsd(input));
  const reservationId = await mustReserve(args.budget, ceiling);
  try {
    const { requestId } = await args.transport.startVideo(input);
    const receipt = { requestId, reservationId };
    await args.persistJob(receipt);
    return receipt;
  } catch (error) {
    // A timeout or failed DB insert does not prove the provider did not bill.
    await args.budget.settleUnknown(reservationId, { provider: 'xai', operation: 'video-start', outcome: 'unknown' });
    throw error;
  }
}

/**
 * The caller must load a tenant-owned, persisted job before polling.
 * Settlement is idempotent at the DB layer (bot_usage_settle).
 */
export async function pollVideoWithBudget(args: {
  job: VideoJobReceipt;
  transport: Pick<XaiImagineTransport, 'getVideoStatus'>;
  budget: AiBudgetGuard;
}): Promise<VideoResult> {
  const result = await args.transport.getVideoStatus(args.job.requestId);
  if (result.status === 'done' || result.status === 'failed') {
    await settle(args.budget, args.job.reservationId, result.costUsd, 'video');
  }
  return result;
}
