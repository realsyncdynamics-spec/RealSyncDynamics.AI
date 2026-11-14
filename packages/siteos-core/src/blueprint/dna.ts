// DNA-Versionen im bestehenden Blueprint-JSON.
//
// Keine Tabelle, keine Migration. Ein Blueprint ohne `dna` hat denselben
// kanonischen Hash wie vorher: `undefined` fällt in der Kanonisierung weg.
// Ältere Fassungen werden nicht gelöscht. Eine neue Fassung mit demselben
// Hash ersetzt nur den gleichlautenden Eintrag, nicht eine andere Fassung.

import type {
  IndustryKey,
  SiteDnaGeneratorIndustry,
  SiteDnaRecord,
  SiteDnaStatus,
  SiteDnaVersion,
} from '../types.ts';

const HASH = /^[0-9a-f]{64}$/;
const CREATED_AT = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/;
const INDUSTRIES = new Set<IndustryKey>([
  'zahnarzt',
  'arztpraxis',
  'rechtsanwalt',
  'steuerberatung',
  'handwerk',
  'gastronomie',
  'immobilien',
  'agentur',
  'ecommerce',
  'sonstiges',
]);
const GENERATOR_INDUSTRIES = new Set<SiteDnaGeneratorIndustry>([
  'handwerk-regional',
  'b2b-saas',
  'kanzlei-beratung',
  'gesundheit',
]);
const STATUSES = new Set<SiteDnaStatus>(['ready', 'warn', 'needs-editor']);

export class DnaRecordError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DnaRecordError';
  }
}

function isStringRecord(value: unknown): value is Record<string, string> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  return Object.values(value).every((item) => typeof item === 'string');
}

function assertVersion(version: SiteDnaVersion): void {
  if (version.schemaVersion !== 1) throw new DnaRecordError('DNA-Fassung hat die falsche schemaVersion.');
  if (!HASH.test(version.hash)) throw new DnaRecordError('DNA-Hash ist kein SHA-256.');
  if (!STATUSES.has(version.status)) throw new DnaRecordError('DNA-Status ist ungültig.');
  if (!INDUSTRIES.has(version.industry)) throw new DnaRecordError('DNA-Branche ist ungültig.');
  if (!GENERATOR_INDUSTRIES.has(version.generatorIndustry)) {
    throw new DnaRecordError('Generator-Branche liegt außerhalb der Taxonomie aus #2216.');
  }
  if (!CREATED_AT.test(version.createdAt)) throw new DnaRecordError('DNA-Zeitstempel ist kein UTC-ISO.');
  if (!isStringRecord(version.overlay) || Object.keys(version.overlay).length > 128) {
    throw new DnaRecordError('DNA-Overlay ist kein begrenztes Token-Objekt.');
  }
  const axes = version.axes;
  if (!axes || [axes['header-type'], axes['card-style'], axes['sidebar-form']].some((item) => typeof item !== 'string' || item === '')) {
    throw new DnaRecordError('DNA-Achsen fehlen.');
  }
  if (!Array.isArray(version.missingTokens) || !Array.isArray(version.rejectedTokens)) {
    throw new DnaRecordError('DNA-Tokenlisten fehlen.');
  }
  const input = version.generatorInput;
  if (!input || typeof input.tone !== 'string' || input.tone === '' || typeof input.primaryColor !== 'string') {
    throw new DnaRecordError('DNA-Eingabe für einen erneuten Lauf fehlt.');
  }
}

/** Aktive Fassung, oder `null`, wenn keine aktiv ist oder der Hash fehlt. */
export function activeDnaVersion(record: SiteDnaRecord | undefined): SiteDnaVersion | null {
  if (!record || record.activeHash === '') return null;
  return record.versions.find((version) => version.hash === record.activeHash) ?? null;
}

/**
 * Hängt eine Fassung an. `ready` und `warn` werden aktiv.
 * `needs-editor` wird gespeichert und nicht aktiviert.
 */
export function appendDnaVersion(record: SiteDnaRecord | undefined, version: SiteDnaVersion): SiteDnaRecord {
  assertVersion(version);
  const previous = record?.versions ?? [];
  const versions = previous.filter((item) => item.hash !== version.hash);
  versions.push(version);
  const activate = version.status === 'ready' || version.status === 'warn';
  return {
    schemaVersion: 1,
    activeHash: activate ? version.hash : (record?.activeHash ?? ''),
    versions,
  };
}

/** Setzt eine vorhandene Fassung aktiv. Entfernt keine Zeile. */
export function activateDnaVersion(record: SiteDnaRecord, hash: string): SiteDnaRecord {
  if (!record.versions.some((version) => version.hash === hash)) {
    throw new DnaRecordError('DNA-Version ist nicht im Verlauf.');
  }
  return {
    schemaVersion: 1,
    activeHash: hash,
    versions: record.versions.slice(),
  };
}
