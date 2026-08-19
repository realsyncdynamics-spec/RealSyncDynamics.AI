-- Keep the waitlist interest contract aligned with the public bot capability.
-- `sales-lead` accepts `bots`; the database must accept the same value.

ALTER TABLE public.waitlist_signups
  DROP CONSTRAINT IF EXISTS waitlist_signups_interest_check;

ALTER TABLE public.waitlist_signups
  ADD CONSTRAINT waitlist_signups_interest_check
  CHECK (interest IN (
    'runtime', 'siteos', 'evidence', 'provenance', 'audit', 'bots', 'other'
  ));

COMMENT ON COLUMN public.waitlist_signups.interest IS
  'Module interest: runtime, siteos, evidence, provenance, audit, bots, or other.';
