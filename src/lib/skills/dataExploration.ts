// Data-Exploration Skill — pure Helper. Keine externen Calls.

export type ColumnType = 'id' | 'numeric' | 'datetime' | 'categorical' | 'text' | 'boolean' | 'unknown';

export interface ColumnClassification {
  name: string;
  type: ColumnType;
  reason: string;
}

const ID_RE = /(^id$|_id$|uuid|guid)/i;
const DATE_RE = /^\d{4}-\d{2}-\d{2}([ T]\d{2}:\d{2})?/;
const BOOL_VALUES = new Set(['true', 'false', '0', '1', 'yes', 'no', 'ja', 'nein']);

function validateInput(name: string, sampleValues: readonly unknown[]): void {
  if (typeof name !== 'string' || !name) throw new Error('column name required');
  if (!Array.isArray(sampleValues)) throw new Error('sampleValues must be array');
}

export function classifyColumn(name: string, sampleValues: readonly unknown[]): ColumnClassification {
  validateInput(name, sampleValues);
  const cleaned = sampleValues.filter((v) => v !== null && v !== undefined && v !== '').slice(0, 50);

  if (ID_RE.test(name) && cleaned.every((v) => typeof v === 'string' || typeof v === 'number')) {
    return { name, type: 'id', reason: 'Name passt auf ID-Muster' };
  }
  if (cleaned.length === 0) return { name, type: 'unknown', reason: 'leere Probe' };

  const allBool = cleaned.every((v) => BOOL_VALUES.has(String(v).toLowerCase()));
  if (allBool) return { name, type: 'boolean', reason: 'Werte in {true,false,0,1,yes,no}' };

  const allNumeric = cleaned.every((v) => typeof v === 'number' || /^-?\d+(\.\d+)?$/.test(String(v).trim()));
  if (allNumeric) return { name, type: 'numeric', reason: 'alle Werte numerisch parsebar' };

  const allDate = cleaned.every((v) => DATE_RE.test(String(v).trim()));
  if (allDate) return { name, type: 'datetime', reason: 'ISO-Date-Muster erkannt' };

  const distinct = new Set(cleaned.map((v) => String(v))).size;
  if (distinct <= Math.max(10, Math.floor(cleaned.length * 0.2))) {
    return { name, type: 'categorical', reason: `geringe Kardinalitaet (${distinct})` };
  }
  return { name, type: 'text', reason: 'hohe Kardinalitaet, freitext-aehnlich' };
}

export interface DataProfilingPlan {
  steps: string[];
  perColumn: Array<{ name: string; type: ColumnType; checks: string[] }>;
  guardrails: string[];
}

export function buildDataProfilingPlan(columns: ColumnClassification[]): DataProfilingPlan {
  const perColumn = columns.map((c) => ({
    name: c.name,
    type: c.type,
    checks: checksFor(c.type),
  }));
  return {
    steps: [
      'Zeilenanzahl, Duplikate, Null-Anteile pro Spalte',
      'Pro Spalte typ-spezifische Kennzahlen',
      'Korrelationen zwischen numerischen Spalten',
      'Aggregat-Output, keine PII-Rohwerte zurueckspielen',
    ],
    perColumn,
    guardrails: ['Keine sensiblen Rohdaten im Output wiederholen — Aggregate bevorzugen.'],
  };
}

function checksFor(type: ColumnType): string[] {
  switch (type) {
    case 'numeric':     return ['min', 'max', 'mean', 'p50', 'p95', 'outlier_share'];
    case 'datetime':    return ['min', 'max', 'gap_count', 'monotonic'];
    case 'categorical': return ['top_n', 'cardinality', 'mode_share'];
    case 'boolean':     return ['true_share'];
    case 'id':          return ['uniqueness', 'null_share'];
    case 'text':        return ['avg_length', 'pii_hint'];
    default:            return ['null_share'];
  }
}
