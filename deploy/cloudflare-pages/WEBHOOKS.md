# Cloudflare Pages — Webhook-Pfad

Gemessen 2026-09-23: Preview `feat-landing-vip-cyan.realsyncdynamics-ai.pages.dev`
stand noch auf Commit `7225f56` (20.09.), obwohl der Branch längst neuere
Commits hatte. Ursache ist nicht Cache, sondern der **Trigger**.

## Was die Git-Integration sieht — und was nicht

| Ereignis | Cloudflare Git App baut Preview? |
|---|---|
| `git push` über Git-Protokoll / `gh` | ja |
| GitHub UI commit | ja |
| Contents API (`repos/.../contents`, Grok `push_files`) | **nein** |
| Merge über GitHub UI | ja |

Die App hängt am GitHub-`push`-Webhook der Installation. Die Contents-API
schreibt den Tree, feuert diesen Hook aber nicht zuverlässig. Deshalb bleibt
die Preview-URL auf dem letzten *Git-Push* stehen.

Der Beleg bleibt der Check-Run der App **Cloudflare Workers and Pages**,
nicht der Actions-Job gleichen Namens (`docs/runbooks/deployment-kette-messen.md`).

## Zweiter Pfad: Deploy Hook

Im Dashboard:

1. Workers & Pages → `realsyncdynamics-ai` → Settings → Deploy hooks
2. Hook anlegen, Name `github-preview`
3. URL nur als Repo-Secret `CF_PAGES_DEPLOY_HOOK` ablegen (nie committen)

Auslösen:

```bash
./scripts/trigger-pages-preview.sh
# oder
curl -sS -X POST "$CF_PAGES_DEPLOY_HOOK"
```

Der Hook baut den im Dashboard hinterlegten Branch (Production = `main`).
Für Feature-Branches reicht der Hook allein nicht — dort Direct Upload
(`wrangler pages deploy --branch=<git-branch>`).

## Dritter Pfad: repository_dispatch

```bash
curl -sS -X POST \
  -H "Accept: application/vnd.github+json" \
  -H "Authorization: Bearer $GITHUB_TOKEN" \
  https://api.github.com/repos/realsyncdynamics-spec/RealSyncDynamics.AI/dispatches \
  -d '{"event_type":"pages-preview","client_payload":{"branch":"feat/landing-vip-cyan"}}'
```

Workflow: `.github/workflows/pages-preview-hook.yml`.

Wenn `CLOUDFLARE_API_TOKEN` + `CLOUDFLARE_ACCOUNT_ID` gesetzt sind, lädt der
Job `dist/` per Wrangler auf **denselben Git-Branch-Namen** hoch. Die Preview-
URL bleibt `https://<branch>.realsyncdynamics-ai.pages.dev`.

Wenn nur `CF_PAGES_DEPLOY_HOOK` gesetzt ist, POST auf den Hook (Production-
Branch laut Dashboard).

## Produktions-Schutz

`pages deploy --branch=main` nur bei `push` auf `main`.
PRs und `repository_dispatch` nutzen `--branch=$GIT_BRANCH` und niemals Custom Domain.
