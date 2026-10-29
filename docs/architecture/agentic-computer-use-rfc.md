# RFC — Agentic Computer Use & RSD Agent Browser

> **Status:** `proposed` · **Stand:** 2026-10-29 · **Scope:** Kundenplattform, Layer 4 (Agent/Automation)
> **Entscheidung:** offen. Dieses RFC ist weder Produktfreigabe noch Produktionsnachweis.
> **Referenzen:** [Zielarchitektur](./target-architecture.md) · [Agent Runtime Contracts](./agent-runtime-contracts.md) · [Browser-Runtime-Tests](../../test/browser/browser-executor-contract.test.ts) · [Produkt-Fokus](../PRODUCT_FOCUS.md)

## Problem und Produktziel

Kunden nutzen ERP-, CRM-, Web- und Desktop-Anwendungen ohne offiziell zugängliche
Schnittstelle. RSD soll **autorisierte** Prozesse in diesen Systemen ausführen,
ohne eine zweite Agenten-Runtime, eine zweite Control Plane oder einen neuen
allgemeinen Desktop-Browser als Voraussetzung einzuführen.

**Zielbild:** Voice-/Chat-Agent oder Workflow formuliert einen begrenzten
`ToolRequest`; die bestehende Governance-Instanz entscheidet; ein isolierter
Browser-/Computer-Worker führt aus; Ausführung und Ergebnis werden verifiziert
und als Evidence mit Kosten-/Risiko-Bezug verknüpft. Kunden können eine
Agenten-Session beobachten, stoppen und bei Bedarf übernehmen.

**Nicht-Ziele:** AGB-, Lizenz-, Captcha-, Anti-Bot- oder Berechtigungsumgehung;
verdeckte Beschäftigtenüberwachung; generische RPA-Plattform; eigenes
Chromium-Fork; Training auf ungeprüften Kundenscreenshots; autonomes
Abschicken von Formulareingaben ohne Policy/Approval.

## Belegter Repository-Ist-Stand (Codeinspektion 2026-10-29, main)

| Bestehender Baustein | Pfad | Grenze / Befund |
| --- | --- | --- |
| Browser-Agent-Drawer | `src/components/governance-os/BrowserAgentDrawer.tsx` | Bindet vorhandenes `BrowserRuntimePanel` ein, kein zweiter Agent |
| Browser Action Composer und Planner | `src/features/governance/dashboard/BrowserRuntimePanel.tsx` | Plan + sequenzielle Aktionen, autonome Ausführung explizit deaktiviert |
| Browser-Preview | `src/components/governance-os/EmbeddedBrowserCanvas.tsx` | **iframe im Kundenbrowser**; zeigt nicht die serverseitige Playwright-Session |
| Client / Edge-Eingang | `src/features/governance/browser/browserExecutorClient.ts`, `supabase/functions/browser-execute/index.ts` | JWT/Tenant-Prüfung, Planner, Approval-Reservierung und Evidence im geprüften Codepfad |
| Headless Browser Worker | `deploy/playwright-scanner/executor.ts`, `server.ts` | Playwright/Chromium, begrenzte Aktionen, In-Memory-Sessions, SSRF-Filter |
| Approval-Reservierung | `supabase/migrations/20260930190000_browser_execution_reservations.sql` | Einmalige Reservierung vor Ausführung (Code- und SQL-Kontrakt) |
| Governed-Sessions-Migration | `supabase/migrations/20261028095440_browser_runtime_governed_sessions.sql` | **Repository-Datei vorhanden**; nicht als produktiv aktiv oder mit Edge verdrahtet nachgewiesen |
| Kanonneutrale Contracts | `docs/architecture/agent-runtime-contracts.md` | `ALLOW`, `DENY`, `REQUIRE_CONFIRMATION`; bestehendes Gateway nicht ersetzen |

Die Tabellenzeilen beschreiben inspizierten **Code**, keine vollständige
Live-Funktionsprüfung. Ein erfolgreicher Health-Check allein beweist weder
E2E-Ausführung noch eine visuell verbundene Browser-Session.

## Integrationsstrategie (absteigende Präferenz)

1. **Offizielle API / MCP:** dokumentierter, berechtigter Connector.
2. **Governed Browser:** vorhandener Browser-Worker über `browser-execute`.
   Navigation und Leseaktionen, schreibende Aktion erst nach Approval.
3. **Computer Use:** künftiger isolierter Desktop-Worker für nicht-browserbasierte
   Legacy-Software; nur nach gesondertem Sicherheits- und Betriebskonzept.
4. **Interne Schnittstellen:** nur bei dokumentierter Befugnis und geprüften
   Vertrags-/Nutzungsbedingungen; explizite Allowlist, Schemavalidierung und
   Verbot der Umgehung technischer Schutzmaßnahmen.

Keiner dieser Pfade darf Autorisierung, Budgetreservierung, Tenant-Grenzen,
Approval, Audit oder Kill Switch umgehen.

## Verbindliche Zielarchitektur

```text
Voice / Chat / Workflow / Agent Task
            |
        ToolRequest
            v
   bestehende Governance Runtime
   Identity -> Tenant -> Capability -> Policy -> Risk
            -> Budget -> Approval -> Kill Switch
            |
            v
   Browser/Computer Executor Adapter
   (bestehender Playwright-Worker zuerst)
            |
            v
   Ergebnisprüfung -> RuntimeEvent -> Evidence -> Kostenledger
            |
            v
   Session-Ansicht im vorhandenen Browser-Agent-Drawer
```

Ein Modell schlägt Schritte vor, ist aber niemals Authority für
`ALLOW`/`DENY`. Jeder übertragene Step trägt Tenant, Principal,
Action-Typ, Session-ID, Request-ID, Idempotenz-/Execution-ID,
Approval-Referenz und Ergebnisstatus. Keine ungeprüfte Weitergabe
von LLM-Ausgaben an Browser oder System-Shell.

## Nebenaufgabe: vom Agenten gesteuerter Browser

**Keinen zweiten Browser entwickeln.** Der vorhandene Chromium-Worker ist
der gesteuerte Browser, der vorhandene Browser-Agent-Drawer ist die
Bedienoberfläche. Das iframe ist eine **separate Vorschau**, kein Remote-View.

### Inkrement 1 — Sichtbare Momentaufnahme (Draft-Pilot)

- Auf explizite Nutzeraktion eine `screenshot`-Aktion über **denselben**
  governed `browser-execute`-Pfad starten.
- Nur erfolgreiche, valide PNG-Frames der passenden Session im geöffneten
  Runtime-Panel anzeigen, deutlich als **Momentaufnahme** statt Live-Stream.
- Base64-Bild nicht in Logs, Analytics oder `localStorage` persistieren;
  beim Session-/Mandantenwechsel und Unmount verwerfen.
- Freigaben weiterhin serverseitig entscheiden; kein versteckter
  Screenshot-Zugriff über andere Mandanten.

### Inkrement 2 — Gemeinsame Session-Identität

- `browser_sessions` (sofern tatsächlich migriert und angebunden) als
  serverseitige Wahrheit verifizieren; `useBrowserSession` erzeugt bislang
  eine lokale ID, der Edge-Pfad präfixiert sie mit `tenantId`.
- Session-Erstellung, TTL, Limits, Owner-/Tenant-Bindung, Refresh/Revoke,
  Cleanup und parallele Läufe auf einen geprüften Contract bringen.
- Bildschirm-Frame muss zum **gleichen Worker-Kontext** wie die ausgeführte
  Aktion gehören. Niemals iframe-Framing als Beleg ausgeben.

### Inkrement 3 — Sichtbare Steuerung

- Zustand: `ready / running / awaiting_approval / paused / failed / closed`.
- Pause/Stop/Kill müssen **serverseitig** wirken, nicht nur Buttons sperren.
- Manueller Takeover benötigt eine eigene, einmalige, scoped Session-Übergabe
  und eine Sicherheitsentscheidung zu Cookies/Secrets; vor dieser Entscheidung
  keine Zugangsdatenübernahme über Frontend/iframe.
- Eine echte Live-Übertragung (Frames/Stream) benötigt Rate-/Kostenlimits,
  Content-Redaktion, kurzlebige Berechtigungen, Quoten, Löschkonzept
  und dokumentierte Zustimmung. Nicht Teil des Momentaufnahme-Pilots.

## Sicherheits-/Datenschutzbedingungen

- Alle externen Ziele nur mit verifizierter Autorisierung; URL-, Redirect-,
  DNS- und Egress-Kontrollen gegen SSRF/DNS-Rebinding; keine internen Netze
  oder Metadatendienste ansteuern.
- Pro Tenant/Session isolierter Browserkontext, keine gemeinsamen
  Session-Cookies, Storage States oder Credentials im UI.
- `click`, `type`, `select` bleiben bis zur **serverseitig bestätigten**
  Freigabe gesperrt; Approval einmalig und an Fingerprint/Session gebunden.
- Mehrdeutige Ausführung nach Timeout führt zu **nicht automatisch wiederholbar**.
- Kein Logging von Formularwerten, Screenshots, Zugangsdaten oder
  ungeschwärzten Patientendaten in Evidence.
- Datensparsame, freiwillige Prozessaufzeichnung; Mitarbeiter-Monitoring
  niemals als Default. Rechtsgrundlagen und Mitbestimmung gesondert prüfen.
- Produktclaims nur aus überprüftem Implementierungsstatus.

## Pilot, Tests und Freigabegates

1. **Read-only:** Testanwendung öffnen, Screenshot explizit anfordern,
   erhaltene Momentaufnahme und Worker-URL getrennt von iframe darstellen.
2. **Governed Mutation:** Testformular ausfüllen, `APPROVAL_REQUIRED`
   erzeugen, erst nach serverseitiger Freigabe einmalig ausführen.
3. **Negativpfade:** fremder Tenant, ungültiger Frame, Offline-Executor,
   private Zieladresse, abgelaufene Freigabe, wiederholter Submit,
   Fehler nach Ausführung und Session-Wechsel.
4. **Nachweis:** Client-/Server-Tests, Screenshot ohne Persistenz,
   CI auf PR-Head; produktiver E2E-Probelauf erst nach separater Freigabe.
5. **Performance/Kosten:** Erfolgsrate, p50/p95 pro Action, Tokenverbrauch,
   Worker-Kosten, Approval-Abbruchquote und manuelle Übernahmen messen;
   keine ungemessenen Verkaufsversprechen.

**Exit Gate für produktiven Rollout:** Session-Autorität serverseitig
nachgewiesen, Policy/Approval/Idempotenz und Tenant-Isolation durch Tests
belegt, Kill Switch/Abbruch geprüft, kein PII-Leak, Kostenlimit
verbindlich beschlossen und Go-live separat autorisiert.

## Entscheidungen vor dem nächsten Ausbau

- Ausführungsmodell: vorhandener Worker weiterverwendet oder separater
  isolierter Pool für Kundenaktionen? (Kein neuer Pool ohne Messung.)
- Welche Frames dürfen gespeichert werden, wie werden sie geschwärzt
  und wann gelöscht? (Default: nicht speichern.)
- Desktop-Agent: unterstützte Betriebssysteme, Betreiber-/Haftungsgrenze,
  Secret-/Credential-Handling und freigegebene Kundenumgebung.
- Interne API: technische Zulässigkeit **und** Lizenz/AGB je Zielsystem.
- Budget/Preis/Entitlements: bestehende SSoT verwenden; keine Zahlen erfinden.

## Umsetzung und Nicht-Autorisierung

Dieses RFC ist **nur eine vorgeschlagene Architektur**. Es setzt weder den
Umfang aus `docs/PRODUCT_FOCUS.md` außer Kraft noch ändert es die
Priorisierung aus `docs/PRODUCT_PRIORITIZATION.md` bzw. `AGENTS.md`.
Kein Merge, Deploy, neue Migration, aktiver Kunden-Workflow,
neuer Preis oder Entitlement ohne jeweilige Einzel-Freigabe.
