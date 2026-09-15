# Scanner Testing Guide

**What we built:** AI disclosure detection integrated into gdpr-audit scanner  
**What to test:** Scanner detects when websites use KI without proper disclosure

---

## Test URLs (Use These)

### Test 1: AI Tool WITHOUT Disclosure (Should be CRITICAL)
```
https://www.openai.com
```
**Expected:** Scanner detects OpenAI API, flags as CRITICAL (no disclosure visible)

### Test 2: AI Tool WITH Disclosure (Should be LOW)
```
https://www.anthropic.com
```
**Expected:** Scanner detects Claude API, flags as LOW (disclosure visible)

### Test 3: No AI Tools (Should PASS)
```
https://www.example.com
```
**Expected:** No AI findings, other DSGVO checks run normally

### Test 4: Mixed KI Services
```
https://chat.openai.com
```
**Expected:** Detects OpenAI, evaluates disclosure

---

## How to Test Locally

### Option A: Via API Directly

```bash
# Start dev server
npm run dev

# Test via curl (in another terminal)
curl -X POST http://localhost:3000/functions/v1/gdpr-audit \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://www.openai.com",
    "email": "test@example.com",
    "company": "Test Corp"
  }'
```

**Expected response:**
```json
{
  "ok": true,
  "issues": [
    {
      "id": "ai_disclosure_check",
      "severity": "critical",
      "title": "KI-Nutzung ohne Disclosure: OpenAI (ChatGPT)",
      "detail": "Die Website nutzt KI-Services (OpenAI (ChatGPT)), hat aber keinen sichtbaren Hinweis...",
      "paragraph_ref": "AI Act Art. 52 (Limited-Risk AI)"
    },
    ... other DSGVO findings ...
  ],
  "score": X,
  "severity": "critical"
}
```

### Option B: Via Web UI (/audit page)

1. Start dev server: `npm run dev`
2. Go to: http://localhost:3000/audit
3. Enter test URL (e.g., `https://www.openai.com`)
4. Click "Audit"
5. Scroll to findings → should see "KI-Nutzung ohne Disclosure: OpenAI"

---

## Expected Behavior

### AI Detection Accuracy

| URL | AI Detected | Disclosure | Finding |
|-----|-------------|-----------|---------|
| openai.com | ✅ Yes | ❌ No | CRITICAL |
| anthropic.com | ✅ Yes | ✅ Yes | LOW |
| example.com | ❌ No | N/A | No AI finding |
| claude.ai | ✅ Yes | ✅ Yes (implied) | LOW |

### Scoring Impact

**AI Disclosure CRITICAL Finding:**
- Score deduction: -25 points (same as other critical findings)
- If only AI disclosure issue: 75/100 score

**AI Disclosure LOW Finding:**
- Score deduction: -2 points
- If only AI disclosure info: 98/100 score

---

## Test Coverage

The AI disclosure detection covers:

### APIs Detected ✅
- OpenAI (ChatGPT, GPT-4, API calls)
- Anthropic (Claude, messages API)
- Google (Gemini, generativeai)
- Cohere, Mistral, Hugging Face

### Disclosure Text Detected ✅
- English: "powered by AI", "AI-generated", "chatbot"
- German: "KI-generiert", "künstliche Intelligenz", "chatbot"

### Edge Cases ✅
- Mixed AI services (multiple APIs on one page)
- Disclosure without explicit API (text only counts)
- No AI but mentions "AI" (no finding if no actual API)
- Malformed HTML (gracefully handled)

---

## Next Steps

### If Test Passes ✅
1. Check that findings appear in dashboard UI
2. Verify score calculation includes AI deduction
3. Verify PDF export includes AI findings
4. Test with real pilot customer website

### If Test Fails ❌
1. Check browser console for errors
2. Check Supabase logs (`supabase functions serve`)
3. Verify import path in gdpr-audit/index.ts
4. Verify ai-disclosure-check.ts exists

---

## Debugging

### Common Issues

**Issue: "detectAIDisclosure is not defined"**
- Solution: Verify import statement in gdpr-audit/index.ts
- Check: `import { detectAIDisclosure } from '../_shared/ai-disclosure-check.ts';`

**Issue: Scanner runs but AI finding doesn't appear**
- Solution: Check that status !== null (page must load successfully)
- Check: HTML must be fetched (fetchError must be null)

**Issue: False positive (AI detected but website doesn't use it)**
- Solution: Check regex patterns in ai-disclosure-check.ts
- Expected: Some false positives OK for MVP (conservative > permissive)

---

## Success Criteria

✅ Scanner compiles without errors  
✅ AI disclosure detection runs without crashing  
✅ Correct severity assigned (critical vs low)  
✅ Findings appear in dashboard  
✅ Score adjusts based on AI findings  
✅ PDF export includes AI findings  

---

**Test status:** Ready for MVP  
**Last updated:** 2026-07-14  
**Next:** Integration testing with tenant-audit pipeline
