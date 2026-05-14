// Sales Outreach Drafting Skill — pure Helper. KEINE automatische Versendung,
// KEINE erfundenen Fakten.

export interface OutreachTarget {
  company: string;
  contactRole?: string;
  industry?: string;
  triggerEvent?: string;
}

export interface OutreachResearchPlan {
  target: OutreachTarget;
  researchSteps: string[];
  draftSteps: string[];
  guardrails: string[];
  reviewRequired: true;
}

export function buildOutreachResearchPlan(target: OutreachTarget): OutreachResearchPlan {
  if (!target || typeof target !== 'object') throw new Error('target required');
  if (typeof target.company !== 'string' || !target.company.trim()) throw new Error('target.company required');

  const safeTarget: OutreachTarget = {
    company: target.company.trim().slice(0, 200),
    contactRole: target.contactRole?.slice(0, 120),
    industry: target.industry?.slice(0, 80),
    triggerEvent: target.triggerEvent?.slice(0, 200),
  };

  return {
    target: safeTarget,
    researchSteps: [
      'Offizielle Quellen: Unternehmenswebsite, Presse, SEC/Handelsregister',
      'Aktuelle Trigger (Funding, Hiring, Produkt-Launch) datiert verifizieren',
      'Rolle/Verantwortung der Zielperson per LinkedIn-Profil bestaetigen',
      'Keine Spekulation: unbestaetigte Fakten als "Hypothese" markieren',
    ],
    draftSteps: [
      'Hook auf nachweisbarem Trigger-Event (Datum + Quelle nennen)',
      'Wertversprechen in einem Satz, kein Boilerplate',
      'Ein einziger klarer Call-to-Action, niedrige Reibung',
      'Personalisierungsfeld trennen vom Template-Body',
    ],
    guardrails: [
      'Keine erfundenen Firmen-/Personenangaben — unbekannt = leer oder "Hypothese".',
      'Keine automatische Versendung. Draft muss durch einen Menschen freigegeben werden.',
      'Opt-out / DSGVO-Hinweis in der Sequenz nicht weglassen.',
    ],
    reviewRequired: true,
  };
}
