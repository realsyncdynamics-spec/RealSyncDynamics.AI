// Auto-Mapping — Deno-Port von src/lib/governance/autoMap.ts.
// Bei Änderungen BEIDE Stellen anpassen (die TS-Suite testet das Original).
//
// Leitet Control-Status deterministisch aus den strukturierten Asset-Feldern ab
// (AI-Act-Klasse, Asset-Typ, Datentypen). Nicht-destruktiv: manuelle
// Zuordnungen (source='manual') werden nie überschrieben.

export type ControlStatus = 'not_started' | 'in_progress' | 'implemented' | 'gap' | 'not_applicable';
export type MappingSource = 'manual' | 'auto';

export interface AssetProfile {
  assetType: string;
  aiActClass: string;
  dataTypes: string[];
}

export interface ControlRef {
  framework: string;
  control_code: string;
}

export interface CurrentMapping {
  framework: string;
  control_code: string;
  status: ControlStatus;
  source: MappingSource;
}

export interface AutoProposal {
  framework: string;
  control_code: string;
  status: ControlStatus;
  rationale: string;
}

const AI_ASSET_TYPES = new Set(['ai_system', 'model', 'agent']);
const AI_ACT_REAL_CLASSES = new Set(['minimal', 'limited', 'high', 'prohibited']);

const PERSONAL_DATA_HINTS = [
  'pii', 'personal', 'personenbezogen', 'customer', 'kunden', 'employee',
  'mitarbeiter', 'health', 'gesundheit', 'email', 'e-mail', 'phone', 'telefon',
  'address', 'adresse', 'name', 'biometric', 'biometr', 'iban', 'payment',
  'zahlung', 'credit', 'ssn', 'passport', 'dob', 'birth', 'geburt',
];

function key(c: ControlRef): string {
  return `${c.framework}::${c.control_code}`;
}

function isAiAsset(profile: AssetProfile): boolean {
  return AI_ASSET_TYPES.has(profile.assetType) || AI_ACT_REAL_CLASSES.has(profile.aiActClass);
}

function hasPersonalData(dataTypes: string[]): boolean {
  return dataTypes.some((dt) => {
    const d = dt.toLowerCase();
    return PERSONAL_DATA_HINTS.some((h) => d.includes(h));
  });
}

export function proposeControlStatuses(profile: AssetProfile, controls: ControlRef[]): AutoProposal[] {
  const out: AutoProposal[] = [];
  const seen = new Set<string>();
  const ai = isAiAsset(profile);
  const highRiskAi = profile.aiActClass === 'high' || profile.aiActClass === 'prohibited';
  const pii = hasPersonalData(profile.dataTypes);

  for (const c of controls) {
    const k = key(c);
    if (seen.has(k)) continue;

    if (c.framework === 'EU_AI_ACT') {
      if (highRiskAi) {
        out.push({ ...c, status: 'gap', rationale: `Asset als ${profile.aiActClass === 'prohibited' ? 'verbotenes' : 'Hochrisiko-'}KI-System klassifiziert — EU-AI-Act-Pflicht offen.` });
        seen.add(k);
      } else if (!ai) {
        out.push({ ...c, status: 'not_applicable', rationale: 'Kein KI-System — EU-AI-Act-Hochrisiko-Pflichten nicht anwendbar.' });
        seen.add(k);
      } else {
        out.push({ ...c, status: 'not_applicable', rationale: `KI mit Risikoklasse „${profile.aiActClass}" — Hochrisiko-Controls nicht anwendbar.` });
        seen.add(k);
      }
      continue;
    }

    if (c.framework === 'GDPR' && pii) {
      out.push({ ...c, status: 'gap', rationale: 'Asset verarbeitet personenbezogene Daten — DSGVO-Control offen.' });
      seen.add(k);
      continue;
    }
  }

  return out;
}

export function reconcileProposals(proposals: AutoProposal[], current: CurrentMapping[]): AutoProposal[] {
  const byKey = new Map<string, CurrentMapping>();
  for (const m of current) byKey.set(key(m), m);

  return proposals.filter((p) => {
    const cur = byKey.get(key(p));
    if (!cur) return true;
    if (cur.source === 'manual') return false;
    return cur.status !== p.status;
  });
}

export function computeAutoMappings(
  profile: AssetProfile,
  controls: ControlRef[],
  current: CurrentMapping[],
): AutoProposal[] {
  return reconcileProposals(proposeControlStatuses(profile, controls), current);
}
