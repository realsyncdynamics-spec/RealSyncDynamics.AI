# Release Roadmap — Integration Order & Gate Strategy

**Version:** 1.0  
**Date:** 2026-07-28  
**Status:** Draft - Phase 5 Release Planning  

---

## Executive Summary

This roadmap documents the recommended integration order for Phase 5 Release Candidate (RC), addressing infrastructure dependencies, governance layer stability, security hardening, monetization validation, and QA gates. Key changes from baseline: reordering governance tasks (browser-agent after MCP-auth), advancing price-logic before checkout integration, and adding a dedicated Revenue Gate post-Phase 4.

---

## Pre-Gate 1: Prerequisites

Before any merges occur, validate these foundation requirements:

| Item | Issue | Status | Owner |
|------|-------|--------|-------|
| Cloudflare API Token as GitHub Secret | #886 | ⏳ Pending | DevOps |
| Branch Protection Rules | #875 (or equiv.) | ⏳ Pending | DevOps |
| PostgreSQL & Redis Connectivity Check | #897 | ⏳ Pending | DevOps |
| Final Review of Draft PRs | (rolling) | ⏳ Pending | Tech Lead |

**Gate Entry Criteria:** All ✅ before proceeding to Phase 1.

---

## Phase 1 — Infrastructure & CI/CD

**Objective:** Establish deployment foundation and automated testing pipeline.

### Recommended Sequence

1. **#900 — VPS Deployment**
   - Deploy base VPS stack (Traefik, reverse proxy setup)
   - **Blocker Resolution:** Must complete before Docker + containerization work

2. **#887 — Docker Stack + Traefik**
   - Docker Compose setup for Playwright, Redis, PostgreSQL
   - Traefik ingress configuration
   - **Dependency:** Requires #900 infrastructure in place

3. **#886 — Playwright CI Integration**
   - GitHub Actions workflow for E2E tests
   - Playwright browser provisioning (Chromium)
   - **Validation:** Run CI to green completion once

4. **Post-#886 Checkpoint:**
   - ✅ CI runs fully green (all checks pass)
   - ✅ Deploy staging environment and verify E2E tests pass
   - ✅ Confirm Docker images build cleanly

5. **#882 — CI/CD Automation** (Draft → Ready)
   - Automated deployment triggers for staging/prod
   - Depends on #887 and #886 passing

6. **#897 — Cloudflare Containers Integration** (Draft → Ready)
   - Configure Cloudflare Workers integration
   - Validate external service connectivity (PostgreSQL, Redis)
   - **Validation:** Health checks must pass in staging

### Gate 1 Closure Criteria
- [ ] #900 merged
- [ ] #887 merged
- [ ] #886 merged and CI green
- [ ] Staging deployment validated
- [ ] #882 and #897 transitioned to Ready for Review

---

## Phase 2 — Governance Layer

**Objective:** Stabilize authentication, MCP integration, browser-agent, and decision workflows.

### Recommended Sequence (Reordered)

**Rationale for Change:**  
Original order: #896 → #899 → #889  
**Recommended:** #896 → #889 → #899  

Browser-agent (#899) benefits from stable authentication already present. Deferring it allows MCP-auth integration (#889) to solidify first, reducing rework when auth patterns later interface with browser operations.

1. **#896 — Governance Runtime**
   - Sentinel-loop optimization
   - Control-to-asset auto-mapping
   - **Validation:** Governance incident workflow end-to-end

2. **#889 — MCP Authentication** (Draft → Ready)
   - Service-role isolation for edge functions
   - MCP auth contracts and validation
   - **Validation:** Test multi-tenant isolation with RLS policies

3. **#899 — Browser-Agent Function** (Draft → Ready)
   - Agent-driven browser automation
   - Depends on stable auth from #889
   - **Validation:** Automated navigation and asset discovery

### Gate 2 Closure Criteria
- [ ] #896 merged
- [ ] #889 merged and auth contracts validated
- [ ] #899 merged and browser-agent workflows confirmed

---

## Phase 3 — Security Hardening

**Objective:** Harden API surface, headers, authentication, and compliance posture.

### Sequence

**#892 — Security Hardening & Compliance**
- CSP (Content Security Policy) headers
- HSTS (HTTP Strict-Transport-Security)
- `X-Frame-Options` (clickjack prevention)
- `Content-Security-Policy` directives
- Cookie flags: `Secure`, `HttpOnly`, `SameSite`
- Network request auditing via browser DevTools

### Pre-Merge Security Checklist
- [ ] All CSP directives validated
- [ ] HSTS enabled with preload
- [ ] Cookie flags correctly set on auth/session cookies
- [ ] No inline scripts or external CDNs (except approved)
- [ ] Rate limiting on API endpoints
- [ ] CORS policy restrictive (no wildcard)

### Gate 3 Closure Criteria
- [ ] #892 merged
- [ ] Security audit report generated
- [ ] No high-severity findings remain

---

## Phase 4 — Monetization

**Objective:** Validate pricing logic, checkout flow, and subscription lifecycle.

### Recommended Sequence (Reordered)

**Rationale for Change:**  
Original order: #893 → #891 → #877 → #878 → #894  
**Recommended:** #893 → #878 → #891 → #877 → #894  

Price calculation (#878) is the logical foundation. Stabilizing pricing logic before checkout integration (#891) prevents integration rework when tier definitions or calculations change.

1. **#893 — Stripe Integration**
   - Establish Stripe account connection
   - Webhook setup and validation
   - Product/plan creation in Stripe dashboard

2. **#878 — Pricing Logic & Tiers** (Draft → Ready)
   - Define tier calculations (Free, Starter, Growth, Agency, Enterprise)
   - Usage meter logic
   - Proration and upgrade/downgrade math
   - **Source of Truth:** `src/config/pricing.ts`
   - **Validation:** Unit tests for all tier transitions

3. **#891 — Checkout Experience** (Draft → Ready)
   - Checkout form integration
   - Stripe Elements integration
   - Trial period logic
   - **Dependency:** Requires #878 pricing logic finalized
   - **Critical:** Replace placeholder `internal_default_*` price IDs with real `price_xxx` IDs from Stripe

4. **#877 — Trial & Onboarding**
   - 14-day trial activation
   - Upgrade prompts
   - Feature gating per tier

5. **#894 — Invoicing & Billing**
   - Invoice generation
   - Tax calculation (EU VAT rules)
   - Subscription renewal

### Critical Risk — Stripe Price IDs

⚠️ **BLOCKER:** If #891 still uses placeholder `internal_default_*` values instead of real Stripe `price_xxx` IDs, **live checkouts will fail with HTTP 400**. This must be resolved before production release.

**Validation Steps:**
- [ ] Fetch Stripe price list and confirm `price_xxx` IDs exist
- [ ] Replace all `internal_default_*` placeholders
- [ ] Test checkout with real price IDs in staging
- [ ] Confirm Stripe webhook logs show successful charge events

### Gate 4 Closure Criteria (Monetization)
- [ ] #893 merged (Stripe connected)
- [ ] #878 merged (pricing logic validated)
- [ ] #891 merged with real Stripe price IDs (no more placeholders)
- [ ] #877 merged (trial flow working)
- [ ] #894 merged (invoicing functional)

---

## Phase 4B — Revenue Gate (NEW)

**Objective:** Comprehensive validation of entire payment flow before go-live.

### Test Scenarios (All Must Pass)

| Scenario | Expected Outcome | Status |
|----------|------------------|--------|
| Sign-up → Trial activation | 14-day trial starts, no charge | ⏳ |
| Trial expiry → Upgrade prompt | User prompted to select paid plan | ⏳ |
| Checkout → Payment success | Subscription active, invoice sent | ⏳ |
| Checkout → Payment failure | Error message, retry prompt | ⏳ |
| Cancel subscription | Next billing cycle cancelled, access revoked | ⏳ |
| Upgrade (Starter → Growth) | Prorated credit applied, new plan active | ⏳ |
| Downgrade (Growth → Starter) | Refund calculated, plan switch on next cycle | ⏳ |
| Invoice retrieval | Customer downloads PDF invoice | ⏳ |
| Tax calculation | VAT correctly applied (EU rules) | ⏳ |
| Webhook integrity | Stripe events logged in `webhook_logs` table | ⏳ |
| Stripe dashboard sync | Customer data matches Stripe records | ⏳ |
| Idempotency | Duplicate webhook events handled gracefully | ⏳ |

### Gate 4B Closure Criteria
- [ ] All scenarios marked ✅ (tested in staging)
- [ ] No data inconsistencies between app and Stripe
- [ ] Webhook retry logic validated
- [ ] Refund/chargeback handling documented and tested

---

## Phase 5 — Release QA

**Objective:** Comprehensive quality assurance across all surfaces before GA.

### Performance Testing
- [ ] Lighthouse score ≥ 90 (desktop & mobile)
- [ ] Core Web Vitals: LCP < 2.5s, FID < 100ms, CLS < 0.1
- [ ] Load test: 500 concurrent users, < 2s response time

### Cross-Browser & Device Testing
- [ ] Chrome, Firefox, Safari, Edge (latest 2 versions each)
- [ ] Mobile: 320px–430px (phone), 768px–1024px (tablet), 1440px+ (desktop)
- [ ] Touch interactions on mobile
- [ ] Portrait & landscape orientations

### Accessibility (WCAG AA)
- [ ] Keyboard navigation (Tab, Enter, Escape)
- [ ] Screen reader support (NVDA, JAWS, VoiceOver)
- [ ] Color contrast ≥ 4.5:1 (text), 3:1 (graphics)
- [ ] Focus indicators visible
- [ ] Alt text on all images

### Visual Regression Testing
- [ ] Automated screenshot comparison (e.g., Percy, Chromatic)
- [ ] Responsive design breakpoints validated
- [ ] Dark mode verified (if applicable)
- [ ] Theme consistency across all pages

### Monitoring & Error Tracking
- [ ] Sentry integration live and capturing errors
- [ ] Error rate baseline established (< 0.1%)
- [ ] Real User Monitoring (RUM) enabled
- [ ] API response time tracking (p95 < 500ms)

### Critical Path E2E Tests
- [ ] Sign-up → Email verification → Dashboard access
- [ ] Free audit scan → Results display → PDF export
- [ ] Trial upgrade → Checkout → Subscription active
- [ ] Search & filter governance controls
- [ ] Create & submit incident workflow
- [ ] Evidence vault: upload, retrieve, verify hash

### Deployment Readiness
- [ ] Rollback plan documented and tested
- [ ] Database backup & restore verified
- [ ] SSL certificate valid and renewed
- [ ] DNS propagation checked (all regions)
- [ ] CDN cache invalidation working
- [ ] Rate limiting active on API endpoints

### Gate 5 Closure Criteria
- [ ] Lighthouse score ≥ 90
- [ ] All cross-browser tests passing
- [ ] WCAG AA conformance verified
- [ ] Visual regression tests approved
- [ ] Error rate < 0.1% over 24-hour load test
- [ ] All critical path E2E tests green
- [ ] Sentry baseline metrics established

---

## Timeline & Milestones

| Phase | Start | End | Duration |
|-------|-------|-----|----------|
| Pre-Gate 1 Checks | Week 1 | Week 1 | 1 week |
| Phase 1 (Infrastructure) | Week 1 | Week 2 | 1 week |
| Gate 1 Validation | Week 2 | Week 2 | 3 days |
| Phase 2 (Governance) | Week 2 | Week 3 | 1 week |
| Gate 2 Validation | Week 3 | Week 3 | 3 days |
| Phase 3 (Security) | Week 3 | Week 4 | 1 week |
| Gate 3 Validation | Week 4 | Week 4 | 3 days |
| Phase 4 (Monetization) | Week 4 | Week 5 | 1 week |
| Phase 4B (Revenue Gate) | Week 5 | Week 5 | 3 days |
| Phase 5 (QA) | Week 5 | Week 6 | 1.5 weeks |
| Gate 5 Validation | Week 6 | Week 7 | 1 week |
| **Release** | Week 7 | — | — |

**Total Duration:** 7 weeks (49 days)

---

## Risk Registry

| Risk | Impact | Probability | Mitigation | Owner |
|------|--------|-------------|-----------|-------|
| Cloudflare container connectivity fails | 🔴 High | 🟠 Medium | Test external service connections in isolated env first | DevOps |
| Stripe price IDs still using placeholders at merge | 🔴 High | 🔴 High | Code review checklist + automated test for real price IDs | Finance/Engineering |
| Auth contracts break browser-agent workflow | 🟠 Medium | 🟠 Medium | Integration test #889 + #899 before Gate 2 closure | Eng Lead |
| CSP too restrictive → legitimate requests blocked | 🟠 Medium | 🟠 Medium | Staging load test with real-world traffic patterns | Security |
| RLS policies leak multi-tenant data | 🔴 High | 🟢 Low | Automated test suite for tenant isolation (#889) | Security |
| Lighthouse score < 90 on release day | 🟡 Low | 🟠 Medium | Weekly performance budget checks during Phase 5 | Frontend |
| Payment webhook race condition | 🔴 High | 🟢 Low | Idempotency keys + transaction-level locking in DB | Backend |

---

## Decision Log

### Decision #1: Reorder Governance Phase (Browser-Agent Deferral)
**Date:** 2026-07-28  
**Rationale:** Browser-agent benefits from stable MCP-auth. Prevents rework if auth patterns change during integration.  
**Status:** ✅ Approved for roadmap  

### Decision #2: Advance Pricing Logic Before Checkout
**Date:** 2026-07-28  
**Rationale:** Pricing calculations are the foundation for checkout. Integrating them first prevents checkout rework when tier definitions or calculations change.  
**Status:** ✅ Approved for roadmap  

### Decision #3: Add Revenue Gate Post-Phase 4
**Date:** 2026-07-28  
**Rationale:** Monetization is foundational for GA. Dedicated revenue-flow testing prevents post-launch payment failures.  
**Status:** ✅ Approved for roadmap  

---

## Approval & Sign-Off

| Role | Name | Date | Sign-Off |
|------|------|------|----------|
| Tech Lead | — | — | ⏳ |
| Product Manager | — | — | ⏳ |
| Security Lead | — | — | ⏳ |
| DevOps Lead | — | — | ⏳ |

---

## Appendix: Gate Definitions

### Gate Structure
Each gate is a **hard stop**: no PR merges to main proceed until all gate criteria pass.

**Gate 1 (Infrastructure):** CI/CD pipeline fully automated, staging deployment validated.  
**Gate 2 (Governance):** Auth contracts stable, browser-agent workflows confirmed.  
**Gate 3 (Security):** No high-severity findings, CSP/HSTS deployed.  
**Gate 4 (Monetization):** Checkout flow end-to-end, Stripe integration live.  
**Gate 4B (Revenue):** All payment scenarios passing in staging.  
**Gate 5 (QA):** Performance, accessibility, cross-browser tests green.  

---

**Document Version:** 1.0  
**Last Updated:** 2026-07-28  
**Maintained By:** Engineering Team  
