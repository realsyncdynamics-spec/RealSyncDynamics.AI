# Runbook — Edge-Function-Konsolidierung (Free-Plan, 100 Slots)

> **Historisch (Stand 2026-08-19).** Die Organisation läuft auf Plan `pro`, das
> Free-Limit von 100 Edge Functions ist aufgehoben und der hier erwähnte
> Workflow `free-plan-slot-swap.yml` wurde entfernt. Dieses Runbook beschreibt,
> was am 2026-08-16 galt — es ist keine Handlungsanweisung mehr. Aktueller Stand:
> `edge-function-kontingent.md`.

**Stand der Erhebung:** 2026-08-16, nach dem Slot-Swap (`free-plan-slot-swap.yml`, Run #1 — Workflow inzwischen entfernt)
**Messung:** Live 100/100 · Repo 180 · **fehlend 80** (davon 12 bewusst gelöschte
Alt-Functions ohne Aufrufer → echter Bedarf **68**)

## 1 Entscheidung

Kein Plan-Upgrade. Die Lücke wird geschlossen, indem Functions **pro Domäne zu
Router-Functions konsolidiert** werden: eine Function pro Domäne, Sub-Endpunkte
über den URL-Pfad (`/functions/v1/<router>/<endpunkt>`). Supabase reicht den
Pfad hinter dem Slug an die Function durch; `supabase.functions.invoke('x/y')`
funktioniert unverändert.

**Warum das trägt:** Die 68 fehlenden Functions waren **nie live** — kein
externer Vertrag bricht, wenn sie unter einem Router-Pfad statt einem eigenen
Slug erscheinen. Nur die Frontend-Wrapper (`src/lib/…`, `src/features/…`)
ziehen mit um, im selben PR.

## 2 Harte Regeln

1. **Extern registrierte URLs sind unantastbar.** `stripe-webhook` (bei Stripe
   hinterlegt), `shopify-webhooks`/`shopify-callback` (bei Shopify),
   `telegram-webhook`, `email-delivery-webhook`, alle pg_cron-Ziele
   (`dispatch_cron_function`-Slugs) — diese Slugs bleiben eigenständig oder
   werden erst umgezogen, **nachdem** die externe Registrierung bzw. der
   Cron-Job per Migration nachgezogen ist.
2. **`verify_jwt` trennt Router.** Öffentliche Webhook-Empfänger
   (`verify_jwt=false`) und user-authentifizierte Endpunkte
   (`verify_jwt=true`) kommen nie in denselben Router.
3. **Cutover-Reihenfolge je Stufe:** Router deployen → Frontend-Aufrufe
   umstellen (derselbe PR, deployt via Pages) → Alt-Functions löschen
   (`delete-edge-function.yml`, manueller Dispatch) → Slot-Bilanz prüfen.
   Zwischen Router-Deploy und Löschung antworten alte und neue URL parallel —
   es gibt keinen Moment ohne funktionierenden Endpunkt.
4. **Ein Router = eine `index.ts` mit Handler-Map**, die bestehenden
   Handler-Dateien werden importiert, nicht umgeschrieben. Shared-Helfer
   (`_shared/gateway.ts`) bleiben die einzige Querverbindung.
5. Jede Stufe ist ein eigener PR mit Tests (`test/edge/…`) und läuft erst,
   wenn die vorige Stufe ihre Slots tatsächlich freigegeben hat.

## 3 Stufenplan

Slot-Bilanz kumulativ, Startpunkt 100/100 (0 frei):

| Stufe | Inhalt | Slots vorher→nachher | frei danach |
|---|---|---|---|
| **K1** | Live-Konsolidierung `enterprise-ai-os-*`: 8 live → Router `enterprise-ai-os` | −8 +1 | 7 |
| **K2** | Live-Konsolidierung `kodee-*` (4→1), `gdpr-*` (3→1), `mfa-*` (2→1), `newsletter-*` (2→1) | −11 +4 | 14 |
| **K3** | Domänen-Router `governance`: 18 live `governance-*` + 8 fehlende (`-score-calculator`, `-gap-analyzer`, `-deadline-monitor`, `-risk-escalate`, `-evidence-handler`, `-workflow-intake`, `-audit-report-gen`, `-analytics-aggregator`) → 2 Router (auth / cron+service) | −18 +2, +26 Endpunkte | 30 |
| **K4** | Neue Router für rein Fehlendes: `siteos` (siteos-* + checkout-siteos-project), `website-ops` (website-*), `webhooks-out` (webhook-deliver/-dispatcher/-retry-cron, api-webhook-deliver, notify-terminal-event), `reports` (generate-*, report-generator, export-audit, dashboard-*), `metrics-sync` (sync-*, calculate-seo-metrics, seo-dashboard-data, stripe-token-meter-sync), `oauth2` (oauth2-apps, oauth2-token) | +6 Router, ~25 Endpunkte | 24 |
| **K5** | Rest-Fehlende einsortieren (compliance-*, optimize-*, tenant-branding-*, social-*, memory-confidence-trigger, …) in bestehende Router; Einzelgänger mit externem Aufrufer (z. B. `stripe-oauth-callback`) als eigene Function deployen | ±0 bis −10 | ≥15 |

Endzustand: **alle 180 Repo-Funktionalitäten erreichbar, ~75–85 Slots belegt,
≥15 frei** — der `Deploy`-Workflow wird wieder grün, und neue Features brauchen
keinen Slot-Tausch mehr.

## 4 Risiken und ihre Behandlung

- **Live-Konsolidierung (K1–K3) ändert produktive URLs.** Behandlung: Traffic
  ist gemessen minimal (Edge-Logs 24 h: außer `track-pageview` nur
  Cron/Stripe); Cutover-Reihenfolge aus §2.3 lässt alte URLs bis zum Schluss
  antworten; das deployte SPA wird im selben Merge aktualisiert.
- **`deploy.yml` erkennt geänderte Functions über Verzeichnispfade.** Router
  importieren Handler aus den alten Verzeichnissen — nach Abschluss jeder
  Stufe werden die alten Verzeichnisse in den Router gezogen und gelöscht,
  sonst deployt der Pfad-Filter ins Leere.
- **`supabase/config.toml`** führt `verify_jwt` je Function — jede Stufe zieht
  die Einträge nach (alte raus, Router rein), sonst schlägt der Drift-Guard an.
- **pg_cron-Ziele** (`memory-decay-worker`, `scheduler-dispatch`,
  `agent-os-runner`, `governance-monitoring-scheduler`,
  `governance-erasure-sweeper`, …) behalten ihre Slugs, bis eine Migration den
  Job auf die Router-URL umstellt — Cron-Umzug ist Teil der jeweiligen Stufe,
  nie ein Nebeneffekt.

## 5 Nach jeder Stufe messen

```bash
supabase functions list --project-ref ebljyceifhnlzhjfyxup | wc -l   # Slot-Bilanz
npm run check:edge-functions                                          # Drift
npm run lint && npm run build && npm test                             # Regression
```
