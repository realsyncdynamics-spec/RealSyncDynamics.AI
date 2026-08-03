# Phase 3: R2 Evidence Vault Setup Guide

**Status:** 🔄 Pending R2 Enablement  
**Date:** 2026-07-23  
**Namespace ID:** (awaiting R2 enablement)

---

## Step 1: Enable R2 in Cloudflare Dashboard

### Manual Configuration Required

R2 (Cloudflare's S3-compatible object storage) is not yet enabled in the account. Follow these steps:

1. **Login to Cloudflare Dashboard**
   - Visit: https://dash.cloudflare.com
   - Navigate to account

2. **Enable R2**
   - Left sidebar → **R2**
   - Click **"Enable R2"** button
   - Choose billing plan (as needed)
   - Confirm enablement

3. **Verify Enablement**
   - R2 section should now show "Create bucket" option
   - Ready to proceed with bucket creation

---

## Step 2: Create Evidence Vault Bucket

Once R2 is enabled, create the bucket:

### Bucket Configuration

**Bucket Name:** `realsyncdynamics-evidence-vault`  
**Region:** EMEA (EU data residency for DSGVO compliance)  
**Versioning:** Enabled (immutable history)  
**Public Access:** Disabled (private, compliance only)

### Lifecycle Rules

Configure retention policies:

```
Rule: Archive Evidence
- Apply to: All objects with prefix "tenant/"
- Action: Retain for 7 years minimum
- Delete: After 7 years automatically purge
- Compliance: DSGVO Article 17 (Right to be Forgotten) — 7yr minimum retention
```

---

## Step 3: Configure Wrangler.toml

After bucket creation, update `wrangler.toml`:

```toml
[[r2_buckets]]
binding = "EVIDENCE_VAULT"
bucket_name = "realsyncdynamics-evidence-vault"
jurisdiction = "eu"
preview_bucket_name = "realsyncdynamics-evidence-vault-preview"
preview_jurisdiction = "eu"
```

---

## Step 4: Create Evidence Storage Edge Function

Once R2 is bound, implement the evidence vault edge function:

```typescript
// supabase/functions/evidence-vault/index.ts

import { serve } from "https://deno.land/std@0.208.0/http/server.ts";

interface EvidenceUploadRequest {
  tenant_id: string;
  evidence_type: "audit" | "policy-eval" | "compliance-report";
  year: number;
  month: number;
  filename: string;
  content: string;
  metadata: {
    retention_years: number;
    compliance_class: string;
    encrypted: boolean;
  };
}

serve(async (req: Request, { EVIDENCE_VAULT }) => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  try {
    const payload: EvidenceUploadRequest = await req.json();

    // Build S3-compatible path
    const path = `tenant/${payload.tenant_id}/${payload.evidence_type}/${payload.year}/${String(payload.month).padStart(2, "0")}/${payload.filename}`;

    // Upload to R2
    await EVIDENCE_VAULT.put(path, payload.content, {
      customMetadata: {
        tenant_id: payload.tenant_id,
        retention_years: String(payload.metadata.retention_years),
        compliance_class: payload.metadata.compliance_class,
        encrypted: String(payload.metadata.encrypted),
        uploaded_at: new Date().toISOString(),
      },
    });

    return new Response(
      JSON.stringify({
        success: true,
        path,
        size: payload.content.length,
        timestamp: new Date().toISOString(),
      }),
      { status: 201, headers: { "Content-Type": "application/json" } }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
});
```

---

## Step 5: Implement Evidence Retrieval

Create retrieval endpoint for compliance audits:

```typescript
// supabase/functions/evidence-retrieve/index.ts

// Retrieve evidence by path (read-only for compliance)
// Only allow via authenticated service role
// Log all access for audit trail
```

---

## R2 Folder Structure

Once configured, evidence will be organized as:

```
s3://realsyncdynamics-evidence-vault/
  ├── tenant/
  │   ├── {tenant_id}/
  │   │   ├── audit/
  │   │   │   ├── 2026/
  │   │   │   │   ├── 01/ (YYYY/MM)
  │   │   │   │   ├── 02/
  │   │   │   │   └── ...
  │   │   ├── policy-eval/
  │   │   │   ├── 2026/
  │   │   │   └── ...
  │   │   └── compliance-reports/
  │   │       ├── 2026/
  │   │       └── ...
  └── system-archive/
      ├── backups/
      └── exports/
```

---

## DSGVO Compliance Notes

**Retention Policy:**
- Minimum: 7 years (DSGVO Article 5 — storage limitation)
- Maximum: 7 years (DSGVO Article 17 — right to be forgotten)
- Automatic purge after 7 years via lifecycle rules

**Access Control:**
- Read-only for compliance audits
- No public access
- Versioning enabled (immutable history)
- Object-level metadata tags for audit trail

**Encryption:**
- R2 default encryption (AES-256)
- Can enable additional encryption via metadata flag

---

## Testing (Post-Enablement)

Once R2 is enabled and configured:

```bash
# Test evidence upload
curl -X POST https://realsyncdynamics-ai.pages.dev/api/evidence-vault \
  -H "Content-Type: application/json" \
  -d '{
    "tenant_id": "test-123",
    "evidence_type": "audit",
    "year": 2026,
    "month": 7,
    "filename": "audit-scan-2026-07-23.json",
    "content": "{...}",
    "metadata": {
      "retention_years": 7,
      "compliance_class": "DSGVO_CRITICAL",
      "encrypted": true
    }
  }'

# Expected response:
# {
#   "success": true,
#   "path": "tenant/test-123/audit/2026/07/audit-scan-2026-07-23.json",
#   "size": 1234,
#   "timestamp": "2026-07-23T17:00:00Z"
# }
```

---

## Checklist for R2 Completion

- [ ] Enable R2 in Cloudflare Dashboard
- [ ] Create bucket `realsyncdynamics-evidence-vault`
- [ ] Set region to EMEA
- [ ] Enable versioning
- [ ] Configure 7-year lifecycle retention
- [ ] Update `wrangler.toml` with R2 binding
- [ ] Deploy evidence-vault edge function
- [ ] Deploy evidence-retrieve edge function
- [ ] Test upload/retrieval endpoints
- [ ] Verify lifecycle policy triggers after 7 years (or test with shorter TTL)

---

## Next: Worker Migration B1

After R2 is complete, proceed with Worker migration planning (see `PHASE_3_WORKER_MIGRATION_B1.md`).
