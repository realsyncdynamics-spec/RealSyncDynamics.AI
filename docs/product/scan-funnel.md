# Public Scan Funnel — Positioning (nicht Cookie-Scanner)

**Stand:** 2026-09-12  
**SSoT Runtime-Claims:** `src/product/implementation-status.ts`  
**Kanonischer Scan:** `/audit?domain=` (kein paralleler Scanner)

---

## Positionierung (lock)

| TAKE | DO NOT TAKE |
|---|---|
| URL first, kein Login fürs erste Ergebnis | Optik eines Website-DSGVO-/Cookie-Scanners |
| Sofort nutzbarer Befund + klarer nächster Schritt | Complianty-Preisband 19–149 € |
| Agency Multi-Tenant Reports später | Architektur erklären, bevor ein Risiko bewiesen ist |
| Continuous Monitoring als Grund zu bleiben | Cyan Complianty-Klon; Preise senken |

**Message:** In Minuten scannen. In Stunden strukturieren. Dauerhaft kontrollieren.

RealSyncDynamics.AI bleibt **AI Governance OS** (Scan → Build → Automate → Govern),
preislich oberhalb eines Cookie-Scanners (Starter €79 / Growth €249 / Agency €699 /
Enterprise Anfrage — `shared/pricing.ts`). Partner/Scale = Legacy/Inquiry, kein
Self-Serve „Scale“.

---

## Zwei Pfade

1. **Self-Service** — Website-/SaaS-Teams: Hero-URL → `/audit` → Top-3 + Choice Row.
2. **Guided Activation (Enterprise)** — bestehendes `/app/activation` über
   `/welcome?next=/app/activation` (kein Sales-Call-First-Onboarding).

---

## Funnel

```
/  (URL + Result-CTA)  →  /audit?domain=  →  Score + Top-3 + Evidence-Preview
                                              →  Choice Row (4 Optionen)
                                              →  Account nur bei Save / Share / Monitor
```

### Hero CTA (DE)

- Button: `Kostenlosen Governance-Scan starten` (Ergebnis versprechen, nie „testen“)
- Unter der Form: `URL eingeben — Top-3-Risiken und Evidence-Preview erhalten. Kein Account nötig.`

### Choice Row (nach Scan)

| # | Aktion | Ziel | Status |
|---|---|---|---|
| 1 | Diese Domain überwachen | `/welcome?next=/app/monitoring` | Coming Soon |
| 2 | Fix-Plan mit Code-Empfehlungen | `/onboarding/:auditId` (bei Findings) bzw. Optimizer Preview | Live / Preview |
| 3 | KI-Use-Cases & EU-AI-Act-Pflichten | `/welcome?next=/app/activation` | Live |
| 4 | Report exportieren | `/welcome?next=/app/evidence` (+ Share/Docs auf Seite) | Preview |

Wiederverwendete Oberflächen: `AuditLanding` / `ReportView`, `gdpr-audit` Score+Issues,
`GuidedPlanBlock` → `/onboarding/:id`, Governance Activation, Evidence unter `/app/evidence`.

---

## Out of scope

Chrome Extension, neue Stripe-Produkte, Complianty Visual Clone, zweites Dashboard,
Sphere auf `/` remounten.
