# Vorlage für Agent-OS README.md (für manuelle Übertragung)

**Zweck:** Diese Datei enthält den **vorgeschlagenen Inhalt für die README.md von `realsync-agent-os`**, um die Positionierung als **Execution Runtime von RealSyncDynamics.AI** (nicht als separates Produkt) klar zu kommunizieren.

**Anleitung:**
1. Kopieren Sie den Inhalt dieser Datei
2. Überschreiben Sie die `README.md` in [realsync-agent-os](https://github.com/realsyncdynamics-spec/realsync-agent-os)
3. Committen und pushen

---

```markdown
# RealSync Agent-OS

**Execution and Orchestration Layer behind RealSyncDynamics.AI**

[![CI](https://github.com/realsyncdynamics-spec/realsync-agent-os/actions/workflows/ci.yml/badge.svg)](https://github.com/realsyncdynamics-spec/realsync-agent-os/actions/workflows/ci.yml)
[![Node.js 20](https://img.shields.io/badge/Node.js-20_LTS-green?logo=node.js)](https://nodejs.org)
[![Docker](https://img.shields.io/badge/Docker-ready-blue?logo=docker)](https://docker.com)
[![EU AI Act](https://img.shields.io/badge/EU_AI_Act_2024%2F1689-konform-yellow)](https://eur-lex.europa.eu/legal-content/DE/TXT/?uri=CELEX:32024R1689)
[![Terraform](https://img.shields.io/badge/Terraform-1.7-purple?logo=terraform)](https://terraform.io)
[![License: MIT](https://img.shields.io/badge/License-MIT-lightgrey)](LICENSE)

> **RealSync Agent-OS is the execution and orchestration layer behind [RealSyncDynamics.AI](https://github.com/realsyncdynamics-spec/RealSyncDynamics.AI).**
> It provides autonomous agent execution, workflow orchestration, human oversight gates, and full EU AI Act compliance controls.

---

## 🎯 What Agent-OS Provides

Agent-OS is **not a standalone product**, but a **technical component** of the RealSyncDynamics.AI platform. It enables:

- **🤖 Autonomous Agent Execution** – Serverless workflows for governance tasks (DSGVO scans, AI Act compliance checks, risk assessments)
- **🔄 Workflow Orchestration** – Multi-step compliance processes with approval gates and escalation paths
- **👤 Human Oversight (EU AI Act Art. 14)** – Mandatory human review for high-risk AI decisions with full audit trail
- **📋 AI Act Compliance Controls** – Transparency requirements, risk classification, and technical documentation
- **📊 Audit Event Generation** – Immutable logging of all agent actions with hash-chain verification
- **🔌 OpenClaw Gateway Integration** – Secure connection to customer systems, VPS, and local environments

---

## 🏗️ Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                    RealSyncDynamics.AI                              │
│  (Control Plane: UI, Billing, Governance, Evidence Vault)           │
└──────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                      Agent-OS Runtime                               │
│  (Execution Layer: Workflows, Agents, External Systems)             │
└──────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                      OpenClaw Gateway                               │
│  (External Execution: Customer Systems, VPS, Local Agents)          │
└─────────────────────────────────────────────────────────────────┘
```

### 📌 Important Positioning Note

**⚠️ Agent-OS is NOT a standalone SaaS product.**

It is a **technical runtime component** of [RealSyncDynamics.AI](https://github.com/realsyncdynamics-spec/RealSyncDynamics.AI) and is **included in the Growth, Agency, Enterprise, and Partner plans** of that platform.

- **For pricing and feature details**, see: [RealSyncDynamics.AI Entitlements Matrix](https://github.com/realsyncdynamics-spec/RealSyncDynamics.AI/blob/main/docs/ENTITLEMENTS_MATRIX.md)
- **For the main product**, visit: [RealSyncDynamics.AI](https://github.com/realsyncdynamics-spec/RealSyncDynamics.AI)

---

## 📊 Key Components

| Component | Purpose | Technology |
|-----------|---------|------------|
| **Workflow Engine** | Executes governance workflows (DSGVO scans, AI Act checks) | Node.js + BullMQ |
| **Policy Engine** | Enforces compliance rules and frameworks | Custom Rules Engine |
| **Execution Engine** | Runs agents in isolated environments | Sandboxed Node.js |
| **Approval Gates** | Human review for high-risk decisions (Art. 14) | React + Webhooks |
| **Audit Logger** | Immutable logging with hash-chain verification | PostgreSQL |
| **OpenClaw Gateway** | Connects to external systems | SSH + REST API |

---

## 🔌 Integration with RealSyncDynamics.AI

### 1. API Communication
Agent-OS exposes a REST API that RealSyncDynamics.AI uses to trigger workflows:

```typescript
// Example: Trigger a DSGVO compliance workflow
const response = await fetch('https://agent-os.internal.realsync.ai/api/workflows', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${API_KEY}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    workflow: 'dsgvo_full_scan',
    params: {
      domain: 'customer.example.com',
      framework: 'DSGVO',
      priority: 'high'
    }
  })
});
```

### 2. Event Streaming
Agent-OS sends events back to RealSyncDynamics.AI via webhooks:

```json
{
  "event": "workflow.completed",
  "timestamp": "2026-08-07T12:00:00Z",
  "data": {
    "workflowId": "wf_abc123",
    "type": "dsgvo_scan",
    "status": "success",
    "results": {
      "score": 95,
      "findings": [
        { "issue": "Missing cookie consent", "severity": "high", "article": "DSGVO Art. 7" },
        { "issue": "No privacy policy link", "severity": "medium", "article": "DSGVO Art. 13" }
      ]
    },
    "auditTrail": [
      { "step": "domain_resolution", "timestamp": "2026-08-07T12:00:01Z" },
      { "step": "page_crawl", "timestamp": "2026-08-07T12:00:05Z" },
      { "step": "compliance_check", "timestamp": "2026-08-07T12:00:10Z" }
    ],
    "evidenceHash": "sha256:abc123...",
    "previousHash": "sha256:def456..."
  }
}
```

### 3. Data Flow
```
RealSyncDynamics.AI (Control Plane)
          │
          ├─── Trigger → Agent-OS (Start Workflow)
          │
          ├─── Receive ← Agent-OS (Results + Audit Trail)
          │
          └─── Store → Evidence Vault (Immutable Records)
```

---

## 🚀 Quick Start (Local Development)

### Prerequisites
- Docker + Docker Compose
- Node.js 20 LTS (for local development)
- PostgreSQL 16 + Redis 7 (included in Docker Compose)

### 1. Clone the Repository
```bash
git clone https://github.com/realsyncdynamics-spec/realsync-agent-os.git
cd realsync-agent-os
```

### 2. Pre-Flight Check
```bash
bash scripts/preflight_check.sh --quick
```

### 3. Start the Stack
```bash
# Starts: PostgreSQL, Redis, Backend, Gateway
docker compose up -d

# Optional: Mailpit (SMTP catcher → http://localhost:8025)
docker compose --profile dev up -d
```

### 4. Verify Health
```bash
curl http://localhost:8080/health
# → {"status":"ok","eu_ai_act_compliant":true,"timestamp":"2026-08-07T12:00:00Z"}

curl http://localhost:8080/health/ready
# → {"status":"ready","checks":{"database":"ok","redis":"ok","gateway":"ok"}}
```

### 5. Stop the Stack
```bash
docker compose down
```

---

## 📦 Deployment (Production)

### Google Cloud Run (Recommended)
Full deployment guide: **[docs/DEPLOY_GUIDE.md](docs/DEPLOY_GUIDE.md)**

#### Quick Deployment (3 Steps)
```bash
# Step 1 — Set up GCP (one-time, ~15 min)
export GCP_PROJECT_ID=your-project-id
bash scripts/gcp_setup.sh

# OR with Terraform:
cd terraform
cp terraform.tfvars.example terraform.tfvars
# → Edit terraform.tfvars (set project_id)
terraform init && terraform apply

# Step 2 — Set GitHub Secrets
gh secret set GCP_PROJECT_ID --body "$GCP_PROJECT_ID"
gh secret set GCP_SA_KEY < /tmp/realsync-sa-key-*.json
gh secret set GCP_DEPLOY_SA --body "realsync-deployer@${GCP_PROJECT_ID}.iam.gserviceaccount.com"

# Step 3 — Trigger Deploy
git commit --allow-empty -m "chore: trigger deploy"
git push origin main
# → Approve the 'production' deploy in GitHub Actions
```

After successful deploy:
```bash
SERVICE_URL=$(gcloud run services describe realsync-backend --region europe-west1 --format 'value(status.url)')
curl "$SERVICE_URL/health"
# → {"status":"ok","eu_ai_act_compliant":true,...}
```

---

## 📂 Repository Structure

```
realsync-agent-os/
├── backend/                  # Express.js API Server
│   ├── src/
│   │   ├── workflows/        # Workflow definitions
│   │   ├── policies/        # Compliance policies
│   │   ├── agents/          # Agent implementations
│   │   └── api/            # REST API routes
│   └── Dockerfile
│
├── gateway/                 # OpenClaw Gateway
│   ├── src/
│   │   └── connectors/     # System connectors (SSH, API, etc.)
│   └── Dockerfile
│
├── docker-compose.yml       # Local development stack
├── scripts/                 # Deployment & validation scripts
│   ├── preflight_check.sh   # Environment validation
│   ├── gcp_setup.sh         # GCP setup automation
│   └── ...
│
├── terraform/               # Infrastructure as Code
│   ├── main.tf
│   ├── variables.tf
│   └── outputs.tf
│
├── docs/
│   ├── DEPLOY_GUIDE.md      # Full deployment guide
│   └── API_REFERENCE.md      # API documentation
│
└── README.md                # This file
```

---

## 🔐 Security & Compliance

### EU AI Act Compliance
- **Article 14 (Human Oversight):** Mandatory approval gates for high-risk decisions
- **Article 10 (Transparency):** Full audit trail of all AI decisions
- **Article 12 (Technical Documentation):** Automated compliance reports
- **Article 50 (General Obligations):** Continuous monitoring and risk assessment

### Security Features
- **Sandboxed Execution:** Agents run in isolated environments
- **JWT Authentication:** Secure API access with short-lived tokens
- **Hash-Chain Auditing:** Immutable evidence trail
- **Rate Limiting:** Protection against abuse
- **Input Validation:** Prevention of injection attacks

---

## 📊 Monitoring & Observability

### Health Endpoints
| Endpoint | Purpose | Example Response |
|----------|---------|------------------|
| `/health` | Basic health check | `{"status":"ok","timestamp":"..."}` |
| `/health/ready` | Readiness check | `{"status":"ready","checks":{...}}` |
| `/health/deep` | Full diagnostics | `{"status":"ok","details":{...}}` |

### Metrics
- **Agent Execution Time:** Average/Max per workflow
- **Queue Length:** BullMQ job statistics
- **Error Rates:** Failed vs. successful workflows
- **Audit Trail Size:** Evidence storage growth

---

## 🤝 Contributing

Agent-OS is a **closed-source component** of RealSyncDynamics.AI. Contributions are currently limited to the RealSyncDynamics team.

For issues or feature requests, please use the [RealSyncDynamics.AI repository](https://github.com/realsyncdynamics-spec/RealSyncDynamics.AI).

---

## 📄 References

- **[RealSyncDynamics.AI – Main Product](https://github.com/realsyncdynamics-spec/RealSyncDynamics.AI)**
- **[Entitlements Matrix](https://github.com/realsyncdynamics-spec/RealSyncDynamics.AI/blob/main/docs/ENTITLEMENTS_MATRIX.md)** – Feature availability per plan
- **[EU AI Act (2024/1689)](https://eur-lex.europa.eu/legal-content/DE/TXT/?uri=CELEX:32024R1689)** – Regulatory framework
- **[OpenClaw Gateway](https://github.com/realsyncdynamics-spec/openclaw-gateway)** – External execution layer

---

## 📜 License

[MIT License](LICENSE) – © 2026 RealSyncDynamics

---

**Note:** This template is designed to replace the current README.md in the `realsync-agent-os` repository. The key change is the **positioning of Agent-OS as a technical component** of RealSyncDynamics.AI, not as a standalone product.
```

---

## 📌 Anpassungs-Hinweise

### Was geändert wurde:
1. **Titel:** "EU-konformes AI-Agenten-SaaS" → **"Execution and Orchestration Layer behind RealSyncDynamics.AI"**
2. **Beschreibung:** Klare Zuordnung als **technische Komponente** (nicht Produkt)
3. **Architektur-Diagramm:** Zeigt die **Hierarchie** (Control Plane → Agent-OS → OpenClaw)
4. **Wichtiger Hinweis:** Explizite Klarstellung, dass Agent-OS **kein eigenständiges Produkt** ist
5. **Links:** Verweise auf RealSyncDynamics.AI und die Entitlements Matrix

### Was beibehalten wurde:
- Technische Details (Stack, Deployment, Struktur)
- CI/CD Badges
- Quick Start Anleitung
- Sicherheitsfeatures

---

**Dokument-Informationen:**
- **Erstellt von:** Vibe Code (Mistral AI)
- **Basierend auf:** Strategischer Ausrichtung (2026-08-07)
- **Zweck:** Vorlage für die Anpassung der Agent-OS README.md
- **Version:** 1.0
