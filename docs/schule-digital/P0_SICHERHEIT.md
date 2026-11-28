# P0-Sicherheitsblocker für Schule DIGITAL

**Status:** KONZEPT  
**Stand:** 27.11.2026, 23:55 (Europe/Berlin), `main` @ `a53dce7c`

Diese Liste benennt, was vor schulbezogenen Funktionen (Kinddaten, Elternzugang, KI für Schüler) geklärt oder geschlossen werden muss. Aufwände in Personentagen sind **ANNAHMEN**, keine Zusagen.

NOVA-Befunde stammen aus `/workspace/nova-reports/baseline-2026-11-23.md` (Prüfung von `main` @ `9e5a0d86`, 23.11.2026, nur lesend). Sie sind jeweils mit „NOVA“ gekennzeichnet. Stichproben auf `a53dce7c` sind extra ausgewiesen. Der Live-Zustand der Produktionsdatenbank wurde von NOVA und in der Folgeanalyse nicht gemessen.

## P0-1 – RLS für die dokumentierte Schuldenliste

- **Inhalt:** Row Level Security für acht Tabellen in `public` einschalten; laut NOVA zusätzlich `search_path` für SECURITY-DEFINER-Funktionen setzen (NOVA M1) und die Live-Rechte von `organizations` / `organization_members` mitprüfen.
- **Beleg Repo (nachgeprüft auf `a53dce7c`):** `test/runtime/db/security-regressions.db.test.ts:540-549` listet als `RLS_BEKANNTE_SCHULD`: `_circuit_breakers`, `_operation_metrics`, `_rate_limits`, `memory_retention_policies`, `provenance_records`, `seo_marketing_audit_log`, `social_publishing_metrics_hourly`, `subscription_addons`. Der Testkommentar markiert `provenance_records` als sensibel (Herkunftsnachweise).
- **Beleg NOVA:** H1 (hoch), M1 (mittel). NOVA: Wenn diese Tabellen in Prod so existieren, sind sie mit dem öffentlichen anon-Key über PostgREST lesbar und eventuell schreibbar. Live NICHT VERIFIZIERT.
- **Relevanz Schule DIGITAL:** Der öffentliche anon-Key im Frontend ist nur so sicher wie die RLS-Regeln. Ohne geschlossene Schuld und ohne nachgewiesene Mandantentrennung dürfen keine Kinddaten angelegt werden.
- **Nächster Schritt:** [RLS_MESSUNG.sql](./RLS_MESSUNG.sql) nur lesend ausführen. Eine ändernde Migration erst nach Freigabe Dominiks, als eigener Draft-PR.
- **Aufwand (ANNAHME):** 1–2 PT nach der Messung.

## P0-2 – Kanonisches Mandantenmodell und Tests zur Trennung

- **Inhalt:** Entscheiden, welches Modell die Isolationsgrenze ist, und Tests schreiben, die eine Übergriffigkeit zwischen Mandanten verhindern.
- **Beleg:** Zwei Modelle, siehe [MANDANTENMODELL_ENTSCHEIDUNG.md](./MANDANTENMODELL_ENTSCHEIDUNG.md). `tenants` ist in den Migrationen nicht per `CREATE TABLE` definiert (`scripts/test-db/bootstrap.sql:70`).
- **Relevanz Schule DIGITAL:** Ohne eine Grenze „Schule A sieht Schule B nicht“ ist ein Eltern- oder Schülerportal nicht vertretbar.
- **Aufwand (ANNAHME):** 3–5 PT.

## P0-3 – Schulrollen und Sorgerechtsmodell

- **Inhalt:** Konzept (dieses Paket) reviewen, danach erst Schema und RLS-Policies für Schulrollen und die Beziehung Eltern ↔ Kind.
- **Beleg:** Schulrollen und Sorgerecht fehlen, siehe [ROLLEN_UND_SORGERECHT.md](./ROLLEN_UND_SORGERECHT.md) und Register SD-B02.1, SD-B02.2.
- **Relevanz Schule DIGITAL:** Kinderschutz-Voraussetzung neben der Mandantentrennung.
- **Aufwand (ANNAHME):** 3–5 PT für das Konzept inklusive Review; Implementierung extra und nur nach Freigabe.

## P0-4 – AI Gateway nur mit Login und `tenant_id`

- **Inhalt:** Modellaufrufe dürfen nicht ohne authentifizierten, mandantengebundenen Kontext laufen, bevor KI für Schüler oder Eltern eingesetzt wird.
- **Beleg (nachgeprüft):** `src/config/featureFlags.ts:5-19` – der Governance-KI-Workspace bleibt standardmäßig aus, bis das Gateway für alle Aufrufe Login und `tenant_id` verlangt.
- **Relevanz Schule DIGITAL:** SYNC ist als öffentlicher Assistent vorhanden (`supabase/functions/governance-agent/index.ts:342`, #2439). Für schulische KI reicht das nicht.
- **Aufwand (ANNAHME):** 2–3 PT.

## P0-5 – Dependabot und verwundbare Abhängigkeiten

- **Inhalt:** Dependabot-Alerts und Security-Updates einschalten, `dependabot.yml` anlegen, `npm audit fix` (laut NOVA 1 kritische Lücke in `proxy-addr`, 9 hohe in Prod-Abhängigkeiten), `vite` nach `devDependencies` verschieben.
- **Beleg Repo (nachgeprüft auf `a53dce7c`):** `.github/dependabot.yml` fehlt. `vite` steht in `dependencies` (`package.json:94`). `express` in `package.json:83`, `react-router-dom` in `package.json:91`.
- **Beleg NOVA:** H2 (hoch). `npm audit --omit=dev` am 23.11.2026: 1 critical, 9 high, 27 moderate, 1 low. GitHub-API: „Dependabot alerts are disabled for this repository“. Ob `express` mit `trust proxy` in einem Prod-Pfad läuft, hat NOVA nicht verifiziert.
- **Relevanz Schule DIGITAL:** Bekannte Schwachstellen ohne automatisches Monitoring sind unvereinbar mit einem späteren Schulbetrieb.
- **Hinweis:** Dependabot in den Repo-Einstellungen einzuschalten ist eine eigene Freigabe. `npm audit fix` gehört in einen eigenen Draft-PR, nicht in diesen Dokumentations-PR.
- **Aufwand (ANNAHME):** 1 PT plus die Einstellungsfreigabe.

## P0-6 – CodeQL als Pflicht-Check und Workflow-Rechte

- **Inhalt:** CodeQL als Required Check bzw. Code-Scanning-Regel im Ruleset, Triage offener Alerts, `permissions: contents: read` in Workflows ohne Block, Default-Workflow-Rechte auf Lesen.
- **Beleg NOVA:** H3 (hoch), M3 (mittel). NOVA: ca. 121–130 offene CodeQL-Alerts, Filter „critical“ 0 Treffer; CodeQL steht nicht unter den Required Status Checks des Rulesets „main merge hygiene“. Die exakte Schweregrad-Verteilung konnte NOVA nicht vollständig auswerten (Connector kürzte die Antwort).
- **Beleg eigene Zählung (27.11.2026, `a53dce7c`):** 29 von 44 Workflows ohne `permissions:` auf oberster Ebene. NOVA nannte 27 von 44; die Differenz ist ungeklärt (ANNAHME: NOVA zählt Rechte auf Job-Ebene mit).
- **Hinweis:** Eine Änderung des Rulesets ist sicherheitskritisch und braucht eine eigene Freigabe Dominiks. Dieser PR ändert das Ruleset nicht.
- **Aufwand (ANNAHME):** 2–4 PT.

## P0-7 – DSFA, AVVs, anwaltlich geprüfte Datenschutzerklärung

- **Inhalt:** Formale Datenschutz-Folgenabschätzung, Auftragsverarbeitungsverträge, geprüfte Datenschutzerklärung – besonders relevant sobald Minderjährige betroffen sind.
- **Beleg NOVA:** M6 (Datenschutzerklärung laut Repo nicht anwaltlich geprüft, Pflichtangaben offen) und Lücke 9 (keine formale DSFA der Plattform im Repo gefunden; AVVs mit Supabase, Stripe, Sentry, Cloudflare und Hostern aus dem Repo nicht prüfbar).
- **Bestand, der hilft, aber nicht ersetzt:** DSFA-Wizard (`src/pages/DsfaWizard.tsx`), DSR-Functions, Seite `/legal/sub-processors` (HTTP 200 am 27.11.2026).
- **Aufwand:** extern / juristisch, hier nicht in PT geschätzt.

## P0-8 – Edge-Function-Kapazität klären

- **Inhalt:** Feststellen, ob neue Edge Functions (z. B. schulische APIs) überhaupt anlegbar sind.
- **Beleg:** 205 Function-Verzeichnisse unter `supabase/functions/` (Zählung 27.11.2026). `docs/MCP_GOVERNANCE_SERVER.md:38-40` (Dateistand 27.09.2026) beschreibt den Free-Plan bei 100 von 100 Functions; neue Functions werden mit `HTTP 402: Max number of functions reached` abgewiesen, bestehende können aktualisiert werden.
- **Widerspruch:** 205 Verzeichnisse im Repo vs. dokumentiertes Limit 100. Live-Kontingent **NICHT VERIFIZIERT** (kein Supabase-Dashboard).
- **Aufwand (ANNAHME):** 0,5 PT für die Kontoprüfung.

## Empfohlene Reihenfolge (Vorschlag)

1. P0-1 messen (nur lesen), dann nach Freigabe schließen.
2. P0-2 und P0-3 entscheiden und als Konzept residual reviewen (NOVA).
3. P0-4, bevor schulische KI angebunden wird.
4. P0-5 und P0-6 parallel als eigene Draft-PRs plus Einstellungsfreigaben.
5. P0-8 früh klären, weil sie neue Functions blockieren kann.
6. P0-7 vor einem Pilot mit echten Schüler- oder Elterndaten.

Keine dieser Maßnahmen wird durch diesen Dokumentations-PR umgesetzt.
