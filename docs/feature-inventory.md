# Feature-Inventar — Sichtbarkeit und Routing

Stand: 2026-11-13. Quelle ist der Code auf diesem Branch (`src/App.tsx`,
`src/components/governance-os/governanceModules.ts`,
`src/features/governance/moduleConfig.ts`, `src/config/public-nav.ts`,
`src/config/featureFlags.ts`). Kein Master-Prompt „PR A – Feature Visibility
& Routing“ im Repository (gesucht in `docs/`, `README`, `AGENTS.md`,
`CLAUDE.md`, `.cursor/`, `prompts/`). Nahe liegende Texte beschreiben andere
Vorhaben (`docs/product/modular-product-experience.md`,
`docs/audit/module-routing-consistency.md` vom 2026-06-15, teils überholt).

Status:

| Status | Bedeutung |
|---|---|
| sichtbar | Route existiert und ein Nutzer findet sie in der Shell-Tab-Leiste, der öffentlichen Navigation oder als Redirect auf eine solche Fläche |
| versteckt | Route und View existieren, die Shell-Navigation listet sie nicht |
| kaputt | Navigation oder View zeigt etwas, das nicht zur registrierten Funktion passt (404, Mockdaten als Nachweis) |
| unfertig | Platzhalter, nur Demo-Daten, Feature-Flag aus, oder bewusst Roadmap |

Empfohlene Maßnahme ist ein Vorschlag, keine Freigabe für Merge oder Deploy.

## Zählung

Gezählt am 2026-11-13 gegen `src/App.tsx` (532 `path=`-Einträge) und die
Shell-Liste nach dieser Änderung.

| Klasse | Anzahl | Hinweis |
|---|---|---|
| Shell-Module (`GOVERNANCE_MODULES`) | 51 | 50 in der Tab-Leiste (`live`/`beta`), 1 nur im Roadmap-Dock (Maßnahmen) |
| In diesem PR neu in die Shell genommen | 13 | plus DSFA von `roadmap` auf `beta` |
| Statische `/app`-Routen | 148 | ohne `:param`-Pfade |
| Davon ohne Shell-Präfix | 83 | Route ist kein Modul und kein Unterpfad eines Moduls |
| Davon Redirects | 24 | `/app/assistant` zählt nicht dazu: View hinter Feature-Flag |
| Davon eigene Views ohne Shell | 59 | Admin, ISO-Cluster, API-Werkzeuge, Mock, Sonstige |
| Kaputt, am Einstieg korrigiert | 2 | Mock-Prüfpfad, `/api/docs` |
| Unfertig, bewusst nicht verlinkt | 4 | VVT-Assistent, Runtime-VVT, Governance-AI-Flag, Maßnahmen bleiben Roadmap |

Öffentliche Nav-Ziele in `public-nav.ts` treffen registrierte Routen.
Ausnahme war der Prüfpfad: die Route existierte, die View nicht als Nachweis.

## In diesem PR sichtbar gemacht

Nur Flächen, deren View Mandantendaten über die bestehende API lädt.
Dieselbe Shell-Liste (`GOVERNANCE_MODULES`) speist Seitenleiste und Tabs.
Keine neue Registry. Pfade in `App.tsx` sind unverändert.

| ID | Route | Status | Gruppe | Herkunft |
|---|---|---|---|---|
| scans | `/app/scans` | beta | Erfassen | `ScansListView` liest `scan_runs` |
| risk-inventory | `/app/risk-inventory` | beta | Bewerten | öffentliche Nav, Entitlement `governance.risk_register` |
| incidents | `/app/incidents` | live | Bewerten | `moduleConfig.ts` |
| dsr | `/app/dsr` | live | Bewerten | `moduleConfig.ts` |
| analytics | `/app/analytics` | beta | Bewerten | KPI-Snapshots |
| approvals | `/app/approvals` | live | Steuern | öffentliche Nav + `moduleConfig.ts` |
| gates | `/app/governance/gates` | live | Steuern | Policy-Gates, getrennt von Approvals |
| mappings | `/app/mappings` | live | Steuern | Asset-Kontroll-Matrix |
| webhooks | `/app/webhooks` | beta | Steuern | Entitlement `webhooks.enabled` |
| connectors | `/app/connectors` | beta | Erfassen | Jira/GitHub/Linear |
| keys | `/app/keys` | live | Verwalten | Ingest-Keys, Schreiben bleibt owner/admin in der View |
| costs | `/app/costs` | beta | Verwalten | Token-Verbrauch |
| evidence-integrity | `/app/governance/evidence` | live | Nachweisen | Kettenprüfung, nicht der Vault |
| dpia | `/app/dpia` | beta | Bewerten | war `roadmap`, View lädt DSFA-Sätze; Gate unverändert |

## Kaputt

| Fläche | Pfad | Befund | Maßnahme |
|---|---|---|---|
| Prüfpfad (Mock) | `/app/governance/audit-trail` | `AuditTrailView` setzt fest eingetragene Logzeilen. Die öffentliche Nav hat diese URL als Live-Prüfpfad verlinkt. | Nav zeigt jetzt auf `/app/audit` (`AuditExportView`, Ereignisse aus `governance_events`). Die alte URL bleibt. |
| API-Referenz | `/api/docs` | Link in `ApiDocumentation.tsx`. Registriert sind `/api` und `/api-docs`. | Link zeigt auf `/api`. |
| Admin-Schnellzugriffe auf `main` | `AdminDashboard.tsx` | Buttons ohne Ziel, bis #2177. | Nicht hier geändert. Offen in #2177. |

## Unfertig — nicht verlinkt

| Fläche | Pfad | Befund | Maßnahme |
|---|---|---|---|
| Governance AI | `/app/assistant` | `isGovernanceAiEnabled()` standardmäßig aus (`src/config/featureFlags.ts`). Route existiert, Shell listet sie nicht. | Versteckt lassen, bis das Gateway Login und `tenant_id` für alle Aufrufe prüft. |
| Runtime-VVT | `/app/vvt` | `RuntimeVvtView` rendert nur `DEMO_VVT_ENTRIES`. | Versteckt lassen. |
| VVT-Assistent | `/vvt-wizard` | Formular ohne Persistenz. Öffentliche Nav markiert ihn als live. | Badge erst nach Freigabe auf Preview setzen. Route nicht umbenennen. |
| Maßnahmen | `/app/remediation` | View lädt Pläne, Shell-Status bleibt `roadmap` (Dock). `moduleConfig.ts` und `test/governance/module-access.test.ts` erwarten `roadmap`. Öffentliche Nav sagt live. | Status nicht in diesem PR anheben. |

## Versteckt — bewusst offen

Diese Routen haben eine View und sind nicht in der Shell. Sie wurden nicht
verlinkt, weil sie Admin-Werkzeuge, ein unprüfbarer ISO-Cluster oder schon
Gegenstand eines anderen PR sind.

| Bereich | Pfade | Empfehlung |
|---|---|---|
| Admin | `/app/admin`, `/app/admin/members`, `/app/admin/settings`, `/app/admin/billing`, `/app/admin/audit`, `/app/admin/api-keys`, `/app/admin-log` | Schnellzugriffe: offen in #2177. Keine zweite Admin-Navigation. |
| API-Werkzeuge | `/app/api/docs`, `/app/api/setup`, `/app/api/monitoring`, `/app/api/monitoring-advanced`, `/app/api/email-templates`, `/app/api/webhook-retry`, `/app/api/webhook-tester`, `/app/api/rate-limiting` | Für Betreiber lassen. Öffentliche Referenz ist `/api`. |
| ISO-/Framework-Cluster | `/app/governance/iso42001*`, `/app/governance/iso-42001-hub`, `/app/governance/iso-control-library`, `/app/governance/frameworks`, `/app/governance/custom-frameworks`, `/app/governance/custom-framework-builder`, `/app/governance/report-builder`, `/app/governance/compliance-roadmap`, `/app/governance/compliance-calendar`, `/app/governance/compliance-analytics`, `/app/governance/audit-reports` (Redirect auf `/app/reports`) | Eigene Prüfung, nicht gebündelt. `App.tsx` nicht anfassen (Konflikt mit #2205, #2195, #2171, Landing-PRs). |
| Weitere Governance-Views | `/app/governance/connectors` (Registry, getrennt von `/app/connectors`), `/app/governance/shadow`, `/app/governance/memory`, `/app/governance/microsoft365`, `/app/governance/industrial-ot`, `/app/governance/team-collaboration`, `/app/governance/gaps`, `/app/datasets`, `/app/policies/templates` | Erst verlinken, wenn die View keine Attrappe ist. |
| Builder | `/app/siteos`, `/app/siteos/modernize`, `/app/siteos/claim`; `/app/siteos/builder` leitet weiter | Einstieg `/build` ist Gegenstand von #2198. |
| Sonstige | `/app/terminal` (Governance-Terminal, kein Claude-Code-Shell; siehe #2198), `/app/leads`, `/app/legal-rag`, `/app/seo-marketing-dashboard`, `/app/optimize`, `/app/company`, `/app/beispiel`, `/app/cockpit/brief`, `/app/risk` | Nicht als Produktkachel. Dashboard-Arbeit: #2195, #2210. |

## Redirects (URLs bleiben)

Diese 24 statischen Pfade sind `Navigate`, keine eigene Fläche:
`/app`, `/app/overview`, `/app/cockpit`, `/app/simple`, `/app/mein-geschaeft`,
`/app/intelligence`, `/app/local-ai`, `/app/bauen`, `/app/onboarding`,
`/app/governance`, `/app/governance/start`, `/app/governance/ai-register`,
`/app/governance/ai-act-assessment`, `/app/governance/dsgvo-directory`,
`/app/governance/nis2-incidents`, `/app/governance/iso27001`,
`/app/governance/iso42001`, `/app/governance/gaps`,
`/app/governance/evidence-vault-advanced`, `/app/governance/remediation-plans`,
`/app/governance/audit-reports`, `/app/governance/api-keys`,
`/app/governance/recommendation`, `/app/governance/integrations`.
`/app/home` ist zusätzlich ein Shell-Alias auf `/app/dashboard`. Nicht löschen.

`/app/governance/bulk-operations` ist eine eigene View neben dem schon
sichtbaren Modul `/app/bulk` und bleibt ohne zweiten Menüpunkt.

`/os/app/*` kommt aus `src/enterprise-os/legacyRouteMap.ts` und leitet auf
`/app/*`. Die Links in den `/os`-Seiten sind deshalb keine 404.

## Offen in anderen PRs — hier nicht erneut gebaut

| PR | Thema | Dateien, die dieser PR nicht anfasst |
|---|---|---|
| #2198 | Vier Landing-Produktkarten | `LandingChannelTools.tsx`, Optimizer-Overview, `ci.yml` |
| #2205 | App-Hülle und Routenregister (Draft) | `src/App.tsx`, `src/app/registry.ts`, `src/app/routes.config.ts`, `TenantProvider.tsx` |
| #2171 | Portal `/produkte` | `src/App.tsx`, `src/product/productSuite.ts`, Portal-Seiten |
| #2164, #2163 | Unternehmen-Menü und „Zur Plattform“ | `companyProducts.ts`, `CompanyLanding.tsx` — die beiden PRs kollidieren untereinander |
| #2177 | Admin-Schnellzugriffe (Draft) | `AdminDashboard.tsx` |
| #2173 | Login-Callback `/welcome` | `Welcome.tsx`, `LoginPage.tsx`, `authResumeTarget.ts` |
| #2191, #2189, #2208, #2204 | Landing v8/v9 und `/` | `src/App.tsx`, Landing-Seiten |
| #2210 | Widget-Registry (Draft, inkl. Migration) | Command Center, `supabase/migrations/…dashboard_layouts.sql` |
| #2195 | Governance-Arbeitslisten im Command Center (Draft) | Dashboard-Dateien und `src/App.tsx` unangetastet. Überlapp nur `test/config/terminology-baseline.json` |
| #2212 | Creative Studio (Draft, Flag, Platzhalter für KI und Publishing) | Modul nicht übernommen. Überlapp: `governanceModules.ts`, `shellNavGroups.ts`, `commandCenterCatalog.test.ts`. Dazu bei #2212: `src/App.tsx` und Migration `social_designs` |

#2212 hängt `creative-studio` an dieselbe Shell-Liste (Gruppe Start). Dieser PR fasst das Modul nicht an. Die Hunks liegen an anderen Stellen der beiden Dateien. Merge-Hygiene will den älteren PR zuerst, danach `npm run sync:main` auf diesem Branch.

#2205 führt ein neues Register ein. Dieser PR hängt die Flächen an die
bestehende Shell-Liste. Nach einem Merge von #2205 die neuen IDs dort
nachziehen, nicht eine dritte Liste anlegen.

Empfohlene Reihenfolge, wenn die PRs zusammenkommen: #2212 und #2195
zuerst (dieselben Dateien, ältere PRs), danach `npm run sync:main` auf
diesem Branch. Dann #2177 und #2173, #2198, genau eine Landing-Fassung,
#2163 vor #2164, #2171, #2205, zuletzt #2210. Creative Studio bleibt hinter
seinem Flag und wird hier nicht sichtbar gemacht.
