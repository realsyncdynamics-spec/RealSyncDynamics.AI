// Abbildung persistierter Incidents auf die Risk-Center-Karten.
// Rein, testbar — keine Mock-Fallbacks.
import type { DbIncident } from '../incidentsApi';

export type RiskSeverity = 'Kritisch' | 'Hoch' | 'Mittel' | 'Niedrig';
export type RiskStatus = 'Offen' | 'In Bearbeitung' | 'Behoben' | 'Akzeptiert';
export type RiskProbability = 'Hoch' | 'Mittel' | 'Niedrig';
export type RiskImpact = 'Hoch' | 'Mittel' | 'Niedrig';
export type RiskCategory =
  | 'DSGVO Art. 6'
  | 'Cookie & Consent'
  | 'EU AI Act'
  | 'Drittlandtransfer'
  | 'Technische Sicherheit'
  | 'Dokumentation';

export interface MappedRisk {
  id: string;
  severity: RiskSeverity;
  title: string;
  category: RiskCategory;
  framework: string;
  systems: string[];
  description: string;
  status: RiskStatus;
  actions: string[];
  evidence: string[];
  detectedAt: string;
  owner: string;
  dueDate: string | null;
  probability: RiskProbability;
  impact: RiskImpact;
  incidentId?: string;
}

const SEVERITY_MAP: Record<string, RiskSeverity> = {
  critical: 'Kritisch',
  high: 'Hoch',
  medium: 'Mittel',
  low: 'Niedrig',
};

const STATUS_MAP: Record<string, RiskStatus> = {
  open: 'Offen',
  investigating: 'In Bearbeitung',
  contained: 'In Bearbeitung',
  resolved: 'Behoben',
  reported_to_authority: 'Behoben',
};

export function mapIncidentToRisk(inc: DbIncident): MappedRisk {
  const detected = new Date(inc.detected_at).toLocaleDateString('de-DE');
  const due = inc.notification_deadline_at
    ? new Date(inc.notification_deadline_at).toLocaleDateString('de-DE')
    : null;
  return {
    id: inc.id,
    incidentId: inc.id,
    severity: SEVERITY_MAP[inc.severity] ?? 'Mittel',
    title: inc.title,
    category: 'DSGVO Art. 6',
    framework: 'DSGVO',
    systems: [],
    description: inc.description ?? inc.title,
    status: STATUS_MAP[inc.status] ?? 'Offen',
    actions: [],
    evidence: [],
    detectedAt: detected,
    owner: inc.assigned_to ?? '–',
    dueDate: due,
    probability: 'Mittel',
    impact: inc.severity === 'critical' || inc.severity === 'high' ? 'Hoch' : 'Mittel',
  };
}

export function countRisksByCategory(risks: MappedRisk[]): Record<RiskCategory, number> {
  const counts: Record<RiskCategory, number> = {
    'DSGVO Art. 6': 0,
    'Cookie & Consent': 0,
    'EU AI Act': 0,
    Drittlandtransfer: 0,
    'Technische Sicherheit': 0,
    Dokumentation: 0,
  };
  for (const risk of risks) {
    counts[risk.category] += 1;
  }
  return counts;
}
