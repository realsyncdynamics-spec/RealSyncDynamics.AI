// Sales Call-Prep Skill — pure Helper. KEINE erfundenen Firmenfakten.

export type MeetingType = 'discovery' | 'demo' | 'kickoff' | 'qbr' | 'renewal';

export interface CallPrepOutline {
  company: string;
  meetingType: MeetingType;
  agenda: string[];
  openQuestions: string[];
  redFlags: string[];
  guardrail: string;
}

function validateType(t: string): MeetingType {
  const ok: MeetingType[] = ['discovery', 'demo', 'kickoff', 'qbr', 'renewal'];
  if (!ok.includes(t as MeetingType)) throw new Error(`unknown meetingType: ${t}`);
  return t as MeetingType;
}

export function buildCallPrepOutline(company: string, meetingType: string): CallPrepOutline {
  if (typeof company !== 'string' || !company.trim()) throw new Error('company required');
  const type = validateType(meetingType);
  const safeCompany = company.trim().slice(0, 200);

  const agenda: Record<MeetingType, string[]> = {
    discovery: [
      'Vorstellung beider Seiten (2 Min)',
      'Kontext der Anfrage / Trigger',
      'Pain-Points + aktuelle Workarounds',
      'Entscheidungsprozess + Stakeholder',
      'Naechste Schritte konkret abstimmen',
    ],
    demo: [
      'Bestaetigung der priorisierten Use-Cases',
      'Geleitete Demo der relevanten Flows (keine Feature-Show)',
      'Edge-Cases aus Discovery durchspielen',
      'Offene Fragen + naechste Schritte',
    ],
    kickoff: [
      'Ziele und Erfolgskriterien dokumentieren',
      'Rollen, Verantwortlichkeiten, Kontaktpfade',
      'Risiken + Dependencies',
      'Meilensteinplan',
    ],
    qbr: [
      'Status vs. Ziele (Daten zeigen, nicht behaupten)',
      'Erfolgsstories aus dem Quartal',
      'Hindernisse + Eskalationen',
      'Roadmap-Abgleich + Renewal-Signal',
    ],
    renewal: [
      'Value-Recap mit Zahlen',
      'Ausgewertete Risiken / Health-Score',
      'Erweiterungs-/Upsell-Optionen',
      'Renewal-Pfad und Vertragsdetails',
    ],
  };

  return {
    company: safeCompany,
    meetingType: type,
    agenda: agenda[type],
    openQuestions: [
      'Was waere fuer Sie ein "guter" Ausgang dieses Termins?',
      'Welche Alternativen oder bestehenden Loesungen sind im Spiel?',
      'Wer ist final entscheidend und was muss diese Person sehen?',
    ],
    redFlags: [
      'Keine offiziellen Stakeholder genannt',
      'Kein Erfolgskriterium quantifizierbar',
      'Timeline ohne Trigger-Event',
    ],
    guardrail:
      'Keine erfundenen Firmen-/Personenangaben. Unbekannte Felder leer lassen oder als Hypothese markieren.',
  };
}
