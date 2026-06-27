// Risk Mapping Engine
// ---------------------------------------------------------------------------
// Überführt ein normalisiertes Security Signal in Governance-Objekte:
//
//   Finding → Risk → Control Mapping → Task → Evidence
//
// Reine, regelbasierte Funktion ohne Seiteneffekte. Spiegelung als Deno-Port
// unter supabase/functions/_shared/securitySignals.ts — bei Änderungen BEIDE
// Stellen anpassen.
//
// Frameworks/Controls bleiben string-kompatibel zur bestehenden Tabelle
// public.framework_controls (GDPR, EU_AI_ACT, NIS2, ISO_27001, …).

import type { NormalizedSecuritySignal, SignalSeverity } from './normalizeSecuritySignal';

export type RiskLevel = 'critical' | 'high' | 'medium' | 'low' | 'info';
export type TaskPriority = 'high' | 'medium' | 'low';

export interface ControlMapping {
  framework: string;
  controlRef: string;
  reason: string;
}

export interface RecommendedTask {
  type: string;
  title: string;
  priority: TaskPriority;
  status: 'open';
}

export interface EvidenceItem {
  type: string;
  title: string;
  description: string;
}

export interface GovernanceMapping {
  riskLevel: RiskLevel;
  frameworks: string[];
  controls: ControlMapping[];
  recommendedTasks: RecommendedTask[];
  evidenceItems: EvidenceItem[];
}

// Severity → Risk-Level (1:1; Risk-Level-Vokabular deckt sich mit governance_events).
const SEVERITY_TO_RISK: Record<SignalSeverity, RiskLevel> = {
  critical: 'critical',
  high: 'high',
  medium: 'medium',
  low: 'low',
  info: 'info',
};

// Schlüsselwörter, die auf personenbezogene Daten hindeuten.
const PII_HINTS = [
  'pii', 'personal_data', 'personenbezogen', 'personal data', 'customer_data',
  'customer data', 'kundendaten', 'gdpr', 'dsgvo', 'email', 'e-mail',
  'phone', 'ssn', 'passport', 'address', 'name', 'birthdate', 'dob',
  'credit_card', 'creditcard', 'iban', 'health', 'gesundheit', 'biometric',
];

// Schlüsselwörter, die auf Web-/Attack-Surface-Bezug hindeuten.
const WEB_HINTS = ['http', 'https', 'www', 'domain', 'web', 'api', 'host', 'url', 'admin', 'login', 'port', 'tls', 'ssl'];

export function mapSignalToGovernance(signal: NormalizedSecuritySignal): GovernanceMapping {
  const riskLevel = SEVERITY_TO_RISK[signal.severity] ?? 'info';
  const frameworks = new Set<string>();
  const controls: ControlMapping[] = [];
  const tasks: RecommendedTask[] = [];
  const evidence: EvidenceItem[] = [];

  const isHighRisk = signal.severity === 'critical' || signal.severity === 'high';
  const haystack = buildHaystack(signal);
  const isWeb = WEB_HINTS.some((h) => haystack.includes(h)) || looksLikeUrlOrHost(signal.assetRef);
  const hasPii = PII_HINTS.some((h) => haystack.includes(h));

  // Regel 1 — kritische/hohe Severity → Security-Frameworks.
  if (isHighRisk) {
    addControl(controls, frameworks, 'GDPR', 'Art. 32',
      'Hohe/kritische Severity erfordert angemessene technische Sicherheitsmaßnahmen (Art. 32 DSGVO).');
    addControl(controls, frameworks, 'NIS2', 'Security Measures',
      'Hohe/kritische Severity fällt unter NIS2-Risikomanagement-/Sicherheitsmaßnahmen.');
    addControl(controls, frameworks, 'ISO_27001', 'A.8',
      'Technologische Maßnahme (ISO 27001:2022 Annex A.8) betroffen.');
    tasks.push({
      type: 'risk_review',
      title: `Risk Review: ${signal.title}`,
      priority: 'high',
      status: 'open',
    });
    evidence.push({
      type: 'json',
      title: 'Security Signal Snapshot',
      description: `Snapshot des ${signal.provider}-Findings "${signal.title}" (Severity ${signal.severity}).`,
    });
  }

  // Regel 2 — Asset bezieht sich auf Domain/Web/API → Web-/Attack-Surface-Controls.
  if (isWeb) {
    addControl(controls, frameworks, 'ISO_27001', 'A.8.16',
      'Web-/API-Asset betroffen — Monitoring der Angriffsfläche (ISO 27001 A.8.16).');
    addControl(controls, frameworks, 'NIS2', 'Attack Surface Management',
      'Öffentlich erreichbares Web-/API-Asset — Attack-Surface-Control.');
    if (!tasks.some((t) => t.type === 'attack_surface_review')) {
      tasks.push({
        type: 'attack_surface_review',
        title: `Attack-Surface prüfen: ${signal.assetRef || signal.title}`,
        priority: isHighRisk ? 'high' : 'medium',
        status: 'open',
      });
    }
  }

  // Regel 3 — personenbezogene Daten im Payload → DSGVO-Incident-Review.
  if (hasPii) {
    addControl(controls, frameworks, 'GDPR', 'Art. 33/34',
      'Hinweis auf personenbezogene Daten — DSGVO-Incident-/Breach-Review (Art. 33/34) erforderlich.');
    tasks.push({
      type: 'dpo_review',
      title: 'DPO Review Required: möglicher Personenbezug',
      priority: 'high',
      status: 'open',
    });
    evidence.push({
      type: 'json',
      title: 'PII Assessment',
      description: 'Payload enthält Hinweise auf personenbezogene Daten — DSGVO-Bewertung dokumentieren.',
    });
  }

  // Fallback: niedrige Severity ohne Treffer bekommt dennoch eine Basis-Spur.
  if (controls.length === 0) {
    addControl(controls, frameworks, 'ISO_27001', 'A.5.7',
      'Informationssignal ohne erhöhtes Risiko — Threat-Intelligence-Erfassung (ISO 27001 A.5.7).');
    tasks.push({
      type: 'triage',
      title: `Triage: ${signal.title}`,
      priority: 'low',
      status: 'open',
    });
  }

  return {
    riskLevel,
    frameworks: Array.from(frameworks),
    controls,
    recommendedTasks: tasks,
    evidenceItems: evidence,
  };
}

/* ── Helfer ──────────────────────────────────────────────────────── */

function addControl(
  controls: ControlMapping[],
  frameworks: Set<string>,
  framework: string,
  controlRef: string,
  reason: string,
): void {
  frameworks.add(framework);
  if (!controls.some((c) => c.framework === framework && c.controlRef === controlRef)) {
    controls.push({ framework, controlRef, reason });
  }
}

function buildHaystack(signal: NormalizedSecuritySignal): string {
  let raw = '';
  try { raw = JSON.stringify(signal.rawPayload ?? {}); } catch { raw = ''; }
  return [
    signal.title,
    signal.description,
    signal.assetRef,
    signal.eventType,
    raw,
  ].join(' ').toLowerCase();
}

function looksLikeUrlOrHost(assetRef: string): boolean {
  if (!assetRef) return false;
  const a = assetRef.toLowerCase();
  return a.startsWith('http://') || a.startsWith('https://') || /\.[a-z]{2,}(\/|:|$)/.test(a);
}
