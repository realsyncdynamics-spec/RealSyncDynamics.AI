# MVP Launch Checklist (12 Weeks to Production)

**Launch Date:** December 31, 2026  
**Current Week:** 1 of 12  
**Owner:** Solo Founder

---

## 🔴 Phase 1: Core Functionality (Weeks 1-4)

### Scanner Backend
- [ ] Verify gdpr-audit Edge Function works (test with 5 URLs)
- [ ] Verify tenant-audit orchestration works
- [ ] Verify all 4 checks executing correctly:
  - [ ] EU AI Act disclosure detection
  - [ ] Cookie banner detection
  - [ ] Privacy policy detection
  - [ ] HTTPS/TLS check
- [ ] Verify findings stored correctly in DB
- [ ] Rate limiting works (prevent abuse)
- [ ] Error handling robust (no crashes)

### Scanner Frontend
- [ ] ScanDetailView works end-to-end
- [ ] ScansListView displays results
- [ ] URL input validation working
- [ ] Loading states clear
- [ ] Error messages user-friendly

### Scoring Logic
- [ ] Score calculation correct (0-100)
- [ ] Severity mapping correct
- [ ] Report payload builds correctly
- [ ] Tests pass for scoring formula

---

## 🟡 Phase 2: Reports & Export (Weeks 5-6)

### PDF Export
- [ ] PDF template designed (company logo placeholder)
- [ ] PDF generation working client-side (@react-pdf/renderer)
- [ ] Includes: URL, Date, Score, Findings
- [ ] Download button working
- [ ] File naming convention: `compliance-report-{domain}-{date}.pdf`

### Email Reports
- [ ] Basic email template (no images, plain text OK)
- [ ] Email send working (Supabase email or SendGrid?)
- [ ] Email includes PDF attachment
- [ ] Email links back to dashboard

---

## 💳 Phase 3: Billing (Weeks 7-8)

### Stripe Setup
- [ ] Stripe account created & configured
- [ ] Professional Plan configured (€99/month)
- [ ] Annual billing option (€990/year, 17% discount)
- [ ] Webhook receiver working
  - [ ] payment_intent.succeeded
  - [ ] customer.subscription.updated
  - [ ] customer.subscription.deleted
- [ ] Subscription stored in Supabase
- [ ] Usage tracking: scans/month counted
- [ ] Rate limiting enforced per plan (50 scans/month)

### Payment Flow
- [ ] Checkout button on dashboard
- [ ] Redirect to Stripe Checkout
- [ ] Success → Subscription active in DB
- [ ] Failed payment → error message
- [ ] Cancel subscription working

### Free Tier (for pilot)
- [ ] 5 free scans (no CC required)
- [ ] Upgrade prompt after 5th scan
- [ ] Email capture for waitlist

---

## 🌐 Phase 4: Deployment & Ops (Weeks 9-10)

### Frontend Deployment
- [ ] Build succeeds: `npm run build`
- [ ] Production checks pass: `npm run check:production`
- [ ] Deployed to Vercel (or similar)
- [ ] Custom domain: `realsync.app` (or TBD)
- [ ] SSL certificate valid
- [ ] env vars set in production

### Backend Deployment
- [ ] Edge Functions deployed to Supabase
- [ ] Database migrations applied (RLS policies verified)
- [ ] Supabase postgrest endpoints responding
- [ ] Environment variables secure (SERVICE_ROLE_KEY NOT exposed)

### Monitoring
- [ ] Sentry configured for frontend errors
- [ ] Sentry configured for edge functions
- [ ] Alert channels set up (email/Slack)
- [ ] Uptime monitor configured (Pingdom/Uptime Robot)
- [ ] Database backups automated

### Security
- [ ] CORS headers correct
- [ ] Rate limiting per IP working
- [ ] No secrets in client code
- [ ] Security headers set (CSP, X-Frame-Options, etc.)
- [ ] OWASP top 10 reviewed

---

## 📝 Phase 5: Content & Marketing (Weeks 11-12)

### Landing Page
- [ ] Hero section (value prop: "EU AI Act Compliance in 2 Min")
- [ ] Problem section (why compliance matters)
- [ ] How it works (3 steps)
- [ ] Pricing section (Professional €99/month)
- [ ] CTA buttons (Primary: "Try Free", Secondary: "See Demo")
- [ ] FAQ section (min 5 questions)
- [ ] Footer (privacy, terms, contact)
- [ ] Mobile responsive
- [ ] SEO basics (meta tags, og:image, structured data)

### Legal Pages
- [ ] Privacy Policy (DSGVO-compliant)
- [ ] Terms of Service
- [ ] Imprint (Impressum) — required for .de/.eu domains
- [ ] Cookie Policy (if using cookies)

### Sales Copy
- [ ] Email templates (welcome, upgrade, password reset)
- [ ] Dashboard empty state (guidance for first scan)
- [ ] Report language (clear, actionable)
- [ ] Error messages (helpful, not technical)

### Documentation
- [ ] Help article: "How to scan your website"
- [ ] Help article: "Understanding the compliance score"
- [ ] FAQ: "What is the EU AI Act?"
- [ ] Support email: support@realsync.app (auto-responder)

---

## ✅ Phase 6: QA & Launch (Weeks 12+)

### Testing
- [ ] Happy path E2E test (sign up → scan → download PDF)
- [ ] Error cases tested (invalid URL, scan fails, payment fails)
- [ ] Performance test (scan completes in <30 sec)
- [ ] Load test (10 concurrent scans)
- [ ] Browser compatibility (Chrome, Firefox, Safari, Edge)
- [ ] Mobile UX tested (iPhone, Android)

### Beta Program
- [ ] 5 pilot customers recruited
- [ ] Beta agreement signed (NDA not needed, but "beta" disclaimer)
- [ ] Onboarding call scheduled
- [ ] Feedback form deployed (Typeform or similar)
- [ ] Weekly sync scheduled

### Go-Live
- [ ] DNS propagated
- [ ] Homepage accessible
- [ ] Stripe live (not test mode)
- [ ] Email sending to real inboxes
- [ ] Monitoring alerts active
- [ ] Incident response plan ready
- [ ] Rollback procedure documented

### Post-Launch (First Week)
- [ ] Monitor Sentry for errors
- [ ] Track conversion metrics (signups, trial-to-paid)
- [ ] Daily beta customer check-in
- [ ] Fix critical bugs within 24 hours
- [ ] Weekly report to self (what worked, what didn't)

---

## 📊 Success Metrics

**By Jan 15, 2027:**
- [ ] 500+ scans executed
- [ ] 5+ customers in beta (≥1 paid)
- [ ] <2% error rate on scan completion
- [ ] Page load time <3 seconds
- [ ] Customer NPS ≥ 40

---

## 🚨 Red Flags (Stop & Reconsider)

If any of these happen, reassess:
- ❌ Scanner accuracy <80% (too many false positives)
- ❌ Scan takes >2 minutes (too slow for "2 min compliance check")
- ❌ More than 1 pilot customer churns (product-market fit issue)
- ❌ Can't get 5 pilot customers by end of Nov (no demand signal)
- ❌ Stripe/payment integration takes >2 weeks (complexity not worth it)

---

## 📱 Weekly Status Template

**Week X (Date):**
- Completed: [list items from checklist]
- Blocked: [if any]
- Next week: [priorities]
- Learnings: [what worked/didn't]

---

**Print this. Check it weekly. Ship on Dec 31.**
