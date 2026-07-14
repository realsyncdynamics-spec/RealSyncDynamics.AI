# RealSyncDynamics.AI — API Developer Guide

## Overview

The RealSyncDynamics.AI API allows programmatic access to audit and compliance scanning capabilities. This guide covers authentication, rate limits, endpoints, and best practices.

## Getting Started

### 1. Generate an API Key

Navigate to **Settings → API Keys** and click **"API-Schlüssel erstellen"** (Generate API Key).

Choose your use case:
- **Website** — Automated compliance monitoring for a domain
- **Tool** — Integration with third-party compliance platform
- **Bot / Chatbot** — Automated audit responses
- **CRM** — Lead-based compliance checking
- **Automation** (Make/Zapier/n8n) — Workflow automation
- **Custom Software** — Direct integration

Select permission level:
- **Read** — View audit results only
- **Write** — Start scans and view results
- **Full** — Complete API access

Save your key securely. **It will only be shown once.**

### 2. Authenticate Requests

Include your API key in the `Authorization` header:

```bash
curl -H "Authorization: Bearer rsd_..." https://realsyncdynamics-ai.de/functions/v1/api-audit
```

## Endpoints

### POST /functions/v1/api-audit

Run a compliance audit for a domain or module.

**Request:**

```json
{
  "domain": "example.com",
  "module": "gdpr",
  "detailed": true
}
```

**Parameters:**
- `domain` (optional): Domain to audit. Defaults to all domains in workspace.
- `module` (optional): Specific module to check. Options: `gdpr`, `dpia`, `dsr`, `consent`, `general`
- `detailed` (optional): Include detailed findings. Boolean, defaults to false.

**Response (200):**

```json
{
  "success": true,
  "data": {
    "tenant_id": "uuid",
    "domain": "example.com",
    "module": "gdpr",
    "status": "compliant",
    "last_checked": "2026-07-05T12:00:00Z",
    "compliance_score": 92,
    "findings": [
      {
        "id": "finding-123",
        "severity": "low",
        "title": "Cookie Banner Not Dismissible",
        "recommendation": "Make all cookie buttons equally prominent"
      }
    ]
  },
  "timestamp": "2026-07-05T12:00:00Z"
}
```

**Error Responses:**

| Status | Error | Meaning |
|--------|-------|---------|
| 401 | Missing or invalid Authorization header | API key not provided or malformed |
| 403 | Invalid API key | API key does not exist or is revoked |
| 429 | Rate limit exceeded | Monthly quota reached for your plan |
| 500 | Internal server error | Service temporarily unavailable |

## Rate Limits

Rate limits are per-tenant, monthly basis:

| Tier | Monthly Calls | Request Timeout |
|------|---------------|-----------------|
| Agency | 1,000 | 30s |
| Scale | 10,000 | 30s |
| Enterprise | 100,000 | 60s |

Limits reset on the first day of each month (UTC).

**Current Usage:**

View your monthly usage in **Settings → API Keys → Usage Statistics**.

```bash
# Check remaining quota
curl -H "Authorization: Bearer rsd_..." \
  https://realsyncdynamics-ai.de/functions/v1/api-quota
```

## Permission Levels

### Read (`read`)
- List previous audit results
- Get compliance scores
- View findings and recommendations
- **Cannot:** Start new scans, export data

### Write (`write`)
- All Read permissions
- Start new scans
- **Cannot:** Manage API keys, view billing, full data export

### Full (`full`)
- All permissions
- Manage API keys
- Access billing and usage data
- Export in all formats

## Authentication Examples

### cURL

```bash
curl -X POST https://realsyncdynamics-ai.de/functions/v1/api-audit \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"domain": "example.com", "module": "gdpr"}'
```

### JavaScript / Node.js

```javascript
const apiKey = 'rsd_...';
const response = await fetch(
  'https://realsyncdynamics-ai.de/functions/v1/api-audit',
  {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      domain: 'example.com',
      module: 'gdpr',
      detailed: true,
    }),
  }
);
const data = await response.json();
```

### Python

```python
import requests

api_key = 'rsd_...'
headers = {'Authorization': f'Bearer {api_key}'}
payload = {
    'domain': 'example.com',
    'module': 'gdpr',
    'detailed': True
}

response = requests.post(
    'https://realsyncdynamics-ai.de/functions/v1/api-audit',
    headers=headers,
    json=payload
)
data = response.json()
```

### Make.com / Zapier Integration

Use the **HTTP Request** module:

1. **Method:** POST
2. **URL:** `https://realsyncdynamics-ai.de/functions/v1/api-audit`
3. **Headers:**
   - `Authorization: Bearer {{ api_key }}`
   - `Content-Type: application/json`
4. **Body:**
   ```json
   {
     "domain": "{{ trigger.domain }}",
     "module": "gdpr"
   }
   ```

## Best Practices

### 1. Secure Your API Keys
- ✅ Store keys in environment variables
- ✅ Use separate keys for different integrations
- ✅ Rotate keys annually
- ❌ Never commit keys to version control
- ❌ Never embed keys in client-side code

### 2. Error Handling

```javascript
try {
  const response = await fetch(apiEndpoint, {
    headers: { 'Authorization': `Bearer ${apiKey}` },
  });
  
  if (response.status === 429) {
    console.error('Rate limit reached. Reset on next month.');
    // Wait or queue request
  } else if (!response.ok) {
    const error = await response.json();
    console.error(`API Error: ${error.error}`);
  }
  
  const data = await response.json();
} catch (error) {
  console.error('Network error:', error);
}
```

### 3. Implement Retry Logic

```javascript
async function callApiWithRetry(apiKey, payload, maxRetries = 3) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const response = await fetch(
        'https://realsyncdynamics-ai.de/functions/v1/api-audit',
        {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${apiKey}` },
          body: JSON.stringify(payload),
        }
      );
      
      if (response.ok) return await response.json();
      if (response.status === 429) {
        // Exponential backoff: 2^attempt seconds
        await new Promise(r => setTimeout(r, Math.pow(2, attempt) * 1000));
        continue;
      }
      throw new Error(`HTTP ${response.status}`);
    } catch (error) {
      if (attempt === maxRetries) throw error;
      await new Promise(r => setTimeout(r, 1000 * attempt));
    }
  }
}
```

## Monitoring

### Usage Dashboard

View real-time usage in **Settings → API Keys → Usage Statistics**:
- Calls per month
- Failed requests
- Average response time
- Last 10 API calls (timestamp, status, endpoint)

### Webhooks

Subscribe to API events:
- Rate limit warning (80% usage)
- Rate limit exceeded
- Key rotation reminder
- Suspicious activity detected

Configure in **Settings → Integrations → Webhooks**.

## Support

- **Email:** api-support@realsyncdynamics-ai.de
- **Docs:** https://docs.realsyncdynamics-ai.de/api
- **Status:** https://status.realsyncdynamics-ai.de
- **Community:** https://discord.gg/realsyncdynamics

---

**Last Updated:** 2026-07-05
