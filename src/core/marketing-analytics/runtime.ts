// Marketing Performance Analytics Runtime — Top-Level-Orchestrator.
//
// Faedelt sanitizeMetadata, RevenueAttributionAgent und ComplianceDriftAgent
// zu einer kleinen API zusammen, die vom Frontend (Client-SDK) und von der
// Supabase-Edge-Function gleichermassen genutzt wird.

import { ComplianceDriftAgent, type ComplianceDriftReport } from './complianceDriftAgent';
import { RevenueAttributionAgent } from './revenueAttributionAgent';
import { detectAnomaly } from './detectAnomaly';
import { sanitizeMetadata } from './sanitizeMetadata';
import type {
  AttributionModel,
  AttributionSnapshot,
  MarketingEvent,
} from './types';

export interface RuntimeOptions {
  /** Hook fuer Persistenz (z. B. Supabase-Client). */
  sink?: (event: MarketingEvent) => Promise<void> | void;
}

export class MarketingAnalyticsRuntime {
  private readonly attribution = new RevenueAttributionAgent();
  private readonly compliance = new ComplianceDriftAgent();

  constructor(private readonly opts: RuntimeOptions = {}) {}

  /** Bereitet ein Event vor (Sanitizer + Defaults) und schreibt es ggf. weg. */
  async track(input: MarketingEvent): Promise<MarketingEvent> {
    const event: MarketingEvent = {
      ...input,
      currency: input.currency?.toUpperCase().slice(0, 3) ?? 'EUR',
      occurred_at: input.occurred_at ?? new Date().toISOString(),
      metadata: sanitizeMetadata(input.metadata),
    };
    if (this.opts.sink) await this.opts.sink(event);
    return event;
  }

  attribute(
    events: MarketingEvent[],
    model: AttributionModel,
    window_start: string,
    window_end: string,
  ): AttributionSnapshot {
    return this.attribution.attribute(events, model, window_start, window_end);
  }

  scanCompliance(events: MarketingEvent[]): ComplianceDriftReport {
    return this.compliance.analyze(events);
  }

  detectMetricAnomaly(values: readonly number[]) {
    return detectAnomaly(values);
  }
}

export { sanitizeMetadata, detectAnomaly };
export * from './types';
