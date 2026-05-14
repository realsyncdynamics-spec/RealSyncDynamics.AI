// Revenue Attribution Agent
//
// Aggregiert Marketing-Events zu Channel-Attributionen unter drei Modellen:
//   - last_touch:  Konversionsrevenue 100% an LETZTEN bekannten Touchpoint
//   - first_touch: 100% an ERSTEN Touchpoint
//   - linear:      gleichmaessig auf alle Touchpoints einer Session verteilt
//
// Input ist eine Liste von `MarketingEvent`s — der Agent macht keine eigenen
// DB-Calls und ist damit pure & testbar.

import type {
  AttributionModel,
  AttributionRow,
  AttributionSnapshot,
  AttributionTouchpoint,
  MarketingEvent,
} from './types';

interface SessionState {
  touchpoints: AttributionTouchpoint[];
  conversionValue: number;
  converted: boolean;
}

const CONVERSION_EVENTS = new Set(['checkout_completed', 'lead_captured']);

function rowKey(row: { utm_source: string; utm_medium?: string; utm_campaign?: string }): string {
  return [row.utm_source, row.utm_medium ?? '', row.utm_campaign ?? ''].join('|');
}

function groupBySession(events: MarketingEvent[]): Map<string, SessionState> {
  const sessions = new Map<string, SessionState>();
  for (const ev of events) {
    const key = ev.session_hash;
    if (!key) continue;
    if (!sessions.has(key)) {
      sessions.set(key, { touchpoints: [], conversionValue: 0, converted: false });
    }
    const state = sessions.get(key)!;
    if (ev.utm_source) {
      state.touchpoints.push({
        utm_source: ev.utm_source,
        utm_medium: ev.utm_medium,
        utm_campaign: ev.utm_campaign,
        occurred_at: ev.occurred_at ?? new Date().toISOString(),
      });
    }
    if (CONVERSION_EVENTS.has(ev.event_name)) {
      state.converted = true;
      state.conversionValue += typeof ev.event_value === 'number' ? ev.event_value : 0;
    }
  }
  return sessions;
}

function emptyRow(tp: AttributionTouchpoint): AttributionRow {
  return {
    utm_source: tp.utm_source ?? '(direct)',
    utm_medium: tp.utm_medium,
    utm_campaign: tp.utm_campaign,
    touchpoints: 0,
    conversions: 0,
    revenue_eur: 0,
  };
}

export class RevenueAttributionAgent {
  attribute(
    events: MarketingEvent[],
    model: AttributionModel,
    window_start: string,
    window_end: string,
  ): AttributionSnapshot {
    const sessions = groupBySession(events);
    const rows = new Map<string, AttributionRow>();

    for (const session of sessions.values()) {
      if (session.touchpoints.length === 0) continue;

      // Touchpoint-Counts (alle Beruehrungen, unabhaengig von Conversion).
      for (const tp of session.touchpoints) {
        const empty = emptyRow(tp);
        const key = rowKey(empty);
        const row = rows.get(key) ?? empty;
        row.touchpoints += 1;
        rows.set(key, row);
      }

      if (!session.converted) continue;

      const tps = session.touchpoints;
      if (model === 'last_touch') {
        const tp = tps[tps.length - 1]!;
        const key = rowKey(emptyRow(tp));
        const row = rows.get(key)!;
        row.conversions += 1;
        row.revenue_eur += session.conversionValue;
      } else if (model === 'first_touch') {
        const tp = tps[0]!;
        const key = rowKey(emptyRow(tp));
        const row = rows.get(key)!;
        row.conversions += 1;
        row.revenue_eur += session.conversionValue;
      } else {
        const share = 1 / tps.length;
        const revShare = session.conversionValue * share;
        for (const tp of tps) {
          const key = rowKey(emptyRow(tp));
          const row = rows.get(key)!;
          row.conversions += share;
          row.revenue_eur += revShare;
        }
      }
    }

    const result = Array.from(rows.values()).map((r) => ({
      ...r,
      revenue_eur: Math.round(r.revenue_eur * 100) / 100,
      conversions: Math.round(r.conversions * 1000) / 1000,
    }));
    result.sort((a, b) => b.revenue_eur - a.revenue_eur);

    return { model, window_start, window_end, rows: result };
  }
}
