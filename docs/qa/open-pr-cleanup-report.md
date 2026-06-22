# Open-PR-Cleanup-Report — RealSyncDynamics.AI

> QA-Audit 2026-06-22 · Quelle: GitHub `realsyncdynamics-spec/realsyncdynamics.ai`, `list_pull_requests(state=open)` + lokale Ancestry-Prüfung gegen `origin/main`.

## Wichtiger Befund zur Umgebung (Transparenz)
Der Container-Checkout (`HEAD f82ef7a`) ist **von `origin/main` (`9f9c0d5`) divergiert: 79 Commits ahead, 55 behind**. Die hier sichtbaren „gemergten" PRs (#663/#664/#662/#655 …) liegen auf der Checkout-Linie, **nicht** auf dem GitHub-`main`, gegen den die offenen PRs laufen.
**Konsequenz:** Eine zuverlässige automatische „bereits in main"-Bestimmung per Inhaltsvergleich ist aus diesem Checkout heraus **nicht** möglich. Ancestry-Test (Commit in `origin/main`?) wurde für **alle 28** PR-Heads durchgeführt:

> **Ergebnis: 0 von 28** PR-Heads sind Vorfahren von `origin/main` → **keine** PR ist nachweislich bereits gemergt.

Deshalb wurde — gemäß Regel „Niemals schließen, wenn unklar" und dem Schutz von Security-/Billing-/Auth-/DSGVO-/AI-Act-/Evidence-/Infra-Arbeit — **keine PR unilateral geschlossen**. Stattdessen: vollständige Kategorisierung + Review-Empfehlung (Ausführung nach Freigabe).

## Offene PRs vorher: **28**

## Kategorisierung (alle 28)

| PR | Titel (gekürzt) | Branch-Alter | Kategorie | Schutz-/Risikoklasse | Aktion |
|---|---|---|---|---|---|
| #666 | dashboard-backend-sync: governance membership-fix (Live-Sync) | 06-22 | KEEP_OPEN | Backend/Governance | offen lassen |
| #665 | Site-wide SEOHead für 60+ Routes | 06-22 | KEEP_OPEN | SEO/Frontend | offen lassen |
| #661 | [hotfix] consolidate duplicate 20260624-Migrations | 06-21 | KEEP_OPEN | **Infra/Migrations** | offen lassen |
| #660 | MainLanding (Earth-at-Night) als Root | 06-21 | UNKNOWN_KEEP_OPEN | Landing (konkurrierend) | Produktentscheid |
| #658 | Alternative-Landing-Shell-Refactor | 06-21 | KEEP_OPEN | Landing-Refactor | offen lassen |
| #657 | Bolt Landing-Design Integration | 06-21 | UNKNOWN_KEEP_OPEN | Landing (konkurrierend, evtl. Dup zu #656) | Review |
| #656 | Neue Bolt Design Landing als Startseite | 06-21 | UNKNOWN_KEEP_OPEN | Landing (konkurrierend) | Review |
| #654 | Complete demo platform (auth, dashboard, E2E, extension) | 06-21 | KEEP_OPEN | **Auth** | offen lassen |
| #650 | Produkt-Tiefenaudit + Bewertungsplan + erste P0-Fixes | 06-21 | KEEP_OPEN | enthält **P0-Fixes** | offen lassen |
| #649 | AI Act: Daten-Governance (Art. 10) + UX | 06-19 | KEEP_OPEN | **AI-Act** | offen lassen |
| #646 | Governance-OS-2050-Homepage (3D-Europa) | 06-21 | UNKNOWN_KEEP_OPEN | Landing (konkurrierend) | Produktentscheid |
| #644 | CEO Governance Cockpit als /app-Einstieg | 06-19 | UNKNOWN_KEEP_OPEN | App-Einstieg (konkurrierend) | Review |
| #640 | SEO: per-route Canonicals + /pricing-Prerender | 06-19 | KEEP_OPEN | SEO/Pricing | offen lassen |
| #639 | Governance Browser OS Shell (Sidebar + Agent-Panel) | 06-21 | KEEP_OPEN | Governance-UI | offen lassen |
| #638 | Governance-OS: Auth-Seite, Office, Browser-OS | 06-20 | KEEP_OPEN | **Auth** | offen lassen |
| #637 | migrate 75 Edge Functions to shared gateway | 06-17 | KEEP_OPEN | **Infra/Backend** | offen lassen |
| #636 | Automation Governance Agent — UI (PR2/5) | 06-17 | KEEP_OPEN | Teil einer Serie | offen lassen |
| #635 | Legal-RAG (NIS-2, DSA, C2PA + Retrieval) | 06-17 | KEEP_OPEN | Compliance/Evidence | offen lassen |
| #634 | QA-Load-Test-Script wiederherstellen (aus #547) | 06-17 | NEEDS_FIX/Review | QA-Script (nicht in origin/main) | Review (klein) |
| #632 | Re-derive + **react-router RCE-Fix** + C2PA Dead-Code | 06-17 | KEEP_OPEN | **Security** | offen lassen |
| #631 | Governance OS Runtime: Monitoring/Risk/Evidence/Tests | 06-19 | KEEP_OPEN | **Evidence** | offen lassen |
| #630 | Cloudflare DNS Topology + Operator-Runbook (docs) | 06-17 | KEEP_OPEN | **Infra-Docs** | offen lassen |
| #629 | „/" als Governance-OS-Produkt-Frontend | 06-17 | UNKNOWN_KEEP_OPEN | Landing (konkurrierend, älter) | Review |
| #628 | Vollständiger Produktaudit 2026-06-17 (38/100) | 06-17 | UNKNOWN_KEEP_OPEN | Audit-Doku (evtl. durch dieses Audit überholt) | Review |
| #627 | Inline-UI ersetzt prompt/confirm/alert (Workflow) | 06-17 | KEEP_OPEN | UX-Verbesserung | offen lassen |
| #626 | GTM-Konversionsstrategie + 6 Landing Pages | 06-17 | UNKNOWN_KEEP_OPEN | GTM/Landing (älter) | Review |
| #624 | Office OS Sektion (Phase 6, 7 Bereiche) | 06-22 | KEEP_OPEN | Feature (recent) | offen lassen |
| #622 | Governance OS: live-data wiring alle Module | 06-17 | KEEP_OPEN | Governance/Evidence | offen lassen |

## Geschlossene PRs: **0**
Begründung: keine PR ist nachweislich obsolet/dupliziert/bereits-in-main **aus diesem (divergierten) Checkout heraus eindeutig feststellbar**. Die Schutzregeln (Security/Billing/Auth/DSGVO/AI-Act/Evidence/Infra nicht schließen, solange Ersatz nicht belegt) greifen.

## Offen gelassen: **28** (alle)

## PRs mit Merge-Potenzial (klein, fokussiert — zuerst prüfen)
- **#666** (governance membership-fix, recent), **#665** (SEOHead), **#640** (SEO canonicals), **#627** (Inline-UI), **#661** (Migrations-Hotfix). Kleine, klar umrissene Changes.

## PRs mit Fix-/Review-Bedarf
- **#634** QA-Load-Test: Script ist in `origin/main` **nicht** vorhanden → entweder rebasen/mergen oder schließen, falls inhaltlich durch anderes Script ersetzt. (Im Container-Checkout ist `scripts/qa-load-test.ts` vorhanden — Divergenz beachten.)
- **Landing-Cluster** (#626, #629, #644, #646, #656, #657, #660): **mehrere konkurrierende Homepages/Einstiege**. Genau **eine** kann „Startseite" werden → Produktentscheid nötig. Empfehlung: Team wählt die Ziel-Landing; die anderen werden dann SUPERSEDED → schließbar.

## PRs mit unklarem Status (UNKNOWN_KEEP_OPEN)
#626, #628, #629, #644, #646, #656, #657, #660 — siehe oben. Bewusst offen gelassen.

## Empfohlene nächste Aktion
1. **Produktentscheid Landing/Einstieg:** Eine Ziel-Landing aus {#646, #656, #657, #660, #629} bestimmen → die übrigen als SUPERSEDED schließen (Kommentar-Vorlage unten).
2. **#628** (Audit 38/100) gegen dieses Audit (`final-platform-audit-report.md`) abgleichen → bei Deckung schließen.
3. **#634** entscheiden (mergen vs. schließen).
4. Kleine fokussierte PRs (#666/#665/#640/#627/#661) reviewen und ggf. mergen (nach Freigabe — **kein** Merge ohne ausdrückliche Erlaubnis).

## Schließ-Kommentar-Vorlage (für freigegebene Closures)
> Closing this PR because it is obsolete/superseded/duplicate/already covered by current main. No active work remains here based on the current repository audit.

## Hinweis
Es wurde **nichts gemergt** und **keine Branch gelöscht** (gemäß Vorgabe). Closures erfolgen erst nach ausdrücklicher Freigabe, da der Container-Checkout von `origin/main` divergiert und eine eindeutige Obsoleszenz-Bestimmung sonst nicht möglich ist.
