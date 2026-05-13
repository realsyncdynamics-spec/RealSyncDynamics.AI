// Compare two consecutive scans and emit drift events.

import type { ShopifyScanResult, ShopifyFinding } from './shopify-scanner.ts';

export interface DriftEvent {
  type:
    | 'new_tracker'
    | 'new_external_script_host'
    | 'lost_security_header'
    | 'score_drop'
    | 'new_high_finding'
    | 'lost_consent_signal';
  severity: 'low' | 'medium' | 'high' | 'critical';
  title: string;
  description: string;
  evidence: Record<string, unknown>;
}

export function compareShopifyScans(
  previous: ShopifyScanResult | null,
  current: ShopifyScanResult,
): DriftEvent[] {
  const out: DriftEvent[] = [];
  if (!previous) return out;

  // New trackers / vendors
  const prevVendors = new Set(previous.evidence.detectedVendors);
  for (const v of current.evidence.detectedVendors) {
    if (!prevVendors.has(v)) {
      out.push({
        type: 'new_tracker',
        severity: 'high',
        title: `Neuer Tracker erkannt: ${v}`,
        description: `Im aktuellen Scan ist ein Vendor-Signal sichtbar, das im vorherigen Scan nicht da war: ${v}.`,
        evidence: { vendor: v },
      });
    }
  }

  // Lost consent signal
  const prevSignals = new Set(previous.evidence.consentSignals);
  const curSignals  = new Set(current.evidence.consentSignals);
  for (const s of prevSignals) {
    if (!curSignals.has(s)) {
      out.push({
        type: 'lost_consent_signal',
        severity: 'high',
        title: `Consent-Signal verschwunden: ${s}`,
        description: `Das Consent-Signal "${s}" war im vorherigen Scan vorhanden und ist im aktuellen Scan nicht mehr erkennbar.`,
        evidence: { signal: s },
      });
    }
  }

  // Lost security headers — per scanned URL
  for (const url of current.evidence.scannedUrls) {
    const prevH = previous.evidence.headers[url] ?? {};
    const curH  = current.evidence.headers[url] ?? {};
    for (const h of ['strict-transport-security', 'content-security-policy', 'x-content-type-options', 'referrer-policy', 'permissions-policy']) {
      if (prevH[h] && !curH[h]) {
        out.push({
          type: 'lost_security_header',
          severity: 'medium',
          title: `Security-Header verloren: ${h}`,
          description: `Der Header ${h} war vorher auf ${url} gesetzt und fehlt im aktuellen Scan.`,
          evidence: { url, header: h },
        });
      }
    }
  }

  // Score drop > 10
  if (current.score < previous.score - 10) {
    out.push({
      type: 'score_drop',
      severity: 'high',
      title: `Score-Drop um ${previous.score - current.score} Punkte`,
      description: `Score sank von ${previous.score} auf ${current.score}.`,
      evidence: { previous: previous.score, current: current.score },
    });
  }

  // New high/critical findings (by id)
  const prevFindingIds = new Set(previous.findings.map((f: ShopifyFinding) => f.id));
  for (const f of current.findings) {
    if ((f.severity === 'high' || f.severity === 'critical') && !prevFindingIds.has(f.id)) {
      out.push({
        type: 'new_high_finding',
        severity: f.severity,
        title: `Neuer ${f.severity}-Befund: ${f.title}`,
        description: f.description,
        evidence: { findingId: f.id, ...f.evidence },
      });
    }
  }

  return out;
}
