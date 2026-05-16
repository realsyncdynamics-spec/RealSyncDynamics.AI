// Social Orchestrator — top-level entry point.
//
// Wires the pipeline together:
//   RuntimeEvent
//     → eventNormalizer.normalize          → SocialEvent
//     → contentPolicy.decideForSocialEvent → final approvalStatus
//     → postGenerator.generatePost (per channel) → SocialPost[]
//     → distributionQueue.enqueueMany       → QueueEntry[]
//
// Returns the full OrchestrationResult so a caller can:
//   - persist or display the SocialEvent (audit trail),
//   - display the generated posts (admin preview UI),
//   - trigger distribution via the queue.

import type {
  RuntimeEvent,
  SocialEvent,
  SocialChannel,
  SocialPost,
  OrchestrationResult,
} from './types';
import { ALL_CHANNELS } from './types';
import { normalize } from './eventNormalizer';
import { decideForSocialEvent } from './contentPolicy';
import { generatePostsForChannels } from './postGenerator';
import { DistributionQueue } from './distributionQueue';

export interface OrchestratorOptions {
  /** Restrict to a subset of channels. Default: all five. */
  channels?: SocialChannel[];
  /** Inject a queue for the orchestrator to enqueue into. If omitted,
   *  the orchestrator creates a fresh in-memory queue per call — useful
   *  for one-shot tests; in production callers SHOULD share a single
   *  queue across calls. */
  queue?: DistributionQueue;
}

export class SocialOrchestrator {
  public readonly queue: DistributionQueue;
  private channels: SocialChannel[];

  constructor(opts: OrchestratorOptions = {}) {
    this.queue = opts.queue ?? new DistributionQueue();
    this.channels = opts.channels ?? [...ALL_CHANNELS];
  }

  /**
   * Process a single runtime event end-to-end. Returns the
   * SocialEvent + generated posts + enqueue results. BLOCKED posts
   * are returned in `posts` for inspection but NOT in `queueEntries`.
   */
  async process(event: RuntimeEvent): Promise<OrchestrationResult> {
    // 1. Normalise to SocialEvent.
    let socialEvent: SocialEvent = await normalize(event);

    // 2. If the normalizer didn't already say BLOCKED, run the
    //    full social-event policy to maybe promote AUTO → REVIEW.
    if (socialEvent.approvalStatus !== 'BLOCKED') {
      const decision = decideForSocialEvent(socialEvent);
      socialEvent = { ...socialEvent, approvalStatus: decision.status };
    }

    // 3. Generate per-channel posts. If the SocialEvent is BLOCKED,
    //    we still produce the post objects (for audit / UI) but the
    //    queue won't accept them.
    const posts: SocialPost[] = generatePostsForChannels(socialEvent, this.channels);

    // 4. Enqueue (BLOCKED posts return null — filtered by queue itself).
    const queueEntries = this.queue.enqueueMany(posts);

    return {
      socialEvent,
      posts,
      queueEntries,
    };
  }

  /**
   * Convenience: process many runtime events in order. Exists because
   * a typical orchestrator caller pulls a batch from the runtime
   * event store.
   */
  async processMany(events: RuntimeEvent[]): Promise<OrchestrationResult[]> {
    const out: OrchestrationResult[] = [];
    for (const e of events) out.push(await this.process(e));
    return out;
  }
}

// ── Default singleton (optional convenience for callers that don't
//    want to thread the orchestrator instance manually) ─────────────

let _default: SocialOrchestrator | null = null;

export function getDefaultOrchestrator(): SocialOrchestrator {
  if (!_default) _default = new SocialOrchestrator();
  return _default;
}

/** Test-only — drops the default singleton so each test gets a fresh queue. */
export function __resetDefaultOrchestratorForTests(): void {
  _default = null;
}
