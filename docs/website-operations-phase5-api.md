# Website Operations Phase 5 — API Documentation

**Cloudflare Integration & Domain Management**

---

## Edge Functions

### 1. cloudflare-deployer
**Endpoint:** `POST /functions/v1/cloudflare-deployer`

Orchestrates Cloudflare Pages deployment, R2 asset upload, and domain/SSL setup.

#### Request Body
```json
{
  "project_id": "uuid",
  "tenant_id": "uuid",
  "action": "create-pages-project | upload-assets | deploy-to-pages | setup-domain | validate-ssl",
  "html": "optional HTML content",
  "domain": "optional domain name",
  "namespace": "optional R2 namespace"
}
```

#### Actions

**create-pages-project**
- Creates Cloudflare Pages project
- Stores `cloudflare_project_id` in `website_projects`
- Returns: `{ project_id, preview_url }`

**upload-assets**
- Uploads HTML/CSS to R2 bucket
- Stores deployment metadata
- Returns: `{ path, size, url }`

**deploy-to-pages**
- Triggers Pages deployment
- Returns: `{ deployment_id, status, preview_url }`

**setup-domain**
- Connects domain to Pages project
- Creates DNS records (CNAME for subdomains)
- Initiates SSL validation
- Returns: `{ domain, status, instructions, validation_code }`

**validate-ssl**
- Checks SSL certificate status
- Returns: `{ domain, ssl_status, certificate_id, expires_at }`

#### Responses

**Success (200)**
```json
{
  "success": true,
  "data": {
    "domain": "string",
    "status": "string",
    "deployment_id": "string",
    "preview_url": "string"
  }
}
```

**Error (5xx)**
```json
{
  "success": false,
  "error": "error message",
  "code": "CLOUDFLARE_ERROR | DEPLOYMENT_FAILED"
}
```

---

### 2. website-domain-manager
**Endpoint:** `POST /functions/v1/website-domain-manager`

Manages domain lifecycle: connect, validate, disconnect, SSL checks.

#### Request Body
```json
{
  "project_id": "uuid",
  "tenant_id": "uuid",
  "action": "connect-domain | validate-domain | disconnect-domain | check-ssl",
  "domain": "domain.com"
}
```

#### Actions

**connect-domain**
- Validates domain format
- Creates entry in `website_domains` table
- Returns DNS instructions (for custom domains)
- For subdomains: instant activation
- For custom domains: requires DNS propagation

**validate-domain**
- Checks DNS propagation (uses Google DNS API)
- Updates domain status
- Initiates SSL provisioning if DNS valid
- Returns: `{ domain, status, dns_valid, ssl_status }`

**disconnect-domain**
- Removes domain mapping
- Deletes `website_domains` entry
- Revokes SSL certificate (via Cloudflare API)

**check-ssl**
- Returns current SSL certificate status
- Shows expiration date and auto-renewal status

#### Database Changes

**website_domains** (created in Phase 2)
```sql
{
  id: UUID,
  project_id: UUID,
  tenant_id: UUID,
  domain: VARCHAR UNIQUE,
  domain_type: 'subdomain' | 'custom',
  cloudflare_status: 'pending' | 'validating' | 'active' | 'failed',
  ssl_status: 'pending' | 'pending_validation' | 'active' | 'expired',
  dns_validated_at: TIMESTAMP,
  ssl_expires_at: TIMESTAMP,
  is_primary: BOOLEAN,
  is_active: BOOLEAN,
  connected_at: TIMESTAMP
}
```

---

## Frontend API Endpoints

(To be implemented in backend - currently mocked in frontend)

### Website Projects API

**GET** `/api/website-projects`
- List user's website projects
- Returns: `{ projects: WebsiteProject[] }`

**GET** `/api/website-projects/:id`
- Get single project
- Returns: `{ project: WebsiteProject }`

**POST** `/api/website-projects`
- Create new project
- Returns: `{ project: WebsiteProject }`

**GET** `/api/website-projects/:id/domains`
- List domains for project
- Returns: `{ domains: Domain[] }`

**GET** `/api/website-projects/:id/deployment-logs`
- Get deployment history
- Returns: `{ logs: DeploymentLog[] }`

**GET** `/api/website-compliance/:id`
- Get compliance report
- Returns: `{ report: ComplianceReport }`

---

## Workflow: Complete Website Creation → Deployment

```
1. User creates project (CreateWebsiteWizard)
   → website_projects entry (status='draft')
   → POST /functions/v1/website-operations-agent

2. AI generates website
   → Saves HTML/CSS/SEO to configuration
   → Runs compliance checks
   → Updates status='preview'
   → Stores compliance_findings

3. User reviews (Dashboard)
   → Views preview_url
   → Reviews compliance_score
   → Can adjust services/content

4. User connects domain (DomainManager)
   → POST /functions/v1/website-domain-manager (action='connect-domain')
   → For subdomains: instant
   → For custom: show DNS instructions

5. System deploys to Cloudflare
   → POST /functions/v1/cloudflare-deployer (action='create-pages-project')
   → POST /functions/v1/cloudflare-deployer (action='upload-assets')
   → POST /functions/v1/cloudflare-deployer (action='deploy-to-pages')
   → POST /functions/v1/cloudflare-deployer (action='setup-domain')

6. DNS validation (automated)
   → Every 30 seconds: POST /functions/v1/website-domain-manager (action='validate-domain')
   → When DNS valid: trigger SSL provisioning
   → When SSL active: mark status='live'

7. Live monitoring
   → Periodic compliance re-checks
   → SSL expiration tracking
   → Deployment log polling
   → Performance metrics collection
```

---

## Error Handling

### Common Error Codes

| Code | Cause | Resolution |
|------|-------|-----------|
| `CLOUDFLARE_NOT_CONFIGURED` | Missing API token/account ID | Set env vars: `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID` |
| `PROJECT_NOT_FOUND` | Invalid project_id | Verify project exists and user has access |
| `DOMAIN_ALREADY_EXISTS` | Domain in use | Choose different domain |
| `INVALID_DOMAIN` | Malformed domain | Use format: `example.com` or `subdomain.realsyncdynamics.ai` |
| `DNS_PROPAGATION_TIMEOUT` | DNS not propagating | Retry after 5 minutes, check DNS provider |
| `CF_API_ERROR` | Cloudflare API error | Check Cloudflare status page, retry |
| `SSL_PROVISIONING_FAILED` | Certificate issuance failed | Usually temporary, retry in 5 minutes |

---

## Rate Limiting

**Cloudflare API (enforced server-side)**
- 1,200 requests/minute
- 120 requests/second burst

**Frontend (client-side recommendations)**
- Poll deployment status: max every 2 seconds
- DNS validation: max every 10 seconds
- Compliance checks: max every 5 minutes

---

## Environment Variables

Required for Phase 5 functionality:

```bash
CLOUDFLARE_API_TOKEN=        # Token with Pages + R2 + DNS permissions
CLOUDFLARE_ACCOUNT_ID=       # Cloudflare account ID
SUPABASE_URL=                # (existing)
SUPABASE_SERVICE_ROLE_KEY=   # (existing)
ANTHROPIC_API_KEY=           # (existing, for website-operations-agent)
```

---

## Implementation Checklist

Phase 5 completion requires:

- [x] cloudflare-deployer Edge Function
- [x] website-domain-manager Edge Function
- [x] DomainManager.tsx frontend component
- [ ] Backend API endpoints (to implement)
  - [ ] GET /api/website-projects
  - [ ] GET /api/website-projects/:id
  - [ ] POST /api/website-projects
  - [ ] GET /api/website-projects/:id/domains
  - [ ] GET /api/website-projects/:id/deployment-logs
  - [ ] GET /api/website-compliance/:id
- [ ] Integration tests (E2E)
- [ ] Environment variable documentation
- [ ] Deployment guide (Supabase function secrets)

---

## Next Steps (Phase 6+)

- **Phase 6:** Maintenance Agent (SEO, performance, broken link detection)
- **Phase 7:** Testing & full E2E validation
- **Phase 8:** Production hardening + monitoring
- **Phase 9:** Analytics & optimization recommendations
- **Phase 10:** Social orchestration & content syndication

---

**Document Version:** 1.0  
**Last Updated:** 2026-07-17  
**Status:** Phase 5 implementation in progress
