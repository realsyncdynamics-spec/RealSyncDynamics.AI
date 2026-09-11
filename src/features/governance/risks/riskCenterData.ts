/**
 * Risk Center — Mandanten-Mapping ohne Demo-Seed.
 *
 * Incidents (RLS) sind die einzige Quelle. Kein atelier-nord, keine
 * erfundenen Scores. Leere Mandanten bleiben leer.
 */
import type { DbIncident } from '../incidentsApi';

export type Severity = 'Kritisch' | 'Hoch' | 'Mittel' | 'Niedrig';
export type Status = 'Offen' | 'In Bearbeitung' | 'Behoben' | 'Akzeptiert';
export type Probability = 'Hoch' | 'Mittel' | 'Niedrig';
export type Impact = 'Hoch' | 'Mittel' | 'Niedrig';
export type Category =
  | 'DSGVO Art. 6'
  | 'Cookie & Consent'
  | 'EU AI Act'
  | 'Drittlandtransfer'
  | 'Technische Sicherheit'
  | 'Dokumentation';

export const RISK_CATEGORIES: Category[] = [
  'DSGVO Art. 6',
  'Cookie & Consent',
  'EU AI Act',
  'Drittlandtransfer',
  'Technische Sicherheit',
  'Dokumentation',
];

export interface Risk {
  id: string;
  severity: Severity;
  title: string;
  category: Category;
  framework: string;
  systems: string[];
  description: string;
  status: Status;
  actions: string[];
  evidence: string[];
  detectedAt: string;
  owner: string;
  dueDate: string | null;
  probability: Probability;
  impact: Impact;
  incidentId?: string;
}

export function formatDeDate(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString('de-DE');
}

export function categorizeIncident(inc: Pick<DbIncident, 'title' | 'description' | 'personal_data_affected' | 'affected_data_types'>): Category {
  const hay = `${inc.title} ${inc.description ?? ''} ${(inc.affected_data_types ?? []).join(' ')}`.toLowerCase();
  if (/cookie|consent|tracker|pixel|tdddg/.test(hay)) return 'Cookie & Consent';
  if (/\bki\b|ai act|eu ai|hochrisiko|modell|llm|chatbot/.test(hay)) return 'EU AI Act';
  if (/drittland|scc|transfer|usa|us-cdn|schrems/.test(hay)) return 'Drittlandtransfer';
  if (/tls|ssl|csp|header|zertifikat|hsts/.test(hay)) return 'Technische Sicherheit';
  if (/dokument|vvt|dsfa|avv|tom/.test(hay)) return 'Dokumentation';
  if (inc.personal_data_affected) return 'DSGVO Art. 6';
  return 'DSGVO Art. 6';
}

export function incidentToRisk(inc: DbIncident): Risk {
  const severityMap: Record<string, Severity> = {
    critical: 'Kritisch',
    high: 'Hoch',
    medium: 'Mittel',
    low: 'Niedrig',
  };
  const statusMap: Record<string, Status> = {
    open: 'Offen',
    investigating: 'In Bearbeitung',
    contained: 'In Bearbeitung',
    resolved: 'Behoben',
    reported_to_authority: 'Behoben',
  };
  const category = categorizeIncident(inc);
  const framework =
    category === 'EU AI Act'
      ? 'EU AI Act'
      : category === 'Cookie & Consent'
        ? 'DSGVO · TDDDG'
        : 'DSGVO';
  return {
    id: inc.id,
    incidentId: inc.id,
    severity: severityMap[inc.severity] ?? 'Mittel',
    title: inc.title,
    category,
    framework,
    systems: inc.affected_data_types ?? [],
    description: inc.description ?? inc.title,
    status: statusMap[inc.status] ?? 'Offen',
    actions: [],
    evidence: inc.triggering_event_id ? [inc.triggering_event_id] : [],
    detectedAt: formatDeDate(inc.detected_at) ?? '–',
    owner: inc.assigned_to ?? '–',
    dueDate: formatDeDate(inc.notification_deadline_at),
    probability: inc.severity === 'critical' || inc.severity === 'high' ? 'Hoch' : 'Mittel',
    impact: inc.severity === 'critical' || inc.severity === 'high' ? 'Hoch' : 'Mittel',
  };
}

export function countByCategory(risks: Risk[]): Record<Category, number> {
  const counts = Object.fromEntries(RISK_CATEGORIES.map((c) => [c, 0])) as Record<Category, number>;
  for (const r of risks) counts[r.category] += 1;
  return counts;
}

export function asOfLabel(risks: Risk[], now = new Date()): string {
  if (risks.length === 0) return now.toLocaleDateString('de-DE');
  return risks[0]?.detectedAt ?? now.toLocaleDateString('de-DE');
}
