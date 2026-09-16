# Grok App Builder Workspace Import

Source artifact: `grok-workspace.zip` supplied on 2026-09-16.

Target repository: `realsyncdynamics-spec/RealSyncDynamics.AI`

This branch is reserved for importing the Grok-generated App Builder workspace without modifying production `main` directly.

## Inspected workspace

The supplied workspace is a Vite/React/TypeScript App Builder implementation. Its relevant application code includes:

- `src/components/app-shell.tsx`
- `src/components/workbench-view.tsx`
- `src/components/lage-view.tsx`
- `src/components/layers-view.tsx`
- `src/components/plan-view.tsx`
- `src/lib/bolt/*` — Bolt-style generation engine, action runner, governance gate, file store, parser, preview and recovery
- `src/lib/auth/*`
- `src/lib/app-data/*`
- `src/routes/*`
- browser smoke, auth invariant, migration and preview scripts

The original archive also contains Grok-local metadata (`.grok/`), screenshots and generated binary assets. Those are import-source artifacts and should not be treated as production configuration.

## Integration guardrail

Do not overwrite the production landing page or deploy from this branch merely by importing the workspace. Integrate the App Builder into the existing RealSyncDynamics.AI product architecture, preserve current authentication/tenant boundaries, and run the repository's existing CI/security checks before merge.
