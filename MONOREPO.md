# RealSyncDynamics.AI — Monorepo-Navigation

**Status:** Production-Ready (Phase 2) | **Go-live:** 2026-08-01

Diese Datei ist die **zentrale Navigationshilfe** durch das Monorepo. Sie beschreibt
alle Packages, Services und Workspaces — wo sie sind, was sie tun, wie man sie startet.

---

## 🗺️ Übersicht

```
RealSyncDynamics.AI (Monorepo-Root)
├── [Vite/React SPA] ← Hauptanwendung (npm run dev)
├── [Node/TS Services] ← Apps & Services (Docker)
├── [Supabase Backend] ← Edge Functions + Postgres
└── [🏗️ Platform-Monorepo] ← Website Builder (docker compose)
```

---

## 1️⃣ Hauptanwendung — Vite/React SPA (Root)

**Ort:** `/` (Root)  
**Stack:** Vite 6 · React 19 · TypeScript 5.8 · Tailwind 4  
**Routing:** react-router-dom 7 (Client-Side)  
**DB:** Supabase (EU-Region Frankfurt)  
**Deploy:** Cloudflare Pages + GitHub Actions

### Start
```bash
npm install
cat > .env.local <<EOF
VITE_SUPABASE_URL=https://ebljyceifhnlzhjfyxup.supabase.co
VITE_SUPABASE_ANON_KEY=<aus Dashboard>
EOF
npm run dev      # http://localhost:3000
```

### Struktur
```
src/
├── pages/          104+ öffentliche Seiten (eager-imported)
├── features/       Auth-gated Module (lazy-loaded)
├── components/     Shared UI-Komponenten
├── config/         Zentrale Konfiguration (Industries, SEO, etc.)
├── core/           Provider (TenantProvider, Auth, etc.)
├── hooks/          Wiederverwendbare React Hooks
├── lib/            Utilities (Tracking, Auth, etc.)
└── App.tsx         Routing-Root
```

### Wichtige Befehle
| Zweck | Befehl |
|---|---|
| Dev | `npm run dev` |
| Build | `npm run build` |
| Lint/Types | `npm run lint` |
| Tests | `npm test` |
| E2E | `npm run e2e` |
| Prod-Check | `npm run check:production` |

### Links
- **Live:** https://realsyncdynamicsai.de
- **Dev:** http://localhost:3000
- **Datei:** [`src/App.tsx`](src/App.tsx)
- **Doku:** [`CLAUDE.md`](CLAUDE.md) (Abschnitt 2–7)

---

## 2️⃣ Backend — Supabase (Edge Functions + Database)

**Ort:** `supabase/`  
**Stack:** Deno/TypeScript · PostgreSQL 16 · RLS · Realtime  
**Provider:** Supabase Cloud (EU)

### Edge Functions
```
supabase/functions/
├── ai-invoke/                    AI-Tool-Pipeline mit Residency-Routing
├── workflow-trigger/             n8n-Bridge
├── stripe-*/                     Stripe Webhooks + Metering
├── gdpr-*/                       DSGVO Art. 15/17
├── governance-*/                 Governance-Gates + Policies
├── evidence-*/                   Evidence-Vault Operationen
├── audit-*/                      Prüfpfad-Events
└── [120+ mehr]
```

### Start Lokal
```bash
supabase start          # Postgres + Functions lokal
supabase functions serve
```

### Migrations
```
supabase/migrations/
├── 001_init_core_tables.sql
├── 002_rls_policies.sql
├── [242 mehr]
└── 244_latest_schema.sql
```

**Wichtig:** Migrations sind immer **additiv**. Niemals destruktiv.  
Test: `npm run test:db`

### Links
- **Dashboard:** https://supabase.com/dashboard
- **Doku:** [`supabase/README.md`](supabase/README.md)
- **Funktionen:** `supabase functions list`

---

## 3️⃣ Node/TypeScript Services (Docker)

Spezialisierte containerisierte Workloads. Jeder Service hat `Dockerfile` + `docker-compose.yml`.

### 3a. Agent Runtime
**Ort:** `apps/agent-runtime/`  
**Stack:** Node.js · TypeScript · Docker  
**Zweck:** Orchestrierung autonomer KI-Agenten  
**Deploy:** Docker (Hostinger VPS oder Cloudflare)

```bash
cd apps/agent-runtime
npm install
docker build -t agent-runtime .
docker run -p 3001:3001 agent-runtime
```

### 3b. Weitere Services
**Ort:** `services/`
- `realsync-runtime-core/` — Runtime-Kern
- `realsync-evidence-runtime/` — Evidence-Verarbeitung
- `openclaw-agent/` — Agent-Worker
- `playwright-scanner/` — DSGVO-Scan-Service

Jeder Service:
- Hat `Dockerfile`
- Deploybar als eigenständiger Container
- Verbunden mit selber Postgres (RLS)

```bash
docker-compose -f deploy/docker-compose.yml up --build
```

### Links
- **Deployment:** [`deploy/README.md`](deploy/README.md)
- **Infra-Code:** `deploy/`, `docker/`

---

## 4️⃣ 🏗️ Platform-Monorepo — Website Builder + Governance

**Ort:** `platform/`  
**Stack:** Python 3.11+ · FastAPI · Postgres · Docker Compose  
**Zweck:** AI-gesteuerte Website-Generierung mit Compliance-Gating

### Was es tut
```
BuildSpec (JSON)
   ↓
builder_orchestrator (FastAPI)
   ├─ register_project → governance_backend (Risk-Evaluator)
   ├─ build_task_graph (Multi-Agent Scheduler)
   ├─ run_agents (Planner → Architect → Coders → DevOps)
   └─ await governance_gate
        ├─ blocked ⇒ Deployment verweigert
        └─ approved ⇒ Deploy aktiviert
   ↓
Website + Audit-Log
```

### Services

#### 4a. builder_orchestrator (Port 8001)
- **Ort:** `platform/builder_orchestrator/`
- **Endpoints:** `/docs` (OpenAPI), `/api/v1/builder/*`
- **Host (lokal):** `builder.localhost:8001`
- **Zweck:** Task-Graph-Scheduler, Agent-Runner, BuildSpec-Parser
- **Input:** `BuildSpec` (Website-Definition)
- **Output:** Website-Code + Audit-Log

#### 4b. governance_backend (Port 8002)
- **Ort:** `platform/governance_backend/`
- **Endpoints:** `/docs`, `/api/v1/governance/*`
- **Host (lokal):** `rsd.localhost:8002`
- **Zweck:** Risk-Evaluator, CI/CD-Gate, Telemetrie
- **Input:** Projekt-Metadata (Datentypen, Modelle, Subjekte)
- **Output:** Risk-Tier + Required-Gates

#### 4c. nextjs_frontend (Port 3000)
- **Ort:** `platform/nextjs_frontend/`
- **Host (lokal):** `app.localhost:3000`
- **Zweck:** Builder-Steuerung, Governance-Cockpit
- **Note:** Unabhängiges Next.js-Projekt (kein Bezug zu Root-Vite)

#### 4d. Postgres (Port 5432)
- **Ort:** `platform/docker-compose.yml`
- **Schema:** Shared mit Root-Supabase (selbe `audit_log`, `workflow_runs` etc.)
- **Note:** Lokal `postgres` (kein Supabase-Emulator), aber RLS aktiv

### Start

```bash
cd platform
cp .env.example .env
docker compose up --build

# Warten auf alle Services (30–60s)
```

**Zugang (nach Start):**
- Builder-OpenAPI: http://builder.localhost/docs
- Governance-OpenAPI: http://rsd.localhost/docs
- Frontend: http://app.localhost
- Traefik-Dashboard: http://localhost:8080
- Postgres (direkt): `localhost:5432`

Falls `.localhost` nicht auflöst → `/etc/hosts` anpassen:
```
127.0.0.1 builder.localhost rsd.localhost app.localhost
```

### Struktur

```
platform/
├── builder_orchestrator/
│   ├── app/
│   │   ├── agents/           Agent-Definitionen (Planner, Architect, Coders)
│   │   ├── clients/          Clients für externe APIs
│   │   ├── services/         Core-Logik (TaskGraph, Scheduler, Gating)
│   │   ├── main.py           FastAPI-App
│   │   └── schemas.py        Pydantic-Models
│   ├── migrations/           SQL-Migrations
│   ├── tests/                pytest-Tests
│   ├── Dockerfile
│   └── requirements.txt
├── governance_backend/
│   ├── app/
│   ├── migrations/
│   ├── Dockerfile
│   └── requirements.txt
├── nextjs_frontend/
│   ├── src/
│   ├── package.json
│   ├── Dockerfile
│   └── next.config.js
├── migrations/               Shared Postgres-Migrations
├── docker-compose.yml        Orchestrierung aller 4 Services
├── .env.example
└── README.md                 Detaillierter Workflow + API-Doku
```

### Workflow (curl-Beispiel)

```bash
# 1. Projekt registrieren
curl -X POST http://localhost:8002/api/v1/governance/register-project \
  -H 'Content-Type: application/json' \
  -d '{
    "project_name": "MyWebsite",
    "description": "E-Commerce Platform",
    "data_types": ["payment", "personal"],
    "data_subjects": ["customers"],
    "models": ["claude-3-5-sonnet"],
    "llm_provider": "anthropic"
  }'
# → {"project_id": "prj_xyz", "risk_tier": "high", "required_gates": […]}

# 2. BuildSpec einreichen
curl -X POST http://localhost:8001/api/v1/builder/create-spec \
  -H 'Content-Type: application/json' \
  -d '{
    "project_id": "prj_xyz",
    "spec": {
      "name": "MyWebsite",
      "pages": […],
      "data_flow": […],
      "integrations": […]
    }
  }'
# → {"build_id": "bld_123", "status": "queued"}

# 3. Progress beobachten (SSE)
curl http://localhost:8001/api/v1/builder/events?build_id=bld_123

# 4. Gate-Status prüfen
curl http://localhost:8002/api/v1/governance/gate-check \
  -d '{"build_id": "bld_123"}'
# → {"status": "approved", "gates_passed": […]}
```

### Wichtige Commands

```bash
# Alle Services (lokal starten)
cd platform && docker compose up --build

# Nur ein Service
docker compose up --build builder_orchestrator

# Logs folgen
docker compose logs -f builder_orchestrator

# Migrations (lokal)
docker compose exec -T postgres psql -U postgres -d realsync < migrations/001_init.sql

# Tests (im Service)
docker compose exec builder_orchestrator pytest tests/

# Herunterfahren
docker compose down
```

### Wichtige Dateien

| Datei | Zweck |
|---|---|
| `platform/README.md` | Ablauf, Fehlerbehandlung, Fail-Closed-Patterns |
| `platform/.env.example` | Env-Variablen (Models, Ports, DB-URL) |
| `platform/docker-compose.yml` | Service-Orchestrierung |
| `platform/builder_orchestrator/app/main.py` | FastAPI-App + Endpoints |
| `platform/governance_backend/app/main.py` | Risk-Engine + Gate-Logic |
| `platform/migrations/` | Postgres-Schema (additiv!) |

### Links
- **Doku:** [`platform/README.md`](platform/README.md)
- **Builder-Code:** [`platform/builder_orchestrator/app/`](platform/builder_orchestrator/app/)
- **Governance-Code:** [`platform/governance_backend/app/`](platform/governance_backend/app/)

---

## 5️⃣ Shared Packages

**Ort:** `packages/`

### SDK (TypeScript + Deno)
- **Ort:** `packages/sdk/`
- **Zweck:** Öffentliche API für RealSync-Integration
- **Build:** CJS + ESM
- **NPM:** `npm install @realsyncdynamics/sdk`

```bash
cd packages/sdk
npm install
npm run build
```

---

## 6️⃣ Weitere Verzeichnisse

| Ort | Zweck |
|---|---|
| `deploy/` | VPS-Deployment (Traefik, Docker, Infra) |
| `infra/` | Terraform/IaC für Hostinger VPS |
| `docker/` | Docker-Bases, Dockerfiles (zentral) |
| `connectors/` | Externe Integrations-Adapter |
| `scripts/` | Build-, Release-, QA-Skripte |
| `docs/` | Runbooks, Playbooks, Spezifikationen |
| `test/`, `tests/`, `e2e/` | Vitest + Playwright |

---

## 🚀 Schnellstart — Wahl

### Nur Hauptanwendung (Vite)
```bash
npm install
npm run dev
# http://localhost:3000
```

### Mit Backend (Supabase lokal)
```bash
npm install
supabase start
npm run dev
# http://localhost:3000 (mit lokalem Backend)
```

### Mit Website Builder + Governance
```bash
cd platform
cp .env.example .env
docker compose up --build
# http://builder.localhost/docs
# http://rsd.localhost/docs
# http://app.localhost
```

### Alles (Vite + Supabase + Platform)
```bash
# Terminal 1: Supabase
supabase start

# Terminal 2: Vite-App
npm install && npm run dev

# Terminal 3: Platform
cd platform && docker compose up --build
```

---

## 📋 Checkliste für neue Entwickler

- [ ] Repo klonen
- [ ] `npm install` (Root)
- [ ] `.env.local` mit Supabase-Keys erstellen
- [ ] `npm run dev` starten
- [ ] http://localhost:3000 aufrufen
- [ ] [`CLAUDE.md`](CLAUDE.md) lesen (Abschnitte 1–7)
- [ ] Für Platform: `cd platform && docker compose up --build`
- [ ] Platform-Tests: `docker compose exec builder_orchestrator pytest tests/`

---

## ⚠️ Wichtige Regeln

### Für Root-Änderungen (Vite/React SPA)
- `npm run lint` vor Commit (TypeScript strict)
- `npm run build` muss durchlaufen
- `npm test` für betroffene Tests
- `npm run e2e` für UI-Änderungen
- **Keine Secrets** in `.env` — nur `.env.local`

### Für Platform-Änderungen (`platform/`)
- Keine Node-Dependency-Änderungen
- RLS + Migrations sind additiv (niemals destruktiv)
- Tests via `docker compose exec SERVICE pytest`
- Endpoints sind OpenAPI-First (Pydantic-Schemas)
- Audit-Log in `audit_log` + `workflow_runs` (selbe DB wie Root)

### Für Migrations
- Ort: `supabase/migrations/` oder `platform/migrations/`
- Format: `YYYYMMDDHHMMSS_description.sql`
- **Immer additiv** — keine `DROP`, keine `ALTER` ohne RLS-Prüfung
- Lokal testen: `supabase db reset && npm run test:db`

---

## 🔗 Externe Ressourcen

- **Live:** https://realsyncdynamicsai.de
- **Repository:** https://github.com/realsyncdynamics-spec/RealSyncDynamics.AI
- **Supabase Docs:** https://supabase.com/docs
- **Vite Docs:** https://vitejs.dev
- **FastAPI Docs:** https://fastapi.tiangolo.com
- **Docker Docs:** https://docs.docker.com

---

**Fragen?** → Siehe `CLAUDE.md`, `platform/README.md`, oder öffne ein Issue.

**Letzte Aktualisierung:** 2026-08-04
