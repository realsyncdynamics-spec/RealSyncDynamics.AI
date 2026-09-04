# Archiv: gelöschte, manuell deployte Edge Functions

Quellstand dreier Edge Functions, die **am 2026-08-11 aus Produktion gelöscht**
wurden (Selective P0 Auth Free Slot Workflow, siehe
`scripts/edge-function-drift-allowlist.json` und
`docs/runbooks/edge-function-kontingent.md`).

Diese Functions lagen **nie im Repository**. Sie wurden per Hand über das
Dashboard deployt — erkennbar am `entrypoint_path`, der auf
`file:///tmp/user_fn_…` zeigte statt auf den Repo-Pfad des CI-Runners. Sie sind
also nie durch ein Review gegangen und tauchen in keinem Diff auf.

## Warum das hier liegt

Mit der Löschung war ihr Quellcode **nirgends mehr vorhanden** — weder im Repo
noch in Produktion. Für ein Produkt, das Prüfpfad und Nachvollziehbarkeit
zusagt, ist das die falsche Richtung: Zwei der drei haben produktive
Stripe-Konfiguration verändert und Secrets in den Vault geschrieben. Wer später
rekonstruieren muss, warum `stripe_webhook_secret` rotiert wurde oder welcher
Endpunkt einen Webhook angelegt hat, findet ohne diese Dateien nichts.

Der Stand wurde am **2026-08-08** über die Management-API aus den damals noch
laufenden Functions geholt, also **vor** der Löschung.

## Inventar

| Function | `verify_jwt` | Zustand bei der Sicherung | Bewertung |
|---|---|---|---|
| `debug-secret-shape` | true | bereits 2026-05-28 auf einen 410-Stub zurückgebaut | harmlos, kein inhaltlicher Verlust |
| `stripe-webhook-fixer` | **false** | funktionsfähig | schrieb `stripe_secret_key` in den Vault; Gate war ein Shared Secret **aus dem Vault** — sauber gelöst |
| `stripe-webhook-provision` | **false** | funktionsfähig | Gate war ein **Klartext-Literal im Quelltext**; konnte Stripe-Webhook-Endpunkte löschen/neu anlegen und `stripe_webhook_secret` überschreiben |

### `stripe-webhook-provision` — warum die Löschung richtig war

Die Function war ohne JWT erreichbar und prüfte allein den Header
`x-provision-token` gegen eine im Quelltext hinterlegte Konstante. Wer diesen
Wert kannte, konnte den produktiven Stripe-Webhook-Endpunkt löschen, neu anlegen
und das Signing Secret im Vault überschreiben — also die Zahlungsstrecke
unterbrechen.

Der Wert stand nur im Code und wurde nie rotiert. **Im Archiv ist er durch einen
Platzhalter ersetzt**, damit er nicht in die Git-History wandert; mit der
Löschung der Live-Function ist er ohnehin gegenstandslos.

## Nicht enthalten

Zwei weitere Functions wurden im selben Zuge gelöscht, ihr Quellcode wurde hier
aber **nicht gesichert**:

- `vault-set-secret`
- `vault-key-setter`

Sie waren zum Zeitpunkt der Sicherung ausdrücklich zum Behalten vorgesehen, weil
die Runbooks `stripe-production-checkout.md` und `resend-production-email.md` auf
`vault-set-secret` verwiesen. Ob ihr Quellcode vor der Löschung anderweitig
gesichert wurde, ist aus dem Repository nicht erkennbar. Falls nicht, ist er
verloren.

## Regel daraus

Wird eine Edge Function gelöscht, die **nicht** aus `supabase/functions/` stammt,
gehört ihr Quellstand vorher hierher:

```bash
supabase functions download <slug> --project-ref ebljyceifhnlzhjfyxup
```

Wird eine dieser Functions je reaktiviert, gehört sie nach
`supabase/functions/` mit echter Authentifizierung — Gate-Token in den Vault,
nicht in den Quelltext.
