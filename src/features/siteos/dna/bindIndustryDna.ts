// Bindet den Theme-Generator aus #2216 an einen SiteOS-Blueprint.
//
// Aufgerufen wird nur `generateTheme`, `publishTheme` und `remixTheme`.
// Die Distanzrechnung bleibt in dem Modul. Ohne diesen Aufruf trägt der
// Blueprint kein `dna`-Feld, und der Renderer bleibt beim bisherigen Theme.
//
// Die Startfarbe und die Systemschriften kommen aus den Seeds von #2197.
// `synthesize` bleibt unangetastet.

import {
  generateTheme,
  publishTheme,
  remixTheme,
  type GeneratorInput,
  type GeneratorResult,
} from '../../../app/theme/generator/generate';
import type { AxisId, DimensionId } from '../../../app/theme/generator/weights';
import {
  activeDnaVersion,
  appendDnaVersion,
  bindDnaOverlay,
  type SiteBlueprint,
  type SiteDnaGeneratorIndustry,
  type SiteDnaVersion,
} from '../../../../packages/siteos-core/src/index';
import { INDUSTRY_GENERATOR_MAP, INDUSTRY_THEME_SEEDS } from './industrySeeds';

const NOW = () => new Date().toISOString();

function toGeneratorLocks(locks: SiteDnaVersion['generatorInput']['locks']): GeneratorInput['locks'] {
  if (!locks) return undefined;
  return {
    dimensions: locks.dimensions as DimensionId[] | undefined,
    axes: locks.axes as AxisId[] | undefined,
  };
}

export interface IndustryDnaOptions {
  now?: string;
  /** Ersetzt die Startfarbe des Seeds. Muss ein Hex-Wert sein, den der Generator annimmt. */
  primaryColor?: string;
  locks?: GeneratorInput['locks'];
}

export interface IndustryDnaResult {
  blueprint: SiteBlueprint;
  activated: boolean;
  reason: string;
  version: SiteDnaVersion | null;
}

function attach(
  blueprint: SiteBlueprint,
  result: GeneratorResult,
  now: string,
  generatorIndustry: SiteDnaGeneratorIndustry,
  input: SiteDnaVersion['generatorInput'],
): IndustryDnaResult {
  const bound = bindDnaOverlay(result.overlay);
  const version: SiteDnaVersion = {
    schemaVersion: 1,
    hash: result.hash,
    status: result.status,
    overlay: bound.accepted,
    axes: result.axes,
    industry: blueprint.industry,
    generatorIndustry,
    createdAt: now,
    missingTokens: bound.missingTokens,
    rejectedTokens: bound.rejectedTokens,
    generatorInput: input,
  };
  const dna = appendDnaVersion(blueprint.dna, version);
  return {
    blueprint: { ...blueprint, dna },
    activated: dna.activeHash === version.hash,
    reason: result.reasons.join('; ') || (dna.activeHash === version.hash ? 'aktiviert' : 'nicht aktiviert'),
    version,
  };
}

/**
 * Erzeugt eine DNA-Fassung für die Branche des Blueprints und hängt sie
 * an eine Kopie. Der übergebene Blueprint bleibt unverändert.
 * `sonstiges` und jede Branche ohne Seed bleiben ohne DNA.
 */
export function withIndustryDna(blueprint: SiteBlueprint, options: IndustryDnaOptions = {}): IndustryDnaResult {
  const seed = INDUSTRY_THEME_SEEDS[blueprint.industry];
  const mapping = INDUSTRY_GENERATOR_MAP[blueprint.industry];
  if (!seed || !mapping) {
    return { blueprint, activated: false, reason: 'kein-branchen-seed', version: null };
  }
  const primaryColor = options.primaryColor ?? seed.accent;
  const brandFonts = { display: seed.fontDisplay, body: seed.fontBody };
  const generated = generateTheme({
    industry: mapping.generatorIndustry,
    tone: mapping.tone,
    primaryColor,
    brandFonts,
    locks: options.locks,
  });
  const published = publishTheme(generated);
  return attach(blueprint, published, options.now ?? NOW(), mapping.generatorIndustry, {
    tone: mapping.tone,
    primaryColor,
    brandFonts,
    locks: options.locks
      ? {
        dimensions: options.locks.dimensions ? [...options.locks.dimensions] : undefined,
        axes: options.locks.axes ? [...options.locks.axes] : undefined,
      }
      : undefined,
  });
}

/** Zweiter Lauf über `remixTheme`. Ohne aktive Fassung passiert nichts. */
export function remixBoundDna(blueprint: SiteBlueprint, options: { now?: string } = {}): IndustryDnaResult {
  const active = activeDnaVersion(blueprint.dna);
  if (!active) {
    return { blueprint, activated: false, reason: 'keine-aktive-dna', version: null };
  }
  const generated = generateTheme({
    industry: active.generatorIndustry,
    tone: active.generatorInput.tone as GeneratorInput['tone'],
    primaryColor: active.generatorInput.primaryColor,
    brandFonts: active.generatorInput.brandFonts,
    locks: toGeneratorLocks(active.generatorInput.locks),
  });
  const remixed = remixTheme(generated);
  return attach(blueprint, remixed, options.now ?? NOW(), active.generatorIndustry, {
    tone: active.generatorInput.tone,
    primaryColor: active.generatorInput.primaryColor,
    brandFonts: active.generatorInput.brandFonts,
    locks: active.generatorInput.locks,
  });
}
