// Rebuild-Workflow — öffentliche Oberfläche.
//
// DISCOVER → ASSESS → REBUILD → REFINE → PUBLISH → AUTOMATE → GOVERN.
//
// Schnitt 2 aus #1727: nur DISCOVER und ASSESS. Richtungen, Überarbeitung,
// Veröffentlichung und nächste Schritte folgen in eigenen, kleinen PRs.
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
