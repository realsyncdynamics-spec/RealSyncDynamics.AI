// Post generator. Combines template + policy + final wrap.
//
// For a given (SocialEvent, SocialChannel), the generator produces
// a SocialPost whose:
//   - body is the channel template with the event-specific hook + the
//     hashtag block,
//   - approvalStatus is the strict combination of the SocialEvent's
//     own status and any post-body language failures.
//
// Pure: no I/O, no async.

import type { SocialEvent, SocialChannel, SocialPost } from './types';
import {
  renderTemplate,
  CHANNEL_CHAR_BUDGET,
} from './postTemplates';
import { checkPostBodyForForbiddenLanguage } from './contentPolicy';

let postCounter = 0;
function nextPostId(): string {
  // Deterministic-ish id for same-process runs; sufficient for in-memory queue.
  postCounter += 1;
  return `post_${Date.now().toString(36)}_${postCounter.toString(36)}`;
}

export function generatePost(event: SocialEvent, channel: SocialChannel): SocialPost {
  const tmpl = renderTemplate(channel, event);
  const blockReasons: string[] = [];

  // Sanity-check the body for forbidden language. If a template
  // accidentally introduced "garantiert DSGVO-konform" or similar,
  // BLOCK rather than publish.
  const langHits = checkPostBodyForForbiddenLanguage(tmpl.body);
  if (langHits.length > 0) {
    blockReasons.push(...langHits.map(h => `forbidden_phrase:${h}`));
  }

  // Build the final body: hook + (hashtag block on a new line).
  const hashtagBlock = tmpl.hashtags.length > 0 ? '\n\n' + tmpl.hashtags.join(' ') : '';
  let body = (tmpl.body + hashtagBlock).trim();

  // Hard char-budget per channel. If exceeded, clip the body, leave
  // the hashtag block intact, and flag REVIEW (clipping a generated
  // post is a legitimate operator concern, not silent truncation).
  const budget = CHANNEL_CHAR_BUDGET[channel];
  if (body.length > budget) {
    const overrun = body.length - budget;
    blockReasons.push(`char_budget_exceeded:${overrun}`);
    // Try to clip from the body-prefix portion only.
    const ellipsis = ' …';
    const allowance = Math.max(0, budget - hashtagBlock.length - ellipsis.length);
    body = (tmpl.body.slice(0, allowance).trim() + ellipsis + hashtagBlock).trim();
  }

  // Final approval is the intersection of the event's status and any
  // body-level finding. Strictest wins:
  //   BLOCKED > REVIEW > AUTO
  let approvalStatus = event.approvalStatus;
  if (blockReasons.some(r => r.startsWith('forbidden_phrase:'))) {
    approvalStatus = 'BLOCKED';
  } else if (blockReasons.length > 0 && approvalStatus === 'AUTO') {
    // char-budget overrun on its own demotes AUTO to REVIEW
    approvalStatus = 'REVIEW';
  }

  return {
    id: nextPostId(),
    socialEventId: event.id,
    channel,
    approvalStatus,
    body,
    hashtags: tmpl.hashtags,
    charCount: body.length,
    generatedAt: new Date().toISOString(),
    blockReasons: blockReasons.length > 0 ? blockReasons : undefined,
  };
}

/** Generate posts for an explicit set of channels. Convenience wrapper. */
export function generatePostsForChannels(
  event: SocialEvent,
  channels: SocialChannel[],
): SocialPost[] {
  return channels.map(ch => generatePost(event, ch));
}
