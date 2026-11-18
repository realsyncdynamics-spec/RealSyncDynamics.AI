-- ═══════════════════════════════════════════════════════════════════════════
--  Eigenständiges Voice-Agent-Abo — Grant-Quelle und Produkte
-- ═══════════════════════════════════════════════════════════════════════════
--
-- Gehört zu supabase/functions/checkout-voice-agent und dem Zweig
-- syncVoiceAgentSubscription in stripe-webhook. Regeln:
-- supabase/functions/_shared/voice-agent-checkout.ts.
--
-- Was diese Migration leistet:
--   1. entitlement_grants kennt die Quelle `voice_subscription`. Solche Grants
--      zählen in tenant_entitlements() wie Einmal-Grants (grant_products:
--      source <> 'addon_subscription'), unabhängig vom Haupt-Abo. Den
--      Lebenszyklus (active/revoked) führt allein der Webhook.
--   2. Je Angebot aus VOICE_STANDALONE_OFFERS (shared/pricing.ts) eine
--      products-Zeile mit Sentinel-Price `internal_voice_agent_<id>` und den
--      Schaltern bots.voice, bots.enabled, bots.human_handoff.
--
-- Was sie NICHT tut:
--   - Kein Minutenkontingent (limit.bot_voice_minutes_monthly). Die Werte
--     stehen noch nicht fest (Stripe-Produktbeschreibung); ohne sie verweigert
--     checkout-voice-agent den Kauf (OFFER_NOT_RELEASED). Das Kontingent kommt
--     mit einer Folge-Migration, zusammen mit `monthlyMinutes` in pricing.ts.
--   - Keine echte Stripe-Price-ID. Die liegt als Edge-Secret
--     STRIPE_PRICE_VOICE_<ID> beim Betreiber.
--   - tenant_entitlements() bleibt unverändert.
--
-- Additiv und idempotent. Nichts wird gelöscht.

BEGIN;

-- ── 1. Grant-Quelle ────────────────────────────────────────────────────────

ALTER TABLE public.entitlement_grants
  DROP CONSTRAINT IF EXISTS entitlement_grants_source_check;
ALTER TABLE public.entitlement_grants
  ADD CONSTRAINT entitlement_grants_source_check
  CHECK (source IN (
    'one_time_purchase', 'manual', 'promotion', 'migration',
    'addon_subscription', 'voice_subscription'
  ));

-- ── 2. Produkte je Angebot ─────────────────────────────────────────────────

INSERT INTO public.products (stripe_price_id, name)
VALUES
  ('internal_voice_agent_starter',        'Voice Agent Starter'),
  ('internal_voice_agent_professional',   'Voice Agent Professional'),
  ('internal_voice_agent_kanzlei_praxis', 'Voice Agent Kanzlei / Praxis')
ON CONFLICT (stripe_price_id) DO NOTHING;

INSERT INTO public.product_entitlements (product_id, entitlement_id, value)
SELECT p.id, e.id, 1
FROM public.products p
CROSS JOIN public.entitlements e
WHERE p.stripe_price_id IN (
        'internal_voice_agent_starter',
        'internal_voice_agent_professional',
        'internal_voice_agent_kanzlei_praxis'
      )
  AND e.key IN ('bots.voice', 'bots.enabled', 'bots.human_handoff')
ON CONFLICT (product_id, entitlement_id) DO NOTHING;

COMMIT;
