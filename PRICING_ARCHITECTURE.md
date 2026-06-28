# RealSyncDynamics.AI — Pricing & Feature-Gating Architecture

## Overview

RealSyncDynamics.AI is a **Governance OS** — not just a website scanner. The product has two main offerings:

1. **Provenance & C2PA** (legacy, maintained for backwards-compatibility)
2. **Governance OS** (DSGVO + EU AI Act compliance automation)

This document describes the feature-gating infrastructure and pricing structure for Governance OS.

---

## Pricing Tiers (Governance OS)

### 1. Starter — Website Compliance
- **Monthly**: €39
- **Target**: Small businesses, solo entrepreneurs, handcraft shops, local practices
- **Max Assets**: 1 domain
- **Core Features**:
  - Website DSGVO-Scan
  - Monthly rescans
  - Cookie & Tracker detection
  - Basic DSGVO check
  - Simple compliance report
- **NOT Included**:
  - DSGVO monitoring
  - AI-Act classification
  - Evidence Vault
  - Policy Engine

### 2. Professional — Runtime Governance
- **Monthly**: €149
- **Target**: Agencies, SaaS providers, SMBs with multiple websites
- **Max Assets**: 10 domains/products
- **Core Features**:
  - Alles aus Starter
  - Up to 10 domains
  - Continuous DSGVO monitoring
  - AI-Act classification
  - Evidence Vault
  - Team access (5 seats)
  - API & Webhooks (optional)
- **NOT Included**:
  - Deep High-Risk AI assessment
  - Policy Engine
  - Branchen-Agenten

### 3. Governance OS — Full Compliance Operations
- **Monthly**: €599
- **Target**: SaaS companies, AI vendors, regulated enterprises
- **Max Assets**: 50+ domains/products
- **Core Features**:
  - Alles aus Professional
  - Unlimited asset registration
  - Policy Engine
  - DPIA pre-assessment
  - Vendor screening
  - Basic automation
  - Evidence Vault (full)
  - Advanced AI-Act classification
  - High-Risk AI deep analysis
  - Compliance reporting & exports
  - Webhooks & full API
  - Team access (unlimited seats)
- **NOT Included**:
  - Branchen-Agenten (available as add-on)
  - Public-Sector mode

### 4. Enterprise / Regulated
- **Monthly**: Custom (negotiated, min. €1.999+)
- **Target**: Healthcare, Banking, Public Sector, Large Enterprises
- **Max Assets**: Unlimited
- **Core Features**:
  - Alles aus Governance OS
  - Branchen-Agenten (SaaS, Healthcare, Public Sector, Agency)
  - High-Risk AI complete assessment
  - SSO/SAML
  - Public-Sector mode
  - Custom policies
  - Dedicated support + SLA
  - Audit-ready deployments

---

## Feature Keys & Gates

Feature gating is defined in `/src/core/billing/types.ts` and `/src/core/billing/plan-config.ts`.

### Feature Keys (FeatureKey)

```typescript
// Website & DSGVO
'website.scan'         // Website DSGVO scanning
'website.resan'        // Continuous rescans
'cookie.tracking'      // Cookie & third-party tracking detection
'dsgvo.basic'          // Basic DSGVO compliance check
'dsgvo.monitoring'     // Continuous DSGVO runtime monitoring

// AI Governance
'aiact.classification' // EU AI Act classification (basic)
'aiact.deeprisk'       // High-Risk AI deep assessment
'dpia.assessment'      // DPIA pre-assessment
'vendor.screening'     // Vendor & sub-processor screening

// Operations & Automation
'evidence.vault'       // Evidence Vault (signed, immutable)
'policy.engine'        // Policy definition & enforcement engine
'automation.basic'     // Basic automation workflows
'agents.industry'      // Industry-specific governance agents

// Team & Integration
'team.members'         // Team access & role management
'api.access'           // REST API & Webhooks
'sso.enabled'          // SAML/SSO for team auth
'public-sector.mode'   // Public sector compliance mode

// Legacy (Provenance)
'asset.register'       // C2PA asset registration
'asset.verify'         // C2PA asset verification
'watermark.apply'      // Digital watermarking
'c2pa.export'          // C2PA export
...
```

---

## Usage: Feature-Gating in Components

### Hook: `useFeatureGate()`

```typescript
import { useFeatureGate } from '@/hooks/useFeatureGate';

export function MyComponent() {
  const gate = useFeatureGate('professional_governance');

  if (gate.hasFeature('policy.engine')) {
    return <PolicyEngine />;
  }
  return <div>Policy engine not available on this plan.</div>;
}
```

### Hook: `useGovernanceFeatures()`

More convenient for governance-specific features:

```typescript
import { useGovernanceFeatures } from '@/hooks/useFeatureGate';

export function GovernancePanel() {
  const features = useGovernanceFeatures('governance_os');

  if (features.isProfessional) {
    return <RuntimeGovernance />;
  }
  
  if (features.isGovernanceOS) {
    return (
      <>
        <PolicyEngine />
        <AutomationWorkflows />
      </>
    );
  }
}
```

---

## Routing & Pages

### New Routes

| Route | Component | Purpose |
|-------|-----------|---------|
| `/governance-os-pricing` | `GovernanceOSPricing` | Full Governance OS pricing page with feature matrix |
| `/solutions/saas` | `SaaSSolution` | SaaS-specific solution landing page |
| `/solutions/agencies` | `AgenciesSolution` | Agency/White-Label solution landing page |

### Legacy Routes (Provenance)

| Route | Component | Purpose |
|-------|-----------|---------|
| `/pricing` | `PricingPage` | Original provenance/C2PA pricing (5-tier: Free → Scale €1.999) |
| `/checkout/:planKey` | `CheckoutPage` | Stripe checkout for any tier |

---

## Database Schema

The Governance OS plans are stored in Supabase as:

```sql
-- Extended from public.products
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS
  default_for_plan_key TEXT UNIQUE
  -- Maps to: 'starter_governance', 'professional_governance', 'governance_os', 'enterprise_regulated'

-- Example:
-- plan_key='starter_governance' → priceId=price_starter_gov → default_for_plan_key='starter_governance'
```

**Note**: Actual Stripe product/price creation is handled via the Stripe Dashboard or Terraform. Edge Functions reference the plan_key to determine features.

---

## Implementation: Phase 1 (Complete)

### ✅ Done:
1. **Type System** (`types.ts`):
   - Extended `FeatureKey` with governance features
   - Added `ProductType` and `PlanMetadata` interfaces
   - New plan keys: `starter_governance`, `professional_governance`, `governance_os`, `enterprise_regulated`

2. **Plan Config** (`plan-config.ts`):
   - Full feature matrix for all 4 Governance OS tiers
   - Pricing metadata (monthly price, target, description)
   - Asset limits and feature flags per tier

3. **Feature-Gating Hooks** (`useFeatureGate.ts`):
   - `useFeatureGate(planKey)` — check if a feature is enabled
   - `useGovernanceFeatures(planKey)` — convenience wrapper for governance queries

4. **Pricing Pages**:
   - `/governance-os-pricing` — full pricing page with feature matrix
   - `/solutions/saas` — SaaS solution page
   - `/solutions/agencies` — Agency/White-Label page

5. **Routing** (`App.tsx`):
   - New routes added and imported

---

## Implementation: Phase 2 (Next)

### TODO:
1. **Stripe Integration**:
   - Create Stripe products & prices for governance tiers
   - Map Stripe prices to plan_keys in Supabase
   - Update checkout flow to support governance plans

2. **Subscription Logic**:
   - Edge Function to map Stripe subscription → plan_key → features
   - RLS policies to enforce feature access per tenant

3. **Feature Enforcement**:
   - Add feature gates to all governance features in the app
   - Block access to unavailable features based on subscription
   - Show upgrade prompts when users hit limits

4. **Industry Agents** (Phase 3):
   - SaaS/Tech Agent (system inventory, AI-Act classification)
   - Agency/White-Label Agent
   - Healthcare Agent
   - Public Sector Agent

---

## Testing Feature Gates

### Manual Testing

```typescript
// Test in browser console:
import { PLAN_CONFIG } from '@/core/billing/plan-config';

const plan = PLAN_CONFIG['governance_os'];
console.log(plan.features);  // All enabled features
console.log(plan.metadata);   // Pricing metadata

// Hook test:
const { hasFeature } = useFeatureGate('professional_governance');
console.log(hasFeature('policy.engine'));  // false (not included)
console.log(hasFeature('aiact.classification'));  // true (included)
```

### Unit Tests

Create tests in `/test/billing/feature-gate.test.ts`:

```typescript
import { useFeatureGate } from '@/hooks/useFeatureGate';

describe('Feature Gates', () => {
  it('Starter should not have policy.engine', () => {
    const { hasFeature } = useFeatureGate('starter_governance');
    expect(hasFeature('policy.engine')).toBe(false);
  });

  it('Governance OS should have all core features', () => {
    const { hasFeature } = useFeatureGate('governance_os');
    expect(hasFeature('policy.engine')).toBe(true);
    expect(hasFeature('dpia.assessment')).toBe(true);
    expect(hasFeature('automation.basic')).toBe(true);
  });
});
```

---

## Pricing Strategy Notes

### Design Principles:
1. **Lead Magnet**: Website audit (free) → lowest friction entry
2. **Mid-Market Sweet Spot**: Professional €149/mo = 5-10 domains + monitoring
3. **Full Governance**: Governance OS €599/mo = unlimited assets + policy engine + automation
4. **Enterprise**: Custom negotiated, includes industry agents + SLA

### Not Included in Phase 1:
- **Branchen-Agenten** (Phase 3 — add-on to Governance OS or in Enterprise tier)
- **High-Risk AI** (Phase 2 — add-on to Governance OS, included in Enterprise)
- **White-Label** (Phase 2 — embedded in Agency/Professional tiers)

### Upsell Paths:
1. **Starter → Professional**: Need monitoring + multiple domains
2. **Professional → Governance OS**: Need policy engine + automation
3. **Governance OS → Enterprise**: Need industry-specific agents + SLA

---

## Configuration: Environment Variables

No additional env vars needed — plans are configured in code. In future:

```bash
# Optional: override pricing for development
VITE_GOVERNANCE_PRICING_OVERRIDE='{
  "starter_governance": { "monthlyPrice": 19 }
}'
```

---

## Support & Sales

### Sales Qualifying Questions:
1. **Starter**: "Do you have a single website?"
2. **Professional**: "Do you need continuous monitoring + API?"
3. **Governance OS**: "Do you need policy automation + high-risk AI assessment?"
4. **Enterprise**: "Do you need industry-specific agents + SLA?"

### Self-Serve Checkout:
- Starter, Professional, Governance OS → Self-serve via Stripe checkout
- Enterprise → Sales call (custom negotiation)

---

## Architecture Diagram

```
┌─────────────────────────────────────────────┐
│         RealSyncDynamics.AI                 │
├─────────────────────────────────────────────┤
│                                             │
│  ┌─────────────────────────────────────┐   │
│  │  Pricing Tiers (4 + Enterprise)     │   │
│  │  ├─ Starter (€39)                   │   │
│  │  ├─ Professional (€149)             │   │
│  │  ├─ Governance OS (€599)            │   │
│  │  └─ Enterprise (Custom)             │   │
│  └──────┬──────────────────────────────┘   │
│         │                                   │
│         ↓                                   │
│  ┌─────────────────────────────────────┐   │
│  │  PLAN_CONFIG (plan-config.ts)       │   │
│  │  Map: PlanKey → PlanFeatures        │   │
│  │  ├─ Features (Record<FeatureKey>)   │   │
│  │  ├─ Limits (UsageLimits)            │   │
│  │  └─ Metadata (PlanMetadata)         │   │
│  └──────┬──────────────────────────────┘   │
│         │                                   │
│         ↓                                   │
│  ┌─────────────────────────────────────┐   │
│  │  useFeatureGate Hook                │   │
│  │  ├─ hasFeature(key: FeatureKey)     │   │
│  │  ├─ canAccessAssets(count)          │   │
│  │  └─ planMetadata                    │   │
│  └─────────────────────────────────────┘   │
│         ↑                                   │
│         │                                   │
│  ┌──────┴──────────────────────────────┐   │
│  │  Components (via hook)              │   │
│  │  ├─ PolicyEngine                    │   │
│  │  ├─ AutomationWorkflows             │   │
│  │  ├─ EvidenceVault                   │   │
│  │  └─ IndustryAgents                  │   │
│  └─────────────────────────────────────┘   │
│                                             │
└─────────────────────────────────────────────┘
```

---

## Questions & Next Steps

1. **Stripe Integration**: When do we create the Stripe products + prices?
2. **Free Trial**: Should Governance OS tiers include free trial (14 days)?
3. **Discount**: Should annual billing have a discount (e.g., 2 months free)?
4. **Multi-Currency**: Should pricing be available in USD, GBP, CHF?
5. **Reseller Program**: How should agencies/resellers get discounted pricing?

---

Last updated: June 2026
Author: Claude Code
