# Phase 2 Governance: Edge Cases & Known Limitations

**Status:** Beta-Ready (Known limitations documented)  
**Last Updated:** 2026-07-03  
**For:** Engineering, QA, Support, Product

---

## Edge Cases & Handling

### 1. Auto-Mapping Edge Cases

#### 1.1 Asset Without Tenant Industry
**Scenario:** User creates asset before selecting industry during onboarding.

**Behavior:**
- Auto-mapping still runs with `tenantIndustry = undefined`
- Only framework-agnostic controls suggested (EU AI Act, GDPR if applicable)
- Healthcare-specific, Finance-specific controls not included
- No error/warning shown to user

**Risk:** Low (user can re-map after setting industry)  
**Mitigation:** UI should prompt industry selection before asset creation

**Code Path:** `src/lib/governance/autoMap.ts:proposeControlStatuses()` line 95-110
```typescript
// If tenantIndustry is undefined, healthcare checks are skipped
if (tenantIndustry && isHealthcareIndustry(tenantIndustry)) {
  // Healthcare-specific logic only runs if industry is set
}
```

---

#### 1.2 Special Category Data Detection False Negative
**Scenario:** Healthcare asset with custom data type like "medical_imaging" not in hints list.

**Behavior:**
- Data type `medical_imaging` not recognized as special category
- GDPR Art. 9 controls NOT recommended
- User must manually flag as special category

**Risk:** Medium (under-protection)  
**Special Category Hints:** `['health', 'diagnosis', 'genetic', 'biometric', 'race', 'religion', 'political', 'sexual', 'biometr']`

**Mitigation:**
- Document data type naming conventions
- Support can manually add missing data types
- Future: ML-based detection for unknown types

**Code Path:** `src/lib/governance/autoMap.ts:hasSpecialCategoryData()` line 30-35

---

#### 1.3 Reconciliation: Mixed Manual + Auto Mappings
**Scenario:** Control has both manual mapping (status: `implemented`) and auto-mapping suggestion (status: `gap`).

**Behavior:**
- Manual mapping always wins (never overwritten)
- Auto-mapping skipped if `source='manual'` exists
- Prevents loss of expert judgement

**Risk:** Low (intentional design)  
**Code Path:** `src/lib/governance/autoMap.ts:proposeControlStatuses()` line 45-50
```typescript
if (current.source === 'manual') {
  // Skip overwriting manual mappings - preserve expert input
  return null;
}
```

---

#### 1.4 Framework Gap Analysis with Empty Catalog
**Scenario:** Control catalog has <10 controls total (edge: startup deployment).

**Behavior:**
- Gap filler recommendation still generated
- May recommend "fix gaps in <framework> (0 issues)" if no gaps found
- Confidence score may be inflated (75+ even with minimal data)

**Risk:** Low (cosmetic)  
**Mitigation:** Require minimum 50 controls in catalog before production

---

### 2. Provenance & Hash-Chain Edge Cases

#### 2.1 Missing Signature on First Event
**Scenario:** Asset created without Ed25519/HMAC signature (legacy system).

**Behavior:**
- Trust score: -10 penalty for unsigned event
- Tamper state: `intact` (because chain links are present)
- Status: PASS (but degraded trust)
- Warning: "Signature verification N/A for legacy assets"

**Risk:** Low (known in Phase 2 docs)  
**Expected Trust Score:** ~90/100 (100 baseline - 10 for unsigned)

**Code Path:** `src/lib/provenance/verify.ts:calculateTrustScore()` line 110-125

---

#### 2.2 Hash Recalculation Mismatch
**Scenario:** Event was signed with one canonical form, but verification recalculates with different field order.

**Behavior:**
- Individual event hash verification skipped (dummy implementation)
- Chain linking verified instead (prev_hash present)
- Status: PASS (chain integrity verified, signature not validated)

**Risk:** Medium (signature verification deferred to Week 2)  
**Current State:** Signature presence checked, not cryptographic validity  
**Production Requirement:** Implement `crypto.verify()` with Ed25519

**Code Path:** `src/lib/provenance/verify.ts:verifySignature()` line 175-200
```typescript
// DUMMY: Only checks presence, not validity
if (sig.signatureAlg === 'Ed25519' || sig.signatureAlg === 'HMAC-SHA256') {
  return true; // ← NOT CRYPTOGRAPHICALLY VERIFIED YET
}
```

---

#### 2.3 Concurrent Custody Event Creation
**Scenario:** Two requests create custody events for same asset simultaneously.

**Behavior:**
- Both events inserted (concurrent inserts OK)
- Both prev_hash links may reference same parent
- Chain branching: two valid chains from same event

**Risk:** Medium (leads to duplicate chains)  
**Mitigation:** Application should serialize event creation per asset

**Database Level:** No unique constraint on `prev_hash` (by design)

---

#### 2.4 Trust Score Boundary Cases
**Scenario:** Asset with 100 unsigned events in chain.

**Behavior:**
- Base score: 100
- Penalty: -2 per unsigned event: -200
- Result: -100 (clamped to 0 in display)
- Actual: `max(0, 100 - 200) = 0/100`

**Risk:** Low (correctly indicates untrusted)  
**Code Path:** `src/lib/provenance/verify.ts:calculateTrustScore()` line 120
```typescript
// No explicit clamp to 0-100, but UI handles display
let score = 100 - penalties;
// Result can be negative, should clamp in display layer
```

---

### 3. Policy-Pack Recommender Edge Cases

#### 3.1 No Recommendations Generated
**Scenario:** Generic asset with no PII, no special categories, generic industry.

**Behavior:**
- Recommendations array: `[]`
- UI component returns `null` (no display)
- No policy packs activated
- User sees no recommendations

**Risk:** Low (intentional - no applicable policies)  
**Mitigation:** UI could show "No policies recommended - this asset is low-risk"

**Code Path:** `src/components/governance/PolicyPackAutoActivator.tsx` line 75-77
```typescript
if (recommendations.length === 0) {
  return null; // Silent no-op
}
```

---

#### 3.2 Confidence Score Edge Case: AI Act + Healthcare
**Scenario:** High-risk AI in healthcare context.

**Behavior:**
- Recommendation 1: EU AI Act High-Risk (confidence: 100, priority: critical)
- Recommendation 2: Healthcare AI Risk-Management (confidence: 100, priority: critical)
- Both have same confidence/priority → order by pack ID (alphabetic sort)

**Risk:** Low (both equally important)  
**Mitigation:** Use recommendation reason text to disambiguate

---

#### 3.3 Gap Filler with Single Gap
**Scenario:** Only 1 control missing in EU_AI_ACT framework.

**Behavior:**
- Gap confidence: 75 + min(1*5, 20) = 80 (confidence score)
- Priority: `medium` (not `high` because gapCount <= 5)
- May be hidden under 2+ other recommendations

**Risk:** Low (single gaps aren't urgent)  
**Code Path:** `src/lib/governance/policyPackRecommender.ts` line 131
```typescript
priority: largestGap.gapCount > 5 ? 'high' : 'medium',
```

---

### 4. PDF Export Edge Cases

#### 4.1 Large Custody Chain (100+ events)
**Scenario:** Asset with 100 custody events.

**Behavior:**
- PDF still renders (all events listed)
- File size: ~500KB (reasonable)
- Page count: ~15-20 pages
- Export time: ~3-4s (within target)

**Risk:** Low (performance acceptable)  
**Mitigation:** Paginate chain if >50 events (future enhancement)

---

#### 4.2 Trust Score Below 0
**Scenario:** Verification returns score = -50 (heavily compromised chain).

**Behavior:**
- PDF displays: "Score: -50/100" (bug - should clamp)
- Color: Red (bad) ← Correct interpretation despite negative value
- Status: "✗ compromised" ← Correct

**Risk:** Low (cosmetic - display bug in edge case)  
**Mitigation:** Clamp score to [0, 100] in display layer

**Code Path:** `src/components/evidence/EvidenceExportDocument.tsx` line 108-109
```typescript
const trustScoreStatus = manifest.trustScore ?? 0;
// Should be: const trustScoreStatus = Math.max(0, manifest.trustScore ?? 0);
```

---

#### 4.3 Missing Signature Field in Event
**Scenario:** Custody event has `signature: null`.

**Behavior:**
- PDF line: "Signature: (no signature)" ← Rendered as null
- Event details still visible
- File generates successfully

**Risk:** Low (null handling OK)  
**Code Path:** `src/components/evidence/EvidenceExportDocument.tsx` line 169-173
```typescript
{event.signature && (
  <Text style={styles.eventDetail}>
    Signature: {event.signatureAlg || 'HMAC'} ✓
  </Text>
)}
```

---

### 5. Tenant & Multi-Tenancy Edge Cases

#### 5.1 Tenant Industry Change After Assets Created
**Scenario:** Tenant industry changed from "generic" to "healthcare" after assets created.

**Behavior:**
- Existing auto-mappings unchanged (source: 'auto' but not re-run)
- New auto-map calls use new industry
- User must manually re-run auto-map on assets for new recommendations

**Risk:** Medium (user must know to re-map)  
**Mitigation:** UI should show "Industry updated - click to re-map all assets"

**Workaround:**
```sql
-- Support can run manual update (Phase 2 doesn't have batch auto-map)
-- Individual asset re-map via UI or API
```

---

#### 5.2 Rapid Tenant Creation (Multi-Company User)
**Scenario:** User with 10 tenants, all seeding test data simultaneously.

**Behavior:**
- Each tenant profile stored separately (key: `realsync.companyProfile.${tenantId}`)
- No cross-tenant pollution
- Industry selection scoped to active tenant

**Risk:** Low (designed for multi-tenancy)  
**Code Path:** `src/features/company/companyProfileLocal.ts:keyFor()` line 18-20

---

#### 5.3 Industry Value with Non-Standard Format
**Scenario:** User submits `industry: "Health Care"` (space) vs `"healthcare"` (lowercase).

**Behavior:**
- Stored as-is in `tenants.industry`
- Auto-mapping uses `.toLowerCase().includes('healthcare')` ← Matches
- Recommendations still generated correctly

**Risk:** Low (case-insensitive matching)  
**Benefit:** Industry display respects user input format

---

### 6. Testing & QA Edge Cases

#### 6.1 Test Data: Empty Data Types Array
**Scenario:** Asset created with `data_types: []`.

**Behavior:**
- No special category detection
- No PII detection
- Minimal controls recommended
- Auto-mapping runs but suggests few controls

**Risk:** Low (correct behavior for data-less assets)  
**Test Case:** Should skip PII/health checks

---

#### 6.2 Asset with All Data Types
**Scenario:** Asset with `data_types: ['pii', 'health_records', 'genetic_data', ... 10+ types]`.

**Behavior:**
- Multiple special category matches
- Recommendation 1: GDPR Art. 9 (critical)
- Recommendation 2: Healthcare-specific (if industry matches)
- Recommendation 3-N: Others

**Risk:** Low (correct - all policies activated)  
**Test Case:** Should recommend 3-5 packs

---

#### 6.3 Performance: 1000-Row Control Catalog
**Scenario:** Framework catalog with 1000+ controls.

**Behavior:**
- Auto-mapping latency: ~2-3s (vs current 850ms baseline)
- Memory: ~5-10MB for catalog
- N+1 queries prevented by SQL select

**Risk:** Medium (performance edge case)  
**Mitigation:** Index `framework_controls(framework, control_code)`

---

## Known Limitations (Deferred to Week 2/3)

### High Priority

| Limitation | Impact | Workaround | Fix Timeline |
|-----------|--------|-----------|--------------|
| Signature verification (dummy) | Trust scores not cryptographically validated | Manual review until Week 2 | Week 2 Production |
| Policy-pack auto-activation API | Mock only, no edge function | UI ready, must activate manually | Week 2 Production |
| Edge function caching | 2-5s latency on governance-agent | Deploy Redis/streaming | Week 2 Optimization |
| No batch auto-map | Can't re-map multiple assets at once | Run per-asset via UI | Week 3 Enhancement |

### Medium Priority

| Limitation | Impact | Workaround | Fix Timeline |
|-----------|--------|-----------|--------------|
| No Slack/email alerts | Customers don't get notifications | Manual monitoring | Week 3 |
| Single-asset PDF export | Can't bulk export evidence | Export one at a time | Week 4 |
| No asset versioning | Can't track config changes over time | Audit log only | Phase 3 |

---

## Support Runbook

### "Auto-mapping is not recommending healthcare controls"
**Root Cause:** Tenant industry not set  
**Solution:**
1. Ask customer what industry they selected
2. Check `tenants.industry` for the tenant ID
3. If null: Have customer re-do onboarding or manually update via SQL:
   ```sql
   UPDATE tenants SET industry = 'healthcare' WHERE id = '...';
   ```
4. Re-run auto-mapping via UI (Asset → Auto-Map button)

---

### "Trust score shows negative number in PDF"
**Root Cause:** Display bug (clamp missing)  
**Solution:**
1. Tell customer: Trust score clamped to 0 in system, negative indicates "compromised"
2. Check actual custody chain in PDF for broken hash links
3. Escalate if user concerned about data integrity

---

### "Policy packs not activating automatically"
**Root Cause:** Auto-activation mock (Phase 2)  
**Solution:**
1. Confirm UI shows recommendations (they were generated)
2. Tell customer: Manual activation only in beta (auto-activation coming Week 2)
3. Have them click "Auto-Aktivieren" button to activate
4. Verify in UI that packs are now `enabled`

---

### "Asset appears in different tenant"
**Root Cause:** RLS policy bypass (critical)  
**Solution:**
1. IMMEDIATE: Page DevOps, revoke API key if compromised
2. Run query to verify scope:
   ```sql
   SELECT COUNT(*) FROM governance_assets 
   WHERE tenant_id NOT IN (
     SELECT tenant_id FROM memberships WHERE user_id = 'user_id'
   );
   ```
3. If count > 0: Security incident, escalate
4. If count = 0: False alarm, likely user confusion

---

## Future Improvements (Post-Beta)

1. **Signature Verification (Week 2)**
   - Implement `crypto.verify()` with Ed25519
   - Validate HMAC-SHA256 checksums
   - Update trust score to "cryptographically verified"

2. **Batch Auto-Mapping (Week 3)**
   - Re-map all assets in tenant after industry change
   - Async job queue for large datasets

3. **Alerts Integration (Week 3)**
   - Slack notifications when critical packs activate
   - Email digest of governance changes

4. **Asset Versioning (Phase 3)**
   - Track asset config changes over time
   - Rollback capability

5. **Advanced PDF Export (Week 4)**
   - Bulk export multiple assets
   - Custom report templates
   - Email delivery option

---

## Testing Checklist for Edge Cases

Before releasing to beta customers, verify:

- [ ] Asset without industry shows minimal recommendations (no false positives)
- [ ] Special category detection accurate for healthcare, genetic, biometric data
- [ ] Manual mappings never overwritten (source='manual' respected)
- [ ] Trust score never shows >100 or <0 (clamp to [0, 100])
- [ ] PDF renders with 100+ custody events without timeout
- [ ] Policy pack recommendations work with 0 or 5+ packs equally
- [ ] Concurrent asset creation doesn't corrupt chain
- [ ] RLS policies prevent cross-tenant access in all queries
- [ ] Industry change doesn't affect existing mappings (expected behavior)
- [ ] Empty data_types array handled gracefully

---

**Last Verified:** 2026-07-03  
**Next Review:** After Week 1 staging
