export type AuditSeverity = 'critical' | 'high' | 'medium' | 'low' | 'pass';

export interface QualificationInput {
  industry?: string | null;
  companySize?: number | null;
  auditScore?: number | null;
  severity?: AuditSeverity | null;
  findings?: Array<{ severity?: string | null; title?: string | null }>;
  requestedAutomations?: string[];
  existingSystems?: string[];
}

export interface FunnelRecommendation {
  leadScore: number;
  priority: 'low' | 'medium' | 'high' | 'hot';
  plan: 'starter' | 'growth' | 'agency' | 'enterprise';
  modules: string[];
  rationale: string[];
}

const AUTOMATION_MODULES: Record<string, string> = {
  telefon: 'Telefon-Automation',
  phone: 'Telefon-Automation',
  whatsapp: 'WhatsApp-Automation',
  chatbot: 'KI-Chatbot',
  chat: 'KI-Chatbot',
  website: 'SiteOS',
  monitoring: 'Continuous Monitoring',
};

export function qualifyLead(input: QualificationInput): FunnelRecommendation {
  let score = 0;
  const rationale: string[] = [];
  const modules = new Set<string>(['DSGVO Audit']);

  const auditScore = typeof input.auditScore === 'number' ? input.auditScore : null;
  if (auditScore !== null) {
    if (auditScore < 40) { score += 35; rationale.push('Sehr niedriger Compliance-Score'); }
    else if (auditScore < 60) { score += 25; rationale.push('Deutlicher Compliance-Handlungsbedarf'); }
    else if (auditScore < 80) { score += 15; rationale.push('Mittlerer Compliance-Handlungsbedarf'); }
  }

  const critical = (input.findings ?? []).filter((f) => ['critical', 'high'].includes((f.severity ?? '').toLowerCase())).length;
  if (critical >= 5) { score += 30; rationale.push(`${critical} kritische/hohe Findings`); }
  else if (critical >= 2) { score += 20; rationale.push(`${critical} kritische/hohe Findings`); }
  else if (critical === 1) { score += 10; rationale.push('Kritisches Finding vorhanden'); }

  if (input.severity === 'critical') { score += 15; rationale.push('Audit-Severity: kritisch'); }
  else if (input.severity === 'high') { score += 10; rationale.push('Audit-Severity: hoch'); }

  if ((input.companySize ?? 0) >= 250) { score += 20; rationale.push('Großes Unternehmen'); }
  else if ((input.companySize ?? 0) >= 50) { score += 12; rationale.push('Mittleres Unternehmen'); }
  else if ((input.companySize ?? 0) >= 10) { score += 5; }

  for (const raw of input.requestedAutomations ?? []) {
    const key = raw.trim();
    const module = AUTOMATION_MODULES[key] ?? AUTOMATION_MODULES[key.toLowerCase()];
    if (module) {
      modules.add(module);
      score += 5;
    }
  }

  if ((input.existingSystems ?? []).length >= 2) {
    score += 5;
    rationale.push('Mehrere bestehende Systeme müssen integriert werden');
  }

  score = Math.min(100, score);

  const plan = score >= 75 ? 'agency' : score >= 45 ? 'growth' : 'starter';
  if (score >= 75) modules.add('Automations Engine');
  if (score >= 45) modules.add('Continuous Monitoring');

  const priority = score >= 80 ? 'hot' : score >= 60 ? 'high' : score >= 35 ? 'medium' : 'low';

  return { leadScore: score, priority, plan, modules: [...modules], rationale };
}
