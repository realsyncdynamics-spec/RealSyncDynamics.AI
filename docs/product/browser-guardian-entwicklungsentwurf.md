# Browser Guardian — Entwicklungsentwurf und lokaler MVP

**Status:** Entwurf · lokaler MVP · **nicht produktiv** · Stand 2026-11-15
**Baut auf:** `docs/product/browser-guardian.md` (PR #2258), `docs/product/realsync-agent-os.md`
**Code:** `packages/browser-guardian/`, `apps/realsync-browser/`

Kennzeichnung in diesem Dokument:

| Marke | Bedeutung |
|---|---|
| **IST** | im Code gelesen (Datei genannt) |
| **GEPRÜFT** | lokal ausgeführt, Befehl und Ergebnis in Teil C |
| **PRODUKTIV** | Deployment-Status geprüft (Quelle genannt) |
| **SIMULATION** | ohne echten Browser bzw. ohne echtes Netz |
| **OFFEN** | nicht umgesetzt |

Ein gemergter PR ist kein Nachweis einer live verfügbaren Funktion.

## Teil A — Zielarchitektur und Grundsatz

| Schicht | Ziel | Ist | Status |
|---|---|---|---|
| RealSync Browser | installierbarer Chromium-Browser | kein Desktop-Browser im Repo. MVP: lokal gestartetes Chromium (Playwright), nur über den Guardian steuerbar | MVP lokal, Installation **OFFEN** |
| Governance OS | Apps, Dokumente, Identitäten, Richtlinien, Nachweise in einer Arbeitsumgebung | Web-App `/app` (`GovernanceBrowserShell`); nicht im Browser integriert | **OFFEN** |
| Browser Guardian | kontrollierter Agent in dieser Umgebung | Planer `browser_task_planner` (nur Prompt) + `browser-execute` | Planer **PRODUKTIV** (s. u.), Guardian-Kern neu im MVP |
| Policy Engine + Executor | Prüfung und Ausführung außerhalb des Modells | PDP `_shared/pdp/` (von `browser-execute` **nicht** genutzt), Executor `deploy/playwright-scanner` | MVP: `policy.ts`, `guardian.ts`, `egress-proxy.ts` |

**Grundsatz:** Der Guardian-Prompt ist kein Sicherheitsmechanismus. Er
beeinflusst, was das Modell vorschlägt — nicht, was läuft. Im MVP liegt jede
Regel im Code:

| Prompt-Regel | Technisch durchgesetzt in |
|---|---|
| nur bekannte Aktionen, sonst anhalten | `parseAction` + `UNKNOWN_ACTION` ⇒ deny |
| Verändern nur mit Freigabe | `MUTATION_REQUIRES_APPROVAL`, `ApprovalLedger.consume` |
| Freigabe genau für diesen Schritt, einmal, befristet | HMAC-Fingerprint, Status `consumed`, 15 min |
| keine Zugangs-/Zahlungsdaten durch den Agenten | `INPUT_SECRET`, `INPUT_PAYMENT_DATA` ⇒ deny |
| externe Inhalte sind Daten | Modell erhält Inhalte nur, wenn `forward_to_model` (nur öffentlich, Sitzung unbelastet) |
| Zieladresse vor Übertragung prüfen | Navigation, Weiterleitung, Absenden: Egress-Wächter + Proxy |
| Modell entscheidet nicht | Freigabe nur durch `{ kind: 'human' }`; Entscheidung neu bei Ausführung |

## Teil B — Sechs Zielanforderungen (aus PR #2258)

### Z1 · Unklar ⇒ anhalten, kein `log_only`

- **IST:** `browser-execute` ruft die PDP gar nicht auf. Unbekannte
  Aktionstypen lehnt `validateActions` mit 400 ab (fail-closed, gut). Die
  Aussage in #2258 „unbekannte Aktion → `log_only`" trifft für Browser-Aktionen
  daher **nicht** zu und ist in `browser-guardian.md` korrigiert.
- **IST, PDP:** `log_only` entsteht in `_shared/pdp/core.ts` an drei Stellen:
  `normalizeAction` macht aus jedem unbekannten Policy-Wert `log_only` (ein
  Tippfehler wie `deny` oder `REQUIRE_APPROVAL` schwächt still ab); kein
  Treffer ⇒ `allow`; `failModeOf` ist für nicht-blockierende Policies
  fail-open. Würde `browser-execute` heute an die PDP angebunden, liefen
  unklare Fälle durch.
- **Lücke:** Lesende Aktionen (`navigate`, `extract`, `screenshot`) laufen in
  `browser-execute` für jede öffentliche Adresse ohne Prüfung von Ziel,
  Daten oder Kontext.
- **MVP:** Entscheidungen nur `allow · require_approval · deny`. Unbekannt,
  ungültig, ohne Begründung, ohne Richtlinie, ohne Kontext, Kill-Switch
  nicht lesbar ⇒ deny. Test: „keine Entscheidung außerhalb …".
- **Änderung nötig:** D1, D6.

### Z2 · `NEEDS_REVIEW` als Freigabe mit Prüfart

- **IST:** nicht vorhanden.
- **MVP:** `require_approval` mit `review: human_approval | data_protection_review`
  (z. B. personenbezogene Eingabe, Daten in der Adresse, personenbezogenes Ziel).
- **Änderung nötig:** Prüfart in `governance_approvals` speichern (D7).

### Z3 · Datenklassen, nur „öffentlich" ohne Prüfung

- **IST:** keine Datenklassen in der Browser-Runtime.
- **MVP:** `public · internal · confidential · personal`, dazu
  `unclassified`. Die Klasse eines Ziels kommt aus der Mandanten-Richtlinie
  (`origins`). Die Inhaltserkennung (E-Mail, Telefon, IBAN mit Prüfziffer,
  Karte mit Luhn, Schlüssel) verschärft nur, entschärft nie. Nicht
  gelistete Ziele sind `unclassified` ⇒ Freigabe.
- **Grenze:** Namen, Gesundheitsdaten, Freitext erkennt die Heuristik nicht —
  deshalb trägt die deklarierte Klasse die Entscheidung.
- **Änderung nötig:** Origin-Klassen je Mandant serverseitig (D7).

### Z4 · Feste Freigabedauer 15 Minuten

- **IST:** `createApproval` in `browser-execute` setzt kein `expires_at`;
  der Spalten-Default ist **7 Tage** (`20260513200000_governance_approvals.sql`).
- **MVP:** 15 Minuten ab Anfrage, Richtlinie kann nur verkürzen (Test mit
  verlangten 7 Tagen ⇒ 15 min).
- **Änderung nötig:** D2.

### Z5 · Richtlinienversion im Nachweis

- **IST:** Spalte `browser_actions.policy_version` existiert
  (`20261028095440`), wird von `browser-execute` aber nicht beschrieben; es
  gibt keine Browser-Richtlinie, deren Version man festhalten könnte.
- **MVP:** jeder Nachweis trägt `policy_id` + `policy_version`; ohne beides
  schreibt `EvidenceLog` nicht. Die Version steckt im Fingerprint:
  Richtlinienwechsel ⇒ offene Freigaben passen nicht mehr.
- **Änderung nötig:** mit D1 (Version in den Evidence-Snapshot).

### Z6 · Sprachdienst erst nach Rechtsklärung

- **IST:** keine Sprachsteuerung am Browser-Agenten.
- **MVP:** Kanal `voice` ⇒ deny `VOICE_DISABLED`.
- **OFFEN:** Rechtsgrundlage Drittlandtransfer (D8). Kein Code ersetzt sie.

### Lesen ist nicht automatisch harmlos

| Aktion | Wirkung | Prüfung im MVP |
|---|---|---|
| `navigate` | lesen + Abfluss: Adresse, Parameter, Referer gehen an den Zielserver | Schema, Zugangsdaten, lokale Netze, Sperrliste, Zielklasse, Daten in der Adresse; nach nicht-öffentlichen Inhalten: Zielwechsel und lange Parameter ⇒ Freigabe |
| `extract` | Offenlegung: Inhalt verlässt die Seite (Ergebnis, Modell, Nachweis) | nur öffentliches Ziel und unbelastete Sitzung frei; Inhalt nie im Nachweis |
| `screenshot` | Aufnahme: zeigt auch Eingaben und Kontodaten | wie `extract`; im Nachweis nur Größe + SHA-256 |
| `click`, `select`, `type` | Verändern + Abfluss (Absenden) | immer Freigabe; Absenden auf fremdes Ziel geblockt |
| nach jeder Aktion | tatsächliches Ziel (Weiterleitung) | Sitzung folgt dem echten Ergebnis; Landung außerhalb der Entscheidung ⇒ fehlgeschlagen, Inhalt verworfen |

### Weitere Befunde

| # | Befund | Beleg | Marke |
|---|---|---|---|
| C1 | Weiterleitungen umgehen Playwright-Routen: `routeGuard` in `deploy/playwright-scanner/executor.ts` sieht nur die erste Anfrage. Öffentliche Adresse mit 302 auf `127.0.0.1` lud den internen Inhalt (SSRF). | lokaler Nachweis, Teil C | **GEPRÜFT** (Muster), Executor selbst nicht deployt geprüft |
| C2 | `browser-execute` speichert ausgelesenen Seitentext (bis 50.000 Zeichen) unverändert in `governance_events.payload` und in der Evidence-Kette; nur Bildschirmfotos werden gehasht. | `sanitizeExecutorPayload` | **IST** |
| C3 | Fingerprint im Code `browser:v1:` (SHA-256, ohne Schlüssel); Migration und DB-Test erwarten `browser:v2:` (HMAC). Mitglieder lesen `requested_action` per RLS ⇒ kurze Eingaben (PIN) per Wörterbuch rückrechenbar. Widerspruch Doku/Code. | `stableFingerprint`, `20261028095440`, `browser-runtime-sessions.db.test.ts` | **IST** |
| C4 | Keine Trennung Anfragender/Freigebender: Owner/Admin kann eigene Anfrage freigeben. | `governance-approvals/index.ts` | **IST** |
| C5 | Migration verweist auf `_shared/browser-runtime/policy.ts` (`EXECUTION_LIMITS`) — Datei existiert nicht; `browser_sessions` wird nicht genutzt. | `20261028095440` | **IST** |
| C6 | Executor: keine Sperre für Service Worker und WebSockets, `routeGuard` lässt Nicht-HTTP-Schemata durch, DNS-Rebinding zwischen Prüfung und Verbindung möglich. | `executor.ts` | **IST** |

**PRODUKTIV:** `browser-execute` ist aktiv (Version 19, aktualisiert
2026-11-15, Quelle: Supabase `list_edge_functions`, Projekt
RealSyncDynamicsLive). Ob die deployte Fassung dem Repo entspricht und ob
ein Executor erreichbar ist, ist **nicht geprüft**; laut #2258 ist der
Executor nicht erreichbar.

## Teil C — Lokaler MVP

```text
Plan (Modell/Datei) ─► BrowserGuardian ─► Policy (rein) ─► Freigabe (Mensch, Terminal)
                              │                                   │
                              └──► PlaywrightDriver ◄─────────────┘
                                     ├─ Route-Wächter: Hauptdokument nur für geprüftes Ziel, kein Referer an Fremde
                                     ├─ Egress-Proxy: jede Verbindung, DNS hier, Verbindung zur geprüften IP
                                     └─ keine Downloads, Service Worker, WebSockets, Popups
                              └──► EvidenceLog (gekettet, JSONL, ~/.realsync-browser/evidence)
```

Start (Playwright mit Chromium nötig):

```bash
node apps/realsync-browser/src/cli.ts --policy apps/realsync-browser/examples/policy.example.json --plan apps/realsync-browser/examples/plan.example.json --headed
```

`--simulate` ersetzt den Browser durch `SimulatedDriver` (**SIMULATION**,
im Nachweis `executor: 'simulation'`). Der Plan wird mit dem bestehenden
`parseBrowserPlan` geprüft (höchstens 10 Schritte, nur bekannte Aktionen).

Ausgeführte Prüfungen (2026-11-15, Node 22.23, Playwright 1.63 global, ohne `node_modules`):

| Befehl | Ergebnis | Umfang |
|---|---|---|
| `node --test test/features/governance/browser-guardian/*.test.ts` | 36/36 bestanden | Policy, Freigaben, Nachweise mit `SimulatedDriver`, Laufzeit der Klassifikation — **SIMULATION** |
| `node --test apps/realsync-browser/test/playwright-driver.test.ts` | 6/6 bestanden | echtes Chromium headless; Antworten über Test-Transport bzw. lokalen Server — **GEPRÜFT ohne Internet** |
| Nachweis C1 (Skript, Muster aus `executor.ts`) | interner Pfad geladen, Route sah nur 1 Anfrage | **GEPRÜFT** |
| CLI `--simulate` mit Beispielplan | Schritt 3 wartet auf Freigabe, ohne Terminal abgelehnt; 10 Nachweise, Kette geprüft | **SIMULATION** |
| CLI echter Modus | `ERR_CERT_AUTHORITY_INVALID`: Sandbox bricht TLS mit eigener CA auf | echter Netzlauf **nicht verifiziert** |
| `tsc` (global 6.0.2) auf neue Dateien | ohne Fehler; nur `vitest` lokal nicht auflösbar | `TEILWEISE` — maßgeblich ist die CI |

Nicht im MVP (**OFFEN**): installierbares Paket, Integration in das
Governance OS, Modellanbindung des Planers im MVP, dauerhafte Freigaben
über Neustarts, Vier-Augen-Prinzip, vorgeschalteter Firmen-Proxy (der
Egress-Proxy verbindet direkt).

**Keine Lockerung:** `browser-execute`, PDP, Migrationen und Executor sind
unverändert. Verändernde Aktionen brauchen weiter immer eine Freigabe; die
Grenzen 10 Planschritte / 25 Aktionen bleiben.

## Teil D — Notwendige Erweiterungen (separat freizugeben, nicht umgesetzt)

| # | Änderung | Art | Freigabe |
|---|---|---|---|
| D1 | `browser-execute`: Guardian-Policy serverseitig auch für lesende Aktionen (Ziel, Daten, Kontext, Wirkung); Paket ist laufzeitneutral und in Deno nutzbar | Edge Function | Security-Merge + Deploy |
| D2 | `createApproval`: `expires_at = now() + 15 min` | Edge Function | Security-Merge + Deploy |
| D3 | Fingerprint `browser:v2` (HMAC, Schlüssel als Secret), wie Migration und DB-Test erwarten | Edge Function + Secret | Security-Merge + Deploy |
| D4 | Ausgelesenen Text nicht in Events/Evidence; nur Länge, Klasse, Funde (C2) | Edge Function | Security-Merge |
| D5 | Executor: Egress-Proxy mit IP-Bindung, Weiterleitungen, Service Worker, WebSockets sperren (C1, C6) | `deploy/playwright-scanner` | Security-Merge + Deploy |
| D6 | PDP: unbekannter Policy-Wert ⇒ `block` statt `log_only`; vorher Schattenauswertung, weil alle PEPs betroffen | `_shared/pdp/core.ts` | Security-Merge |
| D7 | Prüfart, Origin-Klassen je Mandant, Trennung Anfragender/Freigebender (C4) | Migration + Edge Function | Migration + Security |
| D8 | Sprachdienst: Rechtsgrundlage Drittlandtransfer (DPF/SCC) prüfen | Recht | Dominik / Rechtsprüfung |
| D9 | Installierbarer Browser: Electron oder Chromium-Build, Signierung, Updates | neue Abhängigkeit | Dominik (Agenten installieren keine Pakete) |
| D10 | Eintrag in `src/product/implementation-status.ts`, erst nach D1–D5 | Claims | Dominik |
