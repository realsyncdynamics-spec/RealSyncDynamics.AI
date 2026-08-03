# realsync-runtime-core

Fastify-Backend (Postgres, Redis, NATS), lauscht auf Port 4000. Läuft als
Container — siehe `Dockerfile` und `DOCKER_SETUP.md` im Repo-Root.

```bash
npm run dev      # node --watch src/index.js
npm start        # node src/index.js
npm run migrate  # node src/db/migrate.js
```

Es gibt bewusst **kein** `build`-Script: der Dienst wird nicht gebündelt,
sondern als Quellcode ins Image kopiert und dort gestartet.

## Warum hier eine `vercel.json` liegt

Nicht weil der Dienst auf Vercel liefe — er tut es nicht und kann es nicht.

Ein Vercel-Projekt (`real-sync-dynamics-ai`, Team `realsynchost-c3f4cfdf`) hat
sein Root Directory auf dieses Verzeichnis gezeigt und versucht bei jedem Push
einen Build, der mangels `build`-Script scheitert. Das erzeugte an jedem Pull
Request einen roten Check.

`vercel.json` schaltet deshalb die Git-Deployments für dieses Projekt ab:

```json
{ "git": { "deploymentEnabled": false } }
```

Vercel legt damit für Pushes gar kein Deployment mehr an.

*Zur Historie:* Auf dem Branch dieser PR stand zuerst ein *Ignored Build Step*
(`{"ignoreCommand": "exit 0"}`). Der wirkte auch — gemessen am Commit `4179289`
führte der Vercel-Bot das Deployment als `Ignored`, und der Sammelstatus
`Vercel Deployments – realsynchost` kippte von „1 required project failed to
deploy" auf „All required and affected projects deployed". Parallel kam über
PR #844 die obige Variante nach `main`. Beim Merge wurde sie übernommen, weil
sie das Deployment von vornherein verhindert, statt es anzulegen und dann zu
überspringen.

Die beiden projektbezogenen Status (`Vercel – …`) melden unabhängig davon
weiterhin `Account is blocked`.

**Das ist eine Notlösung, keine Reparatur.** Der richtige Schritt ist, die
Vercel-Integration für dieses Repository zu trennen — die Plattform deployt über
Cloudflare Pages und den VPS-Docker-Stack, nicht über Vercel. Sobald das erledigt
ist, kann diese Datei ersatzlos weg. Details und die Dashboard-Schritte stehen in
`DEPLOYMENT.md` unter „Deployment-Ziele".
