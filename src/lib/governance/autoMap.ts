/**
 * Auto-Mapping — leitet Control-Status deterministisch aus den strukturierten
 * Asset-Feldern ab (AI-Act-Klasse, Asset-Typ, Datentypen), statt sie manuell
 * je Control zu setzen.
 *
 * Pure, deterministisch, KEINE Side-Effects. Deno-Port unter
 * supabase/functions/_shared/autoMap.ts — bei Änderungen BEIDE Stellen anpassen.
 *
 * Grundsatz „nicht-destruktiv": Vorschläge überschreiben niemals eine manuell
 * gesetzte Zuordnung (source='manual'). Auto-gesetzte (source='auto') und noch
 * nicht bearbeitete Controls dürfen aktualisiert werden. Damit ist ein
 * wiederholter Lauf idempotent und respektiert menschliche Entscheidungen.
 */

export type ControlStatus = 'not_started' | 'in_progress' | 'implemented' | 'gap' | 'not_applicable';
export type MappingSource = 'manual' | 'auto';

export interface AssetProfile {
  /** governance_assets.asset_type */
  assetType: string;
  /** governance_assets.ai_act_class: minimal | limited | high | prohibited | unknown */
  aiActClass: string;
  /** governance_assets.data_types */
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

// Datentyp-Hinweise auf Personenbezug (DSGVO greift).
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

/**
 * Leitet aus dem Asset-Profil Status-Vorschläge für die übergebenen Controls ab.
 * Deckt EU AI Act (aus ai_act_class) und DSGVO (aus data_types) ab — dort sind
 * die Asset-Felder maßgeblich. Für andere Frameworks werden bewusst keine
 * Vorschläge geraten.
 */
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
        // KI, aber minimal/limited: Hochrisiko-Controls nicht anwendbar.
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

/**
 * Filtert Vorschläge gegen den Ist-Zustand: verwirft alles, was eine manuell
 * gesetzte Zuordnung überschreiben würde, sowie No-Ops (Status unverändert).
 */
export function reconcileProposals(proposals: AutoProposal[], current: CurrentMapping[]): AutoProposal[] {
  const byKey = new Map<string, CurrentMapping>();
  for (const m of current) byKey.set(key(m), m);

  return proposals.filter((p) => {
    const cur = byKey.get(key(p));
    if (!cur) return true;                        // neu → anwenden
    if (cur.source === 'manual') return false;    // menschliche Entscheidung → nie überschreiben
    return cur.status !== p.status;               // auto-owned → nur bei echter Änderung
  });
}

/** Bequemer Ein-Schritt-Aufruf: Vorschläge ableiten + gegen Ist-Zustand filtern. */
export function computeAutoMappings(
  profile: AssetProfile,
  controls: ControlRef[],
  current: CurrentMapping[],
): AutoProposal[] {
  return reconcileProposals(proposeControlStatuses(profile, controls), current);
}
