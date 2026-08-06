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
import { getSupabase, isSupabaseConfigured } from '../../../lib/supabase';

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
  /** True when this store writes to distribution_queue_entries (Postgres)
   *  instead of localStorage. Real publishing then happens server-side in
   *  social-publisher-worker — the browser never holds channel API tokens
   *  (CLAUDE.md §5: "Keine Secrets im Frontend", "Keine Admin-/
   *  Service-Role-Zugriffe aus dem Browser"), so this store only ever
   *  generates and enqueues; it does not publish. */
  readonly isPersisted: boolean;

  constructor(tenantId?: string) {
    this.isPersisted = Boolean(tenantId && isSupabaseConfigured());

    if (this.isPersisted) {
      this.queue = new DistributionQueue({ supabase: getSupabase(), tenantId });
      this.orch = new SocialOrchestrator({ queue: this.queue });
      this.entries = [];
    } else {
      this.queue = new DistributionQueue();
      // Register a MockPublisher for every channel so `publish()` works
      // in the unauthenticated/no-tenant preview.
      for (const ch of ALL_CHANNELS) {
        this.queue.registerPublisher(new MockPublisher(ch));
      }
      this.orch = new SocialOrchestrator({ queue: this.queue });
      // Re-hydrate from localStorage (NOT into the queue's internal
      // state — only into our `entries` snapshot, since approve/reject
      // operate on the snapshot).
      this.entries = loadFromStorage();
    }
  }

  /** Persisted mode only: load existing rows from distribution_queue_entries.
   *  No-op in local/mock mode (already hydrated from localStorage above). */
  async hydrate(): Promise<void> {
    if (!this.isPersisted) return;
    await this.queue.loadFromDatabase();
    this.entries = this.queue.list();
  }

  /** Persisted mode only: refresh the snapshot from Postgres (e.g. after a
   *  realtime notification that social-publisher-worker changed a row). */
  async refreshFromDatabase(): Promise<void> {
    if (!this.isPersisted) return;
    await this.queue.loadFromDatabase();
    this.entries = this.queue.list();
  }

  /** Persisted mode only: subscribe to distribution_queue_entries changes
   *  so publish results from social-publisher-worker show up live. Returns
   *  an unsubscribe function, or null in local/mock mode. */
  subscribeToUpdates(onChange: (entries: QueueEntry[]) => void): (() => void) | null {
    if (!this.isPersisted) return null;
    return this.queue.subscribeToNotifications(() => {
      void this.refreshFromDatabase().then(() => onChange(this.getSnapshot()));
    });
  }

  getSnapshot(): QueueEntry[] {
    return [...this.entries];
  }

  /** Submit a runtime event, generate posts, persist the resulting
   *  queue entries. Returns the full OrchestrationResult so the UI
   *  can render the SocialEvent + per-channel posts. */
  async submitEvent(event: RuntimeEvent): Promise<OrchestrationResult> {
    const result = await this.orch.process(event);
    if (this.isPersisted) {
      // enqueueMany() already awaited the Postgres insert; the queue's
      // own in-memory mirror is authoritative for the snapshot.
      this.entries = this.queue.list();
    } else {
      // Append fresh entries to our snapshot (BLOCKED ones don't get
      // queue entries so this naturally excludes them).
      this.entries = [...this.entries, ...result.queueEntries];
      saveToStorage(this.entries);
    }
    return result;
  }

  async approve(queueId: string, reviewer: string): Promise<QueueEntry | null> {
    if (this.isPersisted) {
      try {
        const updated = await this.queue.approve(queueId, reviewer);
        this.entries = this.queue.list();
        return updated;
      } catch {
        return null;
      }
    }
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

  async reject(queueId: string, reviewer: string): Promise<QueueEntry | null> {
    if (this.isPersisted) {
      try {
        const updated = await this.queue.reject(queueId, reviewer);
        this.entries = this.queue.list();
        return updated;
      } catch {
        return null;
      }
    }
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

  /** Local/mock mode only: mark an approved / auto entry as published
   *  against the MockPublisher. In persisted mode there is nothing to do
   *  here — social-publisher-worker claims and publishes 'auto'/'approved'
   *  rows on its own cron + NOTIFY trigger; the UI reflects that via
   *  subscribeToUpdates()/refreshFromDatabase(), not a button. */
  async publish(queueId: string): Promise<QueueEntry | null> {
    if (this.isPersisted) {
      return this.entries.find(e => e.id === queueId) ?? null;
    }
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
    if (this.isPersisted) return; // queue entries live in Postgres, not bulk-deletable from the admin preview
    this.entries = [];
    saveToStorage(this.entries);
  }
}

// ── Module-level singleton ─────────────────────────────────────────
//
// Keyed by tenantId so switching the active tenant (or logging out)
// gets a fresh store instead of leaking the previous tenant's queue.

let _store: AdminSocialStore | null = null;
let _storeTenantId: string | undefined;

export function getAdminSocialStore(tenantId?: string): AdminSocialStore {
  if (!_store || _storeTenantId !== tenantId) {
    _store = new AdminSocialStore(tenantId);
    _storeTenantId = tenantId;
  }
  return _store;
}

export function __resetAdminSocialStoreForTests(): void {
  _store = null;
  _storeTenantId = undefined;
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
