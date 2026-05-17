// OutputAgent — type system.

import type { ObservationSeverity } from '../agent-os/types';

export type ChannelKind = 'slack' | 'email' | 'webhook' | 'in_app';

export interface ChannelRecord {
  id:                  string;
  tenant_id:           string;
  name:                string;
  kind:                ChannelKind;
  config:              Record<string, unknown>;
  min_severity:        ObservationSeverity;
  rate_limit_per_hour: number;
  enabled:             boolean;
  created_at:          string;
  updated_at:          string;
}

export type DeliveryStatus =
  | 'delivered'         // sent successfully
  | 'failed'            // transport-level failure (will NOT auto-retry)
  | 'rate_limited'      // dropped due to channel rate limit
  | 'skipped_severity'; // below the channel's min_severity threshold

export interface DeliveryRecord {
  id:              string;
  channel_id:      string;
  tenant_id:       string;
  observation_id:  string | null;
  severity:        ObservationSeverity;
  title:           string;
  detail:          string | null;
  status:          DeliveryStatus;
  attempt:         number;
  error_message:   string | null;
  response_code:   number | null;
  created_at:      string;
}

export interface ObservationLike {
  id:       string;
  tenant_id: string;
  severity: ObservationSeverity;
  title:    string;
  detail:   string | null;
  category?: string;
  data?:    Record<string, unknown>;
}

/** Transport adapter — pluggable so tests can inject a recorder
 *  and prod wires a real HTTP/email client. */
export interface ChannelTransport {
  send(channel: ChannelRecord, obs: ObservationLike): Promise<{
    ok: boolean;
    response_code?: number;
    error?: string;
  }>;
}

export interface OutputPersistHook {
  saveChannel?:  (c: ChannelRecord)  => Promise<void> | void;
  saveDelivery?: (d: DeliveryRecord) => Promise<void> | void;
}

// Severity ranking (for min_severity comparison).
export const SEVERITY_RANK: Record<ObservationSeverity, number> = {
  info:     0,
  low:      1,
  medium:   2,
  high:     3,
  critical: 4,
};
