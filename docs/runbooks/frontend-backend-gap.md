# Runbook: Frontend-Aufrufe ohne Backend in Produktion

**Zweck.** Feststellen, welche Oberflächen ins Leere greifen, weil die Edge
Function, die sie aufrufen, nicht deployt ist — und die Liste reproduzierbar
neu erheben, statt sie zu glauben.

**Letzte Erhebung: 2026-08-17** gegen `RealSyncDynamicsLive`
(`ebljyceifhnlzhjfyxup`, eu-central-1).

> Diese Datei ist ein Runbook, kein Statusbericht. Die Zahlen unten veralten —
> die Anleitung nicht. Vor jeder Aussage zum Produktionsstand neu messen.

## Ergebnis der Erhebung vom 2026-08-17

| | Anzahl |
|---|---|
| Edge Functions im Repository | 180 |
| davon in Produktion deployt | 100 |
| **nicht deployt** | **80** |
| davon **vom Frontend aufgerufen** | **32** |

Die letzte Zeile ist die relevante: 48 der fehlenden Functions ruft niemand,
sie kosten nichts. Die übrigen 32 stehen hinter Schaltflächen, die ein Kunde
drücken kann.

### Der Beleg

Eine deployte Function und eine fehlende unterscheiden sich eindeutig:

```
$ curl -s -o /dev/null -w '%{http_code}' -X POST \
    https://ebljyceifhnlzhjfyxup.supabase.co/functions/v1/health
405        # existiert, lehnt POST ab

$ curl -s -o /dev/null -w '%{http_code}' -X POST \
    https://ebljyceifhnlzhjfyxup.supabase.co/functions/v1/save-company-profile
404        # existiert nicht
```

`404` ist der Nachweis. Ein `401` oder `405` bedeutet: Function vorhanden.

## Der schwerste Einzelfall: Onboarding nach der Registrierung

`/unified-entry/onboarding` (`src/unified-entry/pages/PostRegisterOnboardingPage.tsx`)
ruft nacheinander auf:

```ts
await postEdgeFunction('save-company-profile', { sector, answers });
await postEdgeFunction('create-trial-subscription', { planKey: 'growth' });
setStep('success');
```

Beide antworten in Produktion mit `404`. `postEdgeFunction` wirft bei einem
Fehlschlag (`src/lib/edgeFunction.ts`), der `catch`-Zweig setzt eine
Fehlermeldung — `setStep('success')` wird nie erreicht.

**Folge:** Ein Interessent durchläuft Scan, Vorschau, Trial-Angebot und
Registrierung, bekommt ein Konto — und bleibt im letzten Schritt stehen. Weder
Firmenprofil noch Trial werden angelegt.

Das ist kein Frontend-Fehler. Kein Code-Fix im Frontend behebt es; die
Functions müssen deployt werden — und dafür braucht es zwei freie Slots
(siehe unten).

## Betroffene Oberflächen

Ohne die Bot-Laufzeit (`bot-chat`, `bot-voice-webhook`, `appointment-book`,
`order-intake`) und `c2pa-manifest-generate` — die sind in
`src/config/platform-capabilities.ts` bereits als `building` geführt und auf
den Kaufwegen ausgewiesen.

| Function | Aufrufer im Frontend |
|---|---|
| `auditor-engagement` | `src/features/governance/AuditorEngagementView.tsx` |
| `bulk-scan` | `src/features/bulk/bulkApi.ts` |
| `calculate-seo-metrics` | `src/features/seo-marketing-dashboard/useCachedMetrics.ts`<br>`src/features/seo-marketing-dashboard/__tests__/performance.test.ts`<br>`src/features/seo-marketing-dashboard/useRealtimeMetrics.ts`<br>`src/features/seo-marketing-dashboard/SEOMarketingDashboard.tsx` |
| `certification-readiness` | `src/features/governance/CertificationReadinessDashboard.tsx`<br>`src/features/governance/Iso42001CertificationHubView.tsx` |
| `create-trial-subscription` | `src/unified-entry/pages/PostRegisterOnboardingPage.tsx` |
| `export-audit` | `src/features/governance/terminal/AuditExportPanel.tsx` |
| `generate-certification-report` | `src/features/governance/CertificationReportGeneratorView.tsx` |
| `generate-compliance-report` | `src/features/governance/reporting/useReportBuilder.ts`<br>`src/features/seo-marketing-dashboard/__tests__/performance.test.ts`<br>`src/features/seo-marketing-dashboard/ComplianceReportPanel.tsx` |
| `log-tool-run` | `src/components/governance-os/EmbeddedBrowserCanvas.tsx` |
| `maintenance-schedule` | `src/features/governance/Iso42001MaintenanceView.tsx` |
| `remediation-workflow` | `src/features/governance/Iso42001RemediationWorkflowView.tsx` |
| `save-company-profile` | `src/unified-entry/pages/PostRegisterOnboardingPage.tsx` |
| `seo-dashboard-data` | `src/features/seo-marketing-dashboard/SEOMarketingDashboard.tsx` |
| `share-dashboard` | `src/features/seo-marketing-dashboard/CollaborationPanel.tsx` |
| `social-orchestrator-persistence` | `src/core/social-orchestrator/persistenceClient.ts` |
| `sync-ga-metrics` | `src/features/seo-marketing-dashboard/IntegrationSettings.tsx` |
| `sync-stripe-metrics` | `src/features/seo-marketing-dashboard/IntegrationSettings.tsx` |
| `tenant-branding-update` | `src/features/settings/BrandingSettings.tsx` |
| `train-forecast-models` | `src/features/seo-marketing-dashboard/ForecastPanel.tsx`<br>`src/features/seo-marketing-dashboard/__tests__/performance.test.ts` |
| `update-member-role` | `src/features/governance/terminal/useCollaborativeTerminal.ts` |
| `website-domain-manager` | `src/features/website-operations/DomainManager.tsx` |
| `website-maintenance-agent` | `src/features/website-operations/MaintenanceDashboard.tsx` |
| `website-operations-agent` | `src/features/website-operations/CreateWebsiteWizard.tsx` |

Schwerpunkte: **SEO-Marketing-Dashboard** (7 Functions), **ISO 42001**
(4 — die `iso42001-*`-Functions selbst laufen, die Arbeitsschritte darum
nicht), **SiteOS** (4), **Website-Operations** (3).

## Erhebung wiederholen

1. Deployte Functions holen — `supabase functions list`, oder über den
   Supabase-MCP `list_edge_functions` mit der Projekt-ID. Slugs in eine Datei,
   eine pro Zeile.
2. Gegen das Repository stellen:

```bash
ls supabase/functions | grep -v '^_shared$' | sort -u > /tmp/repo.txt
sort -u /tmp/deployed.txt > /tmp/dep.txt
comm -23 /tmp/repo.txt /tmp/dep.txt > /tmp/missing.txt
wc -l < /tmp/missing.txt
```

3. Auf Frontend-Bezug prüfen:

```bash
while read -r fn; do
  hits=$(grep -rl "functions/v1/$fn\b\|invoke('$fn'\|'$fn'" src/ | head -4 | tr '\n' ' ')
  [ -n "$hits" ] && echo "$fn :: $hits"
done < /tmp/missing.txt
```

4. Stichprobe gegen Produktion mit `curl` bestätigen (siehe oben). Der
   `grep`-Treffer allein beweist nichts — er findet auch Kommentare und Tests.

## Warum die 80 fehlen — das ist geklärt, nicht offen

Die Supabase-Organisation läuft auf dem **Free-Plan mit einem harten Limit von
100 Edge Functions**. Der Beleg ist keine Statistik, sondern die Fehlermeldung
selbst: `HTTP 402: Max number of functions reached for project`. Bestehende
Functions lassen sich weiter aktualisieren, neue nicht anlegen. Vollständig in
[`edge-function-kontingent.md`](./edge-function-kontingent.md) (Stand
2026-08-11).

**Ein Slot ist nur gegen einen anderen zu haben.** Genau das ist am 2026-08-16
passiert: `.github/workflows/free-plan-slot-swap.yml` löscht zwölf Functions
und deployt zwölf andere — deshalb stand die Summe an beiden Messtagen bei
exakt 100, obwohl sich die Zusammensetzung änderte.

| aus Produktion entfernt | dafür deployt |
|---|---|
| `pitch-deck-pdf`, `hostinger-agent-brief`, `mfa-admin-reset`, `governance-analytics-aggregator`, `legal-embed`, **`appointment-book`**, **`bot-chat`**, **`bot-voice-webhook`**, **`order-intake`**, `agent-scheduler`, `ai-act-auto-classify`, `api-gateway` | `scheduler`, `scheduler-dispatch`, `memory-decay-worker`, `governance-memory`, `evidence-vault`, `policy-packs`, `provenance`, `stripe-checkout-verify`, alle vier `iso42001-*` |

Das war eine bewusste, begründete Abwägung: Ausgewählt wurden Functions **ohne
einen einzigen Aufrufer** — kein Treffer im Repo-Aufrufkorpus, 0 Invocations in
den Edge-Logs.

### Der Haken an dieser Auswahl

Für die vier Bot-Functions stimmt „kein Aufrufer" im Repo-Sinn: Die
Bot-Oberfläche greift über PostgREST direkt auf die Tabellen zu, nicht über
die Functions. Ihre echten Aufrufer sind **eingehende Webhooks** von WhatsApp
und Telefonie — die tauchen in keinem `grep` auf und erzeugen 0 Invocations,
solange kein Bot live ist.

Damit wurde die Bot-Laufzeit abgeschaltet, während `/pricing/whatsapp`
weiterhin auf `/checkout/growth?channel=whatsapp` verlinkt und Growth das
Modul `whatsapp` laut `shared/pricing.ts` als enthaltene Leistung führt. Das
ist kein Vorwurf an den Tausch — die Slots mussten irgendwo herkommen — aber
es ist der Grund, warum die Kaufwege den Zustand ausweisen müssen
(`src/components/landing/CapabilityAvailabilityNotice.tsx`).

**Regel daraus:** „Keine Aufrufer im Repo" ist für Functions, die von außen
angesprochen werden (Webhooks, Cron, öffentliche APIs), kein taugliches
Kriterium. Vor dem nächsten Tausch die Aufrufrichtung prüfen, nicht nur den
Aufrufkorpus.

## Was diese Liste nicht sagt

- **Ob** eine Oberfläche ohne ihre Function unbrauchbar ist. Manche fangen den
  Fehler ab und zeigen einen leeren Zustand; das Onboarding oben tut es nicht.
  Wer eine Zeile abarbeitet, prüft den Einzelfall.
- **Was der Tausch kostet.** Jede der 32 Zeilen oben ist ein Kandidat für den
  nächsten Slot — und jeder gewonnene Slot nimmt einen anderen weg, solange
  der Free-Plan gilt. Die Konsolidierung mehrerer Functions hinter einem
  Router (siehe #1087) ist der einzige Weg, der Slots schafft statt sie zu
  verschieben.

---

## Nacherhebung 2026-08-19 — und warum die Lücke jetzt im Code steht

Neu gemessen gegen dasselbe Projekt. Der Deploy-Stand hat sich seit dem
2026-08-17 bewegt: `evidence-vault`, `policy-packs`, `provenance`, die vier
`iso42001-*`, `scheduler`, `scheduler-dispatch`, `governance-memory`,
`memory-decay-worker` und `stripe-checkout-verify` laufen inzwischen.

| | Anzahl |
|---|---|
| in Produktion deployt | 100 (= Plan-Limit, exakt ausgeschöpft) |
| vom Frontend aufgerufen | 110 Slugs |
| davon **nicht in Produktion** | **32** |
| davon auf **öffentlichem Pfad** | **7** |

Die Gesamtzahl ist praktisch unverändert, weil das Limit bindet: Was
dazukommt, verdrängt anderes. Deshalb ist „noch nicht deployt" hier keine
Terminfrage, sondern eine Tauschfrage.

### Was sich geändert hat: die Messung ist jetzt Code

Bisher lebte dieses Wissen nur in diesem Dokument und veraltete zwischen zwei
Erhebungen still. Seit dem 2026-08-19 steht es in
`src/config/production-edge-functions.ts`:

- `PRODUCTION_EDGE_FUNCTIONS` — die gemessene Deploy-Liste mit Messdatum
- `UNBACKED_CALLERS` — jeder Frontend-Aufruf ohne Backend, mit Oberfläche
  und der Angabe, ob der Pfad ohne Login erreichbar ist
- `isEdgeFunctionInProduction(slug)` — für die Oberfläche

`test/backend/edge-function-contract.test.ts` hält beide Richtungen fest:

1. Ein **neuer** Aufruf einer nicht deployten Function bricht die CI. Ein Knopf
   ohne Backend geht nicht mehr still in Produktion.
2. Steht ein Eintrag in `UNBACKED_CALLERS`, dessen Function **inzwischen läuft**,
   bricht die CI ebenfalls — als Erinnerung, die Notlösung im UI abzubauen.

Der zweite Punkt ist der wichtigere. Notlösungen verschwinden sonst nie.

### Neu erheben

```bash
# Deploy-Stand holen (Management-API oder CLI)
supabase functions list --project-ref ebljyceifhnlzhjfyxup

# Liste in src/config/production-edge-functions.ts ersetzen,
# PRODUCTION_EDGE_FUNCTIONS_MEASURED_AT mitziehen, dann:
npx vitest run test/backend/edge-function-contract.test.ts
```

Der Test sagt anschließend selbst, welche Einträge in `UNBACKED_CALLERS`
überholt sind.

### Öffentliche Sackgassen, Stand 2026-08-19

| Function | Oberfläche | Behandlung |
|---|---|---|
| `save-company-profile` | `/unified-entry/onboarding` | Fehlschlag wird als eigener Zustand gezeigt, Konto bleibt nutzbar |
| `create-trial-subscription` | `/unified-entry/onboarding` | dito — kein „Growth ist bereit" ohne angelegten Growth-Testzeitraum |
| `audit`, `avv-generator`, `dsfa`, `sub-processors` | `/api-docs` | als „Noch nicht verfügbar" gekennzeichnet |

`api-quota` steht zusätzlich in `src/features/api/API_DEVELOPER_GUIDE.md`,
wird aber von keinem Code aufgerufen — dokumentierter Endpunkt ohne Backend.

---

## SiteOS-Builder scharf schalten (Stand 2026-08-19)

Entscheidung des Eigentümers: **den vorhandenen Builder nutzen**, keinen neuen
bauen. Der Bestand ist erheblich und funktionsfähig geschrieben —

| Baustein | Umfang |
|---|---|
| `packages/siteos-core` — Prompt → Brief → Blueprint → Render, Scoring, Agenten | 3.322 Zeilen |
| `supabase/functions/siteos` — Router mit vier Handlern | 1.175 Zeilen |
| `platform/builder_orchestrator` (Python, Multi-Agent) | 6.792 Zeilen |

Was fehlte, war nie der Code, sondern der Weg dorthin.

### Erledigt (Frontend)

- `PreviewSelectionPage` ist unter **`/app/siteos/builder`** geroutet. Sie lag
  seit ihrer Entstehung ohne Route im Repo.
- Verlinkt vom SiteOS-Dashboard („Website aus Prompt bauen").
- Die Seite prüft `siteos` **vor** dem Aufbau. Fehlt der Slot, erscheint ein
  Hinweis statt eines dauerhaften Ladebalkens, und die Kopfzeile behauptet
  nicht mehr, die Website sei bereits gebaut.
- Die vier Functions sind zu **einem** Router zusammengefasst
  (`supabase/functions/siteos/`). Damit kostet SiteOS einen Slot statt vier.
  Das war die einzige Stellschraube, die ohne fremde Zustimmung zu drehen war:
  Slots freigeben heißt Produktionsfunktionen löschen, den Bedarf senken
  nicht.

### Erledigt — der Router läuft (2026-08-19, 16:39 Uhr)

Der Builder arbeitet. `siteos` ist in Produktion, alle vier Pfade sind über
HTTP nachgewiesen:

| Endpunkt | wofür | Live-Antwort ohne Nutzdaten |
|---|---|---|
| `siteos/discover` | liest die Ausgangsseite | `400 BAD_REQUEST · tenant_id required` |
| `siteos/builder` | erzeugt den Blueprint | `400 BAD_REQUEST · tenant_id required` |
| `siteos/runtime-scan` | die acht Laufzeit-Analysen | `400 BAD_REQUEST · tenant_id required` |
| `siteos/agents` | die sieben asynchronen Agenten | `400 BAD_REQUEST · op must be list\|approve\|run` |

Ein unbekannter Pfad antwortet mit `404 UNKNOWN_ENDPOINT` und listet die vier
bekannten; der alte Bindestrich-Slug `siteos-builder` ist ein Plattform-404 und
löst bewusst **nicht** über den Router auf.

Der Hinweis in der Oberfläche ist damit weg — er hing an
`isEdgeFunctionInProduction()`, und `siteos` steht seit der Neumessung in
`PRODUCTION_EDGE_FUNCTIONS`.

### Der Slot war da — die angenommene Schranke nicht

Dieser Abschnitt hielt bis zum Deploy fest, das Kontingent sei mit 100 voll und
der eine Slot nur durch Tauschen oder Tarifwechsel zu bekommen. Das hat sich
beim ersten Versuch erledigt: `siteos` ging als **101.** Function durch, ohne
402. Eine Neumessung über alle 177 Verzeichnisse ergibt 101 deployt, 76 fehlend.

Die Lehre ist nicht „das Limit ist weg" — wo es liegt, ist unbekannt und nicht
gemessen. Die Lehre ist, dass ein Zählstand von exakt 100 plus ein historisches
402 eine **Vermutung** trugen, die niemand nachgeprüft hatte, und die einen
fertigen Builder wochenlang als unerreichbar führte. Ein Deploy-Versuch kostet
einen Workflow-Lauf.

Vollständige Korrektur: `docs/runbooks/edge-function-kontingent.md`, Abschnitt 0.

### Was jetzt naheliegt

`save-company-profile` und `create-trial-subscription` — die beiden Functions,
an denen die Registrierung hängt (Tabelle oben) — sind unter derselben
Vermutung liegengeblieben. Sie sind wieder Kandidaten für einen Versuch.
