-- Security-Lint Cleanup — addresses one ERROR + two WARN findings from
-- Supabase's database linter (advisor run 2026-05-12).
--
-- 1) ERROR security_definer_view on public.token_usage_monthly
--    The view was created without an explicit security mode, which on
--    Supabase defaults to SECURITY DEFINER for views in the public
--    schema. That means it executes with the owner's privileges,
--    bypassing tenant-RLS on the underlying public.token_usage table.
--    Switch to SECURITY INVOKER so the view honours the caller's RLS.
--
-- 2) WARN function_search_path_mutable on public.set_updated_at and
--    public.incidents_set_deadline. Both are trigger functions
--    declared without a fixed search_path, leaving them exposed to
--    object-resolution hijacking if a privileged role were ever
--    tricked into setting search_path before invoking them. Pin
--    search_path to empty + qualify references; these functions
--    operate purely on the NEW record and don't need any catalogue
--    lookups.

-- ── 1) Fix the ERROR view ─────────────────────────────────────────
ALTER VIEW public.token_usage_monthly SET (security_invoker = true);

-- ── 2) Harden the two trigger functions ──────────────────────────
ALTER FUNCTION public.set_updated_at()        SET search_path = '';
ALTER FUNCTION public.incidents_set_deadline() SET search_path = '';
