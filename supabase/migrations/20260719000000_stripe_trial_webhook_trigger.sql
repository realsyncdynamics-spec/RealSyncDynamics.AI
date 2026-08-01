-- Trigger to forward Stripe trial events to n8n webhooks via Edge Function.
-- When a stripe_trial_events row is inserted, call automation-trigger-trial-webhook
-- Edge Function to post to configured n8n webhook.

-- Note: Uses net.http_post which is available in Supabase production.
-- Gracefully handles environments where this function is not available.

-- Function to trigger n8n webhook for trial events
CREATE OR REPLACE FUNCTION public.trigger_trial_webhook()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_supabase_url TEXT;
  v_service_role_key TEXT;
BEGIN
  -- Get environment variables for API call
  v_supabase_url := current_setting('app.supabase_url', TRUE) || 'https://localhost:54321';
  v_service_role_key := current_setting('app.service_role_key', TRUE) || '';

  -- Fire-and-forget HTTP POST to Edge Function
  -- net.http_post queues requests asynchronously in Supabase
  BEGIN
    PERFORM net.http_post(
      url := v_supabase_url || '/functions/v1/automation-trigger-trial-webhook',
      body := jsonb_build_object(
        'stripe_event_id', NEW.stripe_event_id,
        'kind', NEW.kind,
        'tenant_id', NEW.tenant_id,
        'subscription_id', NEW.stripe_subscription_id,
        'customer_id', NEW.stripe_customer_id,
        'trial_end', NEW.trial_end,
        'occurred_at', NEW.occurred_at
      ),
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || v_service_role_key
      )
    );
  EXCEPTION WHEN undefined_function THEN
    RAISE WARNING 'net.http_post not available (net extension not installed)';
  END;

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- Log error but don't fail the insert
  RAISE WARNING 'trial_webhook trigger error: %', SQLERRM;
  RETURN NEW;
END;
$$;

-- Create trigger on stripe_trial_events INSERT
DROP TRIGGER IF EXISTS trial_webhook_trigger ON public.stripe_trial_events;

CREATE TRIGGER trial_webhook_trigger
AFTER INSERT ON public.stripe_trial_events
FOR EACH ROW
EXECUTE FUNCTION public.trigger_trial_webhook();

-- Add comment for documentation
COMMENT ON TRIGGER trial_webhook_trigger ON public.stripe_trial_events IS
  'Forwards Stripe trial events (trial_started, trial_will_end, converted, canceled) to n8n webhooks for automation workflows. Calls automation-trigger-trial-webhook Edge Function.';
