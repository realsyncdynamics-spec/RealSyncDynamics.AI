# Platform-Monorepo (`platform/`) — Details (Archiv)

> Ausgelagert aus `CLAUDE.md` §7. Kurzfassung steht dort; hier der volle Text.
> Ergänzend: `platform/README.md`.

### 🏗️ Platform-Monorepo (`platform/`) — Website Builder + Governance

In-sich-geschlossener Microservice-Stack für **automatisierte Website-Generierung mit Compliance-Gating**:

**Struktur:**
```
platform/
├── builder_orchestrator/    Python/FastAPI — AI-App-Builder
│                             • Multi-Agent-Task-Graph
│                             • BuildSpec → Code-Generierung
│                             • OpenAPI: /docs
├── governance_backend/       Python/FastAPI — Risk & Compliance Engine
│                             • EU-AI-Act-Konformität
│                             • CI/CD-Gate-Engine
│                             • Audit-Log + Telemetrie
├── nextjs_frontend/          Next.js — Builder-Cockpit + Governance-UI
├── migrations/               SQL-Migrations (Postgres)
├── docker-compose.yml        Lokale Orchestrierung (alle 4 Services)
└── README.md                 Workflow, API-Nutzung, Start-Guide
```

**Start (lokal):**
```bash
cd platform
cp .env.example .env
docker compose up --build
```

**Zugang:**
- Builder-API: http://builder.localhost/docs (Port 8001)
- Governance-API: http://rsd.localhost/docs (Port 8002)
- Frontend: http://app.localhost (Port 3000)
- Traefik-Dashboard: http://localhost:8080

**Zweck:** Die Seite wird **weder** von der Root-package.json noch vom Root-npm noch in den
Root-CI/CD-Workflows verwaltet. Sie ist physisch ein eigenständiges Projekt, das
`docker compose` koordiniert. Änderungen dort brauchen weder `npm run lint` noch
`npm run build` in der Root — nur Docker.

**Modifikationen im `platform/`:**
- Keine Node-Dependencies (alles Python/Deno)
- RLS + Migrations wie im Hauptrepo (selbe DB-Conn in `docker-compose.yml`)
- OpenAPI-First: Endpoints mit `@app.post`, `@app.get` + Schemas in Pydantic
- Prüfpfad: `audit_log` + `workflow_runs` (selbe Tabellen wie Root-Governance)
- **Der PDP ist auch hier der Entscheider** (P2-4, seit 2026-09-04):
  `app/services/pdp_client.py` ruft `governance-decide`; die CI/CD-Gate-Engine
  faltet das Verdikt in ihre Entscheidung ein. Der PDP kann nur **verschärfen**,
  nie lockern — ein `allow` hebt keine lokale Sperre auf.
  `GOVERNANCE_PDP_MODE=off|shadow|enforce`, Default `shadow`.
- **Tests hier laufen mit `pytest`, nicht mit Vitest**:
  `cd platform/governance_backend && pip install -r requirements.txt && pytest`.
  Stand 2026-09-04: 93 passed, 14 skipped, **7 vorbestehend rot** in
  `test_config.py` und `test_security_headers.py` (erwarten Umgebungsvariablen
  bzw. eine Datenbank). Gegen den unveränderten Stand gegengeprüft — wer hier
  arbeitet, sollte sie nicht für eigene Fehler halten.

