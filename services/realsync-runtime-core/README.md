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

`vercel.json` setzt deshalb einen *Ignored Build Step*:

```json
{ "ignoreCommand": "exit 0" }
```

Exit-Code 0 bedeutet für Vercel „Build überspringen" (1 hieße „bauen"). Das
Deployment wird damit übersprungen statt zu scheitern.

**Das ist eine Notlösung, keine Reparatur.** Der richtige Schritt ist, die
Vercel-Integration für dieses Repository zu trennen — die Plattform deployt über
Cloudflare Pages und den VPS-Docker-Stack, nicht über Vercel. Sobald das erledigt
ist, kann diese Datei ersatzlos weg. Details und die Dashboard-Schritte stehen in
`DEPLOYMENT.md` unter „Deployment-Ziele".
