# Cloudflare R2 Evidence Vault: Lifecycle Policy

**Objective**: Cost-optimize evidence storage through intelligent archival while maintaining compliance retention periods.

---

## Lifecycle Strategy

### Hot Storage (R2 Standard - Days 0-90)
- **Cost**: ~$0.015/GB/month (highest)
- **Access**: Instant (milliseconds)
- **Use Case**: Recent evidence queries (audits, incidents, DPIAs)
- **Example**: Policy updates, risk assessments, incident logs from last 3 months

### Archive Storage (Glacier - Days 90-1825)
- **Cost**: ~$0.004/GB/month (7x cheaper)
- **Access**: Hours (retrieval time ~4-12h)
- **Use Case**: Compliance holds, annual audits, historical records
- **Example**: Policies from 3+ months ago, archived compliance evidence

### Delete (Day 1825+)
- **Cost**: $0 (removed)
- **Compliance**: Only after retention period expires
- **Regulations**:
  - **GDPR**: 1-3 years (depending on context)
  - **EU AI Act**: 3 years (model audit trails)
  - **Industry-specific**: 2-7 years (varies by sector)

---

## Configuration (Terraform/Pulumi)

### Cloudflare R2 Lifecycle Policy

```hcl
resource "cloudflare_r2_bucket" "evidence_vault" {
  account_id = var.cloudflare_account_id
  name       = "realsyncdynamics-evidence-vault"

  # Lifecycle rules for cost optimization
  lifecycle_rules = [
    {
      # Hot → Archive transition at 90 days
      transitions = [
        {
          days          = 90
          storage_class = "GLACIER" # Cloudflare's archive tier
        }
      ]

      # Delete old evidence after retention period
      # Configurable per tenant via compliance hold flag
      expirations = [
        {
          days = 2555 # 7 years (max EU AI Act retention)
        }
      ]

      # Apply to all objects with prefix
      prefix = "evidence-vault/"
    },
    {
      # Compliance-held evidence: never auto-delete
      # Must be manually reviewed before deletion
      tags = {
        compliance_hold = "true"
      }
      # No expiration rule = retained indefinitely
      prefix = "evidence-vault/"
    }
  ]
}
```

### Webhook for Compliance Hold Review

```typescript
// supabase/functions/evidence-compliance-review/index.ts
// Triggered yearly to review compliance-held evidence

export async function reviewComplianceHold(tenantId: string) {
  // 1. Query R2 objects with compliance_hold = true
  // 2. Check evidence_retention table for expiry_date
  // 3. If expiry_date < today:
  //    - Remove compliance_hold tag
  //    - Evidence becomes eligible for deletion
  // 4. Return audit log of reviewed objects
}
```

---

## Retention Periods by Regulation

### GDPR (EU)

| Category | Retention | Reason |
|----------|-----------|--------|
| Consent Records | 3 years | Legal basis documentation |
| Data Processing Logs | 1 year | Audit trail for RoPA |
| DPA Copies (approved) | 3 years | Proof of approval |
| Incident Records | 3 years | Breach notification history |

### EU AI Act

| Category | Retention | Reason |
|----------|-----------|--------|
| Model Audit Trails | 3 years | Risk assessment proof |
| Testing Results | 3 years | Conformity assessment |
| Incident Reports | 3 years | Safety/performance records |

### SOC 2 (Cloud Services)

| Category | Retention | Retention Period |
|----------|-----------|------------------|
| Access Logs | 90 days | Real-time monitoring |
| System Changes | 1 year | Change audit trail |
| Incident Evidence | 2 years | Forensics + legal hold |

---

## Cost Comparison

### Example: 100TB Evidence Vault

#### Without Lifecycle (R2 hot storage only)
```
Monthly cost:
- 100 TB @ $0.015/GB/month = 100,000 GB * $0.015 = $1,500/month
- Annual: $18,000
```

#### With Lifecycle (optimized)
```
Year 1:
- 0-90 days (hot): 25 TB @ $0.015/GB/month = ~$375/month
- 90+ days (glacier): 75 TB @ $0.004/GB/month = ~$300/month
- Monthly avg: $337.50
- Annual Year 1: $4,050

Year 2-7 (steady state):
- All 100 TB in Glacier: 100 TB @ $0.004/GB/month = $400/month
- Annual: $4,800

Total 7-year retention: $4,050 + (6 * $4,800) = $32,850
vs. Hot-only: $126,000

Savings: 74% ($93,150)
```

---

## Implementation

### Step 1: Apply Lifecycle Policy

```bash
# Via Terraform
terraform apply -target=cloudflare_r2_bucket.evidence_vault

# Via Cloudflare API
curl -X PUT https://api.cloudflare.com/client/v4/accounts/{account_id}/r2/buckets/{bucket_name}/lifecycle \
  -H "Authorization: Bearer {api_token}" \
  -d '{
    "rules": [{
      "id": "evidence-archive",
      "prefix": "evidence-vault/",
      "transitions": [{
        "days": 90,
        "storageClass": "GLACIER"
      }],
      "expirations": [{
        "days": 2555
      }]
    }]
  }'
```

### Step 2: Track Compliance Holds

```typescript
// Database schema for retention tracking
CREATE TABLE IF NOT EXISTS evidence_retention (
  id UUID PRIMARY KEY,
  tenant_id UUID NOT NULL,
  evidence_id UUID NOT NULL,
  r2_key TEXT NOT NULL,
  compliance_hold BOOLEAN DEFAULT false,
  retention_until DATE NOT NULL,
  regulation_basis TEXT, -- 'GDPR', 'EU_AI_ACT', 'SOC2'
  reviewed_at TIMESTAMP,
  notes TEXT,
  created_at TIMESTAMP DEFAULT now()
);

CREATE INDEX idx_evidence_retention_compliance_hold 
  ON evidence_retention(tenant_id, compliance_hold);
```

### Step 3: Monitor Archival Process

```sql
-- View evidence distribution by storage tier
SELECT
  storage_tier,
  COUNT(*) as object_count,
  SUM(size) / 1024 / 1024 / 1024 as size_gb,
  ROUND(SUM(size) * 0.015 / (1024 * 1024 * 1024), 2) as monthly_cost
FROM r2_objects
WHERE bucket_name = 'realsyncdynamics-evidence-vault'
GROUP BY storage_tier
```

---

## Backup & Recovery Strategy

### R2 Backup

Since R2 is immutable by design, backups follow a multi-region approach:

```bash
# 1. Enable R2 Object Lock (optional, for additional immutability)
#    - Prevents accidental deletion for configured retention period
#    - Adds ~10% cost premium

# 2. Replicate to secondary R2 bucket in different Cloudflare datacenter
wrangler r2 object copy evidence-vault bucket-backup

# 3. Annual cold backup to AWS Glacier Deep Archive (99 years retention)
#    - ~$0.0036/GB/month (cheapest storage available)
#    - For audit compliance (never touched)
```

### Disaster Recovery

If R2 becomes unavailable:

1. **Within 1 hour**: Switch to backup R2 bucket (geo-redundant)
2. **Within 24 hours**: Restore from AWS Glacier Deep Archive (if needed)
3. **Monitoring**: CloudWatch alerts on R2 replication lag (target: <5 min)

---

## Compliance Audit

### Annual Retention Review

```sql
-- Find evidence approaching expiration
SELECT
  tenant_id,
  COUNT(*) as expiring_records,
  MIN(retention_until) as earliest_expiry
FROM evidence_retention
WHERE retention_until BETWEEN now() AND now() + interval '30 days'
GROUP BY tenant_id
ORDER BY earliest_expiry;
```

### Audit Trail

```typescript
// Log all compliance decisions
CREATE TABLE IF NOT EXISTS evidence_audit_log (
  id UUID PRIMARY KEY,
  action TEXT, -- 'compliance_hold_set', 'compliance_hold_released', 'manual_delete'
  evidence_id UUID,
  tenant_id UUID,
  actor_id UUID,
  reason TEXT,
  approved_by UUID,
  created_at TIMESTAMP DEFAULT now()
);
```

---

## Testing Lifecycle Policies

### Local Testing (Miniflare)

```javascript
// test/r2-lifecycle.test.ts
import { test } from 'vitest';

test('evidence archive transition', async () => {
  // Upload evidence to R2
  const evidence = { event_type: 'policy_update', /* ... */ };
  const key = await uploadEvidence(evidence);

  // Simulate 90-day passage
  const futureDate = new Date();
  futureDate.setDate(futureDate.getDate() + 91);

  // Query lifecycle status
  const lifecycle = await getR2Lifecycle(key, futureDate);
  expect(lifecycle.storageClass).toBe('GLACIER');
});
```

### Production Monitoring

```json
{
  "metrics": {
    "r2_objects_in_hot_storage": 5000,
    "r2_objects_in_glacier": 45000,
    "r2_objects_pending_deletion": 200,
    "evidence_with_compliance_hold": 150,
    "monthly_archival_volume_gb": 250
  },
  "alerts": [
    {
      "name": "high_compliance_hold_backlog",
      "threshold": "compliance_hold count > 500",
      "action": "notify compliance@realsyncdynamics.ai"
    }
  ]
}
```

---

## References

- [Cloudflare R2 Lifecycle Policies](https://developers.cloudflare.com/r2/configuration/object-lifecycle-policies/)
- [GDPR Data Retention](https://gdpr-info.eu/)
- [EU AI Act Retention Requirements](https://eur-lex.europa.eu/eli/reg/2024/1689/oj)
- [Terraform Cloudflare R2](https://registry.terraform.io/providers/cloudflare/cloudflare/latest/docs/resources/r2_bucket)

