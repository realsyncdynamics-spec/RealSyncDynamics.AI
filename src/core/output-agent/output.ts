// OutputAgent — notification fan-out layer.
//
// Pure delivery. NEVER:
//   - modifies the source observation
//   - auto-acknowledges anything
//   - auto-retries failed deliveries
//
// Every deliver() call produces exactly one DeliveryRecord per
// MATCHING channel (one observation can fan out to many channels).
// Channels whose min_severity rank > observation severity rank
// produce a 'skipped_severity' record so the audit log is complete.
//
// Rate-limit semantics: per-channel hour-bucket cap. When breached,
// the delivery is recorded as 'rate_limited' and NOT sent. Humans
// see the audit log and can raise the limit.
//
// Transport is pluggable via ChannelTransport — tests inject a
// recorder; prod swaps in a real HTTP/SMTP/Slack adapter.

import type {
  ChannelRecord, ChannelKind, DeliveryRecord, DeliveryStatus,
  ObservationLike, ChannelTransport, OutputPersistHook,
} from './types';
import { SEVERITY_RANK } from './types';
import type { ObservationSeverity } from '../agent-os/types';

let _seq = 0;
function nextId(p: string): string {
  _seq += 1;
  return `${p}_${Date.now().toString(36)}_${_seq}`;
}
function nowIso(): string { return new Date().toISOString(); }

// ── Default transport: no-op recorder ─────────────────────────────
// Tests / Phase A: returns ok=true without doing anything.

const noopTransport: ChannelTransport = {
  async send() { return { ok: true }; },
};

// ── Public input shapes ───────────────────────────────────────────

export interface AddChannelInput {
  tenant_id:            string;
  name:                 string;
  kind:                 ChannelKind;
  config?:              Record<string, unknown>;
  min_severity?:        ObservationSeverity;
  rate_limit_per_hour?: number;
  enabled?:             boolean;
}

export interface DeliverOptions {
  /** Override "now" for deterministic tests. */
  now?: string;
}

// ── OutputAgent ───────────────────────────────────────────────────

export class OutputAgent {
  private channels   = new Map<string, ChannelRecord>();
  private deliveries: DeliveryRecord[] = [];
  private transport:  ChannelTransport = noopTransport;
  private hook:       OutputPersistHook = {};

  setPersistHook(h: OutputPersistHook): void { this.hook = h; }
  setTransport(t: ChannelTransport): void    { this.transport = t; }

  // ── Channel CRUD ───────────────────────────────────────────────

  addChannel(input: AddChannelInput): ChannelRecord {
    if (!input.name?.trim()) throw new Error("OutputAgent.addChannel: 'name' required.");
    for (const existing of this.channels.values()) {
      if (existing.tenant_id === input.tenant_id && existing.name === input.name) {
        throw new Error(`OutputAgent.addChannel: channel '${input.name}' already exists for tenant '${input.tenant_id}'.`);
      }
    }
    if (input.rate_limit_per_hour !== undefined && (input.rate_limit_per_hour <= 0 || input.rate_limit_per_hour > 1000)) {
      throw new Error(`OutputAgent.addChannel: rate_limit_per_hour out of (0,1000] (got ${input.rate_limit_per_hour}).`);
    }
    const now = nowIso();
    const ch: ChannelRecord = {
      id:                  nextId('ch'),
      tenant_id:           input.tenant_id,
      name:                input.name.trim(),
      kind:                input.kind,
      config:              input.config ?? {},
      min_severity:        input.min_severity ?? 'high',
      rate_limit_per_hour: input.rate_limit_per_hour ?? 20,
      enabled:             input.enabled ?? true,
      created_at:          now,
      updated_at:          now,
    };
    this.channels.set(ch.id, ch);
    this.hook.saveChannel?.(ch);
    return ch;
  }

  setEnabled(channel_id: string, enabled: boolean): ChannelRecord {
    const c = this.channels.get(channel_id);
    if (!c) throw new Error(`OutputAgent.setEnabled: channel '${channel_id}' not found.`);
    c.enabled = enabled;
    c.updated_at = nowIso();
    this.hook.saveChannel?.(c);
    return c;
  }

  listChannels(tenant_id: string): ChannelRecord[] {
    return [...this.channels.values()].filter(c => c.tenant_id === tenant_id);
  }

  // ── The main verb ──────────────────────────────────────────────

  /**
   * Fan out a single observation to every channel for its tenant.
   * Returns ALL produced delivery records (one per matching channel
   * — including 'skipped_severity' for sub-threshold severities, so
   * the audit log is complete).
   */
  async deliver(obs: ObservationLike, opts: DeliverOptions = {}): Promise<DeliveryRecord[]> {
    const now = opts.now ?? nowIso();
    const tenantChannels = [...this.channels.values()]
      .filter(c => c.tenant_id === obs.tenant_id && c.enabled);
    const out: DeliveryRecord[] = [];

    for (const ch of tenantChannels) {
      const obsRank = SEVERITY_RANK[obs.severity];
      const minRank = SEVERITY_RANK[ch.min_severity];

      if (obsRank < minRank) {
        out.push(this.record(ch, obs, 'skipped_severity', now, {
          error_message: `severity '${obs.severity}' below channel min '${ch.min_severity}'`,
        }));
        continue;
      }

      if (this.exceedsRateLimit(ch, now)) {
        out.push(this.record(ch, obs, 'rate_limited', now, {
          error_message: `channel rate limit reached (${ch.rate_limit_per_hour}/h)`,
        }));
        continue;
      }

      // Actually send.
      try {
        const result = await this.transport.send(ch, obs);
        if (result.ok) {
          out.push(this.record(ch, obs, 'delivered', now, {
            response_code: result.response_code ?? null,
          }));
        } else {
          out.push(this.record(ch, obs, 'failed', now, {
            error_message: result.error ?? 'transport returned ok=false',
            response_code: result.response_code ?? null,
          }));
        }
      } catch (e) {
        out.push(this.record(ch, obs, 'failed', now, {
          error_message: (e as Error).message ?? String(e),
        }));
      }
    }
    return out;
  }

  // ── Audit reads ────────────────────────────────────────────────

  deliveriesForObservation(observation_id: string): DeliveryRecord[] {
    return this.deliveries.filter(d => d.observation_id === observation_id);
  }

  deliveriesForChannel(channel_id: string, since?: string): DeliveryRecord[] {
    return this.deliveries.filter(d =>
      d.channel_id === channel_id &&
      (since ? d.created_at >= since : true)
    );
  }

  recentDeliveries(tenant_id: string, since?: string): DeliveryRecord[] {
    return this.deliveries
      .filter(d => d.tenant_id === tenant_id && (since ? d.created_at >= since : true))
      .sort((a, b) => b.created_at.localeCompare(a.created_at));
  }

  // ── Internals ──────────────────────────────────────────────────

  private record(
    ch: ChannelRecord,
    obs: ObservationLike,
    status: DeliveryStatus,
    now: string,
    extras: { error_message?: string | null; response_code?: number | null } = {},
  ): DeliveryRecord {
    const d: DeliveryRecord = {
      id:              nextId('dlv'),
      channel_id:      ch.id,
      tenant_id:       ch.tenant_id,
      observation_id:  obs.id,
      severity:        obs.severity,
      title:           obs.title,
      detail:          obs.detail ?? null,
      status,
      attempt:         1,
      error_message:   extras.error_message ?? null,
      response_code:   extras.response_code ?? null,
      created_at:      now,
    };
    this.deliveries.push(d);
    this.hook.saveDelivery?.(d);
    return d;
  }

  private exceedsRateLimit(ch: ChannelRecord, now: string): boolean {
    const hourAgoMs = new Date(now).getTime() - 3600_000;
    const recent = this.deliveries.filter(d =>
      d.channel_id === ch.id &&
      d.status === 'delivered' &&
      new Date(d.created_at).getTime() >= hourAgoMs
    );
    return recent.length >= ch.rate_limit_per_hour;
  }

  __resetForTests(): void {
    this.channels.clear();
    this.deliveries = [];
    this.transport = noopTransport;
    this.hook = {};
  }
}
