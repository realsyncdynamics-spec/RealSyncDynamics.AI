# Produktspezifikation — RealSync Agent Studio (AUTOMATE)

Stand 07.11.2026 · Status-Quelle `src/product/productSuite.ts` · Öffentliche Seite `/produkte/agent-studio`

## Zielgruppe

KMU mit Kundenkontakt, zuerst Handwerk (K4: AI Receptionist — Anfrage, Kontakt, Terminwunsch, Übergabe an
Menschen). Danach Praxen, Kanzleien, Hotel/Gastro, Immobilien, Autohaus, Handel, Dienstleistung.

## Nutzenversprechen

Mehr erreichbare Anfragen, sauber erfasste Kontaktdaten und Terminwünsche, weniger Routinearbeit — über
Website-Chat, WhatsApp und Telefon, mit eingebauter Governance.

## Kanäle und Status

| Kanal | Konfiguration | Produktivbetrieb | Beleg |
|---|---|---|---|
| A · Website-Chatbot | PREVIEW | PREVIEW (Provider-Laufzeit) | `src/features/bots/BotBuilderView.tsx`, `supabase/functions/bot-chat` |
| B · WhatsApp-Agent | PREVIEW | **BLOCKED** (Meta-Verifizierung, Nummer, Webhook-Registrierung unbelegt) | `src/features/bots/WhatsAppChannelsView.tsx`, `supabase/functions/whatsapp-webhook` |
| C · Telefonagent | PREVIEW (Onboarding auf `voice.realsyncdynamicsai.de`) | **BLOCKED** (Deploy `apps/agent-runtime` fehlgeschlagen, keine Rufnummer) | Registry `voice-telephony`, `supabase/functions/bot-voice-webhook` |

Regel: Kein simulierter Anruf, keine simulierte Nachricht, keine simulierte Buchung. Nicht aktivierte Kanäle
werden als PREVIEW oder BLOCKED angezeigt.

## Funktionen

| Funktion | Status |
|---|---|
| Persona, Wissensbasis, Gesprächsregeln je Bot | PREVIEW |
| Anfragen-Posteingang (Lead, Kontakt, Terminwunsch) | PREVIEW |
| Human Handoff | NOT IMPLEMENTED (Entitlement `bots.human_handoff` vorhanden, UI fehlt) |
| Gesprächshistorie im zulässigen Rahmen | PREVIEW (Posteingang) |
| Protokollierte Tool-Entscheidungen / Governance-Ereignisse | PREVIEW (AI Gateway protokolliert jeden Call; Voice-Enforcer `bot-voice-enforcer`) |
| Budget-/Kostengrenzen | PREVIEW (`bot-chat` reserviert Budget, 429 bei Ablehnung) |
| Branchenvorlagen | PREVIEW (Voice-Onboarding), Chat/WhatsApp NOT IMPLEMENTED |
| Workflows | PREVIEW (n8n-Host nicht erreichbar) |
| Qualitätslabor | NOT IMPLEMENTED |

Vorlagen enthalten keine medizinische oder rechtliche Fachberatung und täuschen keine Kalender-/Praxis-/
Kanzleisoftware-Anbindung vor.

## Dashboard-Bereiche (Zuordnung zu vorhandenen Oberflächen)

| Bereich | Route |
|---|---|
| Übersicht | `/app/dashboard` |
| Meine Agenten | `/app/bots` |
| Kommunikationskanäle | `/app/bots/whatsapp` |
| Anruf- und Nachrichtenzentrale | `/app/bots/inbox`, `/app/voice` |
| Wissensbasis | im Bot-Builder `/app/bots/:botId` |
| Workflows | `/app/automations` |
| Integrationen | `/app/governance/connectors` |
| Qualitätslabor | fehlt |
| Governance | `/app/dashboard`, `/app/governance/gates` |
| Nutzung und Abrechnung | `/app/billing` |

Keine neuen Dashboards — Zuordnung bestehender Ansichten.

## Datenflüsse und APIs

Widget/WhatsApp/Telefon → Edge Functions (`bot-chat`, `whatsapp-webhook`, `bot-voice-webhook`) → AI Gateway
(Provider-Keys nur serverseitig) → Postgres (Konversation, Anfrage, Mandant via RLS). Kill-Switch, Einwilligung,
Mandant nie aus dem Request-Body.

## Kommerzielles Modell

Kanäle und Volumen je Tarif (`bots.enabled`, `limit.bots`, `limit.bot_messages_monthly`, `bots.whatsapp`, `bots.voice`,
`limit.bot_voice_minutes_monthly`). Add-ons WhatsApp/Voice in `shared/pricing.ts` (`ADDONS`); Voice-Modulpreis
weicht vom Add-on ab (`MODULE_ADDON_PRICE_DIVERGENCE`) — Kalkulation der Minutenkosten offen. Keine neuen Preise.

## Abnahmekriterien

- [ ] Ein Kanal wird nur LIVE angezeigt, wenn Provider-Zugang, Nummer und Webhook serverseitig verifiziert sind.
- [ ] WhatsApp-Webhook lehnt ungültige Signaturen ab (bereits umgesetzt, Regressionstest Pflicht).
- [ ] Budget-Reservierung vor jedem KI-Aufruf; harte Limits für Sprachminuten.
- [ ] Human Handoff: Übergabe sichtbar im Posteingang, Benachrichtigung an Mensch, Nachweis im Evidence-Log.
- [ ] Mandantentrennung für Konversationen und Anfragen (RLS-Test).
- [ ] Keine Testdaten als Kundendaten in Screens.
