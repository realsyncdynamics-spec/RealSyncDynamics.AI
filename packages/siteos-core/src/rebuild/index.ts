// Rebuild-Workflow — öffentliche Oberfläche.
//
// DISCOVER → ASSESS → REBUILD → REFINE → PUBLISH → AUTOMATE → GOVERN.
//
// Schnitt 2 aus #1727: DISCOVER und ASSESS. Schnitt 2b: REBUILD (Design-
// System, Copy, Richtungen), REFINE und AUTOMATE (nächste Schritte).
// Backend-Vergleich und Veröffentlichungs-Checkliste folgen mit PUBLISH.
//
// Bewusst kuratiert statt `export *`: Die Hilfsmodule (HTML-Leser, CSS,
// Farben) bleiben intern; nach außen gehen die Stufen und ihre Typen.

export * from './types.ts';

// DISCOVER
export {
  REBUILD_USER_AGENT,
  canonicalPageKey,
  isBlockedAddress,
  isPublicHttpUrl,
  normalizeInputUrl,
  parseRobots,
  parseSitemap,
  planCrawl,
  robotsAllows,
  type AddressCheck,
  type CrawlCandidate,
  type RobotsRules,
} from './crawl.ts';
export { discoverPageResources, extractPage, type ExtractInput, type ExtractResult, type PageResources } from './extract.ts';
export { buildSnapshot, evidenceById, sealSnapshot, type SnapshotInput } from './snapshot.ts';
export { toWellFormed, wellFormedText } from './well-formed.ts';

// ASSESS
export { derivePositioning, localityFromText } from './positioning.ts';
export { ASSESSMENT_PENALTIES, CRITERION_LABELS, assessSnapshot } from './assess.ts';

// REBUILD
export {
  accentTextFor,
  brandFromDesign,
  deriveDesignSpec,
  directionLabel,
  readBrandSignals,
  themeFromDesign,
  type BrandSignals,
  type DirectionKey,
} from './design-system.ts';
export { composeHero, composeSeo, findUnbackedClaims, sourceCorpus, type HeroCopy, type SeoCopy } from './copy.ts';
export {
  buildDirection,
  buildDirections,
  planDirections,
  redirectsForBlueprint,
  type BuildDirectionOptions,
  type DirectionBuild,
  type DirectionPlan,
  type FormTargetHint,
  type SectionReport,
} from './directions.ts';

// REFINE
export {
  REVISION_INTENTS,
  describeDesignDiff,
  isRevisionIntentKey,
  matchIntents,
  reviseBlueprint,
  type RevisionIntent,
  type RevisionIntentKey,
  type RevisionRequest,
  type RevisionResult,
} from './intents.ts';

// AUTOMATE / GOVERN
export { planNextSteps, type ConnectionState, type ConnectorState, type NextStep, type NextStepInput, type NextStepKey } from './next-steps.ts';
