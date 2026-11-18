# checkout-voice-agent

Checkout für das eigenständige Voice-Agent-Abo (Starter / Professional /
Kanzlei-Praxis, `VOICE_STANDALONE_OFFERS` in `shared/pricing.ts`).

Regeln: `../_shared/voice-agent-checkout.ts` · Freischaltung: `stripe-webhook`
(`syncVoiceAgentSubscription`) · Migration `20261118120000`.

## Ablauf

1. Kaufseite `/voice/checkout/:offerId` → `POST checkout-voice-agent { tenant_id, offer_id }`.
2. Server prüft: Schalter `VOICE_CHECKOUT_ENABLED`, Login, Rolle owner/admin,
   Angebot freigegeben, Stripe-Price passt zum SSoT-Betrag, kein aktives Voice-Abo.
3. Stripe-Checkout im Modus `subscription`, `metadata.product_type = voice_agent`.
4. `stripe-webhook`: Voice-Abos gehen **nicht** durch den Plan-Sync, sondern
   schreiben `entitlement_grants` (source `voice_subscription`) → `bots.voice`
   → `tenant_voice_agents` → `provision-voice-agent`.

## Aktivierung (jede Stufe braucht eine Freigabe des Eigentümers)

1. Leistungsumfang je Paket aus der Stripe-Produktbeschreibung in
   `shared/pricing.ts` eintragen (`monthlyMinutes`, `bullets`), `npm run sync:pricing`.
2. Folge-Migration: `limit.bot_voice_minutes_monthly` je Produkt
   `internal_voice_agent_<id>` mit denselben Minuten.
3. Edge-Secrets setzen: `STRIPE_PRICE_VOICE_STARTER`,
   `STRIPE_PRICE_VOICE_PROFESSIONAL`, `STRIPE_PRICE_VOICE_KANZLEI_PRAXIS`
   (monatliche EUR-Prices, Betrag = `monthlyEur`).
4. Migration anwenden und Function deployen; `checkout-voice-agent` in
   `src/config/production-edge-functions.ts` von `UNBACKED_CALLERS` nach
   `PRODUCTION_EDGE_FUNCTIONS` umtragen.
5. Testkauf im Stripe-Testmodus, dann `VOICE_CHECKOUT_ENABLED=true` (Server)
   und `VITE_VOICE_CHECKOUT_ENABLED=true` (Pages-Build).

Ohne Schritt 1 und 2 verweigern Checkout (`OFFER_NOT_RELEASED`) und Webhook
die Freischaltung: ohne Kontingent setzte die Bereitstellung kein Tageslimit.
