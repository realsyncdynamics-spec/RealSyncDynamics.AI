# RealSyncDynamics MVP Scope (Q4 2026)

**Status:** Active Development  
**Timeline:** 12 Weeks (Dez 2026 - Launch with First Customers)  
**Target:** German/EU Agencies (5-30 employees)

---

## Core Problem

Agenturen nutzen KI-Tools & Third-Party Services auf Websites, wissen aber nicht:
- Ist das dem EU AI Act konform?
- Erfüllen wir DSGVO-Anforderungen?
- Haben wir revisionssichere Nachweise?

**MVP löst:** "Website-Scan in 2 Min → Compliance Score + PDF"

---

## MVP Feature Set (Must-Have Only)

### 1. Website Scanner
**Input:** URL  
**Checks:**
- ✅ EU AI Act: Werden KI-Tools offengelegt?
- ✅ DSGVO: Ist ein Cookie-Banner vorhanden?
- ✅ DSGVO: Existiert eine Privacy Policy?
- ✅ Baseline: HTTPS/TLS vorhanden?

**Output:** Liste von 4-8 Findings (ja/nein + Schweregrad)

### 2. Compliance Dashboard
**Zielgruppe:** Eingeloggte Tenant-User  
**Features:**
- Scan-Verlauf (zuletzt 20 Scans)
- Einzelne Scan-Details (Findings, Schweregrad, Fixes)
- Status-Transitions (Open → Acknowledged → Fixed)

**Nicht in MVP:**
- Multi-Workspace Support
- Advanced Filtering
- Historical Trends
- Evidence Archive

### 3. Compliance Score
**Formula:**
- Bestandene Checks: X/4 = Score
- Score 0-100: (X/4) * 100
- Schweregrad-Faktor: kritisch = -20 Punkte

**Output:** Single Number für Reports

### 4. PDF Report Export
**Content:**
- Website-URL
- Scan-Datum
- Compliance Score
- Liste Findings (Kurzbeschreibung + Fix)
- Company Logo Placeholder

**Delivery:** Downloadable via Frontend

### 5. Stripe Billing (1 Plan Only)
**Plan:** Professional  
- €99/month (annual: €990)
- 50 scans/month
- PDF Reports
- Email Support

**Billing:** Stripe Subscription, basic recurring

### 6. Authentication
**Methods:**
- Email/Password (Supabase)
- OAuth (optional, not MVP)

**Tenant Model:** Single Tenant per User (can invite later)

---

## NOT in MVP (Phase 2+)

❌ Monitoring/Scheduler  
❌ AI Agents  
❌ Governance Workflows  
❌ Evidence Vault  
❌ Advanced Policy Engine  
❌ API  
❌ SSO/SCIM  
❌ Browser Extension  
❌ Multi-Workspace Advanced Features  
❌ Admin Panels  
❌ Role Management (beyond basic)  
❌ Custom Reports  
❌ Integrations  
❌ Webhooks  

---

## Success Criteria

**By December 31, 2026:**
- [ ] MVP Deployed (staging environment)
- [ ] 5 pilot customers onboarded (beta access)
- [ ] First customer paid (€99)
- [ ] 50 scans executed successfully
- [ ] Zero critical bugs in production path
- [ ] Landing page live

**By March 31, 2027:**
- [ ] 20 paid customers
- [ ] €1.5-2k MRR
- [ ] <2% churn
- [ ] Net Promoter Score > 40

---

## Technical Dependencies

**Already Built:**
- ✅ tenant-audit Edge Function (orchestration)
- ✅ gdpr-audit Edge Function (scanner logic)
- ✅ scan_runs + findings Database schema
- ✅ Supabase Auth + RLS
- ✅ Frontend UI components (ScanDetailView, ScansListView, etc.)
- ✅ Stripe SDK integration

**To Finish:**
- [ ] gdpr-audit Checks: Verify all 4 checks working
- [ ] PDF Export: Test with real reports
- [ ] Stripe Webhook: Handle subscription events
- [ ] Landing Page: Copy + CTA
- [ ] Monitoring: Error tracking (Sentry)
- [ ] Tests: E2E for happy path
- [ ] Deployment: Vercel/Supabase production setup

---

## Out of Scope (Explicitly)

- Multi-currency (EU only)
- Enterprise features (coming Phase 3)
- Integrations (coming Phase 5)
- AI Copilot (coming Phase 4)
- Custom Frameworks (coming Phase 3)
- Advanced Analytics (coming Phase 2)

---

## Deployment Target

**Frontend:** Vercel  
**Backend:** Supabase (Edge Functions + Postgres)  
**DNS:** Cloudflare  
**Monitoring:** Sentry  

**Single Deployment:** `realsync.app` (or similar)

---

## Communication Strategy

### To Users (Agencies)
> "EU AI Act Compliance Check — Instant website audit. Know your risks in 2 minutes."

### Positioning
- ✅ Speed (instant results)
- ✅ Accuracy (EU-specific rules)
- ✅ Actionable (concrete fixes)
- ✅ Affordable (€99/month)

---

## Decision Log

**Why these 4 checks?**
- AI Act Disclosure = differentiator (market gap)
- Cookie Banner = baseline DSGVO (everyone knows it)
- Privacy Policy = legal requirement
- HTTPS = table stakes

**Why no Monitoring?**
- Adds 4+ weeks of work
- Not core to "scan = compliance proof"
- Phase 2 feature

**Why no Advanced Roles?**
- Solo founder uses basic auth
- Teams come in Phase 2
- Overcomplicates MVP

---

**Owner:** Solo Founder  
**Last Updated:** 2026-07-14  
**Next Review:** Weekly (Fridays)
