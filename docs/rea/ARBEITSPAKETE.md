# REA-Radar — Umsetzungspläne der Arbeitspakete (Stand 25.11.2026)

Bezug: `docs/rea/RADAR_BERICHT.md` (Arbeitspakete 1–3). Status aller Punkte: **geplant**,
nichts implementiert. Bestand nur gelesen; Belege als `Datei:Zeile` oder Pfad.

## AP1 — KI-Sekretariat aus der Website

### Bestand (wiederverwendbar)

| Baustein | Was er heute tut | Beleg |
|---|---|---|
| `normalizeWebsiteSource` | Domain → https-URL, blockt lokale Hosts, IPs, Ports, Zugangsdaten | `src/features/siteos/scanHandoff.ts:9` |
| `siteos/discover` | Liest **eine** Seite (max. 1 MB, 3 Redirects, 8 s), liefert `title`, `description`, `h1`, `headings`, `services`, `visible_text`, `source_url`, `fetched_at`. Prüft Bearer-Token und Mitgliedschaft im Mandanten serverseitig | `supabase/functions/siteos/handlers/discover.ts:9-44` |
| Aufrufmuster aus dem Frontend | `sb.functions.invoke('siteos/discover', { body: { tenant_id, url } })` | `src/pages/WebsiteTransformationFlow.tsx:110` |
| Bot-Konfiguration | `bots.persona`, `bots.greeting`, `bots.config` (JSONB, frei erweiterbar), `bots.enabled` | `src/features/bots/types.ts:25-48`, `src/features/bots/api.ts:33` |
| Prompt-Aufbau | `buildBotPrompt` nutzt `persona` als Unternehmenskontext; `config` nur für `vertical = 'restaurant'` | `supabase/functions/_shared/bots.ts:215, 259-261` |
| „Mein Betrieb“ | Lädt Seiten, Bots, Eingänge über bestehende APIs (RLS), Zähllogik rein und testbar | `src/features/betrieb/MeinBetriebView.tsx`, `src/features/betrieb/betriebSummary.ts` |

### Lücken (belegt)

1. **Keine serverseitige Freigabe der Aktivierung.** RLS erlaubt jedem Mandantenmitglied
   `UPDATE` auf `bots` (`supabase/migrations/20260628121531_bots_foundation.sql:145`), und
   `bots.enabled` hat den Standardwert `true` (`…:31`). Ein Mitglied kann einen Entwurf
   also direkt im Client aktivieren. Das gilt heute schon für jeden Bot.
2. `discover` liest nur die Startseite. Öffnungszeiten, Telefonnummer und FAQ werden
   nicht strukturiert geliefert, nur als `visible_text`.
3. `discover` blockt private Ziele nur am Hostnamen bzw. an IP-Literalen
   (`discover.ts:85`, `isBlockedHostname`). Ein öffentlicher Name, der auf eine private
   Adresse zeigt, wird nicht per DNS-Auflösung geprüft. **Zu prüfen** (Security-Review),
   ob die Laufzeit private Ziele ohnehin sperrt.
4. Ein Entwurf als Zeile in `bots` zählt gegen das Bot-Kontingent (Trigger
   `bots_enforce_quota`, `supabase/migrations/20260920130000_bots_quota_enforcement.sql:401-403`).

### Umsetzung Phase 1 (nur Frontend, keine Migration, keine neue Edge Function)

| Datei | Änderung |
|---|---|
| `src/features/betrieb/receptionistDraft.ts` (neu, rein) | `buildReceptionistDraft(discovery)` → Felder `betriebsname`, `kurzbeschreibung`, `leistungen[]`, `oeffnungszeiten`, `telefon`, `faq[]`. Je Feld ein Herkunftsnachweis `{ quelle_url, gelesen_am, methode: 'title'·'meta_description'·'h1'·'heading'·'text_muster'·'manuell', bestaetigt: false }`. Öffnungszeiten/Telefon per Muster aus `visible_text`, FAQ nur aus Überschriften mit „?“. Nicht gefundene Felder bleiben leer, nichts wird ergänzt. |
| ebenda | `compileReceptionistPersona(draft)` → Persona-Text nur aus **bestätigten** Feldern, plus feste Regeln: nur Anliegen des Betriebs (WhatsApp-Richtlinie zu Allzweck-Bots, siehe Bericht C), keine Preise oder Zusagen erfinden, Hinweis „KI-Assistent“ (Art. 50 AI Act), Übergabe an einen Menschen bei Unklarheit. |
| `src/features/betrieb/ReceptionistDraftPanel.tsx` (neu) | In „Mein Betrieb“: Domain eingeben → `normalizeWebsiteSource` → `siteos/discover` → Entwurf mit Herkunft je Feld, jedes Feld editierbar, Bestätigen je Feld. |
| `src/features/betrieb/MeinBetriebView.tsx` | Panel einbinden (eine Karte, bestehendes Layout). |
| Speichern | `createBot({ …, channel: 'chat', enabled: false, persona: compileReceptionistPersona(draft), config: { vertical: 'general', receptionist_draft: draft } })`. `enabled: false` **ausdrücklich** setzen (DB-Standard ist `true`). |
| `test/betrieb/receptionist-draft.test.ts` (neu) | Extraktion je Feld, Herkunft vollständig, unbestätigte Felder fehlen in der Persona, Persona enthält Richtlinien-Regeln, Speichern übergibt `enabled: false`, ungültige Domain → kein Aufruf. |

Phase 1 verändert **kein** Backend und schafft kein neues Risiko gegenüber heute, löst
aber Lücke 1 nicht. „Aktivieren“ bleibt der bestehende Weg im Bot-Builder.

### Phase 2 (braucht Einzel-Freigabe: Migration + Security-Review)

Serverseitiges Freigabe-Gate: Trigger `BEFORE UPDATE ON public.bots`, der den Wechsel
`enabled false → true` nur für Rollen `owner`/`admin` des Mandanten zulässt, Standard
`enabled` für neue Zeilen auf `false` und einen Prüfpfad-Eintrag (wer, wann, welche
Entwurfsfassung) schreibt. Muster: Vier-Augen-Freigabe von SiteOS
(`supabase/functions/siteos/approval-policy.ts`). Wirkung auf bestehende Bots und
Onboarding-Abläufe vorher prüfen (Standardwert-Änderung).

### Abnahmekriterien AP1

- Domain → Entwurf in „Mein Betrieb“ in < 2 Min. (gemessen in Preview, nicht produktiv).
- Jedes Feld editierbar und mit Herkunft (URL, Zeitpunkt, Methode) sichtbar.
- Gespeicherter Entwurf hat `enabled = false`; ohne Freigabe antwortet `bot-chat` nicht.
- Nur bestätigte Felder gelangen in die Persona.
- `npm run lint`, betroffene Tests, `npm run build` grün; CI auf dem Head grün.
- Phase 2: Aktivierung durch Nicht-Admin wird serverseitig abgewiesen (RLS-/Trigger-Test).

### Freigaben AP1

| Schritt | Freigabe |
|---|---|
| Phase 1 auf eigenem Branch, Draft-PR | autonom (Profil `website`) |
| Phase 2 Migration, Standardwert `enabled` | Einzel-Freigabe Migration + Security |
| Klärung DNS-Prüfung in `discover` | Security-Review (`aios-security-audit`) |
| Entwurf zählt gegen Bot-Kontingent | Produktentscheidung |

## AP2 — Gemeinsame Auftragskarte (Folgeschritt)

### Bestand

- Konversationen aller Kanäle in `bot_conversations` (`channel`, `contact_label`, `status`)
  und `bot_messages`; WhatsApp schreibt dort hinein
  (`supabase/functions/whatsapp-webhook/index.ts:181-296`).
- Terminwünsche in `bot_appointments` (`customer_name`, `contact`, `service`,
  `requested_at`, `status`), geschrieben von `supabase/functions/appointment-book`.
- „Mein Betrieb“ zählt Eingänge bereits (`countInbox`, `betriebSummary.ts`).

### Plan

1. **Phase A (nur Frontend):** reine Funktion `toAuftragskarten(conversations, appointments)`
   in `src/features/betrieb/` → eine Karte je Anliegen (Kanal, Kontakt, Anliegen, Termin-
   wunsch, Status, Link zum Verlauf). Anzeige in „Mein Betrieb“. Keine Schemaänderung.
2. **Phase B (Einzel-Freigabe Migration + Security):** strukturierte Felder, die heute
   fehlen (Ort, Dringlichkeit, Fotos aus WhatsApp, Status „erledigt“), Eintrag im
   Prüfpfad, Mandant serverseitig aus `whatsapp_channels` bzw. Bot, nie aus dem Body.

### Abnahme AP2

Fixture aus dem WhatsApp-Webhook erzeugt eine Karte; Karten eines anderen Mandanten sind
nicht sichtbar (RLS-Test); Phase A ohne Änderung unter `supabase/`.

## AP3 — Voice-Laufzeit: Recherche und Architekturvergleich

Nur kostenlose Recherche und Doku-Vergleich, keine Testkonten. Ergebnis siehe Abschnitt
„AP3 — Vergleich“ unten.

### AP3 — Vergleich (Primärquellen, geprüft 25.11.2026)

| Kriterium | ElevenLabs Agents | Twilio ConversationRelay | Eigenbetrieb `apps/agent-runtime` |
|---|---|---|---|
| Kosten/Min. | 0,08 USD (Burst 0,16); LLM/Telefonie extra nicht belegt | 0,07 USD + Telefonie DE (eingehend 0,01 USD, Ortsnummer 1,35 USD/Monat) + eigenes LLM | Carrier + STT/LLM/TTS zum Listenpreis + Betrieb; keine Plattformgebühr (Einzelpreise nicht geprüft) |
| EU-Datenresidenz | nur Enterprise, Verarbeitung außerhalb EU weiter möglich | für Voice nicht belegt | frei wählbar, selbst nachzuweisen |
| AVV/DPA | „Custom DPA“ nur Enterprise belegt | nicht geprüft | je Unterauftragsverarbeiter |
| Deutsche Nummern | über Twilio oder SIP-Trunk | ja, mit Regulatory Bundle | über beliebigen Carrier |
| Übergabe an Menschen | „Transfer to number“ (Telefon); in WhatsApp „coming soon“ | nicht dokumentiert geprüft | selbst bauen (`<Dial>`, SIP REFER) |
| Lock-in | hoch | mittel (Logik bleibt im eigenen Code) | gering, dafür höchster Betriebsaufwand |
| Deploy-Blocker heute | – | – | kein funktionierender Deploy-Pfad (`voice-telephony` = `coming-soon`) |

**Vorläufige Einschätzung (Annahme REA, keine Entscheidung):** Twilio ConversationRelay ist
der kleinste Schritt, weil Gesprächslogik, Prüfpfad und Mandantenbezug in unserem Code
bleiben und deutsche Nummern belegt sind. Vor einer Empfehlung fehlen: Twilio-DPA und
Voice-Region, LLM-Kosten je Minute, Latenz-Messung (nur mit Testkonto = Einzel-Freigabe).
Nicht beantwortete Rechtsfrage: Datenübermittlung in Drittländer je Anbieter.
