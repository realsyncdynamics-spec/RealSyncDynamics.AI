# RealSync Agent OS™ — Product Spec (First Slice)

**Status:** Product-locked · First UI slice on canonical `/app`  
**Owner:** Dominik (Product) · Runtime/Governance  
**Stand:** 2026-09-12  
**Sprache:** DE (EN terms where they are system identifiers)

> **Kein Marketing-Overclaim.** „Agent OS“ / „KI-Betriebssystem“ bleiben
> produktintern und dokumentiert, bis Runtime, Permissions und Observability
> produktiv abgesichert sind. Außenpositionierung unverändert:
> *Automated Digital Compliance Infrastructure*.
> Siehe `docs/architecture/agent-os.md`.

---

## 1. Was es ist

RealSync Agent OS™ ist die **executable Governance-Schicht** im bestehenden
Command Center — kein zweites Dashboard, kein Chatbot.

Der Kunde arbeitet **im** kanonischen `/app` (ComplianceStatusDashboard in
`GovernanceBrowserShell` + RealSync OS Kernel):

```text
Intent → Policy Check → Permission Check → Agent Action
      → Result Validation → Evidence → Audit Log
```

Browser-Agenten haben **niemals** ungeprüfte Authority. Production-Aktionen
bleiben approval-pflichtig (`autoApprove: false`).

Aligniert mit:

| Dokument | Rolle |
|---|---|
| `docs/architecture/agent-os.md` | Runtime, Tenant-RLS, HITL, kein Overclaim |
| `docs/product/realsync-os-command-center.md` | Intent → Plan → Policy/Approval → Execution → Evidence |
| `docs/adr/0011-agent-organisationsmodell-plattform-scope.md` | Autonomiegrenze, Ledger, Org-Modell |
| `src/core/realsync-os` | Kernel: `openCommandSession` / Approval Gate / Events |
| `src/product/implementation-status.ts` | Ehrliche Preview / Coming Soon Matrix |

---

## 2. Architektur (nicht flatten)

```text
Governance Command Center
        │
        ▼
Governance Orchestrator
   Policy · Tenant · Audit
        │
        ▼
Specialist Mesh
├── Compliance          ├── Evidence
├── Product             ├── Security
├── Marketing           ├── DevOps
├── Sales               ├── Implementation
├── Growth + Product Evolution
├── QA / E2E
├── Onboarding
├── Pricing
├── Lead
├── Advertising
├── Scaling
└── Expansion
```

- **Models** (Grok/xAI und andere) sitzen hinter RealSync Tool-/Policy-Layer.
- **Cloudflare** = Edge · **Supabase** = Auth/RLS/Evidence · **Stripe** = Billing ·
  **GitHub PRs** = Code-Governance (wie heute).
- **Hostinger** = future worker runtime — **Spec only** in this PR.
- **Chrome Side Panel** (Analyze Page, GDPR/AI Act, Evidence) — **Spec only /
  Coming Soon**. Keine Fake-Extension.

---

## 3. Customer Loop (executable, nicht Chat)

Prompt im Dashboard / Command Center:

> Was möchtest du erledigen?

Beispiel: *„Prüfe meine KI-Anwendung auf DSGVO und EU AI Act.“*

Der Compliance-Agent erzeugt die **10 Artefakte**:

1. Aufgabe  
2. Prüfplan  
3. Benötigte Daten  
4. Aktionen  
5. Risiko  
6. Ergebnisse  
7. Offene Punkte  
8. Maßnahmen  
9. Evidence Pack  
10. Abschlussbericht  

Interaktive Finding-Aktionen (Beispiel: fehlende Rechtsgrundlage Vendor X):

`[Prüfen]` `[Dokumentation erstellen]` `[Aufgabe delegieren]` `[Ignorieren]`

Jede Wahl ist ein Audit-Ereignis (Session-Event; Persistenz in
`governance_events` nur wenn Client-Write erlaubt — sonst ehrliches Preview).

---

## 4. Product Evolution — Integrity Loop

```text
Landing ↔ Pricing ↔ Stripe ↔ Entitlements ↔ Backend ↔ Dashboard ↔ Docs
```

- Spec + optional **read-only Integrity Panel** (bestehende Pricing-/
  Entitlement-Quellen).
- **Kein Auto-Merge** von PRs. Dominik approved.
- Keine Fake-KPIs.

---

## 5. First-Slice Scope (dieses PR)

| In | Out |
|---|---|
| Product Spec (dieses Dokument) | Chrome Extension |
| Intent-Feld auf `/app` + Ctrl+K | Hostinger Workers |
| Compliance 10-Step Session via `openCommandSession` | Ads/CRM Live-Integrations |
| Mesh-Roster (live / preview / coming-soon) | Auto GitHub PRs |
| Finding-Card Preview | Zweites Dashboard / `/app/agent-os` |
| Integrity Panel (read-only) | Stripe-Catalog-Änderungen |
| | Landing Earth remount |

Nur **Compliance** (+ bestehendes SiteOS `evaluate_governance`) ist
Preview-runnable. Alle anderen Mesh-Agenten: Coming Soon.

---

## 6. Status-Vokabular

| Label | Bedeutung |
|---|---|
| **Live** | Backend + Policy + Evidence produktiv gebunden |
| **Preview** | Kernel-Loop + UI, begrenzte Substrate-Bindung, keine Fake-Zahlen |
| **Coming Soon** | Spec / Registry-Eintrag, nicht ausführbar |

Quelle der Wahrheit für UI-Badges: `src/product/implementation-status.ts`
und `src/core/realsync-os/agentMesh.ts`.
