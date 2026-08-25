# Entitlement Reality Map — die 16 offenen Keys

**Stand: 2026-08-25, gemessen auf `91c4b4e`.** Read-only: kein Code geändert,
kein Planwert angefasst, kein Entitlement repariert, kein Trigger gesetzt,
kein bestehendes Gate verändert.

Auftrag: die nach dem Monitoring-Gate verbliebenen 16 `UNKNOWN`-Keys aus
`claims-reality-audit.md` §3.2 **einzeln bis zur tatsächlichen Verwendung
verfolgen** und in genau eine von fünf Kategorien zwingen.

| Kategorie | Bedeutung |
|---|---|
| `ENFORCED` | Serverseitig geprüft, Verstoß wird abgewiesen |
| `METERED` | Verbrauch wird gemessen und abgerechnet, nicht begrenzt |
| `DISPLAY_ONLY` | Nur Oberfläche oder kundeneigene Daten entscheiden |
| `FUNNEL_EXCLUDED` | Bewusst frei — gehört zum kostenlosen Einstieg |
| `UNKNOWN` | Der Code erlaubt keine belastbare Zuordnung |

**Regel für diese Datei:** `UNKNOWN` bleibt nur stehen, wenn die Messung
tatsächlich nichts findet. Keine Einordnung aus Namensähnlichkeit.

---

## 0. Der Fund, der die Methode korrigiert

`ai.tool.bot_reply` stand als `UNKNOWN`, weil die Zeichenkette
`'ai.tool.bot_reply'` in `supabase/functions` und `src` **nirgends** vorkommt.
Sie kommt dort auch nie vor — der Key wird zur Laufzeit gebaut:

```ts
// _shared/ai.ts
const requiredKey = tool.required_entitlement_key ?? `ai.tool.${tool.key}`;
await gateFeature(admin, tenantId, requiredKey);
```

`ai_tools` trägt die Zeilen `bot_reply`, `code_explain`, `log_analyze`,
`vps_status`, `vps_action_advisor` (Seed in `20260430240000_ai_tools.sql`).
**Jedes `ai.tool.*` ist damit durchgesetzt** — über einen zusammengesetzten
Schlüssel, den keine Volltextsuche findet.

Das korrigiert nicht nur einen der 16, sondern **vier weitere Keys außerhalb
der Liste**:

| Key | in Teil 2 | tatsächlich |
|---|---|---|
| `ai.tool.code_explain` | `NOT_APPLICABLE` | **`ENFORCED`** — aber keinem Plan zugeordnet, also für alle gesperrt |
| `ai.tool.log_analyze` | `NOT_APPLICABLE` | dito |
| `ai.tool.vps_status` | `DISPLAY_ONLY` | **`ENFORCED`** |
| `ai.tool.vps_action_advisor` | `DISPLAY_ONLY` | **`ENFORCED`** |

**Lehre:** Eine Volltextsuche nach dem Key beweist Anwesenheit, nie
Abwesenheit. Wo ein Schlüssel aus Daten zusammengesetzt wird, muss die
Datenquelle mitgelesen werden. Das ist der dritte Fall in diesem Audit, in
dem eine Zählung eine Messung vorgetäuscht hat.

---

## 1. Die Matrix

| Key | Definition | Planquelle | tatsächlicher Verbrauch | Enforcement | Pfad | Klassifikation | Begründung | Abhängigkeit |
|---|---|---|---|---|---|---|---|---|
| `ai.tool.bot_reply` | LLM-Antwort eines Bots | growth, agency, ent, partner | jeder `invokeAiTool` mit `tool.key='bot_reply'` | **ja** | `ai-invoke` → `_shared/ai.ts` → `gateFeature` → 403 | **`ENFORCED`** | Key zur Laufzeit gebaut, `ai_tools`-Zeile belegt | — |
| `bots.chat` | Website-Chat-Kanal | starter (seit AP2), growth, agency, ent, partner | `bot-chat` | **ja, mittelbar** | `bot-chat` → `gateFeature('bots.enabled')` | **`ENFORCED`** | Der Kanal ist gegated, aber über den Oberbegriff. `bots.chat` ⊆ `bots.enabled` auf allen Plänen — keine Lücke, aber der Key prüft sich nicht selbst | Redundanz: entweder `bots.chat` gaten oder als Anzeige-Key führen |
| `bots.appointments` | Terminbuchung über Bot | growth, agency, ent, partner | `appointment-book` | **nein** | prüft `bot.capabilities.appointments` | **`DISPLAY_ONLY`** | Der Prüfpunkt liest ein **kundeneigenes Datenfeld**, nicht den Plan. `createBot`/`updateBot` setzen es im Browser frei — schwächer noch als ein UI-Gate | Gate müsste beim Setzen des Flags greifen, nicht beim Buchen |
| `bots.orders` | Bestellannahme über Bot | growth, agency, ent, partner | `order-intake` | **nein** | prüft `bot.capabilities.orders`; Schalter in `BotBuilderView` | **`DISPLAY_ONLY`** | wie `bots.appointments` | dito |
| `dse.generator` | Generator für Datenschutzerklärung | starter … partner, launch | Frontend | **nein** | `src/lib/billing/planAccess.ts` → `{kind:'module', module:'dsgvo'}` | **`DISPLAY_ONLY`** | Gate existiert, liest aber `plan.modules` — die Quelle, die AP1 als nicht maßgeblich belegt hat | Vierte Vokabular-Ebene (`FeatureKey`), siehe §2 |
| `fix.snippets` | Behebungsvorschläge mit Code | growth, agency, ent, partner | Frontend-Optimizer | **nein** | `src/lib/optimizer/entitlement.ts` → `hasFeature(plan,'fix_snippets')`; `governance-remediate` **ohne** Gate | **`DISPLAY_ONLY`** | Serverseitig offen; die Anzeige entscheidet | dito |
| `policy.iso27001` | ISO 27001 als Rahmenwerk | growth, agency, ent, partner | `policy-packs` | **nein, nicht einzeln** | `policy-packs` → `gateFeature('policy.packs')`, dann `pack_id` **ungefiltert** | **`DISPLAY_ONLY`** | Wer `policy.packs` hat, kann **jeden** Pack aktivieren — auch einen, den sein Plan nicht enthält | Einzelne Packs gegen ihren Key prüfen |
| `policy.nis2` | NIS2 als Rahmenwerk | agency, ent, partner | dito | **nein** | dito | **`DISPLAY_ONLY`** | dito | dito |
| `sla.priority` | Priorisierte Reaktionszeit | agency, ent, partner | — | entfällt | Feature-Liste der Preisseite | **`DISPLAY_ONLY`** ⚠️ | **Organisatorische Zusage, kein Software-Merkmal.** Ein Gate wäre sinnlos — es gibt nichts zu sperren. Die Einordnung gilt **nur innerhalb des vorgegebenen Fünfer-Vokabulars**, siehe §3 | Die fünf Kategorien haben für organisatorische Zusagen keine eigene |
| `alerts.email` | E-Mail-Alert bei neuen Findings | starter … partner | `compliance-alert-trigger`, `email-notify-send`, `audit-monitor-cron` | **nein** | keine der drei Functions liest Entitlements | **`UNKNOWN`** | Der Key kommt außerhalb der Migrationen **nirgends** vor. Es gibt Versandwege, aber keine erkennbare Verbindung zu diesem Key | Zu klären: soll der Versand gegatet werden, oder ist E-Mail Teil des Grundumfangs? |
| `bots.human_handoff` | Übergabe an einen Menschen | agency, ent, partner | — | **nein** | kein Fundort | **`UNKNOWN`** | Kam mit AP1 aus `plan.modules.human_handoff`. Im Repo existiert kein Übergabe-Mechanismus | Fähigkeit möglicherweise unimplementiert |
| `bots.multi_channel` | Ein Bot über mehrere Kanäle | growth, agency, ent, partner | — | **nein** | kein Fundort | **`UNKNOWN`** | dito, aus `plan.modules.multi_channel_messaging` | dito |
| `governance.risk_register` | Risikoregister | growth, agency, ent, partner | `governance-risk-score`, `governance-risk-escalate`, `ai-act-risk-inventory` | **nein** | keine der drei liest Entitlements | **`UNKNOWN`** | Die Fähigkeit existiert, die Verbindung zum Key nicht | Zu klären, ob die drei Functions das Register meinen |
| `webhooks.enabled` | Webhooks für CI/CD | growth (seit AP2), agency, ent, partner | `governance-webhooks`, `api-webhook-deliver` | **nein** | keine Entitlement-Prüfung | **`UNKNOWN`** | Technischer Zugang ohne Prüfpunkt. Seit AP2 auf Growth — die Lücke ist damit breiter geworden | Echter Kandidat für ein Gate |
| `whitelabel.reports` | Berichte mit eigenem Logo | agency, ent, partner | `tenant-branding-update` | **nein** | prüft **Rolle** (`admin`), nicht Entitlement | **`UNKNOWN`** | Der einzige Prüfpunkt fragt, *wer* handelt, nicht *ob der Plan es trägt* | — |
| `whitelabel.dashboard` | Eigenes Branding im Dashboard | ent, partner | dito | **nein** | dito | **`UNKNOWN`** | dito | — |

### Verteilung

| Kategorie | Anzahl | Keys |
|---|---:|---|
| `ENFORCED` | **2** | `ai.tool.bot_reply`, `bots.chat` |
| `METERED` | **0** | — |
| `DISPLAY_ONLY` | **7** | `bots.appointments`, `bots.orders`, `dse.generator`, `fix.snippets`, `policy.iso27001`, `policy.nis2`, `sla.priority` |
| `FUNNEL_EXCLUDED` | **0** | — (der einzige Funnel-Fall, `audit-recheck-weekly`, ist keiner dieser Keys) |
| `UNKNOWN` | **7** | `alerts.email`, `bots.human_handoff`, `bots.multi_channel`, `governance.risk_register`, `webhooks.enabled`, `whitelabel.reports`, `whitelabel.dashboard` |

Von 16 offenen Keys sind **9 belastbar zugeordnet**, 7 bleiben `UNKNOWN` —
und zwar nicht aus Bequemlichkeit: Bei allen sieben findet die Messung keine
Verbindung zwischen Key und Verhalten. Fünf davon (`human_handoff`,
`multi_channel`, `risk_register`, `whitelabel.*`) sind mit AP1 aus
`plan.modules` übertragen worden; sie beschreiben Zusagen, für die im Repo
kein zugehöriger Mechanismus gefunden wurde.

---

## 2. Was die Messung nebenbei zeigt: vier Vokabulare, nicht drei

AP1 hat drei Namensräume auf einen zusammengeführt. Diese Messung findet
einen vierten, der weiterlebt:

| Ebene | Beispiel | Wer liest sie |
|---|---|---|
| Entitlement-Key | `fix.snippets` | Server (`gateFeature`) |
| `plan.modules` | `remediation` | `planAccess.ts` |
| `FeatureKey` | `fix_snippets` | `src/lib/optimizer/entitlement.ts`, `usage-service.ts` |
| `bot.capabilities` | `{appointments, orders}` | `appointment-book`, `order-intake` |

Die vierte Ebene ist die folgenreichste: `bot.capabilities` ist **kundeneigene
Datenhaltung**. Ein Prüfpunkt, der sie liest, fragt den Kunden, ob er darf.

`FEATURE_RULES` bleibt davon unberührt — AP1 hat belegt, dass es das
Verbrauchsmodell speist und kein Freischaltungs-Vokabular ist. Die hier
gefundene dritte Ebene (`planAccess.ts`, `optimizer/entitlement.ts`) ist eine
andere und **entscheidet über Anzeige**.

---

## 3. Eine Kategorie fehlt

`sla.priority` passt in keine der fünf. Es ist eine **organisatorische
Zusage** — Reaktionszeit eines Menschen —, für die ein Software-Gate keinen
Sinn ergibt. Ich habe es `DISPLAY_ONLY` zugeordnet, weil es auf der
Preisseite steht und sonst nichts tut; richtiger wäre eine eigene Kategorie
wie `ORGANIZATIONAL`.

> **Verbindliche Lesart, festgelegt am 2026-08-25.**
>
> `sla.priority` = `DISPLAY_ONLY` **nur innerhalb des vorgegebenen
> Fünfer-Vokabulars; semantisch eine organisatorische Zusage, kein technisches
> Feature-Entitlement.**
>
> Der Zusatz steht hier, damit ein späterer Schritt nicht aus der
> Klassifikation den Kurzschluss zieht: „`DISPLAY_ONLY` → also Gate einbauen."
> Für diesen Key gibt es nichts zu sperren. Der Fünfer wurde für **technische**
> Entitlements definiert; eine organisatorische Zusage ist semantisch etwas
> anderes und wird von ihm nur mangels Alternative aufgenommen.

Das betrifft mindestens noch `org.governance` (Enterprise, Partner) außerhalb
dieser 16. Wer die Kategorien erweitert, sollte beide zusammen einordnen.

**Für die übrigen sechs `DISPLAY_ONLY`-Keys gilt der Kurzschluss ebenfalls
nicht** — aber aus einem anderen Grund: Dort *wäre* ein Gate möglich, ob es
eines geben soll, ist eine Produktfrage. Nur bei `sla.priority` ist die Frage
technisch gegenstandslos.

---

## 4. Was daraus **nicht** folgt

Kein Befund dieser Datei ist eine Entscheidung.

`DISPLAY_ONLY` heißt nicht „Lücke, die geschlossen werden muss". Bei
`sla.priority` wäre ein Gate sinnlos; bei `policy.iso27001` dagegen ist es
eine echte Frage, ob ein Growth-Kunde den NIS2-Pack aktivieren können soll,
den sein Plan nicht enthält.

`UNKNOWN` heißt nicht „kaputt". Bei `bots.human_handoff` ist die
wahrscheinlichere Erklärung, dass die Fähigkeit schlicht nicht gebaut ist —
dann gehört nicht ein Gate ergänzt, sondern die Zusage geprüft.

Die drei Fragen, die sich daraus für eine spätere Entscheidung ergeben:

1. **`webhooks.enabled`** ist der klarste Gate-Kandidat: technischer Zugang,
   seit AP2 auf Growth, ohne jeden Prüfpunkt.
2. **`bots.appointments` / `bots.orders`** — soll das Kundenflag gegen den
   Plan geprüft werden, und wenn ja, beim Setzen oder beim Nutzen?
3. **`bots.human_handoff`, `bots.multi_channel`, `whitelabel.*`,
   `governance.risk_register`** — existiert die Fähigkeit überhaupt? Wenn
   nein, ist die Zusage das Problem, nicht das fehlende Gate.
