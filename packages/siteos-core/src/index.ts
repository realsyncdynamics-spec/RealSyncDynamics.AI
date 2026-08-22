// RealSync SiteOS — Core.
//
// Framework- und laufzeitfreier Kern der Plattform. Läuft unverändert in
// der SPA, in Supabase Edge Functions (Deno) und in Vitest (Node).
//
// Verwendung siehe README.md dieses Pakets.

export * from './types.ts';
export * from './canonical.ts';

export * from './blueprint/industries.ts';
export * from './blueprint/brief.ts';
export * from './blueprint/synthesize.ts';
export * from './blueprint/refine.ts';

export * from './analysis/blueprint.ts';
export * from './analysis/observation.ts';

export * from './scoring/scores.ts';

export * from './render/escape.ts';
export * from './render/theme.ts';
export * from './render/renderer.ts';
export * from './render/presentation.ts';
export * from './render/templates.ts';

export * from './deploy/artifact.ts';
export * from './publish/gate.ts';

export * from './agents/registry.ts';
export * from './agents/remediate.ts';

export { buildSiteFromPrompt } from './pipeline.ts';
