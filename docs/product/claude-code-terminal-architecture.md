# Claude Code Optimizer — isoliertes Entwicklungsterminal (Implementierungsvertrag)

Status: Architekturentwurf; **keine produktive Terminal-Runtime vorhanden**. Der bestehende Governance-Terminal-Flow unter `/app/terminal` führt Slash-Commands aus und ist **kein** OS-Shell/PTY.

## Ziel
Nach Anmeldung und Autorisierung kann ein Workspace-Mitglied ein freigegebenes Repository in einer isolierten, kurzlebigen Entwicklungsumgebung öffnen, Shell-Kommandos interaktiv ausführen und Claude Code benutzen. Git-Diffs sind vor schreibenden Aktionen sichtbar; Push, PR, Merge, Deploy und produktive Secrets benötigen gesonderte Berechtigungen.

## Sicherheitsgrenzen (verpflichtend)
1. **Serverseitige Sandbox**, kein Shell-Prozess im Browser und kein Ausführen von Befehlen in Supabase Edge Functions oder Cloudflare Pages. Isolierte Container/VMs mit nichtprivilegiertem Benutzer, ohne Host-Mounts oder Docker-Socket, read-only Base Image, restriktivem Seccomp/AppArmor, CPU/RAM/Disk-/Zeitlimits.
2. **AuthN/AuthZ pro Session**: Supabase-JWT serverseitig prüfen; Tenant, Workspace, Repo und Rollenberechtigung auf jedem Session-/WebSocket-Request verifizieren. Session-Tokens kurzlebig, nicht in URLs; Origin/CSRF-Prüfung; Reconnect nur mit erneuter Prüfung.
3. **Repository-Zugriff**: kurzlebige, repo-spezifische GitHub-Installationstokens; nur ausdrücklich freigegebene Repos. Keine beliebigen Clone-URLs oder Netzwerke ohne Allowlist. Keine dauerhaften Credentials im Container.
4. **Secret-Grenzen**: Secrets niemals in Browser, Terminal-History, Logs oder Diffs ausgeben; Ausgabe maskieren; scoped Injection erst nach expliziter Berechtigung. KI-Modellzugriff nur über kontrolliertes Gateway mit Kostenlimit.
5. **Schreibschutz**: Standardmodus read-only/Review. File-Edits, package scripts und Shell-Commands sind risikobehaftet; Session-Start erfordert ausdrückliche Bestätigung. Push, PR-Erstellung, Merge, Deploy, Migrationen, Stripe und Production-Änderungen jeweils separate Policy-Gates; niemals automatisch aus Terminal-Output ableiten.
6. **Auditierbarkeit**: unveränderbare Events für Session-Lifecycle, Identität, Repo, Commit-Basis, Command-Metadaten, Exit-Codes, Approval und resultierende Diffs; sensible stdout/stderr nur nach Redaction und Retention-Policy.
7. **Transport**: WSS mit begrenzten Nachrichten, Backpressure, Heartbeats, Idle Timeout, Abbruch und Kill-Switch. PTY-I/O und Resize über kontrolliertes Protokoll; Escape-Sequenzen sicher im Client rendern.
8. **Daten-/Kostenkontrolle**: Tenant-Isolation, EU-Region und Datenübermittlungen vor Freigabe prüfen; Limits und Abuse Detection; keine unbelegte EU-only-Zusage.

## Geplante Komponenten (noch nicht implementiert)
- `/claude-code-optimizer/terminal`: geschützter Workspace-Client, Status + Freigabe-UI + Terminalansicht.
- Session Broker API: create/attach/resize/stop; prüft JWT und Entitlements.
- Sandbox Orchestrator: erstellt kurzlebige, tenant-isolierte Umgebungen; installiert kontrollierte CLI-Versionen.
- GitHub Connector: Repo-Auswahl, scoped checkout, Diff und PR-Workflow.
- Policy/Audit Adapter: Approvals, Evidence und Kostenereignisse.

## Freigabe-Gates / Abnahme
- Architekturreview für Hosting, Datenregion, Netzwerk, Secrets, Auth, Isolation und Bedrohungsmodell.
- Tests: fremder Tenant/Repo verboten, Session-Replay abgelehnt, Token-Expiry, WebSocket-Origin, Secret-Leak, Prozessabbruch, Ressourcenlimits, git diff und Schreibfreigabe.
- E2E: Login → Repo wählen → isolierte Session → `pwd`/`git status`/`npm test` → Diff → Stop → Container/Token gelöscht.
- Erst danach Terminal-CTA freischalten. Bis dahin **„In Vorbereitung“**, keine Fake-Shell und kein Produktionsversprechen.

## Bestehende Grenzen
- Landing-Design unverändert.
- `/app/terminal` bleibt Governance-Terminal.
- Kein neuer produktiver Service, kein Deploy, keine DB-Migration, kein Stripe-Change ohne gesonderte Freigabe.
