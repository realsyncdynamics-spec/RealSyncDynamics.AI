// Compliance Drift Intelligence Agent
//
// Erkennt heuristisch typische Compliance-Drift-Muster in den Marketing-
// Events einer Periode:
//
//   1. utm_no_consent_drift
//      Es gibt Events mit UTM-Parametern, aber `metadata.consent_marketing`
//      ist nicht true. UTM-Tracking ohne Marketing-Consent ist heikel.
//
//   2. checkout_dropoff_anomaly
//      Checkout-Drop-off (started → completed) sinkt deutlich gegen den
//      Trend (Z-Score). Loest oft auf einen Compliance-Banner-Bug zurueck.
//
//   3. claim_drift
//      In `metadata.claim` tauchen unbelegte Superlative auf
//      ("100% sicher", "garantiert DSGVO-konform", "rechtsverbindlich").
//
// WICHTIG: Diese Heuristiken sind technische Indikatoren. Sie ersetzen
// keine Rechtsberatung. Der Disclaimer wird stets mit dem Befund geliefert.

import { detectAnomaly } from './detectAnomaly';
import type {
  ComplianceFinding,
  MarketingEvent,
} from './types';
import { COMPLIANCE_DISCLAIMER } from './types';

const SUPERLATIVES = [
  /100\s*%\s*(sicher|dsgvo|gdpr)/i,
  /garantiert\s+(dsgvo|gdpr|rechtssicher)/i,
  /rechtsverbindlich/i,
  /zero\s+risk/i,
  /no\s+legal\s+risk/i,
];

function isoDay(ts: string): string {
  return ts.slice(0, 10);
}

function groupCountsByDay(events: MarketingEvent[], name: string): number[] {
  const byDay = new Map<string, number>();
  for (const ev of events) {
    if (ev.event_name !== name) continue;
    if (!ev.occurred_at) continue;
    const day = isoDay(ev.occurred_at);
    byDay.set(day, (byDay.get(day) ?? 0) + 1);
  }
  return Array.from(byDay.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([, v]) => v);
}

export interface ComplianceDriftReport {
  findings: ComplianceFinding[];
  disclaimer: string;
}

export class ComplianceDriftAgent {
  analyze(events: MarketingEvent[]): ComplianceDriftReport {
    const findings: ComplianceFinding[] = [];

    findings.push(...this.detectUtmWithoutConsent(events));
    findings.push(...this.detectCheckoutDropoffAnomaly(events));
    findings.push(...this.detectClaimDrift(events));

    return { findings, disclaimer: COMPLIANCE_DISCLAIMER };
  }

  private detectUtmWithoutConsent(events: MarketingEvent[]): ComplianceFinding[] {
    const violations = events.filter((ev) => {
      const hasUtm = Boolean(ev.utm_source || ev.utm_medium || ev.utm_campaign);
      if (!hasUtm) return false;
      const consent = ev.metadata?.consent_marketing;
      return consent !== true;
    });
    if (violations.length === 0) return [];
    const totalUtm = events.filter((e) => e.utm_source || e.utm_medium || e.utm_campaign).length;
    const ratio = totalUtm > 0 ? violations.length / totalUtm : 0;
    return [
      {
        rule_id: 'utm_no_consent_drift',
        severity: ratio > 0.3 ? 'high' : 'medium',
        summary:
          `${violations.length} von ${totalUtm} UTM-Events ohne Marketing-Consent. ` +
          'Pruefe Consent-Banner-Reihenfolge und Pixel-Gating.',
        evidence: { violations: violations.length, total_utm: totalUtm, ratio },
      },
    ];
  }

  private detectCheckoutDropoffAnomaly(events: MarketingEvent[]): ComplianceFinding[] {
    const starts = groupCountsByDay(events, 'checkout_started');
    const completes = groupCountsByDay(events, 'checkout_completed');
    if (starts.length < 6 || completes.length < 6) return [];

    const ratios = starts.map((s, i) => {
      const c = completes[i] ?? 0;
      return s > 0 ? c / s : 0;
    });
    const anomaly = detectAnomaly(ratios);
    if (!anomaly.isAnomaly || anomaly.zScore >= 0) return [];

    return [
      {
        rule_id: 'checkout_dropoff_anomaly',
        severity: anomaly.zScore < -3 ? 'high' : 'medium',
        summary:
          `Checkout-Completion-Rate heute deutlich unter Trend (z=${anomaly.zScore.toFixed(2)}). ` +
          'Moegliche Ursachen: Banner-Block, Stripe-Fehler, Consent-Race.',
        evidence: {
          current: anomaly.value,
          mean: anomaly.mean,
          std_dev: anomaly.stdDev,
          z_score: anomaly.zScore,
        },
      },
    ];
  }

  private detectClaimDrift(events: MarketingEvent[]): ComplianceFinding[] {
    const offenders: { campaign?: string; claim: string }[] = [];
    for (const ev of events) {
      const claim = ev.metadata?.claim;
      if (typeof claim !== 'string') continue;
      if (SUPERLATIVES.some((re) => re.test(claim))) {
        offenders.push({ campaign: ev.utm_campaign, claim: claim.slice(0, 160) });
      }
    }
    if (offenders.length === 0) return [];
    return [
      {
        rule_id: 'claim_drift',
        severity: 'medium',
        summary:
          `${offenders.length} Marketing-Claims enthalten heikle Superlative ` +
          '("100% DSGVO", "garantiert rechtssicher", ...). Pruefen, ob belegbar.',
        evidence: { offenders: offenders.slice(0, 10) },
      },
    ];
  }
}
