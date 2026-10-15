---
title: Unternehmen und Produkt
owner: Plattform-Betrieb
reviewed: 2026-10-15
status: aktiv
---

# Unternehmen und Produkt

**RealSyncDynamics.AI** — EU-souveräne AI-Governance-Runtime für DSGVO und
EU AI Act. Kein Chatbot: eine Governance-Schicht zwischen Mensch, Firma,
Agenten und Daten. Live: https://realsyncdynamicsai.de

## Strategie (verbindliche Quellen)

| Thema | Quelle der Wahrheit |
|---|---|
| Funnel: kostenloser Scan → Governance Core → kontrollierte Bots/Agenten → Agent OS Premium | `.claude/os-funnel/PLAN.md` §2–§4 |
| Entscheidungen E-F1…E-F6, E-V1…E-V9 | `.claude/os-funnel/PLAN.md` §3 |
| Oktober-Plan (Build Studio, O-WP1…O-WP10) | `.claude/os-funnel/OKTOBER-2026.md` |
| Kanonischer Einstieg `/audit` (nicht `/unified-entry/scan`) | `docs/product/canonical-funnel-decision.md` |
| Startseite Landing v6, Vorschauen v5/v4/v2 | `CLAUDE.md` „Website bauen" |

## Pläne und Preise

Nur aus `shared/pricing.ts` zitieren — nie aus dem Gedächtnis. Stand der Datei
am 2026-10-15: Free Audit, Starter, Growth, Agency, Enterprise (höchste
öffentliche Stufe, PR-Triage-Policy) und Partner (E-F4 offen: Programm oder
Stufe). Offene Draft-PRs #1896/#1897 stellen auf Nettopreise zzgl. USt um —
nach deren Merge gelten die Beträge dort.

## Implementierungsstatus

`src/product/implementation-status.ts` ist die einzige Quelle für
live · preview · coming-soon. Die Routine `claims-evidence-check` prüft
wöchentlich, dass jeder live-Eintrag auf vorhandene Dateien verweist.

Verknüpft: [Compliance und Geschäftsprozesse](compliance-und-prozesse.md) ·
[Entwicklung und Arbeitsregeln](entwicklung-und-regeln.md)
