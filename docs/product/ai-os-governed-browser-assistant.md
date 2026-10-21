# RealSync AI OS – Governed Browser-Assistent (Draft)

## Ziel
Die existierende `GovernanceBrowserShell` bleibt der einheitliche Auth-geschützte Workspace. Links stehen die registrierten Anwendungen, in der Mitte die aktive Route oder die KI-Startseite, rechts öffnet sich der Kontext-Assistent. Die Comet-/Grok-Referenz betrifft die Anordnung, nicht den Import fremder Produkte oder Browser-Erweiterungen.

## Aktueller Implementierungsstand (PR #1959)
- `GovernedAssistantSidebar` verwendet denselben Shell-Kontext auf allen `/app/*`-Routen; auf breiten Dashboards wird die rechte Rail standardmäßig geöffnet.
- Die Nutzenden wählen einen Fachzweck und geben die Datenklasse an. `auto` wählt auf dem Server aus einer festen Allowlist einen EU-lokalen Modellprofil-Typ; manuelle Auswahl erlaubt ausschließlich `eu_precise`.
- Vor LLM-Aufruf: echter Nutzer-JWT, Mitgliedschaft, Tenant-Residency-Policy, `GOVERNED_ASSISTANT_EU_RUNTIME_VERIFIED=true`, Datenklassifizierung, konservativer Identifier-Filter und ein erfolgreiches Audit-Protokoll **ohne Roh-Prompt**.
- Danach geht ausschließlich der minimierte aktuelle Text über die bestehende `ai-gateway`-Function; deren Cloud-Fallback ist im aktuellen Code aus. Keine Tools, keine externen Aktionen, keine automatischen Veröffentlichungen, keine Datenbank-Query-Groundings.
- Kein Client darf eigene Provider, Model-IDs, externe Endpunkte oder Freigaben durchreichen.
- Keine Browser-Storage-Persistenz für den neuen Chat; nur sitzungsinterner Speicher getrennt nach angemeldetem Nutzer und Tenant. Laufende Antworten werden bei Tenantwechsel verworfen.
- Der neue Browser-Assistent steht hinter `VITE_GOVERNED_ASSISTANT_ENABLED` (standardmäßig `false`), um bis zur Backend-/Sicherheitsfreigabe die alte UI nicht zu ersetzen. Der bisherige `governance-agent` behält für nicht-EU-only-Tenants seine vorhandene Cloud-Einwilligungsprüfung; bei `enforce_eu_local` wird sein nicht-EU-konformer Pfad strikt abgelehnt.

## Geltende Sicherheitsgrenzen
- **Nicht kategorisiert:** blockieren.
- **Personenbezogene / besondere Kategorien:** blockieren, bis Rechtsgrundlage, Zweck, Löschregeln, Rollen und ggf. DSFA sowie AVV geprüft sind. EU-Hosting allein reicht nicht.
- **Öffentlich / intern:** nur mit verifizierter EU-Privat-Laufzeit und berechtigtem Tenant. Ein Regex-Filter erkennt einige typische personenbezogene Identifier und blockiert dann zusätzlich, ist aber **kein vollständiger DLP-Klassifikator**. Bei absichtlicher Falschetikettierung besteht Restrisiko.
- **Cloud-only-Tenant:** blockieren statt die Workspace-Policy still zu umgehen.
- **Unverifizierte EU-Region / nicht erreichbarer Provider / Audit nicht verfügbar:** blockieren, ohne Cloud-Fallback.
- Fachagent ist derzeit eine zweckgebundene Prompt-Vorlage; **noch kein eigenständig berechtigter Tool-Agent**.
- Ein Chat-Ausgabesatz ist niemals eine behördliche, regulatorische oder anwaltliche Freigabe.
- Die Policy der bestehenden `ai-gateway`-PEP läuft separat und war standardmäßig `shadow`; Cloud-Freigaben über diesen Pfad sind **nicht** Teil dieses PRs.

## Produktions-Freigabegates – harte Blocker
1. Nachweislich sicheren Rollout planen: neue Edge Function bereitstellen, EU- und Sicherheitsfreigabe dokumentieren, erst danach `VITE_GOVERNED_ASSISTANT_ENABLED=true` in einem separat freigegebenen Build setzen. Bis dahin bleibt der Legacy-Assistent sichtbar.\n2. EU-Laufzeit tatsächlich verifizieren: physischer Betreiberstandort, Konfiguration von LM Studio/Ollama, Egress-Regeln, DNS/Netzwerk, Log-Speicherort, Backups und Unterauftragnehmer. Reines Setzen des Flags zählt **nicht** als Nachweis.
2. DSGVO prüfen: Verarbeitungskategorien und Rechtsgrundlagen je Zweck, AVV / Unterauftragsverarbeiter, Datenminimierung, Speicherfristen, Löschung, Informationspflichten und Datenschutz-Folgenabschätzung soweit erforderlich.
3. EU AI Act prüfen: Rolle als Anbieter/Betreiber, Zweck, Risikoklasse, Transparenzpflichten, menschliche Aufsicht und verbotene bzw. hochriskante Anwendungsfälle; keine automatische Entscheidung über Betroffene.
4. Serverintegration testen: 401 ohne JWT, 403 für fremden Tenant, blocked bei unbekannten Policies und Datenklassen, block bei fehlendem Audit, keine Übertragung an Cloud, Ausfall der EU-Inferenz = 503, Quotas und Limits.
5. App-Integration testen: Mobil/Tablet/Desktop, Drawer Escape, Tastatur, Browser-Routing, Tenantwechsel während Request, doppelte Sends, keine verlorenen alten Modulrouten.
6. Backward Compatibility: bereits vorhandene Agent-Tool-Anwendungen gegen das neue Default-Blocking prüfen. Für Tool-Befehle einen eigenen serverseitigen Action Router mit Entitlements, Scope und menschlicher Freigabe bauen.
7. Rollback: vor Aktivierung altes Frontend/Function-Bundle versionieren; keine stillen Rückfälle auf unsichere Cloud-Routen.
8. Erst nach grüner CI und Einzelprüfung separate Freigaben für Merge und Deploy einholen.

## Folgearbeiten (nicht Teil von #1959)
- Tenant-konfigurierbare Provider-Allowlist mit modell-/regiongenauer Vertrags-, DPA- und Egress-Registrierung.
- Datenschutzklassifikation und Rechtsgrundlagen-Prüfung aus vertrauenswürdigen Datenmetadaten, nicht aus selbsterklärten Dropdown-Werten.
- Fine-grained Tool-Berechtigungen je Agent, Dataset und Arbeitskontext sowie Approval-Workflows.
- Audit/Evidence mit technischen Ausführungsbelegen, Versionen der Policies, minimaler und konfigurierbarer Aufbewahrung.
- Gemeinsamer serverseitig autorisierter Konversationsdienst mit RLS, gezielter Löschung und freigebbarem Kontext, ohne Cross-Tenant-Lecks.
- Systematische PEP-Absicherung aller vorhandenen KI-Einstiege, einschließlich `ai-invoke`, `bot-chat`, Anon-Chat und Builder-Routen. Keine globale DSGVO-Konformität behaupten, bevor dieser Punkt abgenommen ist.
