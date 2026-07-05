# Partner Provisioning API

## Overview

The Partner Provisioning API enables resellers, agencies, and white-label partners to programmatically provision white-label tenant instances of RealSyncDynamics. Partners authenticate via API key and can provision up to 100 new tenants per month (configurable).

## Architecture

```
Partner (Reseller)
  ↓ (API Key Auth)
partner-provision-tenant endpoint
  ↓
✓ Validate API key
✓ Check monthly quota (100/month default)
✓ Create tenant with branding (colors, domain, logo)
✓ Auto-create API key for the new tenant
✓ Increment quota counter
  ↓
Return: {tenant_id, api_key, dashboard_url}
```

## Use Cases

1. **White-Label Resellers**: Agencies resell RealSyncDynamics under their own brand
2. **SaaS Integrators**: Embed RealSyncDynamics compliance features in partner products
3. **Enterprise Distributors**: Large partners manage customer onboarding programmatically
4. **Multi-Region Deployment**: Partners provision region-specific instances with custom branding

## Setup

### 1. Create Partner Account

Contact the RealSyncDynamics team to create a partner account. You'll receive:
- `partner_id`: UUID for your partner account
- `partner_api_key`: Secret key (store securely, never commit)
- `max_tenants_per_month`: Quota (default 100, negotiable)
- `stripe_connect_account_id`: For revenue sharing (optional)

**Example API call (admin only):**
```sql
INSERT INTO public.partners (
  name, email, api_key_hash, api_key_prefix, 
  max_tenants_per_month, revenue_share_percent, enabled
) VALUES (
  'Acme Agency', 'contact@acme.com',
  '<hash-of-key>', 'rsd_abc12345',
  500, 30.0, true
);
```

### 2. Provision Your First Tenant

```bash
curl -X POST https://your-realsync-instance/functions/v1/partner-provision-tenant \
  -H "Authorization: Bearer rsd_your_partner_api_key_here" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Acme Corp - Compliance Hub",
    "domain": "compliance.acme.com",
    "brand_colors": {
      "primary": "#0052FF",
      "secondary": "#00D9FF",
      "accent": "#FF6B35"
    },
    "plan_tier": "professional",
    "billing_email": "billing@acme.com"
  }'
```

**Response:**
```json
{
  "ok": true,
  "tenant_id": "550e8400-e29b-41d4-a716-446655440000",
  "api_key": "rsd_a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6",
  "dashboard_url": "https://compliance.acme.com",
  "quota_remaining": 99
}
```

## API Reference

### POST /functions/v1/partner-provision-tenant

**Authentication:**
```
Authorization: Bearer <partner-api-key>
```

**Request Headers:**
```
Content-Type: application/json
```

**Request Body:**
```json
{
  "name": "Tenant Display Name (required)",
  "domain": "custom.domain.com (optional, must be HTTPS-ready)",
  "brand_colors": {
    "primary": "#0052FF (optional)",
    "secondary": "#00D9FF (optional)",
    "accent": "#FF6B35 (optional)"
  },
  "plan_tier": "professional (optional, default: professional)",
  "billing_email": "billing@company.com (optional)"
}
```

**Response (201 Created):**
```json
{
  "ok": true,
  "tenant_id": "uuid",
  "api_key": "rsd_<32-char-random>",
  "dashboard_url": "https://custom.domain.com or https://app.realsync.eu/t/<tenant_id>",
  "quota_remaining": 99
}
```

**Error Responses:**

| Status | Code | Reason |
|--------|------|--------|
| 400 | BAD_REQUEST | Missing required field (name) or invalid JSON |
| 401 | UNAUTHORIZED | Missing/invalid Authorization header or invalid API key |
| 409 | CONFLICT | Custom domain already in use by another tenant |
| 429 | RATE_LIMITED | Monthly quota exceeded (100/month default) |
| 500 | INTERNAL | Database error or unexpected failure |

### Rate Limiting

- **Monthly quota**: 100 tenants per month (configurable per partner)
- **Quota reset**: 1st of each calendar month (UTC)
- **Current usage**: Check `quota_remaining` in response to plan next provisioning

**Check quota manually:**
```sql
SELECT tenants_provisioned
FROM public.partner_provisioning_quota
WHERE partner_id = '<your-partner-id>'
  AND year_month = DATE_TRUNC('month', NOW())::date;
```

## Branding & Customization

### Brand Colors

Tenants can specify custom brand colors that apply to:
- Dashboard header & primary UI elements
- Email templates & compliance documents
- Customer-facing reports & audit exports

**Example:**
```json
{
  "brand_colors": {
    "primary": "#0F766E",      // Petrol (buttons, links)
    "secondary": "#64748B",    // Slate (backgrounds)
    "accent": "#DC2626"        // Red (alerts, warnings)
  }
}
```

### Custom Domain

Provision a tenant under a custom domain (e.g., `compliance.acme.com`):

```json
{
  "domain": "compliance.acme.com"
}
```

**Requirements:**
- Domain must be DNS-verified to your partner account
- DNS setup: Add CNAME to `*.app.realsync.eu`
- HTTPS certificate auto-provisioned via Let's Encrypt
- URL becomes: `https://compliance.acme.com` instead of `https://app.realsync.eu/t/<tenant_id>`

## Tenant Configuration

Once provisioned, the new tenant receives:

1. **Automatic Setup:**
   - API key for programmatic access (in response)
   - Owner role assigned to partner contact email
   - Billing configured with partner's Stripe Connect (if enabled)
   - Auto-invoice passthrough enabled

2. **Tenant Admin Can Later:**
   - Customize branding in dashboard settings
   - Invite team members
   - Configure integrations (webhooks, OAuth, n8n)
   - Manage API keys & quotas

## Billing & Revenue Sharing

### For Partners

When a customer purchases a subscription through your tenant:

1. **Invoice Passthrough**: Invoices show your company name (white-label)
2. **Revenue Share**: You receive 30% commission (negotiable, set per partner)
3. **Stripe Connect**: Link your Stripe account for automatic payouts

**Setup:**
```sql
UPDATE public.partners
SET stripe_connect_account_id = 'acct_123...'
WHERE id = '<your-partner-id>';
```

**Payout Frequency:** Monthly, to your linked Stripe account

## Integration Examples

### 1. Provision Tenant for Customer During Signup

**Node.js/TypeScript:**
```typescript
async function provisionWhiteLabelTenant(customerName: string, domain: string) {
  const response = await fetch(
    'https://your-realsync-instance/functions/v1/partner-provision-tenant',
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.PARTNER_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: customerName,
        domain: domain,
        brand_colors: {
          primary: '#0052FF',
          secondary: '#00D9FF',
        },
        billing_email: `billing@${domain}`,
      }),
    }
  );

  if (!response.ok) {
    const err = await response.json();
    throw new Error(`Provisioning failed: ${err.error_code} - ${err.error_message}`);
  }

  const result = await response.json();
  return {
    tenantId: result.tenant_id,
    tenantApiKey: result.api_key,
    dashboardUrl: result.dashboard_url,
  };
}

// Usage
const tenant = await provisionWhiteLabelTenant('Acme Corp', 'acme.realsync.com');
console.log(`New tenant: ${tenant.dashboardUrl}`);
```

### 2. Bulk Provision Tenants from CSV

**Node.js:**
```typescript
import * as fs from 'fs';
import * as csv from 'csv-parse';

async function bulkProvision(csvPath: string) {
  const records: Array<{name: string; domain: string; email: string}> = [];

  const parser = fs.createReadStream(csvPath)
    .pipe(csv.parse({ columns: true }));

  for await (const record of parser) {
    records.push(record);
  }

  console.log(`Provisioning ${records.length} tenants...`);

  const results = [];
  for (const record of records) {
    try {
      const tenant = await provisionWhiteLabelTenant(
        record.name,
        record.domain
      );
      results.push({
        status: 'success',
        customerName: record.name,
        tenantId: tenant.tenantId,
        dashboardUrl: tenant.dashboardUrl,
      });
      console.log(`✓ ${record.name}`);
    } catch (err: any) {
      results.push({
        status: 'error',
        customerName: record.name,
        error: err.message,
      });
      console.error(`✗ ${record.name}: ${err.message}`);
    }
  }

  // Save results
  fs.writeFileSync('provision-results.json', JSON.stringify(results, null, 2));
}

// Usage
bulkProvision('customers.csv');
```

### 3. Send Tenant Credentials to Customer

After provisioning, send email with:
- Dashboard URL
- Initial admin credentials
- Onboarding guide
- Support contact

```typescript
async function sendOnboardingEmail(tenant: any, customerEmail: string) {
  const html = `
    <h1>Your RealSyncDynamics Tenant is Ready!</h1>
    <p>Welcome to your white-label compliance platform.</p>
    
    <h2>Quick Start</h2>
    <ul>
      <li><strong>Dashboard:</strong> <a href="${tenant.dashboardUrl}">${tenant.dashboardUrl}</a></li>
      <li><strong>Admin Email:</strong> ${customerEmail}</li>
      <li><strong>API Key:</strong> <code>${tenant.tenantApiKey}</code> (save securely!)</li>
    </ul>
    
    <p><a href="${tenant.dashboardUrl}/onboarding">Start Onboarding</a></p>
  `;

  await sendEmail({
    to: customerEmail,
    subject: 'Your Compliance Platform is Ready',
    html,
  });
}
```

## Monitoring & Troubleshooting

### Check Quota Usage

```sql
SELECT
  p.name,
  p.max_tenants_per_month,
  ppq.year_month,
  ppq.tenants_provisioned,
  (p.max_tenants_per_month - ppq.tenants_provisioned) as remaining
FROM public.partners p
LEFT JOIN public.partner_provisioning_quota ppq
  ON p.id = ppq.partner_id
  AND ppq.year_month = DATE_TRUNC('month', NOW())::date
WHERE p.enabled = true
ORDER BY p.name;
```

### List All Provisioned Tenants for Partner

```sql
SELECT
  t.id,
  t.name,
  t.custom_domain,
  t.created_at,
  COUNT(DISTINCT m.user_id) as member_count
FROM public.tenants t
LEFT JOIN public.memberships m ON m.tenant_id = t.id
WHERE t.partner_id = '<partner-id>'
GROUP BY t.id, t.name, t.custom_domain, t.created_at
ORDER BY t.created_at DESC;
```

### View Provisioning Errors

Check Edge Function logs:
```bash
supabase functions logs partner-provision-tenant
```

### Rate Limit Hit?

If you hit the 100/month quota:
1. Contact support to increase quota (negotiable)
2. Spread provisioning across months
3. Re-use existing tenants for new customers (invite members)

## Security Best Practices

1. **Rotate API Key**: Store `partner_api_key` in `.env` or secure vault (never in code)
2. **HTTPS Only**: All provisioning calls must use HTTPS
3. **Domain Verification**: Partners must own/control custom domains
4. **RLS Isolation**: Each tenant has full RLS isolation; data access requires tenant membership
5. **Audit Trail**: All provisioning events logged in partner audit trail

## Deployment

### Checklist

- [ ] Apply migration: `supabase db push`
- [ ] Deploy function:
  ```bash
  supabase functions deploy partner-provision-tenant
  ```
- [ ] Set environment: `DASHBOARD_URL` (e.g., `https://app.realsync.eu`)
- [ ] Create test partner:
  ```sql
  -- Generate API key hash (use crypto.subtle.digest SHA-256 in JavaScript)
  INSERT INTO public.partners (...) VALUES (...);
  ```
- [ ] Test provisioning with curl or API client
- [ ] Monitor logs: `supabase functions logs partner-provision-tenant`
- [ ] Update partner dashboard UI to show API key management

## Metrics to Monitor

| KPI | Target | Alert |
|-----|--------|-------|
| Provisioning success rate | > 99% | < 95% |
| Avg provisioning latency | < 2s | > 5s |
| Monthly quotas used | 30-70% | > 90% |
| API key rotation rate | > 1x per year | If zero |
| Custom domain adoption | > 50% | < 30% |

## FAQ

**Q: Can a partner re-provision the same customer?**
A: No. Each customer gets a unique tenant. To add the customer to additional teams, invite them as a member to existing tenants.

**Q: What happens if provisioning fails halfway?**
A: Automatic rollback: if API key creation fails, the tenant is deleted. Check logs for the cause.

**Q: Can I change the quota later?**
A: Yes. Contact support or update directly:
```sql
UPDATE public.partners
SET max_tenants_per_month = 250
WHERE id = '<partner-id>';
```

**Q: How are custom domains verified?**
A: DNS CNAME verification. Partner must add `CNAME compliance.acme.com -> app.realsync.eu` in their domain provider.

**Q: Can partners see customer data across tenants?**
A: No. Each tenant is completely isolated. Partners can only manage their own partner account settings and quota usage.

**Q: What's the difference between an API key and a tenant API key?**
A: 
- **Partner API Key**: Authenticates the reseller to the provisioning API
- **Tenant API Key**: Allows the customer to access RealSync audit APIs programmatically

**Q: Do white-label tenants have different features?**
A: No. They get the full feature set based on the `plan_tier` (Professional, Governance OS, Enterprise). White-label is branding only.

---

**Last Updated:** 2026-07-05  
**API Version:** v1  
**Status:** Production Ready
