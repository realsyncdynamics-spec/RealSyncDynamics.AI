-- Restaurant/Pizza: provider-neutraler POS/Kitchen Webhook-Katalogeintrag.
-- Keine Zugangsdaten in dieser globalen Tabelle; tenant-spezifische URL/Secrets
-- liegen ausschließlich versiegelt in integration_configs.credentials_enc.
INSERT INTO public.integrations (
  slug,
  name,
  description,
  auth_type,
  enabled
)
VALUES (
  'restaurant-webhook',
  'Restaurant POS/Kitchen Webhook',
  'HMAC-signierter Server-zu-Server-Adapter für Restaurant-POS und Küchenübergaben',
  'webhook',
  true
)
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  auth_type = EXCLUDED.auth_type,
  enabled = EXCLUDED.enabled;
