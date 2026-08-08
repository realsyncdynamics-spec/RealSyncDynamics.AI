# Archiv: manuell deployte Edge Functions

Diese Functions existierten **ausschließlich in Produktion**. Sie wurden nicht
über `supabase/functions/` und den Deploy-Workflow ausgeliefert, sondern per
Hand über das Dashboard — erkennbar am `entrypoint_path`, der auf
`file:///tmp/user_fn_…` zeigt statt auf den Repo-Pfad des CI-Runners.

Damit sind sie nie durch ein Review gegangen, tauchen in keinem Diff auf und
wären beim Löschen **unwiederbringlich** gewesen. Dieses Verzeichnis sichert
ihren Quellstand vom **2026-08-08**, damit die Löschung reversibel wird.

Sie sind auf `scripts/edge-function-drift-allowlist.json` geführt, gehören
also zum bekannten Drift und sind kein Versehen des Drift-Checks.

## Warum sie weg sollen

Zwei Gründe, beide unabhängig voneinander ausreichend:

1. **Kapazität.** Das Projekt steht bei 100/100 belegten Edge-Function-Slots;
   der Deploy-Job scheitert mit `402 — Max number of functions reached`.
   Jede neue Function ist bis zur Freigabe nicht deploybar.
   Siehe `docs/runbooks/release-train-phase2.md` § Stage 0.5.

2. **Angriffsfläche.** Zwei der drei sind einmalige Admin-Werkzeuge, die
   dauerhaft erreichbar geblieben sind (siehe unten).

## Inventar

| Function | `verify_jwt` | Zustand | Bewertung |
|---|---|---|---|
| `debug-secret-shape` | true | bereits 2026-05-28 auf einen 410-Stub zurückgebaut | harmlos, reiner Slot-Verbrauch |
| `stripe-webhook-fixer` | **false** | funktionsfähig | schreibt `stripe_secret_key` in den Vault; Gate ist ein Shared Secret **aus dem Vault** — sauber gelöst |
| `stripe-webhook-provision` | **false** | funktionsfähig | Gate war ein **Klartext-Literal im Quelltext**; kann Stripe-Webhook-Endpunkte löschen/neu anlegen und `stripe_webhook_secret` überschreiben |

### `stripe-webhook-provision` — der kritische Fall

Die Function ist ohne JWT erreichbar und prüft allein den Header
`x-provision-token` gegen eine im Quelltext hinterlegte Konstante. Wer diesen
Wert kennt, kann den produktiven Stripe-Webhook-Endpunkt löschen, neu anlegen
und das Signing Secret im Vault überschreiben — also die Zahlungsstrecke
unterbrechen.

Weil der Wert nur im Code stand und nie rotiert wurde, gilt er als
kompromittierbar. Im Archiv ist er durch einen Platzhalter ersetzt; er soll
nicht in die Git-History wandern. Mit dem Löschen der Live-Function wird er
gegenstandslos.

**Wird eine dieser Functions je reaktiviert**, gehört sie in
`supabase/functions/` mit echter Authentifizierung — Gate-Token in den Vault,
nicht in den Quelltext.

## Löschen

Aus einer Umgebung mit Supabase-CLI und `SUPABASE_ACCESS_TOKEN`:

```bash
supabase functions delete debug-secret-shape       --project-ref ebljyceifhnlzhjfyxup
supabase functions delete stripe-webhook-fixer     --project-ref ebljyceifhnlzhjfyxup
supabase functions delete stripe-webhook-provision --project-ref ebljyceifhnlzhjfyxup
```

Danach prüfen:

```bash
supabase functions list --project-ref ebljyceifhnlzhjfyxup | wc -l   # erwartet: 97
npm run check:edge-functions                                         # muss grün sein
```
