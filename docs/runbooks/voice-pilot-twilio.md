# Runbook: Voice-Pilot über Twilio (VIO-01)

Stand 25.11.2026 · Pfad nach K6: Twilio (`bot-voice-webhook`). Grok Realtime
(`apps/agent-runtime`) und ElevenLabs (`provision-voice-agent`) bleiben aus.
Grundlage: VIO-Bestandsbericht vom 25.11.2026.

> **Jeder Schritt mit Produktionswirkung braucht eine Einzel-Freigabe des Inhabers:**
> Rufnummernkauf, Secrets setzen, Deploy, Datenbankschreibzugriff, Cron-Aktivierung,
> kostenpflichtiger Testanruf (AGENTS.md „Freigaben“, K6). Dieses Runbook beschreibt
> die Schritte, es führt keinen aus. Agenten führen sie nicht aus.

## 0. Ist-Zustand Produktion (gemessen 25.11.2026, nur lesend)

| Prüfung | Wert |
|---|---|
| `bot-voice-webhook` | deployt (v34, 18.11.2026), `verify_jwt = false` |
| `bot-voice-enforcer` | deployt (v7), **Cron-Job inaktiv** |
| `voice_number_bindings` | 0 Zeilen |
| Voice-Gespräche (`bot_conversations.channel = 'voice'`) | 0 |
| Voice-Migrationen bis `20261118120000` | angewandt |

## 1. Voraussetzungen (vor dem ersten Anruf)

| # | Voraussetzung | Prüfung | Verantwortlich |
|---|---|---|---|
| V1 | KI-Offenlegung im ersten Gesprächsschritt deployt (VIO-01a, `_shared/voice-disclosure.ts`) | Deploy-Lauf nach Merge, Version von `bot-voice-webhook` > 34 | REA, Freigabe Inhaber |
| V2 | Mandant hat `bots.voice` und `limit.bot_voice_minutes_monthly > 0` | SQL 3.1 | REA/DATA |
| V3 | Mandant hat eine Kostenbremse > 0 (`bot_usage_limits`), Pilotgrenze K6: 60 / 250 / 750 Min. | SQL 3.1 | REA/DATA |
| V4 | Bot existiert, `channel = 'voice'`, gehört zum Mandanten, ist aktiv | SQL 3.1 | VIO |
| V5 | Function Secrets `TWILIO_AUTH_TOKEN`, `TWILIO_WEBHOOK_URL` gesetzt (nur Namen dokumentieren, nie Werte) | Supabase Dashboard → Edge Functions → Secrets | Inhaber |
| V6 | Vault `cron_bot_voice_enforcer_key` und Function Secret `CRON_BOT_VOICE_ENFORCER_KEY` mit demselben Wert | `docs/runbooks/cron-vault-secrets.md` | Inhaber |
| V7 | NOVA-01 abgeschlossen (AVV Twilio, Transkription, Speicherfristen, Anruferinformation) | NOVA-Bericht | NOVA |

Fehlt V2 oder V3, lehnt der Webhook jeden Anruf vor der Annahme ab (`<Reject reason="busy"/>`,
keine Kosten). Das ist gewollt (fail-closed) und kein Fehler des Webhooks.

## 2. Twilio-Konfiguration (Inhaber, nach Freigabe des Nummernkaufs)

- Rufnummer: deutsche Ortsnummer. Für deutsche Nummern verlangt Twilio ein Regulatory Bundle,
  dessen Bearbeitung kann dauern.
- *A call comes in*: Webhook, `HTTP POST`, URL = exakt der Wert von `TWILIO_WEBHOOK_URL`
  (öffentliche URL von `bot-voice-webhook`, ohne Query).
- *Call status changes* (Status Callback): dieselbe URL, `HTTP POST`. Ohne Status-Callback
  rechnet der Aufräumjob die Reservierung zum Höchstbetrag ab.
- Keine Aufzeichnung aktivieren (`Record` aus). Transkripte entstehen über `<Gather input="speech">`.

## 3. Rufnummer binden (administrativer Prozess)

Es gibt bewusst keine UI und keine Function dafür: Eine falsche Bindung leitet Anrufe an einen
fremden Mandanten. Die Bindung schreibt der Inhaber per SQL im Supabase-SQL-Editor
(Service-Rolle), mit Vier-Augen-Prüfung der beiden IDs.

### 3.1 Vorprüfung (nur lesend)

```sql
-- :tenant_id, :bot_id einsetzen
select b.id, b.tenant_id, b.channel, b.enabled,
       (select value from public.tenant_entitlements(b.tenant_id) e where e.key = 'bots.voice') as bots_voice,
       (select value from public.tenant_entitlements(b.tenant_id) e where e.key = 'limit.bot_voice_minutes_monthly') as voice_minutes,
       l.voice_seconds_monthly, l.cost_eur_monthly, l.plan_profile
from public.bots b
left join public.bot_usage_limits l on l.tenant_id = b.tenant_id
where b.id = :'bot_id' and b.tenant_id = :'tenant_id';
```

Erwartung: genau eine Zeile, `channel = 'voice'`, `enabled = true`, `bots_voice = 1`,
`voice_minutes > 0`, `voice_seconds_monthly > 0`, `cost_eur_monthly > 0`.

### 3.2 Bindung anlegen (schreibend, Einzel-Freigabe)

Die Nummer wird nur gebunden, wenn Bot und Mandant zusammengehören und der Bot ein Voice-Bot
ist. Sonst wird keine Zeile eingefügt und der Block bricht ab.

```sql
begin;
insert into public.voice_number_bindings
  (tenant_id, bot_id, phone_number_e164, telephony_provider, provider_ref, status)
select b.tenant_id, b.id, :'number_e164', 'twilio', :'twilio_number_sid', 'active'
from public.bots b
where b.id = :'bot_id' and b.tenant_id = :'tenant_id' and b.channel = 'voice' and b.enabled
returning id, tenant_id, bot_id, phone_number_e164, status;
-- Genau eine Zeile? Sonst: rollback;
commit;
```

- `phone_number_e164` im Format `+49…` ohne Leerzeichen (CHECK der Tabelle).
- Der Unique-Index `uq_voice_number_bindings_active_number` verhindert, dass dieselbe Nummer
  zwei aktiven Bindungen gehört (mandantenübergreifend).
- Der Webhook prüft zusätzlich `resolveBot(tenant_id, bot_id)`: Ein Bot eines anderen Mandanten
  führt zu `<Reject>`.

### 3.3 Optional: eigener Wortlaut der KI-Offenlegung

Ohne Eintrag gilt der Standardsatz „Hinweis: Sie sprechen mit einem KI-Assistenten.“
Ein eigener Text muss das Wort „KI“ oder „künstliche Intelligenz“ enthalten und darf höchstens
300 Zeichen lang sein, sonst gilt der Standardsatz (`_shared/voice-disclosure.ts`). Gelesen wird
`voice_bot_configs.disclosure_text` für genau diesen Mandanten und Bot.

### 3.4 Bindung lösen (Rollback)

```sql
update public.voice_number_bindings set status = 'released', updated_at = now()
where phone_number_e164 = :'number_e164' and tenant_id = :'tenant_id';
```

Danach sagt der Webhook „Diese Rufnummer ist derzeit nicht vergeben.“

## 4. Enforcer-Cron aktivieren (Einzel-Freigabe)

Erst nach V6. Ebene 1 (TimeLimit beim Anbieter) und Ebene 3 (Prüfung je Gesprächsschritt)
wirken auch ohne Cron. Ebene 2 beendet überfällige Anrufe auch dann, wenn kein weiterer Webhook kommt.

```sql
select jobid, jobname, schedule, active from cron.job where jobname = 'bot-voice-enforcer';
select cron.alter_job(job_id := (select jobid from cron.job where jobname = 'bot-voice-enforcer'), active := true);
```

Prüfung nach 2 Minuten: `cron.job_run_details` für den Job ohne Fehler, Function-Log ohne
`CRON_KEY_MISSING`/401. Zurück: dieselbe Anweisung mit `active := false`.

## 5. Abnahme (Reihenfolge: kostenfrei → kostenpflichtig)

| # | Test | Kosten | Erwartung |
|---|---|---|---|
| A1 | `POST` ohne `X-Twilio-Signature` an `bot-voice-webhook` | keine | `403 forbidden` |
| A2 | JSON-Testkanal mit Mitglieds-JWT, ohne `message` | keine Telefonie | `reply` beginnt mit der Offenlegung |
| A3 | Anruf auf die gebundene Nummer (**Einzel-Freigabe**) | Twilio + KI | erster Satz = KI-Offenlegung, danach Begrüßung |
| A4 | Nach dem Auflegen | — | genau eine `bot_usage_reservations`-Zeile `settled`, Kosten in `bot_voice_call_costs` |
| A5 | Status-Callback doppelt zustellen | — | keine zweite Buchung (`duplicate`) |
| A6 | Gespräch in `/app/bots/inbox` | — | Transkript sichtbar, nur im eigenen Mandanten |
| A7 | Anruf mit Budget 0 (Testmandant) | keine | `<Reject reason="busy"/>`, keine Ansage |
| A8 | Anruf länger als die Reservierung | Twilio | Abschlussansage, Rückrufwunsch gespeichert, Auflegen |

Eine Funktion gilt erst nach A3 bis A6 als **LIVE** (K6, DEPUTY-01).

## 6. Was dieses Runbook nicht abdeckt

- Strukturierte Erfassung von Anliegen, Terminwunsch und Dringlichkeit samt Benachrichtigung
  des Betriebs (VIO-02).
- Verbindung Voice-Abo → Entitlement → Kostenbremse (REA, Deploy-Reihenfolge `stripe-webhook`
  vor `checkout-voice-agent`).
- Tarife und Mehrverbrauch (DATA-01, K6: harte Grenze im Pilot).
