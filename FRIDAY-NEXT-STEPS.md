# Friday Next Steps — Landing Page Implementation

**Date:** July 15, 2026 (Thursday Evening)  
**Next:** Friday, July 16, 2026  
**Task:** Build /audit landing page

---

## Thursday Recap (What's Done)

✅ **Stripe Infrastructure Assessment Complete**
- All Edge Functions exist (stripe-checkout, stripe-webhook, stripe-portal)
- Database schema ready (subscriptions, subscription_plans, feature_usage)
- UI components built (CheckoutPage, BillingView, PlanUpgradeModal)
- Documentation created (STRIPE-INTEGRATION-STATUS.md, THURSDAY-STRIPE-CHECKLIST.md)

**Action Items Created:**
1. Set `STRIPE_SECRET_KEY` in Supabase secrets
2. Set `STRIPE_WEBHOOK_SECRET` in Supabase secrets
3. Create Stripe product & price (get real `price_xxxxx` ID)
4. Update `public.products` table with real Stripe price IDs
5. Execute manual payment test (test card 4242 4242 4242 4242)
6. Verify webhook event syncing

**⚠️ NOTE:** These action items can be done in parallel or after landing page. Stripe setup does NOT block Friday landing page work.

---

## Friday Task: Landing Page (/audit)

### Goal
Create public landing page at `/audit` that:
1. Requires NO authentication
2. Shows value proposition ("EU AI Act Compliance in 2 Minutes")
3. Explains problem & solution
4. Displays pricing
5. Drives conversion (CTAs to start free scan or upgrade)

### Route Structure
```
/audit → AuditLanding.tsx (new component)
  ↓
  (user clicks "Try Free")
  ↓
/scan → ScanInputView (existing)
  ↓
  (user enters URL)
  ↓
/scan/:scanId → ScanDetailView (existing, with PDF download)
```

### Component Checklist

#### NEW: `src/pages/AuditLanding.tsx`

```tsx
// Structure:
export function AuditLanding() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-obsidian to-obsidian-900">
      {/* Top Navigation */}
      <AuditLandingNav />
      
      {/* Hero Section */}
      <HeroSection 
        title="EU AI Act Compliance — in 2 Minutes"
        subtitle="Scan your website and get an instant compliance score"
        cta={{ 
          label: "Try Free",
          href: "/scan" 
        }}
      />
      
      {/* Problem Section */}
      <ProblemSection 
        problem="80% of websites unknowingly violate EU AI Act Article 52"
        subtext="Without transparent AI disclosure, your website faces legal risk"
        image="/images/compliance-risk.svg" // or SVG inline
      />
      
      {/* How It Works (3 Steps) */}
      <HowItWorksSection 
        steps={[
          {
            icon: "🔗",
            title: "Enter Your URL",
            description: "Paste your website URL"
          },
          {
            icon: "⚡",
            title: "Instant Scan",
            description: "AI analyzes DSGVO, HTTPS, AI Disclosure, Privacy Policy"
          },
          {
            icon: "📋",
            title: "Download Report",
            description: "Get audit-grade PDF with findings"
          }
        ]}
      />
      
      {/* Pricing Section */}
      <PricingSection 
        tiers={[
          {
            name: "Free Audit",
            price: "0",
            description: "Quick scan, instant score",
            cta: "Try Now"
          },
          {
            name: "Professional",
            price: "79", // Show as €99/month if preferred
            billing: "/ Monat",
            description: "Continuous monitoring + compliance tracking",
            cta: "14 Days Free",
            highlight: true
          }
        ]}
      />
      
      {/* FAQ Section */}
      <FAQSection 
        faqs={[
          {
            question: "What is the EU AI Act?",
            answer: "Article 52 requires transparency when AI is used to interact with users..."
          },
          {
            question: "Is my score private?",
            answer: "Yes. We don't store emails or share results unless you create an account..."
          },
          {
            question: "Can I export the report?",
            answer: "Yes. Free audit generates downloadable PDF report."
          },
          {
            question: "What is 'continuous monitoring'?",
            answer: "Professional plan includes weekly rescans to detect compliance drift..."
          },
          {
            question: "How much does it cost?",
            answer: "Free audit = no cost. Professional = €79/month with 14-day free trial."
          }
        ]}
      />
      
      {/* Footer */}
      <AuditLandingFooter 
        links={{
          privacy: "/privacy-policy",
          terms: "/terms-of-service",
          contact: "support@realsync.app"
        }}
      />
    </div>
  );
}
```

### Design System

**Colors (Landing Page Light Theme):**
- Background: Slate `slate-50` (#F8FAFC)
- Header: White `white` + soft border
- Text: Slate `slate-900` (dark)
- Accent: Petrol `petrol-700` (#0F766E)
- Highlight: Security Blue `security-500` (#0052FF)

**Components to Create/Reuse:**
- [x] LandingNavbar (likely exists)
- [x] HeroSection (might exist)
- [ ] ProblemSection (new)
- [ ] HowItWorksSection (new)
- [ ] PricingSection (might exist, adapt from pricing page)
- [ ] FAQSection (new)
- [x] Footer (likely exists)

**Typography:**
- Hero H1: 48px, bold
- Section H2: 32px, bold
- Body: 16px, regular
- Small: 14px, regular

### Implementation Plan

1. **Create Page Component (1 hour)**
   ```bash
   touch src/pages/AuditLanding.tsx
   ```

2. **Build Sections (2 hours)**
   - HeroSection (hero + main CTA)
   - ProblemSection (value prop)
   - HowItWorksSection (3-step flow with icons)
   - PricingSection (2 tiers: free + starter)
   - FAQSection (accordion or expandable)

3. **Add to Router (15 min)**
   - Import in `src/App.tsx`
   - Add route: `<Route path="/audit" element={<AuditLanding />} />`
   - Make PUBLIC (no auth wrapper)

4. **Style & Polish (1 hour)**
   - Responsive: desktop, tablet, mobile
   - Dark mode compatible (use `@media (prefers-color-scheme: dark)`)
   - Tailwind classes aligned to CLAUDE.md design system

5. **Test (30 min)**
   - [ ] Page loads at /audit without auth
   - [ ] Hero CTA links to /scan
   - [ ] All links clickable
   - [ ] Mobile responsive (test on iPhone)
   - [ ] No console errors

### Testing

```bash
# Start dev server
npm run dev

# Test routes
curl http://localhost:3000/audit
# Should return HTML (not redirect to login)

# Manual test
open http://localhost:3000/audit
# Try: click "Try Free" → should go to /scan
# Try: click "14 Days Free" → should go to /checkout/starter
```

### Success Criteria

- [x] Page loads without authentication
- [ ] Hero section visible with compelling copy
- [ ] CTA buttons functional
- [ ] Problem/Solution clearly articulated
- [ ] Pricing transparent
- [ ] Mobile responsive
- [ ] No console errors
- [ ] Fast load time (<3s)

---

## Saturday-Sunday (Preview)

**E2E Testing:**
1. Sign up (new user)
2. Scan website
3. View results + PDF
4. Click upgrade
5. Complete payment (test card)
6. Verify subscription in dashboard
7. Verify features unlocked

**Documentation:**
- QUICKSTART.md (how to run locally)
- DEPLOYMENT.md (how to deploy)

---

## Commits This Week

- ✅ bd6f4b3: Week 1 plan
- ✅ 603bc59: AI disclosure detection
- ✅ b0985f9: Deployment strategy
- ✅ c7372ff: AI disclosure integration
- ✅ 3b75eb6: Scanner testing guide
- ✅ eb040fc: PDF export status
- ✅ c747db5: Stripe verification status
- ✅ 6233a8e: Stripe checklist + progress tracking
- ⏳ Friday: Landing page + Stripe secrets (2 commits)
- ⏳ Saturday-Sunday: Testing + deployment (2 commits)

---

## Resources

**Design Reference:**
- Current hero: `src/pages/MainLanding.tsx` (if similar style wanted)
- Pricing page: `src/features/billing/PricingPage.tsx` (reuse components)
- Landing navbar: `src/components/LandingNavbar.tsx`

**Tailwind Classes (Light Theme):**
```tsx
// Hero background
className="bg-gradient-to-b from-slate-50 to-slate-100"

// Cards
className="bg-white rounded-chip border border-slate-200"

// Accent text
className="text-petrol-700 font-semibold"

// CTA Button
className="bg-petrol-700 text-white px-6 py-3 rounded-chip hover:bg-petrol-800"
```

---

## READY FOR FRIDAY

**All materials prepared:**
- ✅ THURSDAY-STRIPE-CHECKLIST.md (for parallel execution)
- ✅ STRIPE-INTEGRATION-STATUS.md (reference)
- ✅ WEEK-1-PLAN.md (updated expectations)
- ✅ MVP-BUILD-PROGRESS.md (tracking)
- ✅ This file (FRIDAY-NEXT-STEPS.md)

**Proceed with:**
1. Friday: Build landing page (/audit)
2. Stripe setup: Run through THURSDAY-STRIPE-CHECKLIST.md (15-30 min setup, 20 min test)
3. Saturday-Sunday: E2E testing + deployment

**Time Budget:**
- Friday: 4-5 hours (landing page)
- Stripe (anytime): 1-2 hours (if not done Thursday)
- Sat-Sun: 6-8 hours (testing + deployment)

---

**Next Update:** Friday EOD  
**Owner:** Solo Founder  
**Status:** Ready to proceed

