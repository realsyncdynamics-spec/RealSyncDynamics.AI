// Automatisierungs-Skills (Self-Service-Modul · Phase 1).
//
// REINE KONFIGURATION — keine Engine, keine DB. Jeder Skill ist ein
// vordefinierter Workflow, der in der UI als "Wählen. Aktivieren. Nutzen."
// dargestellt wird. CTAs verlinken auf BEREITS VORHANDENE Routen — Phase 1
// fuehrt keine echten Backend-Runs aus (siehe docs/product/automation-skills.md).

import type { TierId } from '../config/pricing';

export type AutomationSkillCategory = 'compliance' | 'vertrieb' | 'support' | 'dokumente' | 'meetings';
export type AutomationSkillStatus = 'available' | 'beta' | 'planned';

export interface AutomationSkillCta {
  label: string;
  href: string;
}

export interface AutomationSkill {
  id: string;
  title: string;
  shortDescription: string;
  category: AutomationSkillCategory;
  status: AutomationSkillStatus;
  /** Welches Problem löst der Skill? */
  problem: string;
  /** Ablauf des Workflows, Schritt für Schritt. */
  workflow: string[];
  /** Was liefert der Skill am Ende? */
  output: string[];
  planRequired: TierId;
  cta: AutomationSkillCta;
}

export const AUTOMATION_SKILL_CATEGORIES: Record<AutomationSkillCategory, string> = {
  compliance: 'Compliance',
  vertrieb: 'Vertrieb',
  support: 'Support',
  dokumente: 'Dokumente',
  meetings: 'Meetings',
};

export const AUTOMATION_SKILL_STATUS_LABEL: Record<AutomationSkillStatus, string> = {
  available: 'Verfügbar',
  beta: 'Beta',
  planned: 'Geplant',
};

export const AUTOMATION_SKILLS: AutomationSkill[] = [
  {
    id: 'dsgvo-audit',
    title: 'DSGVO Audit Skill',
    shortDescription: 'Prüft Website, Tracker, Consent, Header und Pflichtseiten auf DSGVO-Risiken.',
    category: 'compliance',
    status: 'available',
    problem: 'Unklare DSGVO-Lage auf der eigenen Website: Tracker, Consent-Banner, Header und Pflichtseiten sind nicht geprüft.',
    workflow: [
      'Website scannen',
      'Tracker & Consent prüfen',
      'Security-Header checken',
      'Pflichtseiten prüfen',
      'Befunde sammeln',
    ],
    output: ['Befunde', 'Risiko-Score', 'Evidence', 'Report'],
    planRequired: 'free',
    cta: { label: 'Skill aktivieren', href: '/audit' },
  },
  {
    id: 'dokumenten-skill',
    title: 'Dokumenten Skill',
    shortDescription: 'Erzeugt aus den Audit-Befunden Datenschutzerklärung, AVV, VVT und TOM.',
    category: 'dokumente',
    status: 'available',
    problem: 'Datenschutzerklärung, AVV, VVT und TOM fehlen oder sind veraltet.',
    workflow: [
      'Befunde aus Audit übernehmen',
      'Unternehmensdaten ergänzen',
      'Dokumente generieren',
    ],
    output: ['Datenschutzerklärung', 'AVV', 'VVT', 'TOM', 'Audit-Zusammenfassung'],
    planRequired: 'starter',
    cta: { label: 'Skill aktivieren', href: '/dokumente-bundle' },
  },
  {
    id: 'meeting-compliance',
    title: 'Meeting Compliance Skill',
    shortDescription: 'Erkennt Aufgaben, Risiken und DSGVO-/AI-Act-relevante Aussagen in Meeting-Notizen.',
    category: 'meetings',
    status: 'beta',
    problem: 'Aufgaben, Risiken und compliance-relevante Aussagen aus Meetings gehen unter.',
    workflow: [
      'Notizen oder Transkript einfügen',
      'Aufgaben & Risiken erkennen',
      'DSGVO-relevante Aussagen markieren',
      'AI-Act-relevante Entscheidungen markieren',
    ],
    output: ['Protokoll', 'To-dos', 'Compliance-Hinweise'],
    planRequired: 'growth',
    cta: { label: 'Workflow ansehen', href: '/app/automations?skill=meeting' },
  },
  {
    id: 'screenshot-feedback',
    title: 'Screenshot Feedback Skill',
    shortDescription: 'Wandelt Screenshots von Kunden und Beta-Nutzern in strukturierte Bug-Tickets um.',
    category: 'support',
    status: 'beta',
    problem: 'Bug-Feedback von Kunden und Beta-Nutzern ist unstrukturiert und schwer zu priorisieren.',
    workflow: [
      'Screenshot hochladen',
      'Betroffene Seite erkennen',
      'Fehlerbeschreibung erkennen',
      'Priorität einschätzen',
      'Ticket erzeugen',
    ],
    output: ['Bug-Ticket', 'Priorität', 'Betroffene Seite', 'Fehlerbeschreibung', 'Weiterleitung an GitHub/n8n'],
    planRequired: 'growth',
    cta: { label: 'Workflow ansehen', href: '/app/automations?skill=feedback' },
  },
  {
    id: 'lead-risk',
    title: 'Lead Risk Skill',
    shortDescription: 'Scannt potenzielle Kunden-Websites auf DSGVO-Risiken und erstellt Outreach-Texte.',
    category: 'vertrieb',
    status: 'available',
    problem: 'Unklar, welche Leads dringenden Compliance-Bedarf haben und wie man sie ansprechen sollte.',
    workflow: [
      'Website des Leads scannen',
      'DSGVO-Risiken bewerten',
      'Outreach-Text generieren',
      'Angebotsempfehlung ableiten',
    ],
    output: ['DSGVO-Risiken', 'Outreach-Text', 'Angebotsempfehlung'],
    planRequired: 'starter',
    cta: { label: 'Skill aktivieren', href: '/audit' },
  },
  {
    id: 'support-skill',
    title: 'Support Skill',
    shortDescription: 'Beantwortet Kundenfragen anhand der eigenen Wissensbasis — mit Quellen.',
    category: 'support',
    status: 'planned',
    problem: 'Wiederkehrende Kundenfragen kosten Zeit, Antworten sind inkonsistent.',
    workflow: [
      'Frage stellen',
      'Wissensbasis durchsuchen',
      'Antwort mit Quellen generieren',
      'Ticket erstellen, falls nötig',
    ],
    output: ['Antwort', 'Quellen', 'Ticket falls nötig'],
    planRequired: 'agency',
    cta: { label: 'Im Dashboard öffnen', href: '/assistant' },
  },
];
