# PDP-Enforcement-Schalter — Details (Archiv)

> Ausgelagert aus `CLAUDE.md` §5. Die Schaltertabelle steht weiterhin dort;
> hier die Begründungen, die Bot-Governance (P2-5) und die offene
> Produktentscheidung zur Kontingentbuchung.

### Enforcement-Schalter — der PDP entscheidet erst, wenn jemand ihn lässt

Seit P2 hängen fünf Pfade am PDP. **Alle stehen auf Beobachtung**; das ist der
beabsichtigte Zwischenzustand aus P0, aber eben keine Durchsetzung:

| Schalter | Wirkt auf | Vorgabe | In `enforce` |
|---|---|---|---|
| `AI_GATEWAY_ENFORCEMENT` | `ai-gateway` | `shadow` | blockt |
| `AGENT_PDP_ENFORCEMENT` | Agent-Runtime | `shadow` | fail **closed** |
| `SITEOS_PUBLISH_PDP` | Publish Gate (P2-3) | `shadow` | fail **closed** (§7 G3) |
| `GOVERNANCE_PDP_MODE` | CI/CD-Gate (P2-4) | `shadow` | verschärft nur |
| `BOT_PDP_ENFORCEMENT` | Chat · WhatsApp · Voice (P2-5) | `shadow` | fail **closed**, per `BOT_PDP_FAILURE_MODE=allow` umstellbar |
| `M365_PDP_ENFORCEMENT` | Microsoft 365 (P2-2) | `shadow` | **löst die Reaktion aus** — anhalten kann Klasse C nichts |

**`enforce` heißt nicht überall dasselbe.** Bei den ersten vier Schaltern
bedeutet es „die Handlung wird angehalten". Bei `M365_PDP_ENFORCEMENT`
(Klasse C, nachgelagert) kann nichts angehalten werden — dort bedeutet es „die
Reaktion wird ausgelöst, es entsteht ein Vorgang". Wer den Namen für dieselbe
Zusage hält, überschätzt, was diese Anbindung kann. Ein `block` des PDP wird
dort zu `react` **mit Vermerk** (`verdict_downgraded_from`); die Datenbank
lässt per CHECK gar nichts anderes zu.

**Vor dem Umschalten `pdp_shadow_log` auswerten** — dafür ist der
Beobachtungsbetrieb da. Und zwar wirklich auswerten: Die Tabelle blieb für den
Publish Gate bis zum 2026-09-04 leer, weil der Aufruf falsch war und der
Fehler in einem `catch` verschwand. Ein leeres Shadow-Protokoll bedeutet nicht
„keine Abweichungen", sondern zuerst „nachsehen, ob überhaupt geschrieben
wird".

**Seit dem 2026-09-06 ist das auswertbar**: `pdp_shadow_readiness()` (Migration
`20260906100000`) und `/app/governance/shadow`. Bis dahin schrieben sechs
Kanäle in die Tabelle und **nichts las sie** — die Aufforderung oben stand da,
war aber nicht befolgbar. Die Auswertung geht bewusst von der **Kanalliste**
aus, nicht von den Zeilen: Ein stummer Kanal erscheint mit `beobachtet = false`
statt gar nicht. Ein `GROUP BY` hätte ihn verschluckt und wie einen Kanal ohne
Befund aussehen lassen. Richtung der Abweichung (v2 strenger / lockerer) und
unbekannte Verdikte werden getrennt gezählt; Letztere ergeben `NULL`, nicht
`0`. **Regel**: Die Kanalliste in `pdp_shadow_known_sources()` steht doppelt —
dort und in der CHECK-Bedingung `pdp_shadow_log_source_check`. Nie einseitig
ändern; `test/governance/shadow-readiness.test.ts` bricht sonst.

**Zur Bot-Governance (P2-5)**: Chatbot, WhatsApp und Voice laufen durch **einen**
PEP (`_shared/pdp/botmessage.ts`, `enforceBotMessage()`) — drei eigene Auslegungen
derselben Regel wären der Fragmentierungsbefund eine Ebene tiefer. Den Prozess
verlassen nur Merkmale: Kanal, Bot-ID, Signalnamen und Zähler. **Nie der
Nachrichtentext** — `bot-chat` und `whatsapp-webhook` laufen mit `verify_jwt = false`,
der Text stammt also von einem beliebigen Fremden und wäre sonst ein Hebel auf die
Bewertung der eigenen Anfrage. Gesichert durch `test/governance/pdp-botmessage.test.ts`
und `test/governance/bot-pep-wiring.test.ts` (Letzterer prüft am Quelltext, dass alle
drei Kanäle denselben PEP **vor** dem Modellaufruf rufen — dass sie sich gleich
verhalten, ist kein Beleg dafür, dass sie dieselbe Stelle benutzen).

**Offen, weil Produktentscheidung**: Eine vom PDP gesperrte Bot-Nachricht verbraucht
trotzdem eine Einheit von `limit.bot_messages_monthly` — das Kontingent wird vor der
Prüfung gebucht. Ob eine blockierte Anfrage berechnet wird, gehört entschieden.

### Dashboard-Module (modulare Reihenfolge)
1. **Agent Registry** — Liste, Status, Risiko, Details
2. **Agent Identity** — Ownership, Permissions, Credentials
3. **Runtime Monitoring** — Sessions, Events, Tool Calls
4. **Policy Engine** — Regeln, Enforcement, Violations
5. **Audit System** — Immutable Logs, Hash Chains, Evidence
6. **Observability** — Metrics, Costs, Performance
7. **Integrations** — APIs, Webhooks, External Providers

---

