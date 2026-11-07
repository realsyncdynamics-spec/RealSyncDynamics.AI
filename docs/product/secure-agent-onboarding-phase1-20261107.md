# Secure Agent Onboarding (Paket C) — Phase-1-Bericht

**Stand:** 2026-11-07 · **Bezug:** `main@c8af738` (Commit 2026-11-03)
**Art:** Bestandsanalyse und Spezifikation. Keine Code-, Schema-, Preis-, Claim- oder Deploy-Änderung.
**Auftrag:** „Managed Governance Onboarding“, Ergänzung §11–17 (Phase 1, nur Paket C).

## 0. Prüfgrenze

Geprüft wurden Repo-Dateien auf `main@c8af738` und die offene PR-Liste über die GitHub-REST-API.
**Nicht** geprüft: Produktions-DB, Provider-Konten, Secrets, echte Anrufe oder Chats.
Eine Migration im Tree beweist nicht, dass die Tabelle live existiert. Am 28.10.2026 fehlten
zum Beispiel `bot_usage_limits` und `tenant_voice_agents` live, obwohl sie heute im Tree liegen
(`docs/product/voice-agent-studio-wip-triage-20261028.md` §11).

**WIP-Stopp:** Die REST-Abfrage `GET /pulls?state=open` liefert am 07.11.2026 **38 offene PRs**.
Nach `.github/PR_TRIAGE_POLICY.md` ist damit kein neuer Feature-PR zulässig. Dieser Bericht
liegt deshalb nur auf einem Docs-Branch, ohne PR.

## 1. Policy-Abgleich: Widersprüche zum Auftrag

| # | Auftrag | Repo-Regel | Folge |
|---|---|---|---|
| W1 | Primärer CTA „Governance-Onboarding anfragen“ (§9) | `AGENTS.md`: öffentliche CTAs nie Pilot/Demo/Call/Sales/Beratung/Termin | CTA in dieser Form unzulässig. Owner-Entscheid nötig |
| W2 | Governance-OS-Produktseite als Hauptbotschaft | K4 (`AGENTS.md`, 27.10.2026): Governance ist Infrastruktur, nicht Hero | Paket C als Eigenschaft des KI-Mitarbeiters rahmen („sicher eingeführt“), nicht als eigenes Governance-Produkt |
| W3 | Vier Servicepakete als Dienstleistung | `PRODUCT_FOCUS.md`: Monetarisierung als Reihenfolge, nicht parallel. Preise nur aus `shared/pricing.ts` | Pakete A, B und D vorerst nicht als buchbare Leistung. Paket C nur als Teil des bestehenden Bot-/Voice-Pfads |
| W4 | Steuerstatus | `PR_TRIAGE_POLICY.md` (29.10.2026): „Seit 15.10.2026 regelbesteuert … §-19-Hinweis gilt nicht mehr“ | Muss vom Owner bestätigt oder korrigiert werden, bevor irgendein Paketpreis entsteht |

## 2. Wiederverwendbare Komponenten

| Baustein | Fundstelle | Eignung für Paket C |
|---|---|---|
| Bot-Modell und -CRUD | `bots`, `src/features/bots/api.ts`, `/app/bots` | Agent-Stammdaten, Kanal, Greeting. Basis für das Agentenregister |
| Agentenregister (Governance) | `governance_agent_registry` (`capabilities[]`, `status`, `owner_email`), RLS-Lesen per `is_tenant_member`, Schreiben nur `service_role` | ONB-10 Agent-Registry. Erfüllt die Regel „schreiben nur serverseitig“ |
| Approvals | `governance_approvals` (mit `expires_at`, `resolved_by`, `resolution_reason`), UI `ApprovalsView` | Menschliche Freigabe. **Setzt `event_id` → `governance_events` voraus** |
| Runtime-Approval-Gates | `runtime_approval_gates` (Tabelle), `src/core/runtime/approvals.ts` | Contract vorhanden. Service ist aber **nur `InMemoryApprovalGateService`** (siehe G2) |
| PDP-Freigabegates | `pdp_approval_gates`, `gatesApi.ts` | Policy-Entscheid für Tool-Rechte. Nicht doppeln |
| Evidence | `evidence_items` (SHA-256 `file_hash`, `framework_codes`, `ai_system_ids`), `evidence_snapshots`, `evidence_vault_timeline`, `src/core/runtime/evidence.ts` | Nachweisreferenzen und Audit-Export |
| Incidents | `incidents` (`incidentsApi.ts`) und zusätzlich `governance_incidents` | ONB-08. Doppelstruktur, siehe G6 |
| Voice-Session-Evidence | `voice_sessions.disclosure_played_at`, `VoiceSessionDetailView` | Art.-50-Nachweis für den Agent-Runtime-Pfad |
| Disclosure (Runtime) | `apps/agent-runtime/src/providers/grok-provider.ts` (`speakDisclosure`, Default `true`) | Voice-Disclosure im Runtime-Pfad. Nicht im Twilio-Pfad |
| Disclosure (UI) | `AIDisclosureNotice.tsx` | Nur RealSyncs eigenes AgentWidget, **nicht** Kunden-Bots |
| Art.-50-Einstufung | `enforcementModel.ts` (`art50Of`, Stufe `limited`) | Klassifizierung eines Assets als Art.-50-pflichtig |
| Budget/Abuse | `bot-budget.ts`, Rate-Limits in `bot-chat`; #2044 (Draft) | Pflicht-Gate vor Go-live |
| Tenant | `TenantProvider`, `is_tenant_member`, `memberships` | Mandantenbindung für Workflow-Instanzen |
| Onboarding-Fortschritt | `tenant_onboarding`, `governance_workflow_state` (Schritt 0–10, eine Zeile pro Tenant) | Nur bedingt geeignet: **ein** Lauf pro Tenant, kein Agent-Bezug (G1) |

**Status laut `src/product/implementation-status.ts`:** `channel-bots` = preview,
`voice-agent-onboarding` = preview, `voice-telephony` = **coming-soon**, `agent-governance` = preview.

## 3. Fehlende Backend-Fähigkeiten (Gap-Liste)

| ID | Lücke | Befund | Status |
|---|---|---|---|
| G1 | Versionierte Workflow-Instanz pro Agent | `governance_workflow_state` ist `UNIQUE(tenant_id)`, ohne Template-Version, Agent-Bezug, Owner, Fälligkeit oder Abhängigkeiten | `NOT IMPLEMENTED` |
| G2 | Persistenter ApprovalGateService | `src/core/runtime/approvals/in-memory-implementation.ts`: laut Header Ersatz „until schema migrations can be deployed“ | `NOT IMPLEMENTED` (persistent) |
| G3 | Serverseitig erzwungene KI-Offenlegung im Twilio-Pfad | `bot-voice-webhook/index.ts` Z. 422/478: Default-Greeting „Hallo, hier ist {name}. Wie kann ich Ihnen helfen?“ ohne KI-Hinweis. Kunden-Greeting ist Freitext | `NOT IMPLEMENTED` |
| G4 | KI-Offenlegung für Kunden-Chat und WhatsApp | `bot-chat` und `whatsapp-webhook`: kein Disclosure-Feld, keine Prüfung gefunden | `NOT IMPLEMENTED` |
| G5 | Human Handoff | `entitlement-reality-map.md`: Mechanismus fehlt | `NOT IMPLEMENTED` |
| G6 | Eine Incident-Quelle | `incidents` und `governance_incidents` existieren parallel | Klärung offen |
| G7 | Support-Zugriffsmodell | Keine Treffer für `impersonat`, `support_access`, `break_glass`, `access_grant` | `NOT IMPLEMENTED` |
| G8 | Append-only Evidence | `evidence_items` erlaubt `tenant_update`. Append-only liegt im offenen #1908 | offen (#1908) |
| G9 | Voice-Sicherheit und Budget live | #1994, #2044, #2046 Draft. `voice-telephony` coming-soon | blockiert |
| G10 | Entitlement „Paket C“ | Kein Eintrag in `shared/pricing.ts` | bewusst nicht anlegen (W3) |

## 4. Workflow-Mapping ONB-06/07/08/10

| Workflow | Input | Owner (Rolle) | Prüfbares Ergebnis | Freigabe | Vorhandene Basis | Lücke |
|---|---|---|---|---|---|---|
| ONB-06 Use-Case & Prompt | Bot-Konfiguration, Zweck, Wissensquellen | Tenant-Admin | Use-Case-Eintrag, Tool-Allowlist, Testfälle | Tenant-Owner | `bots`, PDP-Gates | G1 |
| ONB-07 Human-in-the-Loop | Eskalationsregeln, Übergabeziel | Tenant-Admin | Getestete Übergabe mit Trace | Tenant-Owner | `governance_approvals` | G2, G5 |
| ONB-08 Incident & Feedback | Severity-Matrix, Kontakt | Tenant-Owner | Incident-Verfahren, Test-Incident angelegt | Tenant-Owner | `incidents` | G6 |
| ONB-10 Deployment Gate | Ergebnisse 06/07/08, Art.-50-Test, Budget | Tenant-Owner | Registereintrag `active`, Evidence-Paket | Tenant-Owner, serverseitig | `governance_agent_registry`, `evidence_items` | G1–G4, G9 |

## 5. Art.-50-Testkonzept (ONB-10)

**Pflicht pro Kanal:** Der Hinweis wird **vor** der ersten inhaltlichen KI-Antwort ausgespielt,
serverseitig vorangestellt und vom Kunden nicht entfernbar. RealSync kennzeichnet immer, auch wenn
die Ausnahme „offensichtlich erkennbar“ greifen könnte.

| Kanal | Testfall | Erwartung | Nachweis |
|---|---|---|---|
| Website-Chat | Erste Bot-Antwort einer neuen Konversation | Hinweis sichtbar vor bzw. in der ersten Nachricht, per Screenreader lesbar | `bot_messages`-Eintrag + Hash der Konfigurationsversion |
| WhatsApp | Erste Nachricht an neue Nummer | Hinweis in der ersten ausgehenden Nachricht | Nachrichten-ID + Konfigurationsversion |
| Voice (Twilio) | Eingehender Testanruf | Hinweis gesprochen vor der ersten Frage | TwiML-Trace + `disclosure_played_at` |
| Voice (Agent-Runtime) | Session mit `speakDisclosure=true` | `disclosure_played_at` gesetzt | `voice_sessions` |
| Negativtest | Kunde setzt Greeting ohne Hinweis | Hinweis wird trotzdem vorangestellt; Gate bleibt sonst geschlossen | Testprotokoll |
| Negativtest | Disclosure deaktiviert | Go-live-Gate `denied`, Grund dokumentiert | Approval-Eintrag |

Jeder Nachweis enthält: Zeitpunkt, Kanal, Konfigurationsversion, Testergebnis, prüfende Person.
Aufzeichnung, Transkription und personenbezogene Daten werden getrennt geprüft (nicht Teil von Art. 50).

## 6. Tenant- und Support-Zugriffskonzept

- **Phase 1:** Command Center nur mandanteneigen. Tenant kommt aus Session und `memberships`, nie aus URL oder Body.
- **Support-Zugriff:** `NOT IMPLEMENTED` (G7). Zielmodell (eigene Security-PR mit Migration, Einzel-Freigabe):
  `support_access_grants(tenant_id, grantee, purpose, granted_by, expires_at, revoked_at)`;
  Prüfung in einer `security definer`-Funktion; jeder Zugriff als `audit_events`-Eintrag; Widerruf wirkt sofort;
  kein Rollen- oder Tenant-Parameter aus dem Frontend; Service-Role nie im Browser.

## 7. E2E-Pilot-Spezifikation

**Pilotkanal:** **Website-Chat**, nicht Voice. Begründung: `voice-telephony` ist coming-soon,
und #1994/#2044/#2046 sind offen. Voice folgt als zweiter Pilot, wenn G9 gelöst ist.

**Zustände:** `draft → configured → testing → review → approved → active`, daneben `needs_attention`, `suspended`.
Der Übergang zu `active` erfolgt nur serverseitig und nur, wenn alles erfüllt ist:
`disclosure_test_passed && handoff_test_passed && incident_contact_set && budget_configured && allowlist_valid && approval_granted`.

**Ablauf:** Testmandant anlegen → Chat-Bot konfigurieren → Allowlist prüfen → Art.-50-Test →
Handoff-Test → Test-Incident → menschliche Freigabe → `active` → Evidence-Bericht exportieren.

**Abnahme (alle Punkte belegt):**

1. Cross-Tenant-Lesen auf jede neue Tabelle liefert leer bzw. 403 (RLS-Test).
2. Fehlender Disclosure-Nachweis → Gate `denied`.
3. Abgelaufene Freigabe (`expires_at`) entscheidet nicht.
4. Frontend-Parameter können weder Tenant noch Rolle noch Status setzen.
5. Pause → keine neuen beantworteten Nachrichten.
6. Evidence-Export enthält Hash, Version, Prüfer und Zeit.
7. `npm run lint`, `npm test`, `npm run build` sowie die CI auf dem Head sind grün.

## 8. Kleinster späterer Implementierungs-PR (nach WIP-Abbau)

**P-C1 (ohne Migration):** Typen und Zustandsmaschine für die Paket-C-Workflow-Instanz als reines
Modul mit Unit-Tests, plus Template ONB-06/07/08/10 als versionierte Fixture. Kein UI-Hotspot, kein `src/App.tsx`.

Danach einzeln: **P-C2** serverseitige Disclosure-Voranstellung in `bot-chat` (Security-PR, schließt G4 für Chat),
**P-C3** persistenter ApprovalGateService (Migration, schließt G2), **P-C4** Workflow-Instanz-Tabelle (Migration, schließt G1).

## 9. Blocker

1. WIP-Stopp: 38 offene PRs, Grenze 20.
2. Art.-50-Offenlegung serverseitig nicht erzwungen (G3, G4).
3. ApprovalGateService nur In-Memory (G2).
4. Human Handoff fehlt (G5).
5. Voice-Sicherheit und Budget offen (#1994, #2044, #2046).
6. Owner-Entscheide W1–W4 offen.

## 10. GO / NO-GO

| Gegenstand | Entscheidung | Begründung |
|---|---|---|
| Phase-1-Spezifikation (dieser Bericht) | **GO** | Vollständig, docs-only, policy-konform |
| Implementierung des E2E-Piloten | **NO-GO** | WIP-Stopp; G2–G5 offen |
| Vermarktung von Paket C oder Landing-Integration | **NO-GO** | Art.-50-Gate nicht erzwungen, Handoff fehlt, W1/W2 offen |
| Voice als Pilotkanal | **NO-GO** | `voice-telephony` coming-soon, G9 |
| P-C1 nach WIP-Abbau ≤ 20 | **bedingtes GO** | Keine Migration, kein Hotspot, isoliert testbar |
