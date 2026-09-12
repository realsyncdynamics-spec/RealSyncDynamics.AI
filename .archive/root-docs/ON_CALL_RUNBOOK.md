# Phase 4: Social-Orchestrator On-Call Runbook

**Target Launch**: 2026-08-01  
**On-Call Team**: Engineering + DevOps  
**Response SLA**: P1 15min, P2 30min, P3 1hour  

---

## Quick Start (5 Minutes)

### Alert Received?

1. **Acknowledge** in PagerDuty/Slack (thumbs up emoji)
2. **Open dashboard**: https://realsyncdynamics-ai.pages.dev/admin/monitoring
3. **Check severity**:
   - **🔴 RED** (DLQ > 100 OR Error Rate > 5%) → P1, follow Section 2
   - **🟡 YELLOW** (DLQ > 10 OR Error Rate > 2%) → P2, follow Section 3
   - **🟢 GREEN** with warning → P3, follow Section 4

4. **First 5 minutes**:
   ```bash
   # 1. Acknowledge alert
   echo "Acknowledged $(date)" | slack #incident-response
   
   # 2. Snapshot current state
   # Run this in Supabase SQL Editor:
   SELECT
     (SELECT COUNT(*) FROM social_dlq_entries) as dlq_depth,
     (SELECT ROUND(100.0 * COUNT(CASE WHEN status = 'failed' THEN 1 END) / COUNT(*), 2) FROM social_publishing_metrics WHERE created_at > NOW() - INTERVAL '1 hour') as error_rate_1h_percent,
     NOW() as timestamp;
   
   # 3. Check if alert is ongoing or isolated
   # If DLQ depth stable → likely resolved
   # If DLQ depth growing → active incident
   ```

5. **Still unclear?** Page Engineering Lead (escalation in Section 6)

---

## Section 1: Monitoring Dashboard Overview

**Access**: https://realsyncdynamics-ai.pages.dev/admin/monitoring

### KPI Cards (Top Row)
- **DLQ Depth** — Total failed publishes waiting for retry (target: < 10)
- **Success Rate (1h)** — Publish success % in last hour (target: > 95%)
- **Failed (1h)** — Failed publish attempts (target: 0-5)
- **Succeeded (1h)** — Successful publishes (trending indicator)

### Channel Breakdown (Table)
- Shows **total DLQ entries per channel**
- Shows **ready-to-retry now** (entries past their backoff window)
- Shows **error type breakdown** (RATE_LIMIT, UNAUTHORIZED, NETWORK_TIMEOUT)

### Latency Chart
- **P50, P95, P99** by channel
- Target: P95 < 3 seconds (warning > 3s, critical > 5s)

### Action Triggers
| Read | Action | SLA |
|------|--------|-----|
| DLQ > 100 | Check Section 2.1 | P1 (15min) |
| Error Rate > 5% | Check Section 2.2 | P1 (15min) |
| P95 Latency > 3s | Check Section 3.2 | P2 (30min) |
| Stuck Entries > 5 | Check Section 4.2 | P3 (1h) |

---

## Section 2: P1 CRITICAL - Immediate Action Required (15 min SLA)

### 2.1 Scenario: DLQ Depth > 100

**Symptoms**: Dashboard shows red DLQ Depth card, alerts firing

**Step 1: Confirm the problem (1 min)**
```sql
-- Run in Supabase SQL Editor
SELECT
  channel,
  COUNT(*) as entries,
  COUNT(CASE WHEN error_code = 'RATE_LIMIT' THEN 1 END) as rate_limit,
  COUNT(CASE WHEN error_code = 'UNAUTHORIZED' THEN 1 END) as auth,
  COUNT(CASE WHEN error_code = 'NETWORK_TIMEOUT' THEN 1 END) as timeout
FROM social_dlq_entries
WHERE created_at > NOW() - INTERVAL '1 hour'
GROUP BY channel
ORDER BY entries DESC;
```

**Step 2: Identify root cause (3 min)**

| Top Error Type | Root Cause | Fix |
|---|---|---|
| **RATE_LIMIT** | Platform throttling us | Reduce publish volume, wait 5-10 min, manual retry |
| **UNAUTHORIZED** | Bad/expired token | Rotate credentials in Supabase Vault |
| **NETWORK_TIMEOUT** | Network issue | Check platform status pages, wait for recovery |
| **Multiple types** | Systemic issue | Pause publishes, escalate to Engineering Lead |

**Step 3: Stop bleeding (2 min)**
```bash
# If RATE_LIMIT (most common):
# 1. Pause new publishes (via admin panel or API)
# 2. Wait 5-10 minutes for rate limit to reset
# 3. Then resume publishes at 50% rate

# If UNAUTHORIZED:
# 1. Check Supabase Vault: are credentials still valid?
# 2. Rotate credentials (each platform-specific)
# 3. Resume publishes

# If NETWORK_TIMEOUT:
# 1. Check platform status pages (LinkedIn, X, Instagram, etc.)
# 2. If platform is degraded: WAIT (out of our control)
# 3. If our network: check Supabase region, ping from Edge Function
```

**Step 4: Communicate (1 min)**
```
Slack #incident-response:
⚠️ P1 INCIDENT: DLQ depth {{ dlq_depth }}
Root cause: {{ error_type }}
Action: {{ action_taken }}
ETA recovery: {{ eta }}
```

**Step 5: Verify recovery (3 min)**
- Watch DLQ depth trend for 5 minutes
- If declining → crisis averted, continue monitoring
- If flat/growing → escalate to Engineering Lead (Section 6)

**Step 6: Post-incident (after recovery)**
- [ ] Document incident in runbook comments
- [ ] Schedule post-mortem (within 24h)
- [ ] Update alert thresholds if needed

---

### 2.2 Scenario: Error Rate > 5% (Last 1 Hour)

**Symptoms**: Dashboard shows red Success Rate card, > 5% errors

**Step 1: Identify affected channels (1 min)**
```sql
SELECT
  channel,
  COUNT(*) as total,
  COUNT(CASE WHEN status = 'failed' THEN 1 END) as failed,
  ROUND(100.0 * COUNT(CASE WHEN status = 'failed' THEN 1 END) / COUNT(*), 2) as error_rate_percent
FROM social_publishing_metrics
WHERE created_at > NOW() - INTERVAL '1 hour'
GROUP BY channel
ORDER BY error_rate_percent DESC;
```

**Step 2: Check channel-specific status (2 min)**

For each high-error channel:
- LinkedIn: Check LinkedIn API status page + token validity
- X: Check X API status + rate limits
- Instagram: Check Meta status page
- TikTok: Check TikTok status page
- WordPress: Check website uptime
- Ghost: Check CMS uptime
- Email: Check SendGrid status + quota
- Webhook: Check n8n/destination service status

**Step 3: Determine if systematic or platform issue (2 min)**
- **Single channel failing** → Platform issue or bad credentials
  - Action: If platform degraded → WAIT. If credentials bad → rotate.
- **Multiple channels failing** → Likely our infrastructure
  - Action: Check Edge Function logs (next step)
- **All channels failing** → Critical infrastructure issue
  - Action: Escalate immediately to Engineering Lead

**Step 4: Check Edge Function logs (2 min)**
```bash
# Via Supabase dashboard → Functions → social-orchestrator-persistence → Logs
# Or via CLI:
supabase functions get-logs social-orchestrator-persistence --limit 100

# Look for:
# - Database connection errors
# - Timeout errors
# - Unhandled exceptions
# - Memory exhaustion
```

**Step 5: Pause vs Continue (1 min)**
- Error rate stabilizing or declining? → Continue monitoring
- Error rate growing? → Pause publishes, escalate

**Step 6: Recovery (2 min)**
- If platform issue resolved: Resume publishes
- If our issue fixed: Resume publishes
- Otherwise: Escalate to Engineering Lead

---

## Section 3: P2 WARNING - Investigate (30 min SLA)

### 3.1 Scenario: DLQ Depth 10-100

**Action**: Check trend over last 5 minutes
- Stable/declining? → OK, just monitor
- Growing? → Investigate using 2.1 steps, but lower urgency
- Spiking suddenly? → May become P1, watch closely

**Quick check**:
```sql
-- Is DLQ growing?
SELECT COUNT(*) as dlq_now FROM social_dlq_entries;
-- (Compare to 5 min ago from monitoring log)
```

---

### 3.2 Scenario: P95 Latency > 3 Seconds

**Symptoms**: Latency chart shows p95 > 3000ms

**Investigation (10 min)**:
```sql
-- Check latency trend by channel
SELECT
  channel,
  DATE_TRUNC('minute', created_at) as minute,
  COUNT(*) as count,
  ROUND(AVG(latency_ms), 0) as avg_ms,
  ROUND(PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY latency_ms), 0) as p95_ms,
  MAX(latency_ms) as max_ms
FROM social_publishing_metrics
WHERE created_at > NOW() - INTERVAL '15 minutes'
GROUP BY channel, DATE_TRUNC('minute', created_at)
ORDER BY minute DESC, channel;

-- Check for slow queries
SELECT
  query,
  calls,
  mean_exec_time,
  max_exec_time
FROM pg_stat_statements
WHERE mean_exec_time > 100
ORDER BY mean_exec_time DESC
LIMIT 10;
```

**Common causes**:
- Database under load → Check active connections
- Edge Function slow → Check function logs
- Network latency → Check region/path

**Actions**:
- If load-related → Usually resolves on its own
- If persistent → Escalate to Engineering Lead

---

## Section 4: P3 LOW PRIORITY - Planned Investigation (1 hour SLA)

### 4.1 Scenario: Stuck DLQ Entries > 5

**Symptoms**: Entries in DLQ with `next_retry_at IS NULL` (max retries reached)

**Investigation**:
```sql
-- Find stuck entries
SELECT
  id,
  channel,
  error_code,
  retry_count,
  EXTRACT(EPOCH FROM (NOW() - created_at))::INTEGER / 86400 as age_days
FROM social_dlq_entries
WHERE next_retry_at IS NULL AND retry_count >= 5
ORDER BY created_at ASC;
```

**Action**:
- Review error_code: Is it expected (auth error) or anomaly?
- If expected: No action needed (will auto-cleanup after 30 days)
- If anomaly: Investigate root cause, consider manual removal or re-queue
- High volume (> 50)? Escalate to Engineering Lead

---

### 4.2 Scenario: Audit Log Not Updating

**Symptoms**: No new events in audit log for > 1 hour

**Investigation**:
```sql
-- Check latest audit event
SELECT COUNT(*) FROM social_audit_log WHERE created_at > NOW() - INTERVAL '1 hour';
```

**If count = 0**:
1. Are publishes happening? (Check social_publishing_metrics)
2. If yes but audit log empty → Function issue
3. Check Edge Function logs for errors
4. If error found → Follow fix procedures
5. If no error → Check audit logging code in persistence layer

---

## Section 5: Common Remediation Procedures

### 5.1 Rotate API Credentials

Each platform has different rotation procedures:

**LinkedIn**:
1. Go to LinkedIn → Settings → Developer applications
2. Find app, regenerate access token
3. Update in Supabase Vault: `LINKEDIN_ACCESS_TOKEN`
4. Verify: Test publish to LinkedIn after 5 min

**X (Twitter)**:
1. Go to Twitter Developer Portal → Keys and tokens
2. Regenerate API Key + Secret
3. Update in Supabase Vault: `X_API_KEY`, `X_API_SECRET`
4. Verify: Test publish to X after 5 min

**Meta (Instagram)**:
1. Go to Meta App Dashboard → Settings
2. Regenerate access token
3. Update in Supabase Vault: `META_ACCESS_TOKEN`
4. Verify: Test publish to Instagram after 5 min

**Email (SendGrid)**:
1. Go to SendGrid Dashboard → API Keys
2. Create new API key with required scopes
3. Update in Supabase Vault: `SENDGRID_API_KEY`
4. Verify: Test send email after 5 min

**After all rotations**:
```bash
# Test all channels
curl -X POST https://realsyncdynamics-ai.pages.dev/api/test-publish \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -d '{"channels": ["linkedin.enterprise", "x.alert", "instagram.reel", "email.newsletter"]}'
```

---

### 5.2 Manual DLQ Retry

For entries stuck or ready to retry:

```bash
# Via Supabase Edge Function
curl -X POST https://<project>.supabase.co/functions/v1/social-orchestrator-persistence \
  -H "Authorization: Bearer $SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "action": "dlq:retry",
    "dlqId": "{{ dlq_entry_id }}"
  }'

# Expected response: { "success": true, "message": "Retry scheduled", "nextRetryAt": "2026-07-19T14:30:00Z" }
```

---

### 5.3 Pause Publishes (Circuit Breaker)

To halt all new publishes to a channel:

```sql
-- Update queue entries to 'rejected' status
UPDATE social_dlq_entries
SET metadata = jsonb_set(metadata, '{paused}', 'true'::jsonb)
WHERE channel = 'linkedin.enterprise'
  AND created_at > NOW() - INTERVAL '24 hours';

-- Announce pause
echo "⚠️ Publishes to linkedin.enterprise paused. Reason: {{ reason }}. ETA resume: {{ eta }}" | slack #incident-response
```

To resume:
```sql
UPDATE social_dlq_entries
SET metadata = jsonb_set(metadata, '{paused}', 'false'::jsonb)
WHERE channel = 'linkedin.enterprise';
```

---

### 5.4 Restart Cron Jobs

If cleanup or rollup cron jobs haven't run:

```sql
-- Check cron job status
SELECT jobname, schedule, nodename FROM cron.job WHERE jobname LIKE 'cleanup%' OR jobname LIKE 'rollup%';

-- Manually trigger cleanup
SELECT cleanup_social_dlq();

-- Manually trigger rollup
SELECT rollup_publishing_metrics_hourly();

-- Verify executed successfully
SELECT COUNT(*) FROM social_audit_log WHERE event_type = 'dlq_cleanup_executed' AND created_at > NOW() - INTERVAL '5 minutes';
```

---

## Section 6: Escalation & Communication

### 6.1 Escalation Tree

**Level 1: On-Call Engineer** (You)
- Handle P3, P2 warnings
- Gather context, attempt fixes
- Document actions in #incident-response

**Level 2: Engineering Lead** (After 15 min of P1 with no resolution)
- Page via PagerDuty
- Confirm incident, take command
- Decide on rollback/pause

**Level 3: VP Engineering** (If Level 2 unavailable OR critical data loss risk)
- Page via PagerDuty
- Escalate media/customer communication

### 6.2 Slack Incident Channel Template

Post in #incident-response when incident begins:

```
🚨 INCIDENT: [P1|P2|P3] - [Title]

Status: Active
Time: [UTC time]
Severity: [Description]
Affected: [Channels/Services]
Error Rate: [Current %]
Impact: [What users are experiencing]

Root Cause: [If known]
Action Taken: [Steps so far]
ETA Resolution: [Estimated time]

Owner: @[On-Call Engineer]
Escalation: [If needed]
```

Update every 5 minutes while active.

---

### 6.3 Communication Templates

**To Engineering Team**:
```
⚠️ Publishing degradation affecting [channel].
Cause: [Root cause]
Impact: Failed publishes going to DLQ.
Status: [Investigation/Fixing/Resolved]
```

**To Product Team**:
```
🔍 Social media publishing experiencing delays on [channel].
ETA back to normal: [Time]
Customers notified? [Yes/No]
```

**To Customers** (if > 30 min outage):
```
We are experiencing intermittent publishing delays on [platform].
Our engineering team is investigating.
ETA resolution: [Time]
Updates: [Status page link]
```

---

## Section 7: Post-Incident Procedures

### 7.1 Incident Closure Checklist

After incident resolved:
- [ ] DLQ depth back to normal
- [ ] Error rate < 1%
- [ ] All publishes successful
- [ ] Post final status in #incident-response
- [ ] Update incident log (timestamp, duration, root cause, resolution)

### 7.2 Post-Mortem (Within 24 Hours)

Schedule meeting with:
- On-Call Engineer (responder)
- Engineering Lead (reviewer)
- Relevant platform owners

**Template**:
```
Incident: [Name]
Duration: [Start] to [End] ([X minutes])
Impact: [DLQ depth reached {{max}}, Error rate {{peak}}%]

Timeline:
  T+0: [Event that triggered alert]
  T+2: [Investigation started]
  T+5: [Root cause identified]
  T+7: [Fix applied]
  T+10: [Verified recovered]

Root Cause: [Technical explanation]

Prevention:
  - [ ] Alert threshold adjustment
  - [ ] Code change required?
  - [ ] Additional monitoring?
  - [ ] Documentation update?

Action Items:
  - [ ] [Item 1] - Owner: [Person] - Due: [Date]
  - [ ] [Item 2] - Owner: [Person] - Due: [Date]
```

### 7.3 Runbook Updates

After incident, update this runbook:
- Add new scenario if not covered
- Refine steps if they took too long
- Add links to relevant logs/queries
- Update alert thresholds if needed

---

## Section 8: Reference Material

### Quick Links
- **Dashboard**: https://realsyncdynamics-ai.pages.dev/admin/monitoring
- **Supabase Console**: https://app.supabase.com/projects
- **Sentry**: https://sentry.io/organizations/realsyncdynamics/
- **Incident Response Playbook**: https://github.com/realsyncdynamics-spec/RealSyncDynamics.AI/blob/main/INCIDENT_RESPONSE_PLAYBOOK.md
- **Monitoring Setup**: https://github.com/realsyncdynamics-spec/RealSyncDynamics.AI/blob/main/MONITORING_SETUP.md

### Useful SQL Queries

**System Health Snapshot**:
```sql
SELECT
  (SELECT COUNT(*) FROM social_dlq_entries) as dlq_depth,
  (SELECT ROUND(100.0 * COUNT(CASE WHEN status = 'failed' THEN 1 END) / COUNT(*), 2) 
   FROM social_publishing_metrics WHERE created_at > NOW() - INTERVAL '1 hour') as error_rate_1h,
  (SELECT COUNT(*) FROM social_publishing_metrics WHERE created_at > NOW() - INTERVAL '1 hour' AND status = 'succeeded') as succeeded_1h,
  NOW() as timestamp;
```

**All DLQ Entries**:
```sql
SELECT * FROM social_dlq_entries ORDER BY created_at DESC LIMIT 50;
```

**Error Rate by Channel (24h)**:
```sql
SELECT channel, COUNT(*) as total, COUNT(CASE WHEN status = 'failed' THEN 1 END) as failed, 
ROUND(100.0 * COUNT(CASE WHEN status = 'failed' THEN 1 END) / COUNT(*), 2) as error_pct
FROM social_publishing_metrics WHERE created_at > NOW() - INTERVAL '24 hours'
GROUP BY channel ORDER BY error_pct DESC;
```

---

## Section 9: Team Contacts

| Role | Name | Slack | On-Call |
|------|------|-------|---------|
| Engineering Lead | [Name] | @[handle] | [PagerDuty] |
| DevOps Engineer | [Name] | @[handle] | [PagerDuty] |
| Product Lead | [Name] | @[handle] | [Office hours only] |

---

**Last Updated**: 2026-07-19  
**Valid Until**: 2026-08-30 (30 days after launch)  
**Next Review**: 2026-08-20  

**Sign-Off**: [ ] Reviewed by Engineering Lead | [ ] Approved by VP Engineering

