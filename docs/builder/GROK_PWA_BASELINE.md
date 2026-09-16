# grok-pwa-plugin.test.mjs — 8 red tests, baseline

Workspace file: `scripts/grok-pwa-plugin.test.mjs` (Grok sandbox only).

Git history of that file:

- Single commit: `119e11244bc18caea3029ca4533447b2ed1a9a98` — *Export from Grok* (2026-09-16).
- `git diff 119e112 HEAD -- scripts/grok-pwa-plugin.test.mjs` is empty.
- No builder commit touches this file.

Reproduced 2026-09-16: 47 tests, 39 pass, **8 fail** — identical set, all platform chrome:

1. platform chrome overwrites share-card metas and always sets og:title
2. published grok.me slug is still a title fallback
3. emits og:image for a public host and prefers a custom card
4. placeholder og:image appends site.color when it is 6-digit hex
5. document title entities are not double-escaped on og:title
6. injects into documents with no head element
7. streaming injector matches `</HEAD>` case-insensitively
8. uses the app name in the injected title tag

These are **pre-existing Grok platform tests**. Not a builder regression. Do not rewrite `public/__grok/`, `server/middleware/grok-pwa.ts`, or `grokPwaPlugin()`.
