-- Tenant-scoped CRM foundation for RealSyncDynamics.AI
-- Contacts, companies, deals, activities and lead capture.
-- Strict tenant isolation via RLS. No public write path.

BEGIN;

CREATE TABLE IF NOT EXISTS public.crm_companies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  name text NOT NULL,
  domain text,
  industry text,
  lifecycle_stage text NOT NULL DEFAULT 'prospect'
    CHECK (lifecycle_stage IN ('prospect','lead','customer','partner','inactive')),
  owner_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, name)
);

CREATE TABLE IF NOT EXISTS public.crm_contacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  company_id uuid REFERENCES public.crm_companies(id) ON DELETE SET NULL,
  first_name text,
  last_name text,
  email text,
  phone text,
  job_title text,
  lifecycle_stage text NOT NULL DEFAULT 'lead'
    CHECK (lifecycle_stage IN ('lead','qualified','customer','inactive')),
  source text,
  owner_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.crm_deals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  company_id uuid REFERENCES public.crm_companies(id) ON DELETE SET NULL,
  primary_contact_id uuid REFERENCES public.crm_contacts(id) ON DELETE SET NULL,
  name text NOT NULL,
  stage text NOT NULL DEFAULT 'new'
    CHECK (stage IN ('new','qualified','proposal','negotiation','won','lost')),
  value_cents bigint NOT NULL DEFAULT 0 CHECK (value_cents >= 0),
  currency text NOT NULL DEFAULT 'EUR' CHECK (currency ~ '^[A-Z]{3}$'),
  expected_close_date date,
  owner_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  source text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.crm_activities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  contact_id uuid REFERENCES public.crm_contacts(id) ON DELETE CASCADE,
  company_id uuid REFERENCES public.crm_companies(id) ON DELETE CASCADE,
  deal_id uuid REFERENCES public.crm_deals(id) ON DELETE CASCADE,
  activity_type text NOT NULL
    CHECK (activity_type IN ('note','email','call','meeting','task','system')),
  subject text NOT NULL,
  body text,
  due_at timestamptz,
  completed_at timestamptz,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (contact_id IS NOT NULL OR company_id IS NOT NULL OR deal_id IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS crm_companies_tenant_idx ON public.crm_companies(tenant_id);
CREATE INDEX IF NOT EXISTS crm_contacts_tenant_idx ON public.crm_contacts(tenant_id);
CREATE INDEX IF NOT EXISTS crm_contacts_email_idx ON public.crm_contacts(tenant_id, lower(email));
CREATE INDEX IF NOT EXISTS crm_deals_tenant_stage_idx ON public.crm_deals(tenant_id, stage);
CREATE INDEX IF NOT EXISTS crm_activities_tenant_created_idx ON public.crm_activities(tenant_id, created_at DESC);

ALTER TABLE public.crm_companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_deals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_activities ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS crm_companies_member ON public.crm_companies;
CREATE POLICY crm_companies_member ON public.crm_companies FOR ALL TO authenticated
  USING (public.is_tenant_member(tenant_id)) WITH CHECK (public.is_tenant_member(tenant_id));

DROP POLICY IF EXISTS crm_contacts_member ON public.crm_contacts;
CREATE POLICY crm_contacts_member ON public.crm_contacts FOR ALL TO authenticated
  USING (public.is_tenant_member(tenant_id)) WITH CHECK (public.is_tenant_member(tenant_id));

DROP POLICY IF EXISTS crm_deals_member ON public.crm_deals;
CREATE POLICY crm_deals_member ON public.crm_deals FOR ALL TO authenticated
  USING (public.is_tenant_member(tenant_id)) WITH CHECK (public.is_tenant_member(tenant_id));

DROP POLICY IF EXISTS crm_activities_member ON public.crm_activities;
CREATE POLICY crm_activities_member ON public.crm_activities FOR ALL TO authenticated
  USING (public.is_tenant_member(tenant_id)) WITH CHECK (public.is_tenant_member(tenant_id));

DROP TRIGGER IF EXISTS crm_companies_updated_at ON public.crm_companies;
CREATE TRIGGER crm_companies_updated_at BEFORE UPDATE ON public.crm_companies
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS crm_contacts_updated_at ON public.crm_contacts;
CREATE TRIGGER crm_contacts_updated_at BEFORE UPDATE ON public.crm_contacts
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS crm_deals_updated_at ON public.crm_deals;
CREATE TRIGGER crm_deals_updated_at BEFORE UPDATE ON public.crm_deals
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

COMMIT;
