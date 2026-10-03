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
export * from './blueprint/edit.ts';
export * from './blueprint/pages.ts';

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

// Skills und Workflows als Vokabular über den Agenten (§8). Ordnet zu, führt
// nicht aus — die Ausführung bleibt bei den Agenten.
export * from './workflows/skills.ts';
export * from './workflows/workflows.ts';

export { buildSiteFromPrompt } from './pipeline.ts';

// AI Rebuild Workflow: DISCOVER → ASSESS → REBUILD → REFINE → PUBLISH →
// AUTOMATE → GOVERN. Bestehende Website-URL → belegte Bewertung → zwei
// bis drei gestaltete Richtungen → Klartext-Revision → Publish-Prüfung.
export * from './rebuild/types.ts';
export * from './rebuild/extract.ts';
export * from './rebuild/assess.ts';
export * from './rebuild/design-system.ts';
export * from './rebuild/components.ts';
export * from './rebuild/directions.ts';
export * from './rebuild/revise.ts';
export * from './rebuild/render.ts';
export * from './rebuild/blueprint-bridge.ts';
export * from './rebuild/publish.ts';
export * from './rebuild/next-steps.ts';
export * from './rebuild/workflow.ts';
