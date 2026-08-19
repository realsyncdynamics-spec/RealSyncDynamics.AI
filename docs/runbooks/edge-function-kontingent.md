# Runbook — Edge-Function-Kontingent aufräumen und erweitern

> ## ✅ Status 2026-08-19 — das Limit ist weg, der Rollout steht aus
>
> Die Organisation `kejfpjavqgqrecnbhzex` läuft seit dem Billing-Upgrade auf Plan
> **`pro`** (geprüft über die Management-API, nicht angenommen). Das Free-Limit von
> 100 Edge Functions gilt nicht mehr; `HTTP 402: Max number of functions reached`
> kann nicht mehr auftreten.
>
> Damit gilt für alles unterhalb dieser Zeile: **historischer Befund**. Kein
> Slot-Tausch mehr, keine Löschung live deployter Functions, um Platz zu schaffen.
> Die vier One-Shot-Workflows dazu sind am 2026-08-19 **entfernt** worden —
> `free-plan-slot-swap.yml`, `k1-slots-freigeben.yml`,
> `selective-p0-auth-free-slot.yml`, `selective-p0-auth-deploy.yml`. Sie
> löschten produktive Functions ohne Gegenwert; der Code steht in der
> Git-History, falls jemand die damalige Auswahl nachlesen will.
>
> ### Offen: 80 Functions nachziehen
>
> Messung 2026-08-19 gegen `RealSyncDynamicsLive` (`ebljyceifhnlzhjfyxup`):
> 180 Functions im Repo, 100 live, **80 fehlen**. Der Code ist vollständig — es
> ist ein reiner Rollout.
>
> **Durchführung** (GitHub → Actions → *Deploy* → *Run workflow*):
>
> | Feld | Wert |
> |---|---|
> | Use workflow from | der Branch mit dem erweiterten `deploy.yml` |
> | `deploy_functions` | `true` |
> | `push_migrations` | **`false`** — reiner Function-Rollout, Prod-Schema bleibt unberührt |
> | `functions` | die 80 Slugs unten, leerzeichengetrennt |
>
> Der Input `functions` hat Vorrang vor der Changed-Files-Auswahl; ein Slug ohne
> `supabase/functions/<slug>/index.ts` bricht den Lauf ab, bevor irgendetwas
> deployt wird.
>
> ```
> agent-scheduler ai-act-auto-classify api-gateway api-webhook-deliver
> appointment-book audit-determinism-verify auditor-engagement automation-trigger-trial-webhook
> bot-chat bot-voice-webhook bulk-scan c2pa-manifest-generate
> calculate-seo-metrics certification-readiness checkout-siteos-project cloudflare-deployer
> compliance-alert-trigger compliance-remediation-execute create-trial-subscription dashboard-digest-generate
> dashboard-intelligence email-delivery-webhook email-notify-send export-audit
> generate-certification-report generate-compliance-report governance-analytics-aggregator governance-audit-report-gen
> governance-deadline-monitor governance-evidence-handler governance-gap-analyzer governance-risk-escalate
> governance-score-calculator governance-workflow-intake hostinger-agent-brief invoice-email
> legal-embed log-tool-run maintenance-schedule memory-confidence-trigger
> mfa-admin-reset nis2-deadline-calculator notify-terminal-event oauth2-apps
> oauth2-token optimize-analyze optimize-execute order-intake
> partner-provision-tenant pitch-deck-pdf plans remediation-workflow
> report-generator save-company-profile schedule-data-syncs seed-integrations
> seo-dashboard-data share-dashboard siteos-agents siteos-builder
> siteos-discover siteos-runtime-scan skills social-orchestrator-persistence
> social-publisher-worker stripe-oauth-callback stripe-token-meter-sync sync-ga-metrics
> sync-stripe-metrics tenant-branding-get tenant-branding-update train-forecast-models
> update-member-role webhook-deliver webhook-dispatcher webhook-retry-cron
> website-domain-manager website-maintenance-agent website-maintenance-daily-cron website-operations-agent
> ```
>
> **Danach prüfen** — gemessen, nicht geschätzt:
> `supabase functions list --project-ref ebljyceifhnlzhjfyxup | wc -l` muss 180
> ergeben. Anschließend die Tabelle in `CLAUDE.md` §5 aktualisieren.
>
> **Was der Rollout freischaltet** (Auszug): `save-company-profile` und
> `create-trial-subscription` — beide werden von `/unified-entry/onboarding`
> aufgerufen und antworten heute mit 404, der Registrierungsabschluss bricht dort
> ab (siehe `frontend-backend-gap.md`). Dazu die `siteos-*`-Runtime, `oauth2-*`,
> die `webhook-*`-Zustellung und die Reporting-Functions.
>
> ### Weiterhin offen, unabhängig vom Limit
>
> Point-in-Time-Recovery ist auch im Pro-Tarif ein Zusatz. Solange er nicht
> gebucht ist, steht die Zusage „auditierbarer Prüfpfad" ohne PITR da — eigener
> Governance-Befund, nicht Teil dieses Rollouts.

---


**Stand:** 2026-08-11
**Auslöser:** Jeder `Deploy`-Lauf scheitert mit `HTTP 402: Max number of functions reached for project`.

---

## 1 Befund

Die Supabase-Organisation läuft auf dem **Free-Plan** (Limit: 100 Edge Functions).
Gemessen am 2026-08-10 über die Management-API:

| | Anzahl |
|---|---|
| Live in Supabase | **100** — Limit exakt erreicht |
| Im Repo (`supabase/functions/`) | 178 |
| **Nicht deploybar** | **83** |
| Verwaist (live, aber nicht im Repo) | 5 |

Bestehende Functions werden weiterhin aktualisiert („No change found"), **neue können
nicht angelegt werden**. Das ist die Ursache dafür, dass Module wie Evidence Vault,
Policy Packs, Provenance, sämtliche `iso42001-*` und die RFC-003-Memory-Functions
(`governance-memory`, `memory-decay-worker`, `memory-confidence-trigger`)
im Repo vollständig sind, aber in Produktion fehlen.

> **Wichtig:** Aufräumen schafft 5 Slots. Gebraucht werden 83.
> Das Aufräumen ist Hygiene, **nicht** die Lösung — dafür braucht es mehr Kontingent.

---

## 2 Reihenfolge — nicht vertauschen

Der Drift-Guard (`scripts/check-edge-function-drift.mjs`) meldet eine live deployte
Function ohne Repo-Verzeichnis als **ORPHAN-Fehler**. Die Allowlist entschärft das
zur Warnung. Wird ein Eintrag entfernt, *bevor* die Function gelöscht ist, wird der
Check rot, sobald er mit `SUPABASE_ACCESS_TOKEN` läuft.

```
1. Function in Supabase löschen
2. danach Eintrag aus scripts/edge-function-drift-allowlist.json entfernen
```

---

## 3 Die fünf verwaisten Functions löschen — ✅ erledigt 2026-08-11

> Ausgeführt über den Workflow `Selective P0 Auth Free Slot + Deploy` (Run #1, success).
> Live-Stand danach: Orphans entfernt, `governance-agents-list` deployt (P0 complete),
> Allowlist geleert. Die Anleitung bleibt als Referenz für künftige Orphans stehen.

Alle fünf existieren nicht mehr in `supabase/functions/` und wurden seinerzeit
manuell deployt (erkennbar am `entrypoint_path` unter `/tmp/user_fn_…` statt
`/home/runner/work/…`, also nie über die CI-Pipeline):

| Slug | Version | Zweck (historisch) |
|---|---|---|
| `debug-secret-shape` | 18 | Debug-Helfer für Secret-Format |
| `vault-set-secret` | 16 | einmaliger Vault-Setup-Helfer |
| `vault-key-setter` | 16 | einmaliger Vault-Setup-Helfer |
| `stripe-webhook-fixer` | 16 | einmaliger Fix, seit 2026-05 nicht aktualisiert |
| `stripe-webhook-provision` | 1 | nie über Version 1 hinaus |

```bash
supabase link --project-ref ebljyceifhnlzhjfyxup

for slug in debug-secret-shape vault-set-secret vault-key-setter \
            stripe-webhook-fixer stripe-webhook-provision; do
  supabase functions delete "$slug" --project-ref ebljyceifhnlzhjfyxup
done
```

**Löschen ist irreversibel.** Wer den Code noch braucht, zieht ihn vorher:
`supabase functions download <slug> --project-ref ebljyceifhnlzhjfyxup`

Danach die fünf Einträge aus `scripts/edge-function-drift-allowlist.json` entfernen —
die Liste ist dann leer, was dem dort formulierten Ziel entspricht. (✅ erledigt)

---

## 4 Kontingent erweitern

Nach dem Aufräumen: ~95 belegt, 5 frei, 83 fehlen weiterhin. Die Lücke schließt nur
ein Plan-Wechsel.

- **Pro-Plan**: 500 Edge Functions statt 100, ca. 25 USD/Monat
- Zusätzlich relevant: Der Free-Plan bietet **kein PITR** (Point-in-Time-Recovery).
  Für ein Governance-Produkt mit DSGVO-Anspruch ist das ein eigenständiges Risiko —
  siehe `docs/runbooks/p0-2-migration-reconciliation.md`, wo der fehlende
  Rollback-Pfad bereits vermerkt ist.

Upgrade unter: Supabase Dashboard → Organization → Billing.

---

## 5 Zweite Deploy-Blockade: Migrations-Historie

Unabhängig vom Function-Limit scheitert auch der Job `Push migrations`:

```
Remote migration versions not found in local migrations directory.
supabase migration repair --status reverted 20260628121531 20260628121551 \
  20260628121603 20260628193744 20260628193759 20260628193820 20260701121059 \
  20260715105402 20260720123325 20260720123711 20260720124405 20260802192603
```

Zwölf Migrationen sind in der Remote-DB registriert, existieren aber lokal nicht.
Solange das offen ist, wird **keine** Migration angewendet — auch nicht
`20260819000000`, die den pg_cron-Job `memory-decay-hourly` registriert. Ohne diesen
Job existiert der Decay-Worker zwar, tickt aber nie und es verfällt kein Memory.

Vorgehen: `docs/runbooks/p0-2-migration-reconciliation.md`.

---

## 6 Prüfen, ob es gewirkt hat

```bash
# Kontingent
supabase functions list --project-ref ebljyceifhnlzhjfyxup | wc -l

# Drift-Guard (mit Token, sonst wird der Prod-Teil übersprungen)
SUPABASE_ACCESS_TOKEN=… SUPABASE_PROJECT_ID=ebljyceifhnlzhjfyxup \
  node scripts/check-edge-function-drift.mjs
```

Erfolgskriterium: Der `Deploy`-Workflow läuft ohne `402` durch, und
`governance-memory`, `memory-decay-worker` sowie `memory-confidence-trigger`
erscheinen in `supabase functions list`.

---

## 7 P0 Auth Hardening — ✅ 401-Verifikation 2026-08-11

Die drei live P0-Functions wurden nach #1011 mit `requireAuthAndTenant` + `verify_jwt=true` gehärtet und selektiv deployt:

| Function | 401 (invalid Bearer) |
|---|---|
| `governance-risk-score` | ✅ 401 `UNAUTHORIZED_INVALID_JWT_FORMAT` |
| `governance-agents-list` | ✅ 401 |
| `enterprise-ai-os-discovery-pending` | ✅ 401 |

Cross-Tenant 403 (Schritt 4b) bleibt manuell (benötigt gültiges User-JWT eines Nicht-Mitglieds).

**Gate für Deploy-Manifest (#1012) und Entitlement-Flow (#1013) ist damit offen.**
