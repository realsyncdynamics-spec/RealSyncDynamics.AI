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
Functions müssen deployt werden.

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
| `siteos-agents` | `src/features/siteos/siteOsApi.ts` |
| `siteos-builder` | `src/features/siteos/siteOsApi.ts` |
| `siteos-discover` | `src/unified-entry/pages/PreviewSelectionPage.tsx`<br>`src/pages/WebsiteTransformationFlow.tsx` |
| `siteos-runtime-scan` | `src/features/siteos/siteOsApi.ts` |
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

## Was diese Liste nicht sagt

- **Warum** die 80 fehlen. Zur Vermutung „Function-Kontingent des
  Free-Tarifs" siehe CLAUDE.md §5. Belegt ist: Die Summe stand am 2026-08-16
  und am 2026-08-17 bei exakt 100, obwohl dazwischen mindestens zwölf
  Functions neu deployt wurden. Nicht belegt: der Grenzwert selbst.
- **Ob** eine Oberfläche ohne ihre Function unbrauchbar ist. Manche fangen den
  Fehler ab und zeigen einen leeren Zustand; das Onboarding oben tut es nicht.
  Wer eine Zeile abarbeitet, prüft den Einzelfall.
