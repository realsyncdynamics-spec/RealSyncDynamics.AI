// Admin Social Preview — localStorage-backed snapshot of the orchestrator's
// in-memory queue, plus a thin facade for approve / reject / publish.
//
// The orchestrator (src/core/social-orchestrator/) keeps its queue in
// memory per-process. In the SPA that means per-tab, lost on reload.
// For the admin UI we want survival across reloads, so this module
// serialises the queue entries to localStorage on every mutation and
// reloads them on construction. The orchestrator itself stays the
// source-of-truth for new entries; this module is just persistence.

import {
  SocialOrchestrator,
} from '../../../core/social-orchestrator/socialOrchestrator';
import { DistributionQueue, MockPublisher } from '../../../core/social-orchestrator/distributionQueue';
import type {
  RuntimeEvent,
  QueueEntry,
  SocialChannel,
  OrchestrationResult,
  ApprovalStatus,
} from '../../../core/social-orchestrator/types';
import { ALL_CHANNELS } from '../../../core/social-orchestrator/types';

const STORAGE_KEY = 'rsd:admin-social:queue:v1';

// ── localStorage helpers ───────────────────────────────────────────

function loadFromStorage(): QueueEntry[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as QueueEntry[]) : [];
  } catch {
    return [];
  }
}

function saveToStorage(entries: QueueEntry[]): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
  } catch {
    /* quota or disabled storage — silent */
  }
}

// ── Public API ─────────────────────────────────────────────────────

/**
 * The admin module keeps one shared orchestrator instance per tab.
 * `getSnapshot()` always reflects the union of "what's in memory" and
 * "what was persisted to localStorage" — they are kept in sync on
 * every mutation.
 */
class AdminSocialStore {
  private orch: SocialOrchestrator;
  private queue: DistributionQueue;
  private entries: QueueEntry[];

  constructor() {
    this.queue = new DistributionQueue();
    // Register a MockPublisher for every channel so `publish()` works
    // in the admin preview. Real publishers ship in follow-up PRs.
    for (const ch of ALL_CHANNELS) {
      this.queue.registerPublisher(new MockPublisher(ch));
    }
    this.orch = new SocialOrchestrator({ queue: this.queue });
    // Re-hydrate from localStorage (NOT into the queue's internal
    // state — only into our `entries` snapshot, since approve/reject
    // operate on the snapshot).
    this.entries = loadFromStorage();
  }

  getSnapshot(): QueueEntry[] {
    return [...this.entries];
  }

  /** Submit a runtime event, generate posts, persist the resulting
   *  queue entries. Returns the full OrchestrationResult so the UI
   *  can render the SocialEvent + per-channel posts. */
  async submitEvent(event: RuntimeEvent): Promise<OrchestrationResult> {
    const result = await this.orch.process(event);
    // Append fresh entries to our snapshot (BLOCKED ones don't get
    // queue entries so this naturally excludes them).
    this.entries = [...this.entries, ...result.queueEntries];
    saveToStorage(this.entries);
    return result;
  }

  approve(queueId: string, reviewer: string): QueueEntry | null {
    const i = this.entries.findIndex(e => e.id === queueId);
    if (i < 0) return null;
    const e = this.entries[i]!;
    if (e.status !== 'pending') return e;
    const updated: QueueEntry = {
      ...e,
      status: 'approved',
      decidedAt: new Date().toISOString(),
      reviewer,
    };
    this.entries = [
      ...this.entries.slice(0, i),
      updated,
      ...this.entries.slice(i + 1),
    ];
    saveToStorage(this.entries);
    return updated;
  }

  reject(queueId: string, reviewer: string): QueueEntry | null {
    const i = this.entries.findIndex(e => e.id === queueId);
    if (i < 0) return null;
    const e = this.entries[i]!;
    if (e.status !== 'pending') return e;
    const updated: QueueEntry = {
      ...e,
      status: 'rejected',
      decidedAt: new Date().toISOString(),
      reviewer,
    };
    this.entries = [
      ...this.entries.slice(0, i),
      updated,
      ...this.entries.slice(i + 1),
    ];
    saveToStorage(this.entries);
    return updated;
  }

  /** Mark an approved / auto entry as published (against the
   *  MockPublisher). Returns the updated entry. */
  async publish(queueId: string): Promise<QueueEntry | null> {
    const e = this.entries.find(x => x.id === queueId);
    if (!e) return null;
    if (e.status !== 'approved' && e.status !== 'auto') return e;
    // Use the MockPublisher path — write a synthetic publish result.
    const result = {
      ok: true as const,
      channel: e.post.channel,
      externalId: `mock_${Date.now()}`,
      postedAt: new Date().toISOString(),
    };
    const updated: QueueEntry = {
      ...e,
      status: 'published',
      publishedAt: result.postedAt,
      publishResult: result,
    };
    const i = this.entries.findIndex(x => x.id === queueId);
    this.entries = [
      ...this.entries.slice(0, i),
      updated,
      ...this.entries.slice(i + 1),
    ];
    saveToStorage(this.entries);
    return updated;
  }

  clearAll(): void {
    this.entries = [];
    saveToStorage(this.entries);
  }
}

// ── Module-level singleton ─────────────────────────────────────────

let _store: AdminSocialStore | null = null;

export function getAdminSocialStore(): AdminSocialStore {
  if (!_store) _store = new AdminSocialStore();
  return _store;
}

export function __resetAdminSocialStoreForTests(): void {
  _store = null;
  if (typeof window !== 'undefined') {
    try { window.localStorage.removeItem(STORAGE_KEY); } catch { /* noop */ }
  }
}

// ── Convenience labels for the UI ──────────────────────────────────

export const STATUS_LABEL: Record<QueueEntry['status'], string> = {
  pending:   'Review erforderlich',
  approved:  'Freigegeben',
  rejected:  'Abgelehnt',
  auto:      'Auto-Publish',
  published: 'Gepostet',
  failed:    'Fehlgeschlagen',
};

export const APPROVAL_LABEL: Record<ApprovalStatus, string> = {
  AUTO:    'Auto-Publish',
  REVIEW:  'Review erforderlich',
  BLOCKED: 'Blockiert',
};

export const CHANNEL_LABEL: Record<SocialChannel, string> = {
  'linkedin.enterprise': 'LinkedIn · Enterprise',
  'linkedin.legal':      'LinkedIn · Legal',
  'instagram.reel':      'Instagram · Reel',
  'tiktok.fast':         'TikTok · Fast',
  'x.alert':             'X · Alert',
  'wordpress.blog':      'WordPress · Blog',
  'ghost.blog':          'Ghost · Blog',
  'webhook.custom':      'Webhook · Custom',
  'email.newsletter':    'Email · Newsletter',
};

export type { QueueEntry, SocialChannel, RuntimeEvent, OrchestrationResult };
