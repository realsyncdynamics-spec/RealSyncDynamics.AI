# Phase 2: Cross-Browser Testing Guide

Verify landing page + flows work across Chrome, Firefox, Safari.

**Time:** 1 hour (20 min per browser)  
**URL:** https://claude-realsync-roadmap-stra.realsyncdynamics-ai.pages.dev

---

## Setup: Open DevTools

For each browser, keep DevTools open to catch console errors:

**Chrome/Edge:** `F12` or `Cmd+Option+I` (Mac)  
**Firefox:** `F12` or `Cmd+Option+I` (Mac)  
**Safari:** `Cmd+Option+I` (Mac) — must enable first in Preferences → Advanced

---

## Test 1: Chrome (Baseline)

### Landing Page (`/`)

- [ ] Page loads without spinner/hang
- [ ] Hero section visible (title, subtitle, CTA buttons)
- [ ] Navigation bar sticky at top (logo, Pricing link, Sign In button)
- [ ] All icons render (CheckCircle, ArrowRight, Shield, Zap, FileText)
- [ ] Images/gradients display correctly
- [ ] Text readable (no overlaps or broken layout)
- [ ] Buttons have hover states (change color on hover)

### `/audit` Landing Page

- [ ] Page loads
- [ ] All 7 sections visible:
  - Hero section
  - Problem section (80% stat card)
  - How It Works (3 steps with icons)
  - Pricing section (2 cards: Free + Professional)
  - "Most Popular" badge on Professional card
  - FAQ section (5 questions, expandable)
  - Footer
- [ ] FAQ accordion works (click to expand/collapse each Q)
- [ ] Colors correct:
  - Background: Light gray/slate
  - Accent buttons: Teal/petrol
  - Text: Dark gray/slate

### Forms & Interactions

- [ ] Sign In button is clickable
- [ ] "Try Free" CTA button is clickable
- [ ] "Learn More" button scrolls smoothly to How It Works
- [ ] All footer links clickable

### Console Check

- [ ] F12 → Console tab
- [ ] **0 red error messages** (warnings OK)
- [ ] No `Uncaught TypeError` or `Uncaught ReferenceError`

### Performance

- [ ] Page loads in < 3 seconds
- [ ] No layout shift (content doesn't jump around)
- [ ] Scrolling is smooth (no stuttering)

**Chrome Result:** ✅ All pass or ❌ Issues found: ___

---

## Test 2: Firefox

### Same Checks as Chrome

Repeat all checks from Test 1 for Firefox:

- [ ] Landing page loads
- [ ] Hero section + navigation visible
- [ ] `/audit` page loads with all sections
- [ ] Icons render correctly (may look slightly different)
- [ ] FAQ accordion works
- [ ] Buttons clickable
- [ ] Forms accept input
- [ ] Console: 0 red errors
- [ ] Performance < 3 seconds

### Firefox-Specific Checks

- [ ] CSS Grid layout (pricing cards) displays correctly
- [ ] Flexbox spacing OK (sections not cramped)
- [ ] Font rendering clean (not fuzzy)
- [ ] Color accuracy matches Chrome

**Firefox Result:** ✅ All pass or ❌ Issues found: ___

---

## Test 3: Safari (Mac)

### Same Checks as Chrome

Repeat all checks from Test 1 for Safari:

- [ ] Landing page loads
- [ ] Hero section + navigation visible
- [ ] `/audit` page loads with all sections
- [ ] Icons render correctly
- [ ] FAQ accordion works
- [ ] Buttons clickable
- [ ] Console: 0 red errors (if DevTools enabled)
- [ ] Performance < 3 seconds

### Safari-Specific Checks

- [ ] `-webkit-` prefixed CSS works (smooth scroll, etc.)
- [ ] Font smoothing looks good (shouldn't be aliased)
- [ ] Color gradients render correctly
- [ ] Sticky header stays at top while scrolling

**Safari Result:** ✅ All pass or ❌ Issues found: ___

---

## Test 4: Authentication Flow (Each Browser)

For at least one browser (Chrome), test auth flow:

- [ ] Click "Sign In"
- [ ] Auth page loads
- [ ] Email/password inputs accept text
- [ ] Submit button is clickable
- [ ] Creates account (doesn't error)
- [ ] Redirects to workspace/dashboard after sign up
- [ ] No console errors during auth

**Auth Flow Result:** ✅ Works or ❌ Issue: ___

---

## Test 5: Scan Flow (Each Browser)

For at least one browser (Chrome), test scan:

- [ ] Navigate to `/audit`
- [ ] Click "Try Free" → goes to `/scan`
- [ ] URL input accepts text
- [ ] Submit/Scan button clickable
- [ ] Loading state shows (spinner or "Scanning...")
- [ ] Results appear after 30-60 seconds
- [ ] All 4 checks display (DSGVO, HTTPS, AI Disclosure, Privacy)
- [ ] "Download Report" button visible
- [ ] No console errors

**Scan Flow Result:** ✅ Works or ❌ Issue: ___

---

## Comparison Matrix

After testing all 3 browsers, fill in:

| Feature | Chrome | Firefox | Safari | Issue? |
|---------|--------|---------|--------|--------|
| Loads | ✅ | ✅ | ✅ |  |
| Navigation | ✅ | ✅ | ✅ |  |
| Landing page | ✅ | ✅ | ✅ |  |
| Pricing cards | ✅ | ✅ | ✅ |  |
| FAQ accordion | ✅ | ✅ | ✅ |  |
| Buttons hover | ✅ | ✅ | ✅ |  |
| Icons render | ✅ | ✅ | ✅ |  |
| Console errors | 0 | 0 | 0 |  |
| Load time | 2s | 2.5s | 2.8s |  |

---

## Common Issues & Fixes

### Issue: "Console shows red error"

**Common errors:**
- `Uncaught TypeError: Cannot read property 'X' of undefined`
  - Usually means component didn't initialize
  - Check if Supabase keys are set in .env.local
  
- `Failed to fetch`
  - API endpoint unreachable
  - Check network tab (F12 → Network) to see what failed
  - May indicate Supabase is down

- `Stripe not loaded`
  - Check VITE_STRIPE_PUBLISHABLE_KEY in .env.local
  - Restart dev server: `npm run dev`

### Issue: "Buttons not clickable"

- Check if JavaScript loaded (F12 → Network → filter by .js files)
- May indicate build error

### Issue: "Layout broken on Firefox"

- CSS Grid or Flexbox issue
- Check if `-webkit-` prefix needed for Safari compatibility

### Issue: "Performance slow (>3s)"

- Check Network tab for large images
- May need code splitting or asset optimization

---

## Success Criteria

**Phase 2 Complete When:**

- ✅ All 3 browsers tested (Chrome, Firefox, Safari)
- ✅ Each browser shows 0 red console errors
- ✅ Landing page renders identically across browsers
- ✅ `/audit` page renders identically across browsers
- ✅ FAQ accordion works in all browsers
- ✅ Buttons clickable in all browsers
- ✅ Page load < 3 seconds in all browsers
- ✅ No critical visual differences between browsers

**Issues found:** (List any)
1. ...
2. ...
3. ...

---

## Next Phase

Once Phase 2 ✅ complete, proceed to **Phase 3: Mobile Responsiveness** (iPhone, iPad, Android)

---

**Created:** Saturday, July 17, 2026  
**Estimated Time:** 1 hour  
**Status:** Ready to execute
