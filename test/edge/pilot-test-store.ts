/**
 * In-Memory-Implementierung des Ports `PilotStore`.
 *
 * Bildet genau die Garantien nach, auf die sich `runPilotActivation` verlässt:
 *   - `claimAudit` trifft nur, solange user_id UND tenant_id NULL sind
 *     (entspricht dem UPDATE … WHERE … IS NULL in der Edge Function)
 *   - `upsertWebsite` ist auf (tenant_id, domain) eindeutig
 *     (entspricht unique(tenant_id, domain) auf public.websites)
 *   - `enrollMonitoring` ist auf (tenant_id, url) eindeutig
 *     (entspricht dem Advisory-Lock in pilot_enroll_monitoring_source)
 *   - `createTrial` verschiebt ein vorhandenes Trial-Fenster nicht,
 *     wenn preserveTrialWindow gesetzt ist
 *
 * Ohne diese Nachbildung wären Idempotenz- und Race-Tests nicht aussagekräftig.
 */
import type {
  PilotStore,
  PilotAuditEvent,
  AuditRecord,
} from '../../supabase/functions/_shared/pilot-activation';
import type { SubscriptionRow } from '../../supabase/functions/_shared/pilot';

export const AUDIT_ID = '11111111-2222-4333-8444-555555555555';
export const TENANT_A = 'aaaaaaaa-0000-4000-8000-000000000001';
export const TENANT_B = 'bbbbbbbb-0000-4000-8000-000000000002';
export const USER_A = 'cccccccc-0000-4000-8000-000000000003';
export const USER_B = 'dddddddd-0000-4000-8000-000000000004';

export interface WebsiteRow {
  tenant_id: string;
  domain: string;
  latest_audit_id: string;
  status: string;
  plan_tier: string;
}

export interface MonitoringRow {
  tenant_id: string;
  url: string;
  status: string;
}

export interface ConsentRow {
  user_id: string;
  scan_result_id: string;
}

export interface MemoryState {
  audits: Record<string, AuditRecord>;
  subscriptions: Record<string, SubscriptionRow>;
  websites: WebsiteRow[];
  monitoring: MonitoringRow[];
  consents: ConsentRow[];
  events: PilotAuditEvent[];
  trialCalls: Array<{ tenantId: string; planKey: string; preserveTrialWindow: boolean }>;
}

export interface MemoryStore extends PilotStore {
  state: MemoryState;
  calls: { loadAudit: number; claimAudit: number };
}

export interface MemoryStoreOptions {
  /** Domain, wie sie in gdpr_audits steht (gdpr-audit speichert inkl. www). */
  auditDomain?: string;
  createdAt?: string;
  withAudit?: boolean;
  /** user_id → tenant_id. Default: USER_A und USER_B je eigener Tenant. */
  memberships?: Record<string, string>;
  denyMembership?: boolean;
  subscription?: SubscriptionRow;
  failWebsite?: boolean;
  failTrial?: boolean;
  failMonitoring?: boolean;
  /** Gemeinsamer Zustand für Tests mit zwei nebenläufigen Aufrufen. */
  sharedState?: MemoryState;
}

export function createMemoryState(opts: MemoryStoreOptions = {}): MemoryState {
  const audits: Record<string, AuditRecord> = {};
  if (opts.withAudit !== false) {
    audits[AUDIT_ID] = {
      id: AUDIT_ID,
      domain: opts.auditDomain ?? 'example.com',
      created_at: opts.createdAt ?? new Date().toISOString(),
      user_id: null,
      tenant_id: null,
      claimed_at: null,
    };
  }

  const subscriptions: Record<string, SubscriptionRow> = {};
  if (opts.subscription) {
    subscriptions[TENANT_A] = { tenant_id: TENANT_A, ...opts.subscription };
  }

  return { audits, subscriptions, websites: [], monitoring: [], consents: [], events: [], trialCalls: [] };
}

export function createMemoryStore(opts: MemoryStoreOptions = {}): MemoryStore {
  const state = opts.sharedState ?? createMemoryState(opts);
  const memberships = opts.memberships ?? { [USER_A]: TENANT_A, [USER_B]: TENANT_B };
  const calls = { loadAudit: 0, claimAudit: 0 };

  return {
    state,
    calls,

    async loadAudit(auditId) {
      calls.loadAudit += 1;
      const row = state.audits[auditId];
      return row ? { ...row } : null;
    },

    async resolveTenant(userId) {
      return memberships[userId] ?? null;
    },

    async isMember(userId, tenantId) {
      if (opts.denyMembership) return false;
      return memberships[userId] === tenantId;
    },

    async claimAudit(auditId, userId, tenantId, claimedAt) {
      calls.claimAudit += 1;
      const row = state.audits[auditId];
      if (!row) return false;
      // Entspricht `WHERE user_id IS NULL AND tenant_id IS NULL` — nur der
      // erste nebenläufige Aufruf trifft eine Zeile.
      if (row.user_id !== null || row.tenant_id !== null) return false;
      row.user_id = userId;
      row.tenant_id = tenantId;
      row.claimed_at = claimedAt;
      return true;
    },

    async readAuditOwner(auditId) {
      const row = state.audits[auditId];
      return row ? { tenant_id: row.tenant_id, user_id: row.user_id } : null;
    },

    async upsertWebsite(tenantId, domain, auditId) {
      if (opts.failWebsite) throw new Error('websites unavailable');
      const existing = state.websites.find(
        (w) => w.tenant_id === tenantId && w.domain === domain,
      );
      if (existing) {
        existing.latest_audit_id = auditId;
        existing.status = 'audit_done';
        return;
      }
      state.websites.push({
        tenant_id: tenantId, domain, latest_audit_id: auditId,
        status: 'audit_done', plan_tier: 'audit',
      });
    },

    async loadSubscription(tenantId) {
      const row = state.subscriptions[tenantId];
      return row ? { ...row } : null;
    },

    async createTrial(tenantId, planKey, preserveTrialWindow) {
      if (opts.failTrial) throw new Error('trial creation failed');
      state.trialCalls.push({ tenantId, planKey, preserveTrialWindow });

      const now = new Date().toISOString();
      const end = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString();
      const existing = state.subscriptions[tenantId];

      state.subscriptions[tenantId] = {
        tenant_id: tenantId,
        plan_key: planKey,
        status: 'trialing',
        // Spiegelt preserveTrialWindow aus create-trial-subscription: ein
        // bereits laufendes Fenster wird NICHT verschoben.
        trial_start: preserveTrialWindow && existing?.trial_start ? existing.trial_start : now,
        trial_end: preserveTrialWindow && existing?.trial_end ? existing.trial_end : end,
      };
    },

    async enrollMonitoring(tenantId, url) {
      if (opts.failMonitoring) throw new Error('monitoring unavailable');
      const existing = state.monitoring.find(
        (m) => m.tenant_id === tenantId && m.url === url,
      );
      if (existing) {
        existing.status = 'active';
        return;
      }
      state.monitoring.push({ tenant_id: tenantId, url, status: 'active' });
    },

    async recordConsent(userId, auditId) {
      state.consents.push({ user_id: userId, scan_result_id: auditId });
    },

    async logEvent(event) {
      state.events.push(event);
    },
  };
}
