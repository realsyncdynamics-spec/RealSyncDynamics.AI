# Claims-Reality-Audit — Teil 2

**Stand: 2026-08-24, gemessen auf `7365de1`.** Read-only: kein Code geändert,
keine Migration ausgeführt, kein Stripe-Objekt angefasst.

Auftrag des Eigentümers: Enforcement-Matrix der Entitlement-Keys, Prüfung der
Usage-Kontingente **zuerst** (Kostenrisiko), Compliance-Claims-Kette für NIS2,
ISO 27001, TISAX und DORA. Vorgehen: **messen → belegen → klassifizieren →
stoppen.**

Klassifikation nach Vorgabe:

| Status | Bedeutung |
|---|---|
| `HARD` | Vor der Nutzung serverseitig geprüft, Verstoß wird abgewiesen |
| `SOFT` | Verbrauch wird gebucht, aber nicht begrenzt — nachträglich sichtbar |
| `DISPLAY_ONLY` | Nur die Oberfläche entscheidet |
| `NOT_APPLICABLE` | Kein Gate nötig oder keinem Plan zugeordnet |
| `UNKNOWN` | Kein Prüfpunkt gefunden, Zweck unklar — gehört geklärt, nicht geraten |

---

## 0. Korrektur einer Aussage aus Teil 1

Teil 1 hat behauptet, **fünf** Kontingente würden „nur gebucht, nicht
begrenzt": Voice-Minuten, Automationsläufe, AI-Token, AI-Calls und
WhatsApp-Konversationen.

**Das war zu grob und in drei von fünf Fällen falsch.** Die Messung hat nur
nach `consumeUsage()` gesucht. Tatsächlich gibt es einen zweiten, gleichwertigen
Weg: eine eigene Vorprüfung mit `getCurrentTotal()` plus Vergleich, die mit
`402 QUOTA_EXCEEDED` abbricht. Automationsläufe, AI-Calls und AI-Token nutzen
genau den — sie sind **HARD**, nicht SOFT.

Die Lehre ist dieselbe wie beim `tenant_entitlements`-Fund: Ein Muster zu
zählen ist keine Messung des Verhaltens. Erst das Lesen der Aufrufstelle
entscheidet.

---

## 1. Kontingente — die vollständige Tabelle

`billing_mode` aus `usage_limits_config` sagt, was **beabsichtigt** ist;
die Spalte daneben, was tatsächlich passiert.

| Key | Absicht | Durchsetzung | Wo | Bewertung |
|---|---|---|---|---|
| `limit.bot_messages_monthly` | included | **HARD** | `consumeUsage` in `bot-chat`, `whatsapp-webhook` | deckt sich |
| `limit.bulk_jobs_monthly` | included | **HARD** | `consumeUsage` in `bulk-scan` | deckt sich |
| `limit.automation_runs_monthly` | included | **HARD** | Vorprüfung → 402 in `automation-trigger` | deckt sich |
| `limit.workflow_runs_monthly` | included | **HARD** | Vorprüfung → 402 in `workflow-trigger` | deckt sich |
| `limit.ai_calls_monthly` | included | **HARD** | Vorprüfung → 402 in `_shared/ai.ts` | deckt sich |
| `limit.ai_tokens_monthly` | metered | **HARD** | Vorprüfung, projiziert → 402 | **strenger als vorgesehen** |
| `limit.ai_cost_monthly_cents` | overage | SOFT | `recordUsage` | deckt sich |
| `limit.agent_runs_monthly` | metered | SOFT | `recordUsage`, Overage über `stripe-meter-sync` | deckt sich |
| `limit.bot_voice_minutes_monthly` | metered | SOFT | `recordUsage` nach dem Anruf | deckt sich |
| `limit.whatsapp_conversations_monthly` | metered | SOFT | `recordUsage` | deckt sich |
| `limit.api_calls_monthly` | metered | **KEINE** | — | ⚠️ kein Verbrauchspunkt |
| `limit.team_seats` | included | **KEINE** | — | ⚠️ |
| `limit.compliance_exports_monthly` | included | **KEINE** | — | ⚠️ |
| `limit.domains` | — | **KEINE** | — | ⚠️ |
| `limit.bots` | — | **KEINE** | — | ⚠️ |
| `limit.llm_queries_monthly` | — | **KEINE** | — | ⚠️ |
| `limit.evidence_storage_gb` | — | **KEINE** | — | ⚠️ |
| `limit.active_assets` | included | **KEINE** | keinem Plan zugeordnet | — |
| `limit.monthly_registrations` | included | **KEINE** | keinem Plan zugeordnet | — |

### 1.1 Sieben Kontingente werden verkauft, aber nie geprüft

`limit.team_seats`, `limit.domains`, `limit.bots`,
`limit.compliance_exports_monthly`, `limit.llm_queries_monthly`,
`limit.evidence_storage_gb` und `limit.api_calls_monthly` stehen in
`product_entitlements` — sie sind also je Plan **vergeben** — und kommen in
keiner Edge Function vor. Die Zahl auf der Preisseite hat zur Laufzeit keine
Entsprechung.

`limit.team_seats` trägt in `usage_limits_config` sogar den Kommentar
„checked at invitation time". Ein solcher Prüfpunkt existiert im Repo nicht.

### 1.2 Der globale Riegel ist überall leer

`consumeUsage()` kennt neben der Plan-Grenze einen zweiten Riegel aus
`usage_limits_config.hard_limit`. **Alle 15 Zeilen dort tragen `NULL`.** Es
gibt also keinen Auffangwert; die einzige wirksame Grenze ist die aus
`tenant_entitlements()`.

Das erweitert die Tragweite des Fundes aus Teil 1 erheblich: Solange der
Auflöser dem Server nichts lieferte, war **jedes** Kontingent wirkungslos —
auch die vier mit eigener Vorprüfung, denn alle lesen den Wert über
`admin.rpc('tenant_entitlements')` und prüfen mit `typeof x === 'number'`.
Bei `undefined` wird die Prüfung stillschweigend übersprungen. `20260831020000`
repariert alle gemeinsam.

---

## 2. Der folgenreichste Befund: die Überwachung ist nicht durchgesetzt

Das Produktversprechen lautet: *Der Scan ist kostenlos, verkauft wird die
dauerhafte Überwachung.* Genau diese ist nicht abgesichert.

`governance-monitoring-scheduler` wählt seine Arbeit so aus:

```
from('monitoring_sources').select('*').eq('status', 'active')
```

**Kein Plan-Filter, keine Entitlement-Prüfung.** `audit-recheck-weekly`
enthält überhaupt keinen Entitlement-Bezug. Die Keys `monitoring.monthly`,
`monitoring.daily` und `monitoring.drift` haben im gesamten
Function-Verzeichnis keine Prüfstelle — der Treffer im Scheduler ist der
Name eines Cron-Jobs (`'governance-monitoring-daily'`), keine Berechtigung.

Damit gilt: Wer eine `monitoring_sources`-Zeile auf `active` hat, wird
überwacht — unabhängig davon, ob sein Plan tägliche Läufe, monatliche oder
gar keine enthält.

**Das ist keine Preisfrage, sondern die Kernleistung.** Es gehört als eigener
Arbeitsschritt entschieden, nicht nebenbei behoben: Die richtige Auflösung
könnte ein Gate im Scheduler sein, könnte aber auch heißen, dass
`monitoring_sources` beim Anlegen bereits nach Plan begrenzt wird.

---

## 3. Klassifikation aller 73 Keys

Automatisch erhoben (Vorkommen je Key in `supabase/functions`, `src`, `test`),
danach für die folgenreichsten Fälle von Hand nachgelesen. **Die
`DISPLAY_ONLY`- und `UNKNOWN`-Spalten sind eine Arbeitsgrundlage, kein
Urteil** — jede Zeile braucht dieselbe Handprüfung, die §1 und §2 bekommen
haben.

| Status | Anzahl | Bedeutung im Befund |
|---|---:|---|
| `HARD` | 20 | serverseitiger Prüfpunkt belegt |
| `SOFT` | 7 | Kontingent ohne Prüfpunkt — die Liste aus §1.1 |
| `DISPLAY_ONLY` | 19 | nur im Browser referenziert |
| `UNKNOWN` | 19 | weder Backend noch Frontend gefunden |
| `NOT_APPLICABLE` | 8 | keinem Plan zugeordnet |

### 3.1 `HARD` — belegt geprüft

`ai.tool.automations` · `ai.tool.workflows` · `bots.enabled` · `bots.voice` ·
`bots.whatsapp` · `bulk.jobs` · `evidence.advanced` · `policy.packs` ·
`provenance.advanced` · `scheduler.enabled` — plus die zehn Kontingente aus §1
mit Prüf- oder Buchungspunkt.

### 3.2 `UNKNOWN` — die Liste, die als Nächstes drankommt

`ai.tool.bot_reply` · `alerts.email` · `bots.appointments` · `bots.chat` ·
`bots.human_handoff` · `bots.multi_channel` · `bots.orders` · `dse.generator` ·
`fix.snippets` · `governance.risk_register` · **`monitoring.daily`** ·
**`monitoring.drift`** · **`monitoring.monthly`** · `policy.iso27001` ·
`policy.nis2` · `sla.priority` · `webhooks.enabled` · `whitelabel.dashboard` ·
`whitelabel.reports`

Drei davon sind in §2 bereits geklärt und sind echte Lücken. Bei den übrigen
ist offen, ob sie einen Prüfpunkt brauchen. Beispiele für beide Richtungen:

- `sla.priority` beschreibt eine **organisatorische** Zusage (Reaktionszeit).
  Ein Software-Gate wäre hier sinnlos — vermutlich `NOT_APPLICABLE`.
- `webhooks.enabled` liegt seit AP2 auf Growth und beschreibt einen
  technischen Zugang. Ohne Prüfpunkt wäre das eine echte Lücke.

Der Unterschied ist nicht aus dem Namen ablesbar. Er gehört gemessen.

### 3.3 `NOT_APPLICABLE` — keinem Plan zugeordnet

`ai.tool.code_explain` · `ai.tool.log_analyze` · `barcode.issue` ·
`limit.active_assets` · `limit.monthly_registrations` · `provenance.basic` ·
`public-sector.mode` · `watermark.apply`

Sechs davon hängen ausschließlich an der stillzulegenden Fremdleiter
(`bronze`/`silver`/`gold`) — dieselbe Liste, die
`zielzustand-paketmodell.md` §2.2 als offene Frage führt.

---

## 4. Compliance-Claims — drei Ebenen, sauber getrennt

Der Auftrag verlangt ausdrücklich die Trennung:

```
Policy Pack vorhanden
        ↓
Controls / Assessment technisch vorhanden
        ↓
Marketing-Aussage zulässig
```

### Ebene 1 — Policy Pack vorhanden

Belegt. `policy_pack_controls` und `framework_controls` existieren,
`20260702120000_policy_pack_full_catalogs.sql` trägt 192 Control-Zeilen:

| Pack | Controls im Katalog |
|---|---:|
| `dsgvo-essentials` | 19 |
| `dora-financial` | 17 |
| `nis2-cybersecurity` | 13 |
| `tisax-automotive` | 6 |

ISO 27001 hat eine eigene Migration (`20260705070000_iso_controls.sql`),
ISO 42001 einen eigenen Katalog (`20260708000000`).

### Ebene 2 — Controls und Assessment technisch vorhanden

**Nur teilweise.** Eine Assessment-Tabelle existiert für den EU AI Act
(`ai_act_assessments`). Für NIS2, ISO 27001, TISAX und DORA wurde **keine
eigene Assessment- oder Bewertungsmaschinerie** gefunden — die Rahmenwerke
existieren als Control-Kataloge und als Entitlement-Keys, nicht als geführter
Prüfprozess.

Dazu kommt: `policy.nis2` und `policy.iso27001` stehen in §3.2 unter
`UNKNOWN` — sie haben keinen Prüfpunkt. Gegated ist nur der Sammel-Key
`policy.packs` in `policy-packs`. Ein Growth-Kunde ohne `policy.nis2` würde
also nicht daran gehindert, den NIS2-Pack zu laden — das ist zu prüfen und
gehört zur `UNKNOWN`-Abarbeitung.

### Ebene 3 — welche Aussage zulässig ist

**Diese Ebene ist keine technische Messung und wird hier nicht entschieden.**
Was der Befund trägt und was nicht:

| Aussage | trägt der Befund? |
|---|---|
| „Control-Katalog für NIS2, DORA, TISAX, ISO 27001 vorhanden" | **ja** |
| „Governance-Score je Rahmenwerk" | für DSGVO und EU AI Act belegt; für die übrigen **nicht geprüft** |
| „Geführtes Assessment für NIS2 / ISO / TISAX / DORA" | **nein** — nur der AI Act hat eine Assessment-Tabelle |
| „NIS2-konform" / „ISO-27001-zertifiziert" | **nein.** Ein Control-Katalog ist kein Nachweis und keine Zertifizierung |

Dreizehn Control-Zeilen sind ein Katalog, keine Konformität. Ob sechs
TISAX-Controls das Rahmenwerk sinnvoll abbilden, ist eine fachliche Frage —
sie gehört einem Menschen mit Fachkunde gestellt, nicht aus der Zeilenzahl
beantwortet.

---

## 5. Was daraus folgt — und was ausdrücklich nicht

**Nicht getan und nicht vorgeschlagen:** kein Gate nachgerüstet, kein
Kontingent geändert, kein Claim umformuliert. Der Auftrag lautete messen und
klassifizieren.

Die drei Arbeitspakete, die dieser Befund nahelegt, in der Reihenfolge ihres
Gewichts:

1. **Überwachung durchsetzen** (§2). Betrifft die Kernleistung.
2. **Die sieben unbewachten Kontingente** (§1.1) — je Kontingent entscheiden:
   Prüfpunkt nachrüsten, auf `metered` umstellen oder als reine Anzeige
   kennzeichnen.
3. **Die 19 `UNKNOWN`-Keys** (§3.2) einzeln nachlesen, mit demselben
   Beleg-Anspruch wie §1 und §2.

Für alle drei gilt, was der `tenant_entitlements`-Fund gezeigt hat: Ein
grüner Test für den einen Aufrufer bestätigt beinahe eine kaputte Kette für
den anderen. Jede Zugriffsregel braucht die Gegenprobe für **jeden**
Aufrufer, den es gibt.
