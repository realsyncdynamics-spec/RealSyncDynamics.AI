# R2 Evidence Vault Setup Guide — Manual Cloudflare Dashboard Steps

This guide covers the manual configuration needed to enable R2 and create the evidence vault bucket for 7-year DSGVO-compliant evidence retention.

**Total Time**: ~15 minutes (Step 1: 5 min, Step 2: 10 min)

---

## Step 1: Enable R2 Service (5 minutes)

### 1.1 Navigate to R2
1. Log in to [Cloudflare Dashboard](https://dash.cloudflare.com)
2. Left sidebar → **Storage** → **R2**
3. Click **Create bucket** (or **Enable R2** if not yet activated)

### 1.2 Service Activation
If you see a prompt "Enable R2":
- Click **Enable R2**
- Confirm the activation
- Wait for dashboard to refresh (30-60 seconds)
- You should now see the R2 bucket creation form

### 1.3 Confirmation
✅ R2 is active when:
- Dashboard shows "Create bucket" button
- No "Enable R2" prompts appear
- Sidebar shows "R2" under Storage

---

## Step 2: Create Evidence Vault Bucket (10 minutes)

### 2.1 Bucket Creation Form
Fill out the "Create bucket" form:

| Field | Value | Notes |
|-------|-------|-------|
| Bucket name | `realsyncdynamics-evidence-vault` | Exact spelling (lowercase, hyphens) |
| Region | **EMEA** (select from dropdown) | EU data residency for DSGVO |
| Versioning | **Enable** | Immutable audit trail |
| Any other options | Leave defaults | Not needed for this setup |

**Important**: Leave all other options at default unless specified

### 2.2 Click "Create bucket"
- Wait for confirmation message
- You should see the bucket listed in R2

### 2.3 Verify Bucket Creation
Check that:
- ✅ Bucket name is `realsyncdynamics-evidence-vault`
- ✅ Region shows EMEA
- ✅ Versioning is **Enabled**

---

## Step 3: Configure Lifecycle Rules (5 minutes)

### 3.1 Open Bucket Settings
1. Click on `realsyncdynamics-evidence-vault` bucket
2. Go to **Settings** tab (usually top-right)
3. Scroll to **Lifecycle rules**

### 3.2 Add 7-Year Retention Rule
Click **Add lifecycle rule** and fill in:

| Field | Value | Purpose |
|-------|-------|---------|
| Rule name | `dsgvo-7-year-retention` | Compliance identifier |
| Apply to | All objects in bucket | Applies to everything uploaded |
| Days until deleted | `2557` | Exactly 7 years (7 × 365 + 2 leap days) |

### 3.3 Create Rule
- Click **Create rule**
- Rule should appear in the lifecycle rules list

### 3.4 Verify
✅ You should see:
```
Rule: dsgvo-7-year-retention
Status: Active
Deletes objects after 2557 days
```

---

## Step 4: Generate API Token (3 minutes)

### 4.1 Create Token
1. Bottom of left sidebar → **Account** → **API Tokens**
2. Click **Create Token** (or **Create API Token**)
3. Choose option: **Use template** → **Edit R2 Object**

### 4.2 Configuration
Set the following:

| Setting | Value |
|---------|-------|
| Token name | `realsyncdynamics-evidence-vault-api` |
| Permissions | R2 read/write |
| R2 API token → Scope | **All buckets** (or select `realsyncdynamics-evidence-vault` specifically) |
| TTL | **No expiration** (or 90 days for rotation) |

### 4.3 Create and Copy Token
- Click **Create Token**
- **Copy the token immediately** and store it securely
  - You will NOT be able to see it again
  - Store in secure credential manager (1Password, LastPass, HashiCorp Vault, etc.)
  - Do NOT commit to git or share in chat

### 4.4 Token Format
```
Token will look like:
v1.0c1234567890abcdef1234567890abcdef1234567890abc...
```

### 4.5 Verification
✅ Token is ready when:
- You have the full token string copied
- It starts with `v1.0`
- Length is ~100+ characters

---

## Step 5: Verify Bucket Configuration (2 minutes)

### 5.1 Final Checks
In Cloudflare Dashboard → R2 → `realsyncdynamics-evidence-vault`:

**Bucket Settings**
- ✅ Name: `realsyncdynamics-evidence-vault`
- ✅ Region: EMEA
- ✅ Versioning: Enabled

**Lifecycle Rules**
- ✅ Rule exists: `dsgvo-7-year-retention`
- ✅ Status: Active
- ✅ Delete after: 2557 days

**API Access**
- ✅ Token generated: `realsyncdynamics-evidence-vault-api`
- ✅ Token stored securely

---

## Completion Checklist

- [ ] R2 service is **Enabled** (visible in Storage menu)
- [ ] Bucket created: `realsyncdynamics-evidence-vault`
- [ ] Region: **EMEA**
- [ ] Versioning: **Enabled**
- [ ] Lifecycle rule: `dsgvo-7-year-retention` (2557 days)
- [ ] API token: `realsyncdynamics-evidence-vault-api` (stored securely)

---

## Next Step

Once all items above are checked, you are ready for **Step 3** in `PHASE_3_IMPLEMENTATION_ROADMAP.md`:

→ Deploy evidence-vault edge function with R2 binding

The edge function code is ready in `supabase/functions/evidence-vault/index.ts` and just needs the R2 binding configured in `wrangler.toml`.

---

## Troubleshooting

### "R2 service not found"
- R2 may not be available in your Cloudflare plan
- Check plan status: Dashboard → Billing → Plan details
- Free/Pro plans do not include R2 — upgrade to Business plan

### "Cannot create bucket — region not available"
- EMEA region requires specific account type
- Alternative: Select **any region** for now, note it
- Update deployment docs with correct region

### "API token not appearing in list"
- Refresh the page (Ctrl+R / Cmd+R)
- Token should appear within 30 seconds
- If still missing: create a new token

### "Lifecycle rule not saving"
- Ensure you have **Business** plan or higher
- Free/Pro plans do not support lifecycle rules
- Set deletion reminder in calendar instead (manual cleanup)

---

## Security Notes

- **Token Storage**: Keep token in secure vault, not in code or chat
- **Bucket Policy**: Current setup is private (good)
- **Versioning**: All objects are immutable once uploaded
- **Audit Trail**: Access logs available in Cloudflare Analytics
- **Compliance**: 7-year retention satisfies DSGVO data retention requirements

---

## What's Next After Completion

1. **Step 3**: Deploy evidence vault function
   - File: `supabase/functions/evidence-vault/index.ts`
   - Binding: Add R2 bucket binding to `wrangler.toml`
   - Test: Use curl to upload/retrieve evidence

2. **Step 4**: 4-week Workers migration sprint
   - Timeline: 1 week design + 1 week middleware + 1 week migration + 1 week rollout
   - Target: Move governance functions to Cloudflare Workers
