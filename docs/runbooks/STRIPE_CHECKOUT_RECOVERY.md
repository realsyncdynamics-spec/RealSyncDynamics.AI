# Stripe Checkout Recovery — Operationscheckliste

**Datum**: 2026-09-04  
**Betroffene Komponente**: Edge Function `supabase/functions/stripe-checkout/`  
**Status**: 🔴 Production Down — Conversion-Blocker  

---

## Diagnose

### Was funktioniert
- ✅ **Edge Function ist deployed** — `stripe-checkout` läuft, antwortet mit HTTP
- ✅ **Code-Struktur ist korrekt** — Alle Syntax-Checks grün, keine Parse-Fehler
- ✅ **Abhängigkeiten sind vorhanden** — `_shared/gateway.ts` und `_shared/pricing.generated.ts` existieren
- ✅ **Auth-Flow funktioniert** — JWT-Validierung, Tenant-Zugehörigkeit wird korrekt geprüft
- ✅ **Error-Handling ist implementiert** — Vier verschiedene Fehlerausgänge sind vorgesehen

### Was bricht
Die Edge Function gibt **HTTP 400: `PRICE_NOT_CONFIGURED`** zurück.

```typescript
// supabase/functions/stripe-checkout/index.ts, Zeile 181–184
const isLiveStripePrice = (id: string | null | undefined): boolean =>
  typeof id === 'string' && id.startsWith('price_');
const realPrice = (products ?? []).find((p) => isLiveStripePrice(p.stripe_price_id));
if (!realPrice) {
  return jsonError(400, 'PRICE_NOT_CONFIGURED', 
    `no Stripe Price wired for plan_key=${body.plan_key}; ...`);
}
```

**Ursache**: Die `public.products` Tabelle enthält für den angeforderten `plan_key` (z.B. `starter`, `growth`) 
**keine echte Stripe-Price-ID** — oder die dort eingetragene ID beginnt nicht mit `price_`.

---

## Was du vor der Freigabe verifizieren musst

### Schritt 1: Lokale Umgebung testen (optional, aber empfohlen)

```bash
# 1.1 Dev-Server starten
npm run dev

# 1.2 Einen Browser-Tab öffnen, anmelden und zum Checkout navigieren
# http://localhost:3000/checkout/growth

# 1.3 Developer Console (F12) offenlassen — dort siehst du die Error-Response
```

**Erwarteter Fehler heute** (vor Setup):
```json
{
  "ok": false,
  "error": {
    "code": "PRICE_NOT_CONFIGURED",
    "message": "no Stripe Price wired for plan_key=growth; insert a real price_xxx..."
  }
}
```

### Schritt 2: GitHub Actions Secrets setzen

**Ort**: GitHub Repo → Settings → Secrets and variables → Actions

**Zu setzen:**

| Secret | Wert | Quelle |
|--------|------|--------|
| `CLOUDFLARE_API_TOKEN` | Cloudflare API Token | Cloudflare Dashboard → Mein Profil → API-Tokens → Global Scope |
| `CLOUDFLARE_ACCOUNT_ID` | Deine Cloudflare Account ID | Cloudflare Dashboard → oben rechts oder Übersicht |
| `VITE_SUPABASE_URL` | `https://ebljyceifhnlzhjfyxup.supabase.co` | bereits vorhanden, ggf. überprüfen |
| `VITE_SUPABASE_ANON_KEY` | Supabase anon key | Supabase Dashboard → Einstellungen → API |

**Nach dem Setzen:** Workflow manuell triggern (siehe Schritt 3).

### Schritt 3: Supabase Vault Secret setzen

**Ort**: Supabase Live-Projekt (`RealSyncDynamicsLive`) → SQL Editor

**SQL ausführen:**

```sql
-- Stripe Secret in den Vault legen
-- Quelle: Stripe Live-Dashboard → API Keys → Secret Key (Kopieren)
SELECT public.set_app_secret('stripe_secret_key', 'sk_live_YOUR_KEY_HERE');

-- Verifizieren (sollte true zurückgeben)
SELECT public.get_app_secret('stripe_secret_key') IS NOT NULL;
```

**⚠️ Wichtig**:
- `sk_live_*` verwenden (**nicht** `sk_test_*` im Live-Projekt)
- Den Key **niemals** in Logs oder Commits speichern
- `set_app_secret()` speichert im Vault, nicht in `public.app_secrets` (die ist schreibgeschützt)

### Schritt 4: Stripe Price IDs in die Datenbank eintragen

**Ort**: Supabase Live-Projekt → SQL Editor (oder Supabase Studio → Browser)

**Pläne und ihre erforderlichen Price IDs:**

| Plan Key | Monatlich | Jahresabonnement |
|----------|-----------|------------------|
| `free_audit` | — (keine Checkout) | — |
| `starter` | `price_1Pxx...` | `price_1Pxx...` |
| `growth` | `price_1Pxx...` | `price_1Pxx...` |
| `enterprise` | `price_1Pxx...` | `price_1Pxx...` (falls verkauft) |

**SQL — aktuelle Einträge anschauen:**

```sql
SELECT id, stripe_price_id, default_for_plan_key, name
FROM public.products
ORDER BY default_for_plan_key
LIMIT 10;
```

**Erwartete Spalte `stripe_price_id`**: muss mit `price_` beginnen, z.B. `price_1PKNG0IUXXXXXXXXXXrxXx`

**SQL — ein Product aktualisieren:**

```sql
UPDATE public.products
SET stripe_price_id = 'price_1PKNG0IUXXXXXXXXXXrxXx'
WHERE default_for_plan_key = 'starter' AND stripe_price_id LIKE 'internal%';
```

**Schritte:**
1. In **Stripe Live-Dashboard** für jeden Plan die `price_xxx` kopieren:
   - Billing → Products → Plan auswählen → Pricing-Seite
   - Rechts neben jedem Preis: **Copy ID**
2. Für jeden Plan ein `UPDATE` ausführen (oben)
3. Nach jedem Update verifizieren:
   ```sql
   SELECT stripe_price_id, default_for_plan_key 
   FROM public.products 
   WHERE default_for_plan_key IN ('starter', 'growth', 'enterprise');
   ```

### Schritt 5: Cloudflare DNS und Deploy-Workflow prüfen

**Ort A**: Cloudflare Dashboard → DNS-Einstellungen  
**Ort B**: GitHub → Actions → Deploy to Cloudflare Pages

**Checkliste:**

- [ ] DNS-Record für `realsyncdynamicsai.de` zeigt auf **Cloudflare Pages** (nicht GitHub Pages)
- [ ] GitHub-Secrets sind alle gesetzt (Schritt 2)
- [ ] Workflow `.github/workflows/deploy-cloudflare-pages.yml` ist aktiviert
- [ ] Letzter Deploy-Run ist **grün** ✅
  - Falls rot ❌: **Workflow manuell triggern**:
    - GitHub → Actions → „Deploy to Cloudflare Pages"
    - Run workflow → Branch `main` → Green button

**Nach erfolgreichem Deploy:**
```bash
# Verifizieren, dass / das neue Bolt-MainLanding zeigt
curl -s https://realsyncdynamicsai.de/ | grep -i "bolt\|earth"

# Erwartet: Irgendein Text aus der Bolt-Landing (z.B. "Earth at Night")
# Nicht erwartet: "PublicWorkspacePreview" oder "Governance OS"
```

---

## Test-Ablauf nach der Freigabe

### Test 1: Edge Function ist erreichbar und antwortet

```bash
# Terminal — einen JWT beschaffen
curl -s https://ebljyceifhnlzhjfyxup.supabase.co/auth/v1/token \
  -H "apikey: $(echo $VITE_SUPABASE_ANON_KEY)" \
  -H "content-type: application/json" \
  -d '{"email":"test@example.com","password":"test"}' | jq .access_token

# (Für einen echten Test: anmelden im Browser und Developer Console nutzen)
```

### Test 2: Checkout-Flow mit Testkarte

1. **Browser öffnen**: http://localhost:3000 (lokal) oder https://realsyncdynamicsai.de (live)
2. **Anmelden** (als Workspace-Owner oder Admin)
3. **Navigieren zu**: `/checkout/growth` oder `/app` → Pricing → Growth-Plan → „Jetzt bestellen"
4. **Erwartet**: Stripe Hosted Checkout öffnet sich
5. **Testkarte eingeben**:
   - Kartennummer: `4242 4242 4242 4242`
   - Ablaufdatum: `12/26` (oder später)
   - CVC: `123`
   - Name: `Test Customer`
6. **Klick**: „Bezahlen" oder „Abschließen"
7. **Erwartet nach erfolgreichem Checkout**:
   - Umleitung zu `/checkout/success?session_id=...`
   - Email-Bestätigung von Stripe (falls Live-Projekt)
   - Subscription in `public.subscriptions` sichtbar

### Test 3: Fehler-Szenarien (optional, zur Validierung)

**Szenario A**: Ungültiger `plan_key`
```json
POST /functions/v1/stripe-checkout
Body: { "tenant_id": "...", "plan_key": "invalid_plan" }
→ HTTP 400: UNKNOWN_PLAN
```

**Szenario B**: Legacy-Plan `agency`
```json
POST /functions/v1/stripe-checkout
Body: { "tenant_id": "...", "plan_key": "agency" }
→ HTTP 400: PLAN_RETIRED
```

**Szenario C**: Free Audit (darf nicht checkoutbar sein)
```json
POST /functions/v1/stripe-checkout
Body: { "tenant_id": "...", "plan_key": "free_audit" }
→ HTTP 400: BAD_REQUEST (Free Audit braucht keinen Checkout)
```

---

## Häufige Fehler und Lösungen

| Fehler | Symptom | Lösung |
|--------|---------|--------|
| **STRIPE_NOT_CONFIGURED** | Edge Function startet nicht, gibt 500 zurück | `STRIPE_SECRET_KEY` in Supabase Vault oder `.env` fehlt. Siehe Schritt 3. |
| **PRICE_NOT_CONFIGURED** | Checkout startet nicht, gibt 400 zurück | Stripe-Price-IDs in `public.products` fehlen oder beginnen nicht mit `price_`. Siehe Schritt 4. |
| **UNAUTHORIZED** | JWT wird nicht akzeptiert | Anmeldung fehlgeschlagen oder JWT ist abgelaufen. Neu anmelden. |
| **FORBIDDEN** | User ist kein Owner/Admin | Der angemeldete User hat nicht die Rolle `owner` oder `admin` für diesen Tenant. Berechtigungen in `public.memberships` prüfen. |
| **DNS zeigt noch auf alten Origin** | `/` zeigt alte Seite, aber `/pricing` ist neu | Cloudflare-DNS noch nicht auf Pages umgeleitet. Schritt 5A prüfen. |
| **Deploy-Workflow ist rot** | GitHub Actions zeigen Fehler | GitHub-Secrets (Schritt 2) sind nicht alle gesetzt oder falsch. Actions-Log lesen. |

---

## Rollback (falls nötig)

Falls nach dem Setup etwas schiefgeht:

1. **Lokale Edge Function zurücksetzen**:
   ```bash
   # Letzte funktionierende Version deployen
   git revert <Commit, der Fehler einführte>
   # Oder auf ein früheres Commit zurückgehen
   supabase functions deploy stripe-checkout
   ```

2. **Stripe Secret zurücksetzen**:
   ```sql
   SELECT public.set_app_secret('stripe_secret_key', 'sk_test_...');
   -- (auf Test-Wert zurücksetzen)
   ```

3. **Datenbank-Änderungen rückgängig machen**:
   ```sql
   UPDATE public.products
   SET stripe_price_id = 'internal_default_...'
   WHERE stripe_price_id LIKE 'price_%';
   ```

---

## Checkliste für die Freigabe

- [ ] Schritt 1: Lokales Setup validiert
- [ ] Schritt 2: GitHub Secrets gesetzt und getestet
- [ ] Schritt 3: Stripe Secret in Supabase Vault
- [ ] Schritt 4: Alle Plan-Price-IDs in `public.products` eingetragen
- [ ] Schritt 5: Cloudflare DNS und Deploy grün
- [ ] Test 1: Edge Function antwortet mit korrektem `plan_key`
- [ ] Test 2: Checkout-Flow mit Testkarte funktioniert
- [ ] Test 3: Fehler-Szenarien verhalten sich korrekt
- [ ] Live-URL (realsyncdynamicsai.de) zeigt Bolt-MainLanding
- [ ] Stripe Dashboard zeigt neue Subscription

**Nach erfolgreichem Test**: Deploy-Status auf #status-page / Slack aktualisieren.

---

## Kontakt & Eskalation

Falls ein Schritt nicht funktioniert:

1. **Edge-Function-Logs lesen**:
   - Supabase Dashboard → Functions → `stripe-checkout` → Logs
   - Dort sollte die genaue Fehlermeldung stehen

2. **GitHub Actions Log lesen**:
   - GitHub → Actions → Deploy-Workflow → fehlgeschlagener Run
   - Logs durchsuchen nach `CLOUDFLARE`, `SECRET`, `DEPLOY`

3. **Stripe Dashboard prüfen**:
   - Billing → Events → letzte API-Aufrufe prüfen
   - Entwickler-Modus: Test vs. Live unterscheiden

4. **Datenbank-Status**:
   ```sql
   -- Alle Secrets prüfen
   SELECT * FROM public.app_secrets;
   
   -- Alle Produkte mit Preisen
   SELECT stripe_price_id, default_for_plan_key FROM public.products;
   
   -- Letzte Checkout-Aufrufe (falls Edge-Log deprecated ist)
   SELECT error_code, error_message, created_at 
   FROM public.function_calls_log 
   WHERE function_name = 'stripe-checkout' 
   ORDER BY created_at DESC 
   LIMIT 10;
   ```

---

## Hintergrund: Warum der Fehler entstanden ist

Die Edge Function liest Stripe-Price-IDs aus `public.products` — aber dort waren vorher nur **Sentinel-Werte** 
eingetragen (z.B. `internal_default_starter`, `STRIPE_PRICE_STARTER_XXX`).

Die Funktion prüft seit dem 2026-08-30: `id.startsWith('price_')` — alle anderen Werte werden abgewiesen.
Das ist **intentional**, um kaputte Checkout-Sessions zu verhindern, bevor sie Stripe erreichen.

**Regulärer Betrieb**:
1. Stripe-Dashboard → Preis-ID kopieren (z.B. `price_1PKNG0IU...`)
2. In `public.products` eintragen (mit `UPDATE`)
3. Checkout funktioniert sofort

Die Prüfung steht im Code (Zeile 178–180 der `index.ts`), aber die Daten fehlen — deshalb ist **Schritt 4** der kritische Punkt.

