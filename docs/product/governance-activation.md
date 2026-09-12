# Governance Activation

**Status:** P0/P1 product module · first production vertical (Org + Scope persist)  
**Owner:** Dominik Steiner (Product)  
**Module name:** Governance Activation  
**Subtitle:** Turn existing data into operational governance.  
**Claim (product):** Govern AI. Prove Everything. Operate with Confidence.

> **Not onboarding. Not a setup wizard.**  
> Governance Activation is the activation layer between enterprise data and running governance.  
> Canonical `/app` dashboard remains `ComplianceStatusDashboard` inside `GovernanceBrowserShell`.  
> Do **not** build a second `/app` dashboard.

**UI route (first slice):** `/app/activation`  
**Spec examples ≠ live KPIs:** Any example numbers in this document (e.g. `1.284`, `78%`) are **SPEC EXAMPLES only**. In product UI they MUST be labeled `Preview` / `Coming Soon`, never as live tenant metrics.

---

## 1. Name & Submodules

| | |
|---|---|
| **Module** | Governance Activation |
| **Subtitle** | Turn existing data into operational governance. |
| **Submodules** | Activation · Discovery · Blueprint · Migration · Mapping · Expert Review · Evidence · Tasks · Go-Live |

Do **not** call this module Onboarding or Setup Wizard.

---

## 2. Hero (product copy)

**Headline:** Von Bestandschaos zu aktiver Governance.

**Body:** Importiere deine bestehenden Daten und Dokumente. RealSyncDynamics.AI strukturiert Organisation, Risiken, Systeme, Policies und Nachweise automatisch — Experten prüfen nur, was wirklich eine Entscheidung erfordert.

> This is product/hero copy for Activation positioning. It does **not** replace the live public `/` hero (“AI Governance, Running in Real Time”) unless shipped as a clearly separate landing section or `/activation` marketing page.

---

## 3. Activation Wizard

### Step 01 — Organization

Capture:

- Unternehmen
- Gesellschaften
- Standorte
- Business Units
- Mitarbeiter-/Teamstruktur
- Verantwortlichkeiten
- Rollen

### Step 02 — Governance Scope (multi-select)

- DSGVO
- EU AI Act
- AI Governance
- Third-Party Risk
- Information Security
- Policies
- Audit & Evidence
- Optional: weitere Frameworks

### Then

Auto-create a **Governance Blueprint**.

---

## 4. Auto-Blueprint Engine (differentiator)

### Flow

```
ORGANIZATION
  → GOVERNANCE BLUEPRINT
    → Policies / Controls / Risks
      → Systems
        → Evidence
          → Owners
            → Tasks
```

### Example recognition (spec example)

> “Ihr Unternehmen nutzt Microsoft 365, Salesforce und OpenAI.”

Derives:

- Systeme
- Anbieter
- Datenverarbeitungen
- KI-Systeme
- Risiken
- Controls
- Verantwortliche
- Nachweise
- Aufgaben
- Review-Anforderungen

---

## 5. Evidence & Migration Engine

### Drag & drop

**Label:** „Bestehende Dokumente hier ablegen“

### Accepted types

`XLSX` · `CSV` · `DOCX` · `PDF` · `JSON`  
plus governance exports: VVT, DSFA, TOM, Policies, Risiko-Register, Lieferantenlisten, AI-System-Inventare, Auditberichte.

### Pipeline

```
Document
  → Parsing
    → Entity Extraction
      → Classification
        → Mapping
          → Deduplication
            → Relationship Detection
              → Governance Graph
```

### Result UX

A **mapping table** (systems / vendors / processes / risks / controls / evidence — recognized vs auto-mapped).

**Not** a toast that says “Import erfolgreich”.

### Spec-example metrics (UI must label Preview / Coming Soon)

| Example | Meaning in spec only |
|---|---|
| e.g. `1.284` entities | Illustrative recognition volume — **not** a live KPI |
| e.g. readiness `%` | Illustrative activation readiness — **not** a live KPI |

---

## 6. Expert Review Queue

Experts do **not** see everything.

Only: **„N Entscheidungen benötigen Ihre Aufmerksamkeit.“**

### Example decision

Unclear AI vendor **OpenAI** — classify as:

- AI Service Provider
- Processor
- Third Party
- Other

Actions: **[Bestätigen]** · **[Ändern]** · **[Ignorieren]**

---

## 7. Governance Graph (visual; later 3D/orbital)

- **Center:** GOVERNANCE CORE  
- **Around:** Systems → Processes → Risks → Controls → Evidence → Owners  
- Interaction: mouse move / zoom / open nodes  
- Example chain: `OpenAI → AI System → Customer Support Assistant → Personal Data → Risk → Control → Evidence → Owner`

This is scenery of the OS — **not** a second public-landing sphere.

---

## 8. Activation status (not a second `/app` dashboard)

After import, the module must not be an empty shell.

**Surface:** “Your Governance Activation” with:

- Readiness (Preview unless real data)
- Exception counts (Preview unless real data)
- Next actions, e.g.:
  - Review AI systems
  - Confirm processors
  - Upload TOM
  - Assign owner
  - Approve AI Act policy pack
- CTA: **Continue Activation**

Again: numbers only as **Preview** unless real tenant data exists. Canonical dashboard stays `/app/dashboard`.

---

## 9. Automatic task assignment

- Assign tasks to owners automatically
- Plain language
- No compliance jargon in task titles/bodies for end users

---

## 10. Backend model (event-driven)

Activation is an **event-driven Activation Pipeline**, not a linear onboarding process.

```
Tenant
  → Organization, Scope, Assets, Documents, AI Systems,
    Risks, Controls, Evidence, Owners, Tasks
  → Activation Engine
      (Extraction, Classification, Mapping,
       Risk Detection, Relationship Engine,
       Policy Engine, Review Queue)
  → Governance Runtime
```

> Do **not** casually rewrite `docs/architecture/target-architecture.md`.  
> This file is the product SSoT for Governance Activation. Architecture pointers stay additive.

---

## 11. Strategic position

Activation is the layer between enterprise data and running governance:

```
Activation
  → Governance Runtime
    → Policy Engine
      → Risk
        → Evidence Vault
          → Audit
            → Analytics
```

---

## 12. Marketing block (landing SECTION)

For a landing **section** (or dedicated `/activation` marketing page).  
Do **not** replace the live public hero on `/`.

**EYEBROW:** `REALSYNC DYNAMICS.AI · GOVERNANCE ACTIVATION`

**Headline:** Your governance. Activated automatically.

**Body:** Import existing data, documents and systems. RealSyncDynamics.AI builds your governance structure automatically and routes only decisions requiring human expertise.

**CTAs:** `[Start Activation →]` · `[See how it works]`

**Three steps:**

| Step | Title | Intent |
|---|---|---|
| 01 | CONNECT | Connect existing data, documents and systems |
| 02 | ACTIVATE | Auto-blueprint structure, map evidence, open expert decisions |
| 03 | GOVERN | Run governance with owners, tasks, evidence and audit readiness |

---

## 13. First slice (this PR) — in scope

1. This product spec (`docs/product/governance-activation.md`)
2. In-app Wizard as Governance OS module (`/app/activation`) behind `AppGate` + `GovernanceBrowserShell`:
   - Organization + Governance Scope UI **persisted** to `governance_activations` (RLS)
   - Blueprint / Migration dropzone / Expert Review remain **Preview / Coming Soon**
   - Continue → canonical `/app/dashboard` (`ComplianceStatusDashboard`)
3. Landing section + header/module CTAs wired to real routes (`/audit`, `/app/evidence`, `/app/modules`, `/governance-runtime`, `/app/activation` via `/welcome?next=…`)
4. Additive architecture index note — does **not** rewrite `target-architecture.md`

## 14. OS roadmap — remaining modules (not shipped)

Honest backlog for the Governance OS beyond this vertical. Treat as roadmap, not product claims:

| Area | Status | Notes |
|---|---|---|
| Document extraction / mapping table | Coming Soon | Dropzone queues filenames locally only |
| Auto-Blueprint Engine | Coming Soon | Spec flow exists; no derivation backend |
| Expert Review decision queue | Coming Soon | Empty / Preview UI only |
| Evidence Graph | Coming Soon | See `docs/architecture/evidence-graph-rfc.md` |
| Policy Engine (full enforcement) | Partial | Packs live; continuous PDP enforcement still evolving |
| Hostinger DKIM / mail infra | Out of scope here | Ops / hosting, not this PR |

## Out of scope (this PR)

- Real AI extraction / mapping / 3D graph / event pipeline implementation
- Rebuilding the public Earth hero (parallel workstream)
- Second `/app` dashboard
- Fake production KPIs (`78%`, `1284`, …)
- Replacing live `/` hero copy
- Merging unrelated PRs

## Done when

- Draft PR open
- CI green (build, hygiene, conflict-state, Migration validation)
- Preview URL + screenshots of landing module wiring + Activation Org/Scope persist (or honest Preview)
- Left as **draft** until Dominik says Go to merge
