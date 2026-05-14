// Legal-Contract-Review Skill — pure Helper. KEINE Rechtsmeinung.

export type Severity = 'cosmetic' | 'minor' | 'material' | 'showstopper';
export type ContractType = 'nda' | 'mnda' | 'msa' | 'dpa' | 'sow' | 'eula';
export type UserSide = 'vendor' | 'customer';

export interface RedlineStep {
  order: number;
  focus: string;
  guardrail: string;
}

export interface RedlineReviewPlan {
  contractType: ContractType;
  userSide: UserSide;
  steps: RedlineStep[];
  disclaimer: string;
}

const DISCLAIMER =
  'Output ist eine technische Strukturhilfe und stellt keine Rechtsberatung dar. ' +
  'Vor Annahme/Versand durch qualifizierte Fachleute pruefen lassen.';

export function classifyClauseDeviation(severity: string): { severity: Severity; reviewRequired: boolean } {
  const allowed: Severity[] = ['cosmetic', 'minor', 'material', 'showstopper'];
  if (!allowed.includes(severity as Severity)) throw new Error(`unknown severity: ${severity}`);
  const sev = severity as Severity;
  const reviewRequired = sev === 'material' || sev === 'showstopper';
  return { severity: sev, reviewRequired };
}

function validateContractType(c: string): ContractType {
  const allowed: ContractType[] = ['nda', 'mnda', 'msa', 'dpa', 'sow', 'eula'];
  if (!allowed.includes(c as ContractType)) throw new Error(`unknown contractType: ${c}`);
  return c as ContractType;
}
function validateSide(s: string): UserSide {
  if (s !== 'vendor' && s !== 'customer') throw new Error(`userSide must be vendor|customer`);
  return s;
}

export function buildRedlineReviewPlan(contractType: string, userSide: string): RedlineReviewPlan {
  const ct = validateContractType(contractType);
  const us = validateSide(userSide);

  const generic: RedlineStep[] = [
    { order: 1, focus: 'Parteien + Definitionen sauber abgleichen', guardrail: 'Keine Annahmen ohne Beleg.' },
    { order: 2, focus: 'Haftung / Limitation of Liability', guardrail: 'Materialitaet markieren, kein Auto-Sign.' },
    { order: 3, focus: 'IP / Lizenzumfang', guardrail: 'Werknutzung explizit, sonst flaggen.' },
    { order: 4, focus: 'Termination + Auswirkungen', guardrail: 'Datenrueckgabe/-loeschung sichern.' },
    { order: 5, focus: 'Datenschutz / DPA-Anhang', guardrail: 'Schrems-II-Massnahmen mitfuehren.' },
  ];
  const ctSpecific: Partial<Record<ContractType, RedlineStep[]>> = {
    nda: [{ order: 6, focus: 'Definition Vertraulichkeit + Ausnahmen', guardrail: 'Ausnahmenliste validieren.' }],
    msa: [{ order: 6, focus: 'SLA + Service-Credits', guardrail: 'Messmethode klar definieren.' }],
    dpa: [{ order: 6, focus: 'Sub-Processor-Liste + Notification', guardrail: 'Schrems-II Pruefung mitfuehren.' }],
    sow: [{ order: 6, focus: 'Change Control + Akzeptanzkriterien', guardrail: 'Annahmekriterien quantifizieren.' }],
  };
  const sideHint: RedlineStep = us === 'vendor'
    ? { order: 99, focus: 'Verteidigungs-Fallbacks fuer kritische Klauseln vorbereiten', guardrail: 'Eskalation an Legal-Lead.' }
    : { order: 99, focus: 'Eskalationsoptionen + Out-Klauseln pruefen', guardrail: 'Eskalation an Legal-Lead.' };

  return {
    contractType: ct,
    userSide: us,
    steps: [...generic, ...(ctSpecific[ct] ?? []), sideHint],
    disclaimer: DISCLAIMER,
  };
}
