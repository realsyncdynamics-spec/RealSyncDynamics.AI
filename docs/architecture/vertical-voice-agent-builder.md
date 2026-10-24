# Vertical Voice Agent Builder — inkrementeller Implementierungsplan

Status: **Phase 1 (Foundation) in Review; nicht produktiv aktiviert** (24.10.2026).

## Architekturentscheidung

Vertikale Sprachagenten sind **Vorlagen innerhalb** des RealSync Governance OS,
kein autonomes Nebenprodukt. Runtime-Entscheidungen laufen über die bestehende
Voice Policy und bestehende Tool-Runner-Grenze. Die bestehende Architektur in
`docs/architecture/voice-agent-v0.1.md` bleibt normativ, bis eine eigene
Änderung geprüft und freigegeben wird.

## Zielablauf

1. Admin wählt Branche und konfiguriert Agentennamen, Business-KB und Begrüßung.
2. Admin prüft erlaubte Tools, Human-Handoff und Einwilligungs-/Transparenztexte.
3. Agent wird im Sandbox-Webkanal getestet. Testdaten sind keine Produktionsdaten.
4. Freigabe durch berechtigte Person, Policy-Validierung und Evidence-Protokoll.
5. Erst danach Kanal Web aktivieren; Telefonkanal **separat** nach SIP-, DPA-,
   Provider-, Routing-, Missbrauchs- und Notfallprüfung.
6. Betrieb: Gesprächsmetriken, blockierte Aktionen, Freigaben, Retention,
   Löschung und Not-Aus im Tenant-Dashboard.

## Abgrenzung Foundation

**Im Branch umgesetzt:** typsichere Branchenvorlagen für Handwerk, Metzgerei,
Kanzlei; restriktive Tool-Schnittmenge; Draft/Review/Pause-Sperre; Validierung von
Phone, Recording, Retention und menschlicher Übergabe; Datenschutz-Gate für
Branchen mit erhöhter Sensibilität (Kanzlei); fail-closed Tool-Freigabe bei
jedem Validierungsfehler; Abbildung auf die bestehende Tabelle
`public.voice_bot_configs` (`toVoiceBotConfigFields`); Unit-Tests unter
`apps/agent-runtime/test/` (laufen in `backend-services-ci.yml`).

**Nicht umgesetzt:** GUI, WebRTC/Streaming-ASR/TTS, SIP, Telefonprovider,
DB-Migration/RLS, persistente Konfiguration, Nummernverwaltung, Billing,
Tool-Runner, End-to-End-Tests oder Produktionsdeploy. Diese Punkte dürfen
nicht aus dem Vorhandensein der Vorlagen als funktionierend dargestellt werden.

## Folge-PRs — klein und getrennt

A. UI: geschützter `/app/voice/builder`-Wizard, Preview, Branchen-Auswahl;
   Route gesondert wegen Hotspot `src/App.tsx`.
B. Backend: tenant-isolierte Agent-Konfiguration, RLS und additive Migration
   in **einem separat freigegebenen** Migration-PR; keine Secret-Ausgabe.
C. Web-Vorschau: Browser-Mikrofon, Speech-to-Text und Text-to-Speech mit
   Abschaltung, Anzeigen von KI-Identität und ausdrücklicher Einwilligung,
   wo erforderlich; keine unerlaubte Datenübertragung.
D. Actions: ausschließlich vorhandene `evaluateVoiceToolRequest`/
   Evidence-Gates nutzen; Termin-Aktion verlangt menschliche Freigabe,
   keine direkte CRM-/Kalender-Schreiboperation aus Modelltext.
E. Telefonie: EU-Datenflussprüfung, SIP-Anbieter-Vertrag, Webhook-Signatur,
   Nummernzuordnung, parallele Calls, Aufzeichnungsoption aus,
   Notfall-/Fehlerrouting und Kostengrenzen.
F. Dashboard: Sessions, nur notwendige Metadaten, Alerts, Widerruf,
   Löschworkflow, Evidence-Link und Kill Switch.
G. Pilot: synthetische Tests; Missbrauchstests, Datenschutz-/Security-Review,
   Kostenlasttest, Rollback, danach kontrollierte Aktivierung.

## Unverhandelbare Gates

- Fail-closed bei ungeklärtem Tenant, Auth, Tool-Recht, Consent oder Kill Switch.
- Sprachmodell gibt niemals endgültige Policy-Entscheidungen.
- Kein Audio-Mitschnitt per Default; keine stille Transkriptablage.
- Transparenz der KI-Interaktion; erforderliche Rechtsgrundlage,
  Informationspflichten und AV-Verträge vor Kundendaten.
- Rechtsanwalts-Template gibt **keine Rechtsberatung**, bestätigt **kein**
  Mandat und entscheidet **keine Fristen**.
- Kein Merge, keine Migration und kein Produktionsdeploy ohne separate Freigabe.

## Bestandsaufnahme und Implementierungsmatrix (24.10.2026)

Statuswerte: `BESTÄTIGT` = im Code gelesen und durch Test/Lauf belegt ·
`TEILWEISE` = vorhanden, aber Lücke benannt · `NICHT GEPRÜFT` = nicht
ausgeführt · `BLOCKIERT` = wartet auf Entscheidung oder Freigabe.

### Ist-Zustand (wiederverwendbar)

| Baustein | Fundstelle | Status |
|---|---|---|
| Voice-Policy, 8 Checks, Verdict `ALLOW`/`DENY`/`REQUIRE_CONFIRMATION`, `decidedBy: 'policy-engine'` | `apps/agent-runtime/src/voice-policy.ts` (`evaluateVoiceToolRequest`) | BESTÄTIGT (13 Tests `test/voice-policy.test.ts` lokal grün) |
| Tool-Katalog (5 Tools, Risiko, Default-Verdict) | `apps/agent-runtime/src/voice-tools.ts` | BESTÄTIGT |
| Nora als Referenz-Agent (`agent_voice_nora_v01`) | `apps/agent-runtime/src/voice-types.ts` | BESTÄTIGT |
| Permission-Check ist an `VOICE_AGENT_ID` gebunden; Bots unterscheiden sich nur über `offered_tools` | `voice-policy.ts` (Check `permission`), `voice/session-runtime.ts` (`intersectOfferedTools`) | TEILWEISE — reicht für Vorlagen, kein Agent-spezifisches Tool-Recht in der Policy |
| Tool-Gateway: Policy → Ausführung → Verifikation → Evidenz, fail-closed ohne Store | `apps/agent-runtime/src/voice/tool-gateway.ts` | TEILWEISE (Tests lokal NICHT GEPRÜFT, s. u.) |
| Echte Executor nur für `schedule_appointment` (→ `bot_appointments`); übrige Tools `not_configured` | `apps/agent-runtime/src/voice/tool-executors.ts` | TEILWEISE |
| Realtime-Provider-Adapter (Grok), Provider-Interface | `apps/agent-runtime/src/providers/grok-provider.ts`, `packages/agent-runtime-contracts/src/voice-provider.ts` | TEILWEISE — ein Adapter, keine EU-/lokale Alternative |
| Session-Runtime inkl. Kill-Switch/Rate-Limit-Status | `apps/agent-runtime/src/voice/session-runtime.ts`, Route `POST /voice-sessions` in `gateway.ts` | TEILWEISE |
| Datenmodell: `voice_bot_configs`, `voice_number_bindings`, `voice_sessions`, `voice_tool_requests`, `voice_executions`, `voice_evidence`; RLS Lesen = Tenant-Mitglied, Schreiben Konfiguration = Owner/Admin, Rest = Service-Role; Trigger erzwingen Reihenfolge Entscheidung → Ausführung → Evidenz | `supabase/migrations/20260928130000_voice_runtime_foundation.sql` | TEILWEISE — `status` kennt kein `review`; kein Feld für Vorlage, Datenschutzprüfung, Retention, Handoff-Kontakt |
| Dashboard `/app/voice` (read-only Sessions, Evidenz) hinter `AppGate` | `src/features/governance/voice/*`, `src/App.tsx` | TEILWEISE — keine Konfiguration, kein Kill-Switch-Schalter |
| Telefonie-Webhook (Twilio-Signatur, Tenant nur aus `voice_number_bindings`, PEP `enforceBotMessage`) | `supabase/functions/bot-voice-webhook/index.ts` | TEILWEISE — Antwortpfad über `runAiTool`, nicht über den Tool-Gateway; Produktivbetrieb NICHT GEPRÜFT |
| Branchenvorlagen + Validierung + DB-Abbildung | `apps/agent-runtime/src/vertical-voice-templates.ts` | BESTÄTIGT (20 Tests `test/vertical-voice-templates.test.ts`) |

### Befunde im Foundation-Branch (in diesem PR behoben)

1. `src/vertical-voice-templates.test.ts` importierte `vitest`. `apps/agent-runtime`
   hat `vitest` nicht als Abhängigkeit, `tsconfig.json` schließt `src/**` ein:
   `npm run typecheck` (CI-Matrix `backend-services-ci.yml`) bricht mit
   `TS2307`, der Docker-Build (`COPY src` → `npm run build`) ebenso — nach
   Merge wäre der VPS-Deploy (`deploy-agent-runtime-vps.yml`) gescheitert.
   Zusätzlich lief der Test in keinem Runner (Root-Vitest liest nur `test/**`).
   → Test nach `apps/agent-runtime/test/` verschoben, auf `node:test` umgestellt.
2. Tool-Namen waren ein Duplikat von `VoiceToolName` → eine Quelle (`voice-types.ts`).
3. `effectiveVoiceTools` gab aktiven, aber ungültigen Konfigurationen (z. B. mit
   Telefonie oder Aufzeichnung) Tools zurück → jetzt fail-closed.

### Fehlende Komponenten, Prioritäten, PR-Grenzen

| # | Paket | Abhängigkeit | Security-Gate | Tests | PR-Grenze | Status |
|---|---|---|---|---|---|---|
| 1 | Foundation (dieser PR) | — | Fail-closed-Vorlagen, kein Policy-Eingriff | `node --test test/vertical-voice-templates.test.ts` | nur `apps/agent-runtime/src/vertical-voice-templates.ts`, Test, Doku | in Review |
| 2 | Migration: Vorlagen-Felder an `voice_bot_configs` (`template_id`, `privacy_review_approved_at`, `retention_days`, `handoff_contact`, Status `review`) — additiv | 1 | RLS unverändert prüfen, kein Service-Role im Client | Migration-Lint, RLS-Test mit zwei Tenants | **eigener Migrations-PR, Einzel-Freigabe** | BLOCKIERT (Freigabe) |
| 3 | Agent-Builder-UI `/app/voice/builder` (Wizard, Vorschau, Validierung clientseitig = Anzeige, serverseitig = Entscheidung) | 1, für Speichern 2 | Kein Schreiben ohne Owner/Admin-RLS; keine Secrets | Vitest für Wizard-Logik, Playwright-Smoke | `src/features/governance/voice/builder/*` + eine Zeile in `src/App.tsx` (Hotspot → seriell) | offen |
| 4 | Policy: Agent-spezifisches Tool-Recht statt fester `VOICE_AGENT_ID` | 2 | **Security-PR**, unabhängiges Review | bestehende 13 Policy-Tests + Cross-Agent-/Cross-Tenant-Fälle | nur `voice-policy.ts` + Tests | BLOCKIERT (Security-Freigabe) |
| 5 | Web-Voice-MVP (Browser-Mikrofon, STT/TTS-Adapter, KI-Hinweis, Abbruch) | 1, 3 | Einwilligung/Transparenz vor Audio, keine Aufzeichnung per Default | Session-Runtime-Tests, manueller Pilot mit Messprotokoll | eigener PR | offen |
| 6 | Governed Actions (Ticket, KB, Handoff) über Tool-Gateway | 4 | Idempotenz/Replay je Schreibaktion, Rückgabe-Prüfung | Tool-Gateway-Tests | je Tool ein PR | offen |
| 7 | Telefonie über Tool-Gateway statt `runAiTool` | 4, 6 | Provider-/AVV-/Drittlandprüfung, Kostenlimit | Webhook-Signatur-Tests, Pilot | eigener PR, eigene DoD | BLOCKIERT (Provider-/Vertragsentscheidung) |
| 8 | Betrieb: Kill-Switch im Dashboard, Metriken, Kosten, Löschworkflow | 2, 3 | Kill-Switch nur Owner/Admin, Prüfpfad | Vitest + E2E | eigener PR | offen |

Nicht ausgeführte Prüfungen werden nicht als erfolgreich geführt: Die Tests
`grok-provider`, `session-runtime`, `session-persistence`, `tool-gateway` und
`voice-session-endpoint` liefen in der Analyse-Umgebung nicht (kein
`npm ci` erlaubt, Node-Strip-Mode ohne `tsx`) — sie laufen in CI.
