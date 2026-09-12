# White-Label Branding API

## Overview

The White-Label Branding API enables tenant admins to fully customize the RealSyncDynamics dashboard appearance for their users. Supports colors, logos, domain, contact info, and custom CSS.

## Architecture

```
Tenant Admin
  ↓
PATCH /tenant-branding-update
  ├→ Validate JWT token + admin role
  ├→ Validate branding fields (hex colors, URLs, lengths)
  ├→ Merge with existing brand_colors (preserve unspecified colors)
  ├→ Log changes to branding_audit_log (audit trail)
  └→ Return updated branding

Frontend / Public
  ↓
GET /tenant-branding-get?domain=custom.domain.com
  ├→ Lookup tenant by custom domain
  ├→ Fetch all branding settings
  └→ Return branding JSON for UI rendering
```

## Features

### Core Branding Fields

| Field | Type | Max Length | Required | Example |
|-------|------|-----------|----------|---------|
| company_name | string | 256 | no | "Acme Corp" |
| brand_colors | object | — | no | `{primary: "#0F766E", secondary: "#64748B"}` |
| custom_logo_url | URL | 2048 | no | "https://cdn.acme.com/logo.png" |
| favicon_url | URL | 2048 | no | "https://cdn.acme.com/favicon.ico" |
| support_email | email | — | no | "support@acme.com" |
| support_phone | string | 20 | no | "+49 30 123456" |
| support_url | URL | 2048 | no | "https://support.acme.com" |
| footer_text | string | 1024 | no | "© 2026 Acme Corp" |
| custom_css | JSONB | — | no | `{button: "border-radius: 8px"}` |

### Brand Colors

Control primary UI colors with hex values:

```json
{
  "primary": "#0F766E",      // Main buttons, links, accents
  "secondary": "#64748B",    // Backgrounds, secondary elements
  "accent": "#06B6D4",       // Highlights, alerts
  "background": "#F8FAFC",   // Page background
  "text": "#0F172A"          // Text color
}
```

## API Reference

### PATCH /functions/v1/tenant-branding-update

Update tenant branding settings.

**Authentication:**
```
Authorization: Bearer <jwt-token>
```

**Required:**
- JWT token must contain `sub` (user ID) and `tenant_id` claims
- User must be admin or owner of the tenant

**Request Body:**
```json
{
  "company_name": "Acme Corp",
  "brand_colors": {
    "primary": "#0F766E",
    "secondary": "#64748B",
    "accent": "#06B6D4"
  },
  "custom_logo_url": "https://cdn.acme.com/logo.png",
  "favicon_url": "https://cdn.acme.com/favicon.ico",
  "support_email": "support@acme.com",
  "support_phone": "+49 30 123456",
  "support_url": "https://support.acme.com",
  "footer_text": "© 2026 Acme Corp"
}
```

**Response (200 OK):**
```json
{
  "ok": true,
  "branding": {
    "id": "<tenant-id>",
    "company_name": "Acme Corp",
    "brand_colors": {
      "primary": "#0F766E",
      "secondary": "#64748B",
      "accent": "#06B6D4",
      "background": "#F8FAFC",
      "text": "#0F172A"
    },
    "custom_logo_url": "https://cdn.acme.com/logo.png",
    "favicon_url": "https://cdn.acme.com/favicon.ico",
    "support_email": "support@acme.com",
    "support_phone": "+49 30 123456",
    "support_url": "https://support.acme.com",
    "footer_text": "© 2026 Acme Corp",
    "custom_css": {}
  }
}
```

**Error Responses:**

| Status | Code | Reason |
|--------|------|--------|
| 400 | BAD_REQUEST | Invalid color format, missing fields, validation errors |
| 401 | UNAUTHORIZED | Missing/invalid token or invalid claims |
| 403 | FORBIDDEN | User not admin/owner of tenant |
| 500 | INTERNAL | Database error |

**Example:**
```bash
curl -X PATCH https://your-realsync-instance/functions/v1/tenant-branding-update \
  -H "Authorization: Bearer <jwt-token>" \
  -H "Content-Type: application/json" \
  -d '{
    "company_name": "Acme Corp",
    "brand_colors": {
      "primary": "#0F766E",
      "secondary": "#64748B"
    },
    "custom_logo_url": "https://cdn.acme.com/logo.png"
  }'
```

### GET /functions/v1/tenant-branding-get

Fetch branding for a tenant (public endpoint).

**Query Parameters:**
```
?tenant_id=<uuid>     // Fetch by tenant ID
?domain=<domain>      // Fetch by custom domain (e.g., custom.acme.com)
```

**Response (200 OK):**
```json
{
  "ok": true,
  "branding": {
    "tenant_id": "<uuid>",
    "company_name": "Acme Corp",
    "custom_domain": "compliance.acme.com",
    "brand_colors": {
      "primary": "#0F766E",
      "secondary": "#64748B",
      "accent": "#06B6D4",
      "background": "#F8FAFC",
      "text": "#0F172A"
    },
    "custom_logo_url": "https://cdn.acme.com/logo.png",
    "favicon_url": "https://cdn.acme.com/favicon.ico",
    "support_email": "support@acme.com",
    "support_phone": "+49 30 123456",
    "support_url": "https://support.acme.com",
    "footer_text": "© 2026 Acme Corp",
    "custom_css": {}
  }
}
```

**Examples:**
```bash
# Fetch by tenant ID
curl https://your-realsync-instance/functions/v1/tenant-branding-get?tenant_id=550e8400-e29b-41d4-a716-446655440000

# Fetch by custom domain (public, no auth required)
curl https://your-realsync-instance/functions/v1/tenant-branding-get?domain=compliance.acme.com
```

## Branding Presets

Pre-designed color themes available for quick setup:

### Petrol Professional
```json
{
  "primary": "#0F766E",
  "secondary": "#64748B",
  "accent": "#06B6D4",
  "background": "#F8FAFC",
  "text": "#0F172A"
}
```
EU enterprise theme with petrol + slate neutrals.

### Security Blue
```json
{
  "primary": "#0052FF",
  "secondary": "#00D9FF",
  "accent": "#FF6B35",
  "background": "#F5F7FA",
  "text": "#1A1A2E"
}
```
Trust-focused security theme.

### Minimal Monochrome
```json
{
  "primary": "#1F2937",
  "secondary": "#9CA3AF",
  "accent": "#3B82F6",
  "background": "#FFFFFF",
  "text": "#111827"
}
```
Minimalist grayscale theme.

**Fetch presets:**
```sql
SELECT id, name, description, brand_colors, is_public
FROM public.branding_presets
WHERE is_public = true
ORDER BY name;
```

## Integration Examples

### React Dashboard Component

```typescript
import { useEffect, useState } from 'react';

export function BrandedDashboard() {
  const [branding, setBranding] = useState<any>(null);

  useEffect(() => {
    const fetchBranding = async () => {
      // Get domain or tenant_id from URL
      const domain = new URL(window.location.href).hostname;

      const res = await fetch(
        `/functions/v1/tenant-branding-get?domain=${domain}`
      );
      const data = await res.json();
      if (data.ok) {
        setBranding(data.branding);
        applyBranding(data.branding);
      }
    };

    fetchBranding();
  }, []);

  const applyBranding = (branding: any) => {
    // Apply brand colors to CSS variables
    const root = document.documentElement;
    if (branding.brand_colors) {
      root.style.setProperty('--color-primary', branding.brand_colors.primary);
      root.style.setProperty('--color-secondary', branding.brand_colors.secondary);
      root.style.setProperty('--color-accent', branding.brand_colors.accent);
      root.style.setProperty('--color-background', branding.brand_colors.background);
      root.style.setProperty('--color-text', branding.brand_colors.text);
    }

    // Update logo
    if (branding.custom_logo_url) {
      const logo = document.querySelector('img.logo') as HTMLImageElement;
      if (logo) logo.src = branding.custom_logo_url;
    }

    // Update favicon
    if (branding.favicon_url) {
      const favicon = document.querySelector('link[rel="icon"]') as HTMLLinkElement;
      if (favicon) favicon.href = branding.favicon_url;
    }

    // Update company name in header
    if (branding.company_name) {
      document.title = branding.company_name;
    }

    // Update support links in footer
    if (branding.support_email) {
      const emailLink = document.querySelector('a[href^="mailto:"]') as HTMLAnchorElement;
      if (emailLink) emailLink.href = `mailto:${branding.support_email}`;
    }
  };

  return branding ? (
    <div style={{ '--color-primary': branding.brand_colors.primary } as any}>
      {/* Dashboard content */}
    </div>
  ) : (
    <div>Loading...</div>
  );
}
```

### Node.js Admin Update

```typescript
async function updateTenantBranding(jwtToken: string, branding: any) {
  const response = await fetch(
    'https://your-realsync-instance/functions/v1/tenant-branding-update',
    {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${jwtToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        company_name: branding.company_name,
        brand_colors: branding.colors,
        custom_logo_url: branding.logoUrl,
        favicon_url: branding.faviconUrl,
        support_email: branding.supportEmail,
        footer_text: branding.footerText,
      }),
    }
  );

  const result = await response.json();
  if (!result.ok) {
    throw new Error(`Failed to update branding: ${result.error_code}`);
  }

  console.log('✓ Branding updated:', result.branding.company_name);
  return result.branding;
}
```

### Branding Form Component

```typescript
export function BrandingSettingsForm({ tenantId, onSubmit }: any) {
  const [form, setForm] = useState({
    company_name: '',
    primaryColor: '#0F766E',
    secondaryColor: '#64748B',
    accentColor: '#06B6D4',
    logoUrl: '',
    faviconUrl: '',
    supportEmail: '',
    supportPhone: '',
    supportUrl: '',
    footerText: '',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const token = localStorage.getItem('access_token');
    await updateTenantBranding(token, {
      company_name: form.company_name,
      colors: {
        primary: form.primaryColor,
        secondary: form.secondaryColor,
        accent: form.accentColor,
      },
      logoUrl: form.logoUrl,
      faviconUrl: form.faviconUrl,
      supportEmail: form.supportEmail,
      footerText: form.footerText,
    });

    onSubmit?.();
  };

  return (
    <form onSubmit={handleSubmit}>
      <div>
        <label>Company Name</label>
        <input
          type="text"
          value={form.company_name}
          onChange={(e) => setForm({ ...form, company_name: e.target.value })}
        />
      </div>

      <div>
        <label>Primary Color</label>
        <input
          type="color"
          value={form.primaryColor}
          onChange={(e) => setForm({ ...form, primaryColor: e.target.value })}
        />
      </div>

      {/* More fields... */}

      <button type="submit">Save Branding</button>
    </form>
  );
}
```

## Audit Trail

All branding changes are logged in `branding_audit_log` table for compliance and rollback.

**View change history:**
```sql
SELECT
  created_at,
  changed_by,
  old_values,
  new_values,
  change_type
FROM public.branding_audit_log
WHERE tenant_id = '<tenant-id>'
ORDER BY created_at DESC
LIMIT 20;
```

**Example output:**
```
created_at: 2026-07-05 14:32:00
changed_by: user-uuid-123
old_values: {"company_name": null, "brand_colors": {"primary": "#0052FF"}}
new_values: {"company_name": "Acme Corp", "brand_colors": {"primary": "#0F766E"}}
change_type: update
```

## Deployment

### Checklist

- [ ] Apply migration: `supabase db push`
- [ ] Deploy functions:
  ```bash
  supabase functions deploy tenant-branding-update
  supabase functions deploy tenant-branding-get
  ```
- [ ] Update dashboard to call branding endpoints on load
- [ ] Test with curl to verify API works
- [ ] Update admin settings UI with branding form
- [ ] Test white-label appearance in different domains

### Environment Variables

None required. Branding API uses standard Supabase auth.

## Monitoring & Troubleshooting

### Check Branding Usage

```sql
SELECT
  t.name as tenant_name,
  COUNT(CASE WHEN bal.change_type = 'update' THEN 1 END) as changes,
  MAX(bal.created_at) as last_updated,
  (t.brand_colors ->> 'primary') as primary_color
FROM public.tenants t
LEFT JOIN public.branding_audit_log bal ON bal.tenant_id = t.id
GROUP BY t.id, t.name, t.brand_colors
HAVING COUNT(bal.id) > 0
ORDER BY last_updated DESC;
```

### Validate Branding Colors

```sql
SELECT
  t.name,
  jsonb_each_text(t.brand_colors) as color_entry
FROM public.tenants t
WHERE t.brand_colors IS NOT NULL
  AND jsonb_typeof(t.brand_colors) = 'object'
ORDER BY t.name;
```

### Reset Branding to Default

```sql
UPDATE public.tenants
SET brand_colors = '{}'::jsonb,
    company_name = NULL,
    custom_logo_url = NULL,
    favicon_url = NULL,
    support_email = NULL,
    support_phone = NULL,
    support_url = NULL,
    footer_text = NULL,
    custom_css = '{}'::jsonb
WHERE id = '<tenant-id>';

-- Log the reset
INSERT INTO public.branding_audit_log (tenant_id, change_type, old_values, new_values)
SELECT id, 'reset', brand_colors, '{}'::jsonb FROM public.tenants WHERE id = '<tenant-id>';
```

## Security Considerations

1. **Role-based access**: Only admins/owners can update branding
2. **Input validation**: Hex colors, URL formats, field lengths validated server-side
3. **Audit logging**: All changes logged with user ID and timestamp
4. **Public read**: Branding is public (no sensitive data stored)
5. **CSP**: Custom CSS is NOT executed (stored as data, not applied raw)

## FAQ

**Q: Can I use custom CSS?**
A: Currently stored but not executed. We recommend using brand_colors for styling instead. Custom CSS execution is planned for v2.

**Q: What if I want to revert to a previous branding?**
A: Check branding_audit_log to see the old values, then re-apply them via the API.

**Q: Do brand colors apply everywhere?**
A: Yes. Dashboard, emails, documents, and reports all respect brand_colors settings.

**Q: Can partners customize branding?**
A: Yes. Branding is per-tenant, and white-label partners can customize the tenants they provision.

**Q: How do I apply branding to my custom domain?**
A: When provisioning a tenant with a custom domain, the dashboard on that domain automatically fetches and applies branding via `GET ?domain=custom.domain.com`.

---

**Last Updated:** 2026-07-05  
**Status:** Production Ready  
**Expected Usage:** All white-label partners + enterprise tenants with custom domains
