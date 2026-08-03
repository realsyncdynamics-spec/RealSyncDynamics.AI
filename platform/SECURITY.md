# Security Architecture

RealSyncDynamics.AI implements defense-in-depth security across all layers of the platform. This document outlines the security measures in place for both the Builder Orchestrator and Governance Backend services.

## 1. Transport Security (TLS/HTTPS)

**Implementation:** Traefik reverse proxy with TLS termination
- **Local Development:** Self-signed certificates for `*.localhost`
- **Production:** ACME/Let's Encrypt automatic certificate management
- **Protocol:** TLS 1.2+ enforced
- **Ciphers:** ECDHE-based cipher suites only (perfect forward secrecy)
  - `TLS_ECDHE_RSA_WITH_AES_128_GCM_SHA256`
  - `TLS_ECDHE_RSA_WITH_AES_256_GCM_SHA384`
  - `TLS_ECDHE_RSA_WITH_CHACHA20_POLY1305`

**File:** `traefik/traefik.yml`, `traefik/dynamic.yml`

## 2. Authentication & Authorization

**Bearer Token Authentication:**
- User tokens: Fixed token → tenant_id mapping via `*_AUTH_TOKENS` env var
- Service tokens: Inter-service auth via `*_SERVICE_TOKEN` + `X-Tenant-Id` header
- Token comparison: Constant-time comparison (HMAC) prevents timing attacks
- Scope: All `/api/v1/*` endpoints require `Authorization: Bearer <token>` header

**Multi-Tenancy:**
- Tenant isolation via `ContextVar` (survives async boundaries)
- RLS policies on database tables ensure data isolation per tenant
- Every request validates tenant context before data access

**File:** `app/auth.py`

## 3. Input Validation

**Pydantic Constrained Types:**
- `ProjectId`: Alphanumeric + underscore/hyphen, max 64 chars
- `ProjectName`: Unicode text, max 256 chars
- `Description`: Max 4000 chars
- `Prompt`: 1-8000 chars for LLM inputs
- `TargetStack`: Enum validation (nextjs_supabase, fastapi_postgres, remix_supabase)
- `RiskTier`: Enum validation (minimal, limited, high, unacceptable)
- `Jurisdiction`: ISO 3166-1 alpha-2 or 'eu'

**Shell Injection Prevention:**
- Function `validate_no_shell_metacharacters()` blocks: `$`, backticks, pipes, redirects, `&`, `;`
- Allows only: alphanumeric, underscore, hyphen, dot

**Integration:** All API request models use validated constrained types

**File:** `app/validators.py`, `app/schemas.py`

## 4. Rate Limiting

**Per-IP Rate Limiting:**
- Limit: 100 requests/minute per IP address
- Scope: All `/api/*` endpoints (health check exempt)
- IP Detection: Respects `X-Forwarded-For` header for proxied requests
- Enforcement: Returns 429 (Too Many Requests) when exceeded
- Window: Sliding 60-second window with automatic cleanup

**Configuration:** `MAX_BODY_SIZE` environment variable

**File:** `app/middleware.py` → `RateLimitMiddleware`

## 5. Request Size Limits

**DoS Prevention:**
- Max body size: 10 MB (configurable via `MAX_BODY_SIZE` env var)
- Enforcement: Content-Length header validation before processing
- Response: 413 (Payload Too Large) when exceeded

**Prevents:**
- Memory exhaustion attacks
- Buffer overflow attacks
- Unintended large uploads

**File:** `app/middleware.py` → `RequestSizeLimitMiddleware`

## 6. Security Response Headers

All responses include 11 security headers:

| Header | Value | Purpose |
|--------|-------|---------|
| `X-Frame-Options` | `DENY` | Clickjacking protection |
| `X-Content-Type-Options` | `nosniff` | MIME-type sniffing prevention |
| `X-XSS-Protection` | `1; mode=block` | Legacy XSS filter (modern browsers ignore) |
| `Referrer-Policy` | `strict-origin-when-cross-origin` | Referrer leakage prevention |
| `Permissions-Policy` | `geolocation=(), microphone=(), camera=()` | Disable powerful APIs |
| `Content-Security-Policy` | `default-src 'none'; script-src 'self'; ...` | XSS mitigation via whitelist |
| `Strict-Transport-Security` | `max-age=31536000; includeSubDomains` | HTTPS enforcement (1 year) |
| `X-Permitted-Cross-Domain-Policies` | `none` | Cross-domain policy block |
| `Cache-Control` | `no-store, no-cache, must-revalidate` | Prevent caching of sensitive data |
| `Pragma` | `no-cache` | Legacy cache prevention (HTTP/1.0) |
| `Expires` | `0` | Additional cache prevention |

**File:** `app/middleware.py` → `SecurityHeadersMiddleware`

## 7. Error Sanitization

**Information Disclosure Prevention:**
- 5xx (server) errors: Sanitized to generic message "An internal error occurred"
- 4xx (client) errors: Kept as-is for validation feedback
- Full error details logged server-side for debugging
- Prevents attacker intelligence gathering from error responses

**What's Hidden:**
- Stack traces
- Database error messages
- Internal function names
- System configuration details

**File:** `app/middleware.py` → `ErrorSanitizationMiddleware`

## 8. Environment Configuration Validation

**Startup Validation:**
- Critical settings checked before service starts
- Service fails immediately with clear errors if config invalid
- Graceful degradation for optional settings

**Critical Settings:**
- `GOVERNANCE_BACKEND_URL` (for Builder Orchestrator)
- Database URL schema validation (PostgreSQL only)

**Validated Numeric Settings:**
- `MAX_BODY_SIZE` (integer byte count)
- `GOVERNANCE_REDELIVERY_INTERVAL` (float seconds)

**Logged Configuration:**
- ✓ Configured settings shown at startup
- ⚠ Warnings for missing optional security settings
- ℹ Info for operational settings

**Fail-Closed:**
- Invalid config → service doesn't start
- No silent failures or degraded security

**File:** `app/config.py`

## 9. Multi-Tenant Data Isolation

**Row-Level Security (RLS):**
- All 25 tables have RLS policies enabled
- Tenant ID in WHERE clause on every query
- Database enforces isolation at PostgreSQL level
- Service role keys used ONLY in Edge Functions

**Audit Logging:**
- All external API calls logged in `ai_tool_runs`/`workflow_runs`
- Timestamp, tenant_id, operation tracked
- Enables compliance audit trails

## 10. Database Connection Security

**Pooling & Timeouts:**
- Connection pooling prevents resource exhaustion
- Prepared statements prevent SQL injection
- Timeouts prevent hanging connections

**Encrypted Connections:**
- PostgreSQL connections support SSL/TLS
- Recommended: `postgresql://...?sslmode=require`

## 11. Service-to-Service Security

**Builder Orchestrator → Governance Backend:**
- Uses `BUILDER_SERVICE_TOKEN` (shared secret)
- Includes `X-Tenant-Id` header to identify tenant
- Token stored in environment, never in code
- Service-token auth separate from user-token auth

**Webhook Delivery (Governance → n8n):**
- HTTPS required in production
- Webhook URL configurable, not hardcoded
- Redelivery with exponential backoff on failure
- Failed attempts logged and retryable

## 12. Logging & Monitoring

**Security Events Logged:**
- Authentication failures (401/403)
- Rate limit violations (429)
- Request size violations (413)
- Configuration errors (startup)
- Internal server errors (500)
- All logged with timestamp, IP, tenant_id, request path

**Log Levels:**
- `ERROR`: Critical issues requiring attention
- `WARNING`: Security-relevant non-blocking issues
- `INFO`: Configuration and operational events
- `DEBUG`: Verbose tracing (development only)

## 13. CORS Configuration

**Default:** All origins allowed (`*`)
- Suitable for public API during development
- **Production:** Restrict to specific origins via `CORS_ORIGINS` env var
  - Example: `https://app.example.com`
  - Multiple origins: Comma-separated list

**Methods:** All allowed (GET, POST, PUT, DELETE, etc.)

## 14. OWASP Top 10 Coverage

| OWASP Item | Mitigation |
|------------|-----------|
| **A01:2021 - Broken Access Control** | Bearer tokens, RLS policies, tenant context validation |
| **A02:2021 - Cryptographic Failures** | TLS 1.2+, encrypted database connections |
| **A03:2021 - Injection** | Pydantic validation, shell injection blocking, prepared statements |
| **A04:2021 - Insecure Design** | Defense-in-depth, fail-closed on config errors |
| **A05:2021 - Security Misconfiguration** | Startup env validation, health check shows auth status |
| **A06:2021 - Vulnerable Outdated Components** | Regular dependency scanning, pinned versions |
| **A07:2021 - Identification & Auth** | Constant-time token comparison, service-to-service auth |
| **A08:2021 - Software Data Integrity Failures** | Request validation, error sanitization |
| **A09:2021 - Logging & Monitoring** | All security events logged with context |
| **A10:2021 - SSRF** | Not applicable (no outbound requests to user-controlled URLs) |

## 15. Known Limitations & Future Work

**Phase 2 (Current):**
- ✅ TLS/HTTPS
- ✅ Authentication & multi-tenancy
- ✅ Input validation
- ✅ Rate limiting & DoS prevention
- ✅ Security headers & error sanitization
- ✅ Environment validation

**Phase 3 (Future):**
- OAuth2/OIDC for user-facing auth
- API key rotation helpers
- Secrets vault integration
- Advanced threat detection
- Security audit logging to external systems
- Compliance reporting (SOC 2, ISO 27001)

## 16. Testing Security

**Test Coverage:**
- 66+ security-related tests
- Input validation tests (20+)
- Rate limiting tests (5+)
- Security header tests (10+)
- Error sanitization tests (2+)
- Config validation tests (25+)

**Test Execution:**
```bash
# Run all security tests
npm test -- test_security test_validators test_config

# Run specific security test
npm test -- test_security_headers.py
```

## 17. Security Incident Response

**If a security issue is discovered:**

1. **Do not** open a public GitHub issue
2. Email: security@realsyncdynamicsai.de (placeholder)
3. Include: Description, reproduction steps, impact assessment
4. Allow 90 days for patch development before disclosure

**Security Updates:**
- Announced via security advisories
- Patched in all supported versions
- Backward compatibility maintained where possible

## 18. Configuration Checklist for Production

Before deploying to production, ensure:

- [ ] `DATABASE_URL` set to PostgreSQL (not in-memory)
- [ ] `*_AUTH_TOKENS` configured (API requires auth)
- [ ] `*_SERVICE_TOKEN` configured (for inter-service auth)
- [ ] `CORS_ORIGINS` restricted to your domain(s)
- [ ] `LOG_LEVEL` set to `INFO` or `WARNING` (not `DEBUG`)
- [ ] TLS certificates configured (ACME/Let's Encrypt)
- [ ] Health checks monitored (`/health` endpoint)
- [ ] Error logs monitored for security events
- [ ] Regular dependency updates scheduled

## References

- OWASP Top 10: https://owasp.org/www-project-top-ten/
- NIST Cybersecurity Framework: https://www.nist.gov/cyberframework
- CWE Top 25: https://cwe.mitre.org/top25/
- FastAPI Security: https://fastapi.tiangolo.com/advanced/security/
