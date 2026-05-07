# Stripe — First-Charge Verification Checklist

**Status:** Pre-Launch — vor erstem Live-Verkauf abarbeiten.
**Account:** `acct_1Sr3lpCNKcHrCAIC` (realsyncdynamics.de · Live-Mode)

## Warum diese Checkliste

Beide Stripe Payment Links sind im **Live-Mode** und auf Production verdrahtet:
- `/cookie-consent-sdk` Pro 49 €/M → `https://buy.stripe.com/5kQ6oGeQK44L3Uv3PD8og0f`
- `/audit-pro` 499 € → `https://buy.stripe.com/4gM00icIC44L76HgCp8og0g`

Ein erster Live-Test stellt sicher, dass:
1. Der Checkout-Flow ohne Fehler durchläuft
2. Auszahlung an deine Bankverbindung getriggert wird
3. Tax-Settings korrekt greifen (Kleinunternehmer-Hinweis bzw. USt)
4. Email-Bestätigungen vom Customer + Stripe-Receipt funktionieren

## Schritt 1: Stripe-Tax-Settings prüfen

→ https://dashboard.stripe.com/settings/tax

**Bei Kleinunternehmer-Status (§ 19 UStG, vor USt-IdNr-Vergabe):**
- Tax-Behavior auf **„Inclusive"** setzen
- Custom-Hinweis auf Rechnung: „Hinweis: Kleinunternehmer i. S. v. § 19 UStG. Es wird keine Umsatzsteuer ausgewiesen."
- Tax-Rate **0 %**

**Sobald USt-IdNr vom Finanzamt vergeben:**
- Tax-Behavior auf **„Exclusive"** umstellen
- Stripe-Tax aktivieren (automatische Berechnung)
- USt-IdNr in Stripe-Settings hinterlegen
- Reverse-Charge-Mechanismus für B2B-EU-Kunden konfigurieren

## Schritt 2: Bankverbindung verifizieren

→ https://dashboard.stripe.com/settings/payouts

- IBAN + BIC eingetragen?
- Verifikations-Status: **Active** (grün)
- Payout-Schedule: empfohlen `weekly` (Friday-Auszahlung) für überschaubare Cashflow-Steuerung

## Schritt 3: Webhook-Endpoint live

→ https://dashboard.stripe.com/webhooks

Existing Webhook-Endpoint sollte zeigen:
- URL: `https://<supabase-project>.supabase.co/functions/v1/stripe-webhook`
- Events: `checkout.session.completed`, `customer.subscription.updated`, `invoice.paid`
- Status: **Healthy** (kein 5xx-failures-banner)

Test-Webhook-Event senden (Send Test Webhook Button) → in Supabase Logs prüfen ob Edge Function 200 zurückgibt.

## Schritt 4: Test-Charge mit echter Karte

**Cookie-SDK Pro:**
1. Privates Browser-Fenster (kein Login)
2. https://realsyncdynamicsai.de/cookie-consent-sdk öffnen
3. „Jetzt buchen" klicken → Stripe-Checkout
4. Echte Karte verwenden (eigene), Adresse, Email
5. Zahlung abschließen
6. Email-Bestätigung von Stripe sollte binnen 1 Min eintreffen
7. In `https://dashboard.stripe.com/payments` Eintrag prüfen: Status `Succeeded`

**Audit-Pro:**
Wie oben, aber https://realsyncdynamicsai.de/audit-pro

## Schritt 5: Refund (Sanity-Check abschließen)

→ Im Stripe-Dashboard `https://dashboard.stripe.com/payments`
1. Test-Charge anklicken
2. **Refund** → Full Refund
3. Email-Bestätigung an Customer
4. In ca. 5–10 Werktagen wieder auf der Karte

Für die Subscription (Cookie-SDK Pro): Subscription **canceln** unter
`https://dashboard.stripe.com/subscriptions` damit keine Folge-Buchung läuft.

## Schritt 6: Customer-Email-Templates anpassen

→ https://dashboard.stripe.com/settings/emails

Standard-Stripe-Receipt-Email enthält den Customer-Email + Betrag. Optional:
- Logo hochladen (`/public/brand/logo-square-400.png`)
- Custom-Footer: „Bei Fragen: hello@realsyncdynamicsai.de"
- „From"-Name: `RealSync Dynamics`

## Schritt 7: Erste-Verkaufs-Notification (intern)

Optional Slack-Webhook für Sales-Notifications:
→ Stripe-Dashboard → Webhooks → neuer Endpoint → URL = Slack-Incoming-Webhook
→ Event: `checkout.session.completed`
→ Body-Template anpassen für lesbare Slack-Message

So erfährst du in real-time wenn jemand kauft.

## Verifikations-Status (zu pflegen)

- [ ] Tax-Settings konfiguriert
- [ ] Bankverbindung verifiziert
- [ ] Webhook gesund
- [ ] Test-Charge Cookie-SDK erfolgreich
- [ ] Test-Charge Audit-Pro erfolgreich
- [ ] Beide Test-Charges refunded
- [ ] Customer-Email-Template angepasst
- [ ] Slack-Sales-Notification (optional) eingerichtet

## Bei Fehlern

- Stripe-Logs unter https://dashboard.stripe.com/logs
- Supabase-Edge-Function-Logs unter https://supabase.com/dashboard/project/<id>/functions
- Falls Webhook 5xx: Supabase Edge Function `stripe-webhook` debuggen

## Nach Verifikation

Sobald alle 8 Punkte abgehakt sind: erste echte Kunden-Akquise kann starten.
LinkedIn-Templates für Cold-DMs liegen unter `marketing/linkedin-templates.md`.
