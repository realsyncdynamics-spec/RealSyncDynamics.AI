# RealSync AI Studio — geprüfter Implementierungsplan (18.10.2026)

Status: **Architektur/Phase 0**, keine Produktionsfreigabe. Vergleichsquelle: https://ai.google.dev/gemini-api/docs/ai-studio-quickstart und https://ai.google.dev/gemini-api/docs/aistudio-build-mode.

## Verifizierter IST-Stand
- React 19, Vite 6, Tailwind 4, React Router in `src/App.tsx`; Supabase EU/RLS, Cloudflare Pages.
- `supabase/functions/ai-gateway`: nutzergebundene Tenant-Autorisierung, op-API und OpenAI-kompatible Shell. Cloud-Fallback ausdrücklich deaktiviert; local/EU-Pfad nicht stillschweigend auf US-Provider umstellen.
- `src/features/build-studio/README.md`: `/build` bestehender Einstieg, `/builder/:slug` SiteOS/Puck, `/builder/:slug/code` bestehender Code-Builder; `siteos_blueprints` und `app_builder_projects` bleiben getrennt. Kein `build_projects`-Duplikat.
- `@google/genai` installiert, aber dadurch keine produktive Gemini-Anbindung belegt.
- Googles eingeloggter Arbeitsbereich ließ sich ohne Accountzugriff nicht direkt inspizieren; Funktionsinventar aus offizieller Dokumentation, keine pixelgenaue Kopie.

## Produktentscheidung
Neuer Bereich „RealSync AI Studio“ als **orchestrierender Workspace**, kein Ersatz der Landing V6, kein dritter Builder. Eigenständige Marken-UI (keine Google-Assets). Ziel: Playground + vorhandene SiteOS-/Code-Builder-Flows + später Agents/Workflows/Deploy. Zunächst ausschließlich hinter Auth und Tenant-Kontext.

## Phasen und überprüfbare Gates
### P0 — Bestandsabgleich / Architektur
- [x] README und Gateway-Vertrag gelesen.
- [x] Abweichung vom ursprünglichen Plan korrigiert: vorhandene Engines wiederverwenden.
- [ ] Berechtigungen/Routen/Entitlements des bestehenden `/build` und Code-Builders mit Tests nachvollziehen.
- [ ] Tatsächlich verfügbare Provider und Gateway-Antwortformate in Staging prüfen; keine Modellnamen erfinden.

### P1 — Playground (erster funktionsfähiger vertikaler Schnitt)
- [ ] Geschützte Route `/app/ai-studio` innerhalb der bestehenden AppShell (Auth und tenant_id nur aus Session).
- [ ] Modellprofil nur aus serverseitigem allowlist-Katalog, Systemanweisung, Temperatur und token limit entsprechend Gateway-Fähigkeiten; nicht unterstützte Parameter deaktivieren.
- [ ] Chat-Request an vorhandenen Gateway mit User-JWT, Tenant und nachvollziehbarer Fehlerdarstellung (401,403,429,503). Kein API-Key im Browser.
- [ ] Verlauf pro Tenant/Nutzer nur mit serverseitiger RLS, keine unkontrollierte LocalStorage-Ablage sensibler Inhalte.
- [ ] Streaming nur nach Contract-Test; zunächst non-streaming falls Backend nicht kompatibel.
- [ ] Tests: fehlender Auth-Token, Tenant-Wechsel, fremde Chats, Rate-Limit, fehlender Provider, Prompt Injection in Tool-Antworten.

### P2 — Projektverwaltung und Prompt Library
- [ ] Bestehende stores/identity nutzen, kein duplizierter builder store.
- [ ] Prompt-Versionen, Forking, Run-Verlauf, Export mit Besitzprüfung und Audit-Log.
- [ ] Get Code aus tatsächlich verwendeter API-Konfiguration generieren, Secrets maskieren.

### P3 — Prompt-to-App und Vorschau
- [ ] `/build` für App-Typauswahl, `/builder/:slug` SiteOS und `/builder/:slug/code` Code-Builder weiterverwenden.
- [ ] Iterative Prompt-Änderungen mit Diff, Rollback und kontrolliertem Builder-Adapter.
- [ ] Ausführung untrusted generierten Codes nur in isoliertem Sandbox-Runtime mit Netzwerk-/Datei-/Ressourcen-Policy; keine Ausführung in Cloudflare Pages/Supabase-Privilegkontext.

### P4 — Tools, Agents, Workflows, Multimodalität
- [ ] Agent-/Tool-Registry mit expliziter Berechtigung, tenant-scoped credentials und Bestätigung vor externen Aktionen.
- [ ] Datei-/Bild-/Audiofunktionen nur nach Anbieter-/Compliance-/Retention-Check als LIVE markieren.
- [ ] Traces, Quotas, Kosten, Tenant-Ratenlimits und Tool-Audit.

### P5 — Freigabe, Veröffentlichung, Betrieb
- [ ] Dev/Staging/Prod, signierte Releases, Preview-URL und überprüfbares Publish-Gate.
- [ ] Security: RLS, SSRF, XSS, Geheimnisse, Dependency/Container-Scanning, Content Policies.
- [ ] E2E: Playground, Save/Resume, Builder, Preview, Deploy-Deny, Tenant-Isolation, Billing, accessibility und mobile layout.
- [ ] Separater Merge und Deploy nach CLAUDE.md und erfolgreichen CI-Gates.

## Kritische Invarianten
1. Keine ungetestete Modellumschaltung, kein Cloud-Fallback-Bypass.
2. Keine direkten Zugriffe auf service_role, Provider-Secrets oder AI-Gateway-Internal-Key im Browser.
3. Kein stilles Deploy aus einem Prompt; Freigabe ist separat.
4. Bestehende Website, `/build`, SiteOS und Code-Builder bleiben intakt.
5. Kennzeichnung „Geplant“, „Beta“ und „Live“ anhand nachgewiesener Funktion, nicht Marketing.
6. Jede Phase hat Akzeptanztests; erst nach grünem Gate die nächste freigeben.

## Umsetzungsreihenfolge
P0-P1 zuerst: Auth/Gateway/Chat vollständig (kein Fake-Chat), dann Projektverwaltung und Builder-Kopplung, dann Sandbox und komplexe Features. Keine zeitliche Zusage oder Behauptung von Produktionsreife vor CI und Live-Test.
