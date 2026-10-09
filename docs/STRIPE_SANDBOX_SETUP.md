# Stripe-Sandbox (Testmodus) für die Beta — Setup-Checkliste

Stand: Beta-Testversion. Solange nicht belegt ist, dass gekaufte Pakete im
Dashboard tatsächlich freischalten, laufen **alle Zahlungen gegen den
Stripe-Testmodus**. Es wird kein echtes Geld bewegt.

## Wie der Schalter funktioniert

| Ebene | Variable | Wirkung |
|---|---|---|
| Edge Functions | `STRIPE_MODE` | `live` (exakt) = Live. **Alles andere / nicht gesetzt = `test`.** |
| Frontend (Vite, Build-Zeit) | `VITE_STRIPE_MODE` | wie oben; verwirft im Testmodus `pk_live_…` und Live-Payment-Links |

Code: `supabase/functions/_shared/stripe-mode.ts`, `src/config/stripeMode.ts`.

Im Testmodus gilt (fail-closed):

- Secret Key kommt aus `STRIPE_SECRET_KEY_TEST`. Der alte `STRIPE_SECRET_KEY`
  wird nur genommen, wenn er selbst ein `sk_test_…` ist. Ein `sk_live_…` wird
  **nie** benutzt → Checkout antwortet `503 STRIPE_LIVE_KEY_BLOCKED`.
- Price-IDs kommen **nicht** aus `public.products` (dort stehen die Live-IDs),
  sondern aus `STRIPE_TEST_PRICE_<PLAN_KEY>`. Fehlt sie → `400 PRICE_NOT_CONFIGURED`.
- Webhook prüft mit `STRIPE_WEBHOOK_SECRET_TEST`. Events mit `livemode=true`
  werden quittiert und ignoriert (`ignored: stripe_mode_mismatch`).
- Testkäufe melden keine Conversions an Werbeplattformen.
- Antworten von `stripe-checkout`, `stripe-checkout-verify`, `stripe-portal`,
  `checkout-siteos-project`, `checkout-website-rebuild` enthalten
  `stripe_mode: "test"` und `beta_test: true`; Session-, Subscription- und
  Customer-Metadaten tragen `beta_test: "true"`.

## 1. Stripe-Dashboard (Testmodus / Sandbox)

Im Stripe-Dashboard oben rechts **Testmodus** einschalten (bzw. eine Sandbox
öffnen). Alles Folgende dort anlegen.

1. **API-Schlüssel**: Entwickler → API-Schlüssel → `sk_test_…` (Secret) und
   `pk_test_…` (Publishable) kopieren.
2. **Produkte und Preise** anlegen, Spiegel von `shared/pricing.ts`
   (EUR, Preise **inkl. USt.** = `tax_behavior: inclusive`, wie live).
   Bei jedem Preis unter *Metadaten* `plan_key` = Plan-Key setzen.

   | Plan-Key | Name | Preis | Typ | Testphase |
   |---|---|---|---|---|
   | `starter` | Starter | 79 € | monatlich wiederkehrend | 14 Tage (setzt der Code) |
   | `growth` | Growth | 249 € | monatlich wiederkehrend | 14 Tage (setzt der Code) |
   | `agency` | Agency | 699 € | monatlich wiederkehrend | keine |
   | `governance_launch` | Governance Launch | 349 € | **einmalig** | — |

   Nicht anlegen: `enterprise` (nur Anfrage), `partner` (stillgelegt),
   `*_yearly` (Jahrespreise sind nicht verdrahtet), `free_audit`.
   Optional `website_rebuild_managed|premium|enterprise` — haben aktuell keinen
   Aufrufer im Frontend.
3. **Stripe Tax** (Einstellungen → Steuern) im Testmodus aktivieren und
   Ursprungsadresse hinterlegen — `stripe-checkout` nutzt `automatic_tax`,
   ohne das scheitert die Session-Erstellung.
4. **Kundenportal** (Einstellungen → Billing → Kundenportal) im Testmodus
   einmal speichern — sonst scheitert `stripe-portal`.
5. **Webhook-Endpoint** (Entwickler → Webhooks → Endpoint hinzufügen):
   - URL: `https://<PROJECT_REF>.supabase.co/functions/v1/stripe-webhook`
   - Events:
     `checkout.session.completed`,
     `customer.subscription.created`, `customer.subscription.updated`,
     `customer.subscription.deleted`, `customer.subscription.trial_will_end`,
     `invoice.created`, `invoice.finalized`, `invoice.paid`,
     `invoice.payment_failed`, `charge.failed`, `charge.refunded`
   - Signing Secret `whsec_…` kopieren.

> **Live-Webhook:** Der bestehende Live-Endpoint zeigt auf dieselbe URL. Im
> Testmodus schlägt dessen Signaturprüfung fehl (400) und Stripe stellt erneut
> zu. Vorher prüfen, ob es **zahlende Live-Abos** gibt. Falls nein: Live-Endpoint
> während der Beta im Live-Dashboard deaktivieren. Falls ja: nicht umschalten,
> ohne das vorher zu klären.

## 2. Supabase-Secrets setzen

```bash
supabase secrets set --project-ref <PROJECT_REF> \
  STRIPE_MODE=test \
  STRIPE_SECRET_KEY_TEST=sk_test_XXXXXXXXXXXXXXXX \
  STRIPE_WEBHOOK_SECRET_TEST=whsec_XXXXXXXXXXXXXXXX \
  STRIPE_TEST_PRICE_STARTER=price_XXXXXXXXXXXXXXXX \
  STRIPE_TEST_PRICE_GROWTH=price_XXXXXXXXXXXXXXXX \
  STRIPE_TEST_PRICE_AGENCY=price_XXXXXXXXXXXXXXXX \
  STRIPE_TEST_PRICE_GOVERNANCE_LAUNCH=price_XXXXXXXXXXXXXXXX
```

Optional (nur falls die Rebuild-Tarife getestet werden):

```bash
supabase secrets set --project-ref <PROJECT_REF> \
  STRIPE_TEST_PRICE_WEBSITE_REBUILD_MANAGED=price_XXXXXXXXXXXXXXXX
```

Kontrolle (zeigt nur Namen/Hashes, keine Werte):

```bash
supabase secrets list --project-ref <PROJECT_REF>
```

Hinweise:

- Die Live-Secrets `STRIPE_SECRET_KEY` / `STRIPE_WEBHOOK_SECRET` **bleiben
  stehen** — sie werden im Testmodus nur nicht benutzt.
- Die Functions lesen zuerst den Vault (`get_app_secret`) und dann Env. Für die
  Test-Keys gibt es optional die Vault-Namen `stripe_secret_key_test` und
  `stripe_webhook_secret_test`. Empfohlen ist `supabase secrets set` (Env).
  `checkout-website-rebuild` liest nur Env.
- Nach dem Merge die geänderten Functions deployen:
  `stripe-checkout`, `stripe-checkout-verify`, `stripe-webhook`, `stripe-portal`,
  `checkout-siteos-project`, `checkout-website-rebuild` (der Deploy-Workflow
  `.github/workflows/deploy.yml` oder `supabase functions deploy <name>`).

## 3. Frontend (Cloudflare Pages Build)

GitHub-Repo-Secrets / Build-Env:

- `VITE_STRIPE_MODE=test` (fehlend = test)
- `VITE_STRIPE_PUBLISHABLE_KEY=pk_test_…`
- `VITE_STRIPE_AUDIT_PRO_LINK` leer lassen oder einen **Test**-Payment-Link
  (`https://buy.stripe.com/test_…`). Ein Live-Link wird im Testmodus durch
  `/checkout/growth` ersetzt.

`VITE_STRIPE_MODE` wird im Build-Env-Block von
`.github/workflows/deploy-cloudflare-pages.yml` aus dem gleichnamigen Repo-Secret
durchgereicht (fehlt es, gilt der sichere Default `test`).

Zusätzlich baut die Cloudflare-Git-Integration (Bot „Cloudflare Pages" am PR)
mit den Build-Variablen des Pages-Projekts, nicht mit Repo-Secrets. Dort
`VITE_STRIPE_MODE` ebenfalls setzen: Cloudflare-Dashboard → Workers & Pages →
`realsyncdynamics-ai` → Settings → Variables and Secrets → Production
(und Preview, falls gewünscht).

Für Live-Betrieb **alle** Stellen gemeinsam auf `live` setzen: Supabase-Secret
`STRIPE_MODE`, Repo-Secret `VITE_STRIPE_MODE` und die Pages-Build-Variable
`VITE_STRIPE_MODE`. Weicht der Frontend-Modus ab, bricht der Checkout mit
`STRIPE_MODE_MISMATCH` ab, sobald der Server eine Live-Session meldet.
Price-IDs liegen im Frontend nicht vor: Die `VITE_STRIPE_PRICE_*`-Variablen
werden im Code nicht gelesen.

## 4. Testkarten

| Fall | Kartennummer |
|---|---|
| Erfolg | `4242 4242 4242 4242` |
| 3-D-Secure nötig | `4000 0025 0000 3155` |
| Abgelehnt | `4000 0000 0000 9995` |

Ablaufdatum: beliebig in der Zukunft, CVC: beliebig 3-stellig, PLZ: beliebig.

## 5. Verifikation: schaltet der Kauf im Dashboard frei?

**Für jeden Plan einen frischen Test-Tenant nehmen.** `subscriptions` ist pro
Tenant eindeutig. Hat ein Tenant ein Live-Kundenkonto, lehnt `stripe-checkout`
im Testmodus den Kauf mit `409 STRIPE_MODE_CUSTOMER_MISMATCH` ab, damit seine
Live-Abo-Zeile nicht überschrieben wird. Bestandskunden erreichen ihr Live-Abo
im Testmodus weiter über `stripe-portal` (Rückfall auf den Live-Key nur dort).

Ablauf je Plan (`starter`, `growth`, `agency`, `governance_launch`):

1. Als Owner einloggen → `/pricing` → Plan wählen → Checkout.
   In den DevTools muss die Antwort von `stripe-checkout` `stripe_mode: "test"`
   enthalten. Die Stripe-Seite zeigt das Banner „Testmodus".
2. Mit `4242 4242 4242 4242` bezahlen → `/checkout/success`.
3. Stripe-Dashboard (Testmodus) → Webhooks → Endpoint: Events mit 200.
4. In der Datenbank prüfen (SQL-Editor):

   ```sql
   select plan_key, status, stripe_price_id, trial_end
     from public.subscriptions where tenant_id = '<TENANT_ID>';
   select source, plan_key, status from public.entitlement_grants
     where tenant_id = '<TENANT_ID>';            -- Einmalkauf governance_launch
   select key, value from public.tenant_entitlements('<TENANT_ID>');
   ```

   Erwartet: `plan_key` = gekaufter Plan (nicht `free_audit`), `status`
   `trialing` (starter/growth) bzw. `active` (agency). Bei `governance_launch`
   eine Zeile in `entitlement_grants`, kein Abo.
   Steht `plan_key = free_audit`, fehlt an der Test-Price `metadata.plan_key`
   **und** die Price-ID stimmt nicht mit `STRIPE_TEST_PRICE_<PLAN_KEY>` überein.
5. Im Dashboard prüfen, ob die Module des Plans entsperrt sind
   (Soll-Werte: `modules`, `limits`, `permissions` je Plan in `shared/pricing.ts`).
   Beispiele: Starter → 1 Site/Domain, Evidence Vault, Audit Center;
   Growth → zusätzlich ISO 27001, Risk Register, Workflows, 3 Sites;
   Agency → zusätzlich NIS2, TISAX, API, Webhooks, Human Handoff, 10 Sites.

### Wo das Gating im Code gelesen wird

| Stelle | Datei |
|---|---|
| Abo-Sync (Webhook + Verify, Plan-Key-Auflösung) | `supabase/functions/_shared/stripe-subscription-sync.ts` |
| Einmalkauf → `entitlement_grants` | `supabase/functions/stripe-webhook/index.ts` (`recordOneTimePurchase`) |
| Entitlement-Auflösung (DB) | SQL `public.tenant_entitlements()` — Produkt über `stripe_price_id`, sonst über `plan_key` |
| Server-Guard in Functions | `supabase/functions/_shared/entitlements.ts` |
| Client-Loader | `src/core/access/load-entitlements.ts` |
| Aktiver Plan im Client | `src/lib/billing/planAccess.ts` (`getActivePlanForTenant`) |
| Sidebar-/Navigationssperren | `src/components/governance-os/navAccess.ts`, `useNavLock.ts` |
| SiteOS-Builder-Rechte | `src/features/siteos/builderEntitlements.ts` |
| Erfolgsseite / Verify | `src/pages/CheckoutSuccess.tsx` → `stripe-checkout-verify` |
| Plan- und Abo-Ansicht | `src/features/billing/BillingView.tsx`, `src/features/market/MyPlanSection.tsx` |

Bekannte Grenzen im Testmodus:

- `stripe-checkout-verify` prüft nur Abos. Für `governance_launch` antwortet es
  `NO_SUBSCRIPTION`; die Freischaltung kommt allein über den Webhook.
- Add-ons (`subscription-addons`) und Meter-Sync (`stripe-meter-sync`,
  `stripe-token-meter-sync`) sind **nicht** umgestellt. Sie nutzen weiter
  `STRIPE_SECRET_KEY` und `plan_addons.stripe_price_id` (live). Add-on-Käufe auf
  Test-Abos schlagen deshalb fehl, ohne dass Geld fließt.

## 6. Zurück auf Live

1. Klären, ob Käufe zuverlässig freischalten (Abschnitt 5 für alle Pläne grün).
2. Prüfen, dass `STRIPE_SECRET_KEY` (`sk_live_…`) und `STRIPE_WEBHOOK_SECRET`
   (Live-Endpoint) gesetzt sind und der Live-Webhook aktiv ist.
3. `supabase secrets set --project-ref <PROJECT_REF> STRIPE_MODE=live` und
   `VITE_STRIPE_MODE=live` + `pk_live_…` im Build, dann neu deployen.
4. Test-Tenants und deren `subscriptions`-Zeilen aufräumen (nicht destruktiv
   per Migration, sondern gezielt im SQL-Editor).
