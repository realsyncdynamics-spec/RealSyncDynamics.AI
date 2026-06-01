# Growth-/Compliance-Agenten-Stack

Konzept + Umsetzungsstand für den automatisierten Growth-/Compliance-Stack
auf dem Hostinger-VPS. Ergänzt — ersetzt nicht — die bestehende
Infrastruktur (`deploy/ollama-traefik/`, Supabase, Stripe).

## Zielarchitektur (additiv)

```
Host-Traefik (TLS, vorhanden)
├── n8n (vorhanden, SQLite)          Orchestrator/Cron
│     └─ ruft Supabase Edge Functions (keine Logik-Duplikation in n8n)
├── Ollama + Open WebUI (vorhanden)  EU-lokale Inferenz
├── playwright-scanner (vorhanden)   Crawl-Microservice
└── Audit-Worker (worker/)           audit_jobs → scan_runs → findings
        │
        └──► Supabase = einzige Wahrheit (RLS, scan_runs, findings,
             audit_evidence, workflow_runs, stripe_*, business-metrics)
```

Grundregel: **keine zweite produktive Datenbank.** n8n nutzt sein
eingebettetes SQLite nur für Workflow-Definitionen; alle Geschäfts-/
Compliance-Daten liegen in Supabase mit RLS.

## Agenten-Rollen → vorhandene Bausteine

| Agent | Aufgabe | Edge Function / Workflow |
|---|---|---|
| Growth Intelligence | Zielkunden finden, DSGVO-Risiko grob bewerten | `market-scanner` · WF 01 |
| Compliance Audit | Website-Scan, Evidence/Findings schreiben | `audit-*` + Audit-Worker · WF 02 |
| Sales Conversion | DSGVO-geprüfte Outreach-**Entwürfe** | `sales-lead` + `_shared/outreach-gate.ts` · WF 03 |
| Finance | MRR/Churn/Trials | `business-metrics-cron` · WF 04 |
| DevOps Monitoring | Healthcheck Infra/SSL/Container | `health` · WF 05 |

## Workflow-Zeitplan

`deploy/ollama-traefik/n8n-workflows/` — alle Vorlagen **inaktiv**, kein
Echt-Mailversand. Import-Anleitung siehe README dort.

| Zeit | Workflow |
|---|---|
| 08:00 | Discovery — Zielkunden + grobe Risikobewertung |
| 10:00 | Audit-Scans anstoßen |
| 14:00 | Outreach-**Entwürfe** (hinter DSGVO-Gate) |
| 17:00 | MRR/Pipeline-Report |
| stündlich | Infrastruktur-Healthcheck |

## DSGVO-Grenzen (vor jedem Outreach)

Durchgesetzt in `supabase/functions/_shared/outreach-gate.ts`
(`evaluateOutreachGate`), gespiegelt im Code-Node von WF 03:

- nur B2B / öffentlich-geschäftliche Kontaktdaten, keine Freemail-Adressen
- dokumentierte Quelle + Rechtsgrundlage (berechtigtes Interesse mit
  Begründung **oder** Consent-Nachweis)
- Opt-Out hart durchgesetzt; Pflicht-Opt-Out-Fußzeile in jeder Nachricht
- keine besonderen Datenkategorien (Art. 9 DSGVO)
- Echtversand bleibt ein **separater, manuell freizugebender** Schritt

## Umsetzungsstand in diesem Beitrag

- **Audit-Worker fertiggestellt:** `worker/src/` schreibt jetzt `scan_runs`,
  `findings` und `audit_evidence` und schließt den `scan_run` terminal ab
  (vorher: TODO-Scaffold ohne Persistenz). Mapping/Persistenz unit-getestet
  (`test/unit/worker-persistence.test.ts`).
- **DSGVO-Gate:** `_shared/outreach-gate.ts` + Tests
  (`test/edge/outreach-gate.test.ts`).
- **n8n-Vorlagen:** 5 inaktive Workflows + Import-/Compliance-Doku.

## Offen / nächste Schritte (Freigabe nötig)

- Live-VPS-Audit (`docker ps`, Secret-Check) — nur am Host ausführbar.
- Frontend-Trigger auf `audit_jobs`-Insert umstellen (siehe `worker/README.md`).
- Outreach-Echtversand erst nach Rechts-Review aktivieren.
