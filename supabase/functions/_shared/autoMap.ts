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
  tenantIndustry?: string; // Tenant-Branche für Industry-spezifische Controls
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
  'diagnosis', 'diagnose', 'treatment', 'therapie', 'genetic', 'genetisch',
  'race', 'ethnicity', 'religion', 'political', 'sexual', 'orientation',
];

// Industry-spezifische Control-Frameworks
const HEALTHCARE_INDICATORS = new Set(['healthcare', 'medical', 'pharma', 'klinik', 'praxis']);
const FINANCE_INDICATORS = new Set(['finance', 'banking', 'insurance', 'finanz', 'versicherung']);
const LEGAL_INDICATORS = new Set(['legal', 'law', 'jura', 'rechtsanwalt', 'anwaltskanzlei']);

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

function hasSpecialCategoryData(dataTypes: string[]): boolean {
  // DSGVO Art. 9 — Besondere Kategorien personenbezogener Daten
  const specialCategoryHints = ['health', 'gesundheit', 'diagnosis', 'diagnose', 'genetic', 'genetisch', 'race', 'ethnicity', 'religion', 'political', 'sexual', 'biometric', 'biometr'];
  return dataTypes.some((dt) => {
    const d = dt.toLowerCase();
    return specialCategoryHints.some((h) => d.includes(h));
  });
}

function isHealthcareIndustry(industry?: string): boolean {
  if (!industry) return false;
  return HEALTHCARE_INDICATORS.has(industry.toLowerCase());
}

export function proposeControlStatuses(profile: AssetProfile, controls: ControlRef[]): AutoProposal[] {
  const out: AutoProposal[] = [];
  const seen = new Set<string>();
  const ai = isAiAsset(profile);
  const highRiskAi = profile.aiActClass === 'high' || profile.aiActClass === 'prohibited';
  const pii = hasPersonalData(profile.dataTypes);
  const specialData = hasSpecialCategoryData(profile.dataTypes);
  const isHealthcare = isHealthcareIndustry(profile.tenantIndustry);

  for (const c of controls) {
    const k = key(c);
    if (seen.has(k)) continue;

    // EU AI Act — Risikobasiert
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

    // GDPR — Standard + Besondere Kategorien
    if (c.framework === 'GDPR') {
      if (specialData) {
        out.push({ ...c, status: 'gap', rationale: 'Asset verarbeitet besondere Kategorien gem. DSGVO Art. 9 — strikte Compliance erforderlich.' });
        seen.add(k);
        continue;
      }
      if (pii) {
        out.push({ ...c, status: 'gap', rationale: 'Asset verarbeitet personenbezogene Daten — DSGVO-Control offen.' });
        seen.add(k);
        continue;
      }
    }

    // Industry-spezifische Controls
    if (isHealthcare && c.framework === 'HEALTHCARE') {
      out.push({ ...c, status: 'gap', rationale: 'Healthcare-Industry — regulatorische Compliance erforderlich.' });
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
