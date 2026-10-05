# Build Studio — Builder-01

Contract only. `/build` remains `BuildStudioPage`. SiteOS remains `/builder/:slug`. Code remains `/builder/:slug/code`.

No table. No second tenant. `published` does not deploy.

The decision lives here, next to the contract, not under `docs/` (context budget, `npm run check:context`).

Status: decision. Not a runtime, not a migration, not a publish path.

One studio, two existing engines. DesignOS is not a third builder and does not get a backend. `src/os/design/types.ts` is named in `docs/product/designos-architecture.md` and is not on `main`; this contract does not depend on it.

## What already exists

| Surface | Role | Stays |
|---|---|---|
| `src/unified-entry/pages/BuildStudioPage.tsx` | `/build` intent, local SiteOS blueprint, preview | yes |
| `/builder/:slug` | SiteOS / Puck workspace | yes |
| `/builder/:slug/code` | bolt code builder, `app_builder_projects` | yes |
| `src/config/frontend-entry-modes.ts` | which inputs the runtime may offer | yes |

`siteos_blueprints` and `app_builder_projects` stay separate. Tenant comes from the session, never from the URL. Publish stays behind the existing gate; public deploy is still preview (`builderEntitlements.ts`).

## Decision

`BuildProject` is a product identity, not a store.

- No `build_projects` table in this change.
- No single `engine` field. A later combined project is a second surface, not a migration.
- `landing` and `website` open a SiteOS surface. `web_app`, `dashboard` and `saas_app` open the existing code surface.
- A surface points at the store **slug**. Both stores version per `(tenant_id, slug, version)`; a row id would pin one version.
- `published` is a target status. It does not deploy. The stores keep their own status checks (`siteos_blueprints`: draft/approved/deployed/archived, `app_builder_projects`: draft/archived); `BuildProjectStatus` is not written to either.
- URL modernise and description are SiteOS entry modes. They are not a DesignOS extractor. Screenshot and media stay unavailable until `frontend-entry-modes.ts` says otherwise.

## Builder-02

`/build` asks for the kind. `landing`/`website` stay in the SiteOS flow; `web_app`/`dashboard`/`saas_app` continue at `/builder/<slug>/code` (`entry.ts`). `?kind=` preselects. The description is not handed to the code builder yet.

## Out of scope

Screenshot import, asset store, WebContainer, a new AI agent, Cloudflare production promotion, closing the old routes.
