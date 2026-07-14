-- Add invoice email delivery tracking
-- Phase 3: Invoice Email Delivery

-- 1. Track invoice email sends
ALTER TABLE public.stripe_invoices
  ADD COLUMN invoice_email_sent_at timestamptz NULL;

CREATE INDEX IF NOT EXISTS stripe_invoices_email_sent_idx ON public.stripe_invoices (invoice_email_sent_at)
  WHERE invoice_email_sent_at IS NOT NULL;

COMMENT ON COLUMN public.stripe_invoices.invoice_email_sent_at IS 'Timestamp when invoice confirmation email was successfully sent via Resend';

-- 2. Optional: Tenant billing contact email (defaults to primary contact if not set)
ALTER TABLE public.tenants
  ADD COLUMN billing_email text NULL;

CREATE INDEX IF NOT EXISTS tenants_billing_email_idx ON public.tenants (billing_email)
  WHERE billing_email IS NOT NULL;

COMMENT ON COLUMN public.tenants.billing_email IS 'Optional billing contact email. If not set, invoices default to primary contact or Stripe customer email';
