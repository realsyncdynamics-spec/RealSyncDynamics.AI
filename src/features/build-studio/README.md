# Build Studio — Builder-01

Contract only. `/build` remains `BuildStudioPage`. SiteOS remains `/builder/:slug`. Code remains `/builder/:slug/code`.

No table. No second tenant. `published` does not deploy.

Decision: `docs/product/build-studio-decision.md`.

Builder-02: `/build` asks for the kind. `landing`/`website` stay in the SiteOS flow; `web_app`/`dashboard`/`saas_app` continue at `/builder/<slug>/code` (`entry.ts`). `?kind=` preselects. The description is not handed to the code builder yet.
