-- Admin-Read-Policy auf customer_onboarding.
-- Vorhandene Policies: onboarding_service_all (service_role full), onboarding_owner_read
-- (authenticated user → eigene Email). Super-Admins brauchen Sicht auf alle Rows
-- für die Admin-View, die zeigt wo Pilot-Kunden im Onboarding-Funnel hängen.

drop policy if exists "onboarding_admin_read" on public.customer_onboarding;
create policy "onboarding_admin_read"
    on public.customer_onboarding for select
    using (exists (
      select 1 from public.profiles p
       where p.id = auth.uid() and p.is_super_admin = true
    ));

comment on policy "onboarding_admin_read" on public.customer_onboarding is
    'Super-admins sehen alle Onboarding-Rows. Pattern matches gdpr_audits/sales_leads/outreach_contacts admin policies.';
