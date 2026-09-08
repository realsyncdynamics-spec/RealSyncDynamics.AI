# Token-Ökonomie — Ist-Zustand und offene Kostenfrage (Phase 0)

**Gemessen am 2026-09-08** auf `main` @ `9587905`.
**Status: `PARTIAL`.** Zählwerk vorhanden, Guthabenbegriff nicht.

---

## 1. Was bereits steht

Der Auftrag (§12) behandelt Tokens als einzuführendes System. Gemessen ist ein
erheblicher Teil vorhanden:

| Baustein | Fundstelle | Status |
|---|---|---|
| Verbrauchstabelle | `public.token_usage` | `LIVE` |
| Agenten-Verbrauch | `agent_token_usage` | `LIVE` |
| Metering-Schalter | `20260705100000_enable_ai_token_metering.sql` | `LIVE` |
| Agenten-Budget | `20260706011047_agent_token_budget.sql` | `LIVE` |
| Runner-Token | `20260901010000_agent_os_runner_token.sql` | `LIVE` |
| Kontingent-Schlüssel | `limit.ai_tokens_monthly`, `limit.ai_cost_monthly_cents`, `limit.ai_calls_monthly`, `limit.llm_queries_monthly` | `LIVE` |
| Protokollierung jedes Aufrufs | `ai_tool_runs`, `workflow_runs` | `LIVE` (CLAUDE.md §2) |
| Ein Durchgangspunkt für KI | Edge Function `ai-gateway` | `LIVE` |

**Der letzte Punkt ist der wichtigste.** Beide Dashboard-Flächen und die
Agent-Runtime laufen über dieselbe Edge Function. Eine Token-Ökonomie braucht
genau das: **eine** Stelle, an der Verbrauch entsteht und gebucht werden kann.
Sie existiert bereits und muss nicht geschaffen werden.

---

## 2. Was fehlt

| Fehlend | Folge |
|---|---|
| **Guthabenbegriff** | Verbrauch wird gezählt, ein Restwert nicht geführt |
| **Nachkauf** | §12 „Purchase more" hat kein Produkt und keinen Pfad |
| **Kundensichtbare Anzeige** | §8 „Token balance" hat keine Oberfläche |
| **Umrechnung Provider → Kundentoken** | §12 „TOKEN COST MODEL" existiert nicht |

Aus `limit.ai_tokens_monthly` (ein Monatskontingent) wird kein Guthaben, das
sich aufladen lässt. Das ist der eigentliche Schritt von Metering zu Ökonomie.

---

## 3. Eine Entscheidung, die vor dem Bau fällt

**Zählt ein blockierter Aufruf?**

CLAUDE.md hält für die Bot-Governance bereits denselben offenen Punkt fest:

> Eine vom PDP gesperrte Bot-Nachricht verbraucht trotzdem eine Einheit von
> `limit.bot_messages_monthly` — das Kontingent wird vor der Prüfung gebucht.
> Ob eine blockierte Anfrage berechnet wird, gehört entschieden.

Für Tokens stellt sich dieselbe Frage in größerem Maßstab. Sie ist keine
technische Feinheit: Bei `enforce`-Betrieb der PDP-Schalter kann ein Kunde für
Aufrufe zahlen, die das System selbst verhindert hat. **Diese Entscheidung
gehört vor die Einführung eines Guthabens**, nicht danach — nachträglich wäre
sie eine Preisänderung für Bestandskunden.

---

## 4. Die Kostenrechnung, die §30 verlangt

Zu messen, bevor Kontingente oder ein Tokenpreis festgelegt werden:

| Größe | Quelle | Stand |
|---|---|---|
| Provider-Kosten je 1k Ein-/Ausgabe-Token | `ai_tool_runs`, Provider-Abrechnung | **nicht erhoben** |
| Anteil Ollama (EU-lokal) vs. externe Provider | `ai_tool_runs` | **nicht erhoben** |
| Kosten je Browser-Ausführung (Playwright-Scanner) | VPS-Auslastung | **nicht erhoben** |
| Kosten je Scan / Audit | `gdpr_audits`, Laufzeiten | **nicht erhoben** |
| Speicher (Evidence Vault, R2) | Cloudflare/Supabase | **nicht erhoben** |
| Cloudflare, Supabase, Stripe-Gebühren | Abrechnungen | **nicht erhoben** |

**Nichts davon ist in Phase 0 erhoben** — diese Sitzung hatte keinen Zugriff
auf Produktionsdaten oder Abrechnungen. Ohne diese Zahlen wäre jeder
Tokenpreis erfunden; §36 verlangt dann `UNKNOWN` statt einer Zahl.

**Zusätzlich zu rechnen** (§30): Durchschnittsnutzer, Vielnutzer,
Missbrauchsszenario. Der Preis muss das Vielnutzer-Szenario überstehen, nicht
den Durchschnitt.

---

## 5. Was der Kunde sehen soll (§12) — und was das voraussetzt

| Anzeige | Voraussetzung |
|---|---|
| Verbrauchte Tokens | **vorhanden** (`token_usage`) |
| Verbleibende Tokens | Guthabenbegriff — **fehlt** |
| Erwarteter Verbrauch | Verlaufsdaten + Hochrechnung — **fehlt** |
| Nachkaufen | Stripe-Produkt + Grant-Pfad — **fehlt** |
| Im Plan enthalten | **vorhanden** (`limit.ai_tokens_monthly`) |

Der Nachkauf sollte dem bestehenden Muster folgen, nicht einem neuen: Add-ons
sind seit dem 2026-09-01 Positionen des Stripe-Abos, `tenant_entitlements()`
**addiert** Kontingente aus Add-on-Grants auf den Plan. Ein Token-Nachkauf ist
strukturell dasselbe. §18 des Auftrags verbietet ausdrücklich ein zweites
Entitlement-System — und hier wäre es besonders verlockend, eines zu bauen.

---

## 6. Empfehlung

1. **Nicht bauen, bevor §4 gemessen ist.** Die Kostenrechnung ist die
   Voraussetzung, nicht die Begleitung.
2. **Die Frage aus §3 entscheiden lassen**, bevor ein Guthaben entsteht.
3. **Auf `ai-gateway` aufsetzen**, nicht daneben. Der Durchgangspunkt existiert.
4. **Kein zweites Entitlement-System** — Token-Nachkauf als Grant, wie Add-ons.
5. **Beachten**: PR #1164 baut das Routing genau dieser Edge Function um.
   Beides zugleich zu ändern wäre vermeidbares Risiko.
