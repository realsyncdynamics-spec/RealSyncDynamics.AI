# Tenant CRM

## Purpose

The CRM is a tenant-scoped operating layer for contacts, companies, deals and activities. It is intentionally part of the authenticated Governance workspace rather than a separate SaaS or external CRM.

## Data model

- `crm_companies` — organizations/accounts.
- `crm_contacts` — people linked to an organization.
- `crm_deals` — revenue opportunities with a simple pipeline.
- `crm_activities` — notes, emails, calls, meetings and tasks attached to CRM objects.

Every row carries `tenant_id` and is protected by `public.is_tenant_member(tenant_id)` through RLS.

## Integration direction

The CRM should become the commercial context layer for the existing automated funnel:

1. Anonymous audit / scan creates a prospect context.
2. Registration creates or resolves a tenant.
3. The prospect/contact is linked to the tenant.
4. Trial activation creates/updates a customer lifecycle state.
5. Stripe subscription state remains the billing source of truth.
6. Compliance findings, monitored domains and SiteOS activity remain product sources of truth and may reference CRM records without duplicating them.
7. Automated email, n8n and AI agents create activities rather than storing parallel customer histories.

## Security rules

- No public CRM write endpoint.
- No service-role key in the browser.
- All browser access is authenticated and tenant-scoped.
- Cross-tenant reads/writes must fail at RLS.
- Billing identifiers remain in billing tables; CRM stores only commercial context needed for operations.

## MVP UI

The first UI exposes counts for companies, contacts and deals plus a basic contact list and deal pipeline. It is deliberately small: the next increment should add search, detail views, activities, funnel attribution and automated lifecycle transitions rather than another disconnected dashboard.
