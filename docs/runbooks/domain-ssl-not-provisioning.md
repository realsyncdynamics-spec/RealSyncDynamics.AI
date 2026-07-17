# Runbook: Domain SSL Certificate Not Provisioning

**Severity:** High  
**Component:** `website-domain-manager` Edge Function  
**SLA:** Resolution within 2 hours  

---

## Symptoms

Users report:
- Domain shows "SSL: pending" for >30 minutes
- "SSL provisioning failed" error
- HTTPS connection fails (ERR_SSL_PROTOCOL_ERROR)
- Domain shows "DNS: pending" or "DNS: failed"

Metrics:
- SSL status not transitioning from `pending` to `active`
- DNS propagation time > 5 minutes
- Certificate validation errors in logs

---

## Root Causes

### 1. DNS Propagation Issue (40%)
- DNS records not properly configured
- TTL too high (user waiting for cache)
- Nameserver not resolving correctly

### 2. Cloudflare API Error (30%)
- API rate limit exceeded
- Certificate generation failed
- Domain already exists in Cloudflare

### 3. Custom Domain Validation Failure (20%)
- Domain not pointing to Cloudflare nameservers
- CNAME record misconfigured
- DNS validation token not published

### 4. Let's Encrypt/ACME Issue (10%)
- Certificate revocation
- Rate limiting by certificate authority
- Invalid domain (non-TLD domain)

---

## Diagnosis

### Step 1: Check Domain Status
```sql
SELECT id, domain, domain_type, cloudflare_status, ssl_status, 
       created_at, updated_at, details
FROM website_domains
WHERE id = 'domain-uuid'
ORDER BY updated_at DESC;

-- Should show:
-- cloudflare_status: 'active' (not 'pending' or 'failed')
-- ssl_status: 'active' (not 'pending' or 'failed')
```

### Step 2: Check DNS Resolution
```bash
# Test DNS from multiple locations
nslookup yourdomain.com
dig yourdomain.com +short
dig yourdomain.com MX

# Check if pointing to Cloudflare nameservers
dig yourdomain.com NS

# Expected output:
# yourdomain.com. 300 IN NS ns1.cloudflare.com.
# yourdomain.com. 300 IN NS ns2.cloudflare.com.
```

### Step 3: Check Cloudflare Records
```bash
# List all DNS records for domain
curl -X GET https://api.cloudflare.com/client/v4/zones/{zoneId}/dns_records \
  -H "Authorization: Bearer $CF_API_TOKEN" \
  -H "Content-Type: application/json" | jq '.result[] | {name, type, content, proxied}'

# Look for: CNAME or A record pointing to Cloudflare Pages
# Expected: yourdomain.com CNAME realsyncdynamics.pages.dev (if subdomain)
```

### Step 4: Check SSL Certificate Status
```bash
# Test SSL handshake
openssl s_client -connect yourdomain.com:443 -servername yourdomain.com

# Check certificate details
echo | openssl s_client -servername yourdomain.com -connect yourdomain.com:443 2>/dev/null | openssl x509 -noout -dates -subject

# Expected:
# notBefore=Jan 1 00:00:00 2026 GMT
# notAfter=Jan 1 00:00:00 2027 GMT
```

### Step 5: Check Cloudflare Certificate Status
```bash
# List certificates in Cloudflare
curl -X GET https://api.cloudflare.com/client/v4/zones/{zoneId}/ssl/certificate_packs \
  -H "Authorization: Bearer $CF_API_TOKEN" | jq '.result[] | {status, certificate_authority, hosts}'

# Should show status: 'active' or 'pending_issuance'
```

### Step 6: Test From Browser
```javascript
// In browser console:
fetch('https://yourdomain.com', { mode: 'no-cors' })
  .then(() => console.log('SSL OK'))
  .catch(e => console.error('SSL error:', e.message))

// Or check: https://www.sslshopper.com/ssl-checker.html?domain=yourdomain.com
```

---

## Resolution

### If DNS Records Are Missing or Incorrect

**For Subdomain (realsyncdynamics.ai):**
```sql
-- Update database with correct status
UPDATE website_domains
SET cloudflare_status = 'active',
    ssl_status = 'pending_issuance',
    details = jsonb_set(
      details,
      '{dns_records}',
      '{"type":"NS","name":"subdomain","points_to":"cloudflare_pages"}'
    )
WHERE id = 'domain-uuid';

-- Verify in Cloudflare UI:
-- Settings → Nameservers → Should show Cloudflare NS
```

**For Custom Domain:**
```bash
# Provide user with DNS instructions:
echo "Add these records to your DNS provider:"
echo "Type: CNAME"
echo "Name: yourdomain.com (or @)"
echo "Value: realsyncdynamics.pages.dev"
echo "TTL: 300 (5 minutes) or Auto"

# Alternative (if provider doesn't support CNAME at root):
echo "Type: A"
echo "Name: @ (root)"
echo "Value: Use Cloudflare nameservers instead:"
echo "  - ns1.cloudflare.com"
echo "  - ns2.cloudflare.com"
```

**Step to verify:**
```bash
# After user updates DNS (wait up to 5 minutes):
dig yourdomain.com +short
# Should show: realsyncdynamics.pages.dev (CNAME)
# or Cloudflare IP addresses (A records)
```

### If Cloudflare API is Rate Limited

**Check rate limit headers:**
```bash
curl -v https://api.cloudflare.com/client/v4/user 2>&1 | grep -i "X-RateLimit"

# Should show:
# X-RateLimit-Limit: 1200
# X-RateLimit-Remaining: 999
# X-RateLimit-Reset: 1626307200
```

**Solution:**
1. Wait until rate limit reset time
2. Retry DNS validation (should use cached records)
3. Check if certificate was already issued

**If certificate exists:**
```bash
# Retrieve existing certificate
curl -X GET https://api.cloudflare.com/client/v4/zones/{zoneId}/ssl/certificate_packs \
  -H "Authorization: Bearer $CF_API_TOKEN" | jq '.result[0]'

# Update database to reflect actual status
UPDATE website_domains
SET ssl_status = 'active'
WHERE id = 'domain-uuid';
```

### If Certificate Generation Failed

**Check ACME logs:**
```bash
# In Cloudflare dashboard:
# SSL/TLS → Edge Certificates → View Details
# Look for: Error messages, validation issues

# Common errors:
# - "DNS validation failed" → DNS records not propagated
# - "CAA record validation failed" → CAA record missing
# - "Rate limited by Let's Encrypt" → Try again in 1 hour
```

**Add CAA record if missing:**
```bash
# Instruct user to add:
# Type: CAA
# Name: @ (root domain)
# Value: 0 issue "letsencrypt.org"
#        0 issuewild ";cert.letsencrypt.org"
#        0 iodef "mailto:admin@yourdomain.com"
```

**Retry certificate issuance:**
```sql
UPDATE website_domains
SET ssl_status = 'pending',
    details = jsonb_set(
      details,
      '{retry_count}',
      '1'::jsonb
    )
WHERE id = 'domain-uuid';

-- Trigger re-request via Edge Function
-- POST /functions/v1/website-domain-manager
-- { "action": "check-ssl", "domain_id": "..." }
```

### If Let's Encrypt Rate Limit Hit

**Symptom:** Error message contains "too many certificates already issued"

**Solution:**
1. Wait 1 week for rate limit reset
2. Use existing certificate (if available)
3. Alternative: Change domain to subdomain (realsyncdynamics.ai)

**Check rate limits:**
```bash
# https://letsencrypt.org/docs/rate-limits/
# Main limit: 50 certificates per domain per week
# Duplicate limit: 5 duplicate certificates per domain per week
```

---

## Verification

**After applying fix:**

1. ✓ DNS resolves to correct target:
```bash
dig yourdomain.com +short
# Should return IP or CNAME
```

2. ✓ SSL certificate is valid:
```bash
openssl s_client -connect yourdomain.com:443 < /dev/null | openssl x509 -noout -dates
# Should show valid dates (not expired)
```

3. ✓ HTTPS connection works:
```bash
curl -I https://yourdomain.com
# Should return 200-level status (not SSL errors)
```

4. ✓ Database shows correct status:
```sql
SELECT ssl_status, cloudflare_status FROM website_domains
WHERE id = 'domain-uuid';
-- Should both be 'active'
```

5. ✓ Browser access works:
Visit `https://yourdomain.com` - should load website without errors

---

## Prevention

### Dashboard Improvements
- [ ] Show estimated DNS propagation time
- [ ] Display current DNS records in UI
- [ ] Link to DNS provider configuration guide
- [ ] Auto-check DNS every 30 seconds (up to 5 min)

### Monitoring
- [ ] Alert if SSL status stays `pending` >15 minutes
- [ ] Log all Cloudflare API calls to Sentry
- [ ] Track certificate renewal dates (30 days before expiry)

### Documentation
- [ ] Create per-provider DNS setup guides (GoDaddy, Route53, etc.)
- [ ] Add video tutorial for domain connection
- [ ] Provide DNS record templates (copy-paste)

---

## Related Runbooks

- [Cloudflare Deployment Stuck](cloudflare-deployment-stuck.md)
- [Rate Limit Exceeded](rate-limit-exceeded.md)
- [Website Generation Failure](website-generation-failure.md)

---

## Contacts & Escalation

**Cloudflare Support:** https://support.cloudflare.com/  
**Let's Encrypt:** https://letsencrypt.org/  
**DNS Verification:** https://mxtoolbox.com/  

---

**Last Updated:** 2026-07-17  
**Owner:** Infrastructure Team  
**Review Date:** 2026-08-17
