# Incident Response Playbook
**Social Orchestrator — Phase 4 & Beyond**

On-call runbook for responding to publishing failures and system degradation.

---

## Severity Levels

| Level | Definition | Response Time | Example |
|-------|-----------|----------------|---------|
| **P1 - Critical** | Service down, no publishes possible | 15 minutes | All channels failing, database unavailable |
| **P2 - High** | Partial service degradation | 30 minutes | 1-2 channels failing, high error rate |
| **P3 - Medium** | Single channel or slow performance | 1 hour | WordPress timeouts, high latency |
| **P4 - Low** | Minor issues, no user impact | 4 hours | Audit log query slow, cosmetic issues |

---

## Initial Response (First 5 Minutes)

### 1. Confirm the Incident
```
☐ Check monitoring dashboard: error rates, DLQ depth, latency
☐ Check Supabase status page: https://status.supabase.com
☐ Check social platform status pages:
  - LinkedIn: https://www.linkedin.com/psettings/system-status
  - X: https://www.xstatus.com
  - Instagram/Meta: https://developers.facebook.com/status
  - TikTok: https://www.tiktok.com
  - Google (Gmail): https://www.google.com/appsstatus
☐ Verify it's not a false alarm (check last successful publish time)
☐ Assess severity: P1 (immediate escalation) or P2-P4 (investigate)
```

### 2. Gather Context
```bash
# Check Edge Function logs
supabase functions get-logs social-orchestrator-persistence --tail 50

# Check recent database activity
SELECT event_type, count(*) as count, max(created_at) as latest
FROM social_audit_log
WHERE created_at > NOW() - INTERVAL '30 minutes'
GROUP BY event_type
ORDER BY latest DESC;

# Check DLQ depth
SELECT channel, count(*) as dlq_entries, max(created_at) as latest_failure
FROM social_dlq_entries
WHERE created_at > NOW() - INTERVAL '1 hour'
GROUP BY channel
ORDER BY dlq_entries DESC;
```

### 3. Alert Team
**P1 - Critical**: Page on-call engineer + engineering lead + product lead  
**P2 - High**: Alert engineering Slack channel + on-call engineer  
**P3-P4**: Log in issue tracking system

---

## Incident Scenarios & Responses

## Scenario 1: All Channels Failing

**Symptoms**: 
- Error rate 100% across all channels
- DLQ entries accumulating rapidly
- No successful publishes in last 15 minutes

**Root Cause Investigation**:
```bash
# 1. Check Edge Function is running
curl -X POST https://your-project.supabase.co/functions/v1/social-orchestrator-persistence \
  -H "Authorization: Bearer $ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{"action": "dlq:list", "payload": {}}'

# 2. Check Supabase database connectivity
psql "postgresql://postgres:password@your-project.supabase.co:5432/postgres" \
  -c "SELECT version();"

# 3. Check Edge Function error logs
supabase functions get-logs social-orchestrator-persistence --tail 100 | grep ERROR

# 4. Verify API credentials in Vault
# UI: Supabase Dashboard → Settings → Vault
# Check all credentials present and not expired

# 5. Check database table status
SELECT schemaname, tablename, pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size
FROM pg_tables
WHERE tablename LIKE 'social_%'
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;
```

**Common Causes & Fixes**:

| Cause | Detection | Fix |
|-------|-----------|-----|
| **Database unavailable** | `psql` connection fails | Check Supabase status, restart pooler if needed |
| **Edge Function down** | `curl` returns 500 | Redeploy: `supabase functions deploy social-orchestrator-persistence` |
| **All API credentials expired** | Vault shows outdated tokens | Rotate tokens immediately (see Credential Rotation) |
| **RLS policy issue** | Query returns permission denied | Verify policies: `SELECT * FROM pg_policies WHERE tablename LIKE 'social_%'` |
| **Disk space exhausted** | Queries timeout, writes fail | Check storage quota, archive old audit logs |

**Recovery Steps** (in order):
1. Verify Supabase is up (https://status.supabase.com)
2. Restart Edge Function: `supabase functions deploy social-orchestrator-persistence`
3. Check credential Vault: Rotate if expired
4. Retry single publish to each channel
5. If still failing: Escalate to Supabase support

---

## Scenario 2: High Error Rate (> 10%) on Single Channel

**Symptoms**:
- LinkedIn error rate 50%, other channels < 1%
- DLQ entries growing only for LinkedIn
- X, Instagram working normally

**Investigation**:
```bash
# 1. Check channel-specific metrics
SELECT channel, status, error_code, count(*) as count
FROM social_publishing_metrics
WHERE channel = 'linkedin.enterprise' 
  AND created_at > NOW() - INTERVAL '1 hour'
GROUP BY channel, status, error_code
ORDER BY count DESC;

# 2. Review audit log for this channel
SELECT event_type, status, metadata, created_at
FROM social_audit_log
WHERE channel = 'linkedin.enterprise'
  AND created_at > NOW() - INTERVAL '30 minutes'
ORDER BY created_at DESC
LIMIT 20;

# 3. Check DLQ entries for this channel
SELECT error_code, count(*) as count, max(created_at) as latest
FROM social_dlq_entries
WHERE channel = 'linkedin.enterprise'
GROUP BY error_code
ORDER BY latest DESC;
```

**Common Causes & Fixes**:

| Cause | Error Code | Fix |
|-------|-----------|-----|
| **Rate limit** | RATE_LIMIT | Wait 60s, retry automatically (exponential backoff) |
| **Invalid credentials** | UNAUTHORIZED | Check/rotate LinkedIn API token in Vault |
| **API version deprecated** | API_VERSION_CHANGED | Update API endpoint in `linkedinPublisher.ts` |
| **Platform maintenance** | SERVICE_UNAVAILABLE | Wait, monitor LinkedIn status page |
| **Quota exceeded** | QUOTA_EXCEEDED | Check LinkedIn API quota dashboard |

**Recovery Steps**:
1. Identify error code from DLQ
2. If rate limit: Wait 60-120 seconds, allow automatic retry
3. If auth error: Rotate credentials immediately
4. If API change: Update publisher code and redeploy
5. Manually retry DLQ entries: `dlq.retry(dlqId)`

---

## Scenario 3: High Latency (> 5 seconds per publish)

**Symptoms**:
- p95 latency jumped from 2s to 8s
- DLQ entries not growing (so publishes succeed, just slow)
- User reports publishing is "frozen"

**Investigation**:
```bash
# 1. Check Edge Function performance
supabase functions get-logs social-orchestrator-persistence --tail 50 | grep "duration_ms"

# 2. Check database query performance
SELECT query, calls, mean_exec_time, max_exec_time
FROM pg_stat_statements
WHERE query LIKE '%social_%'
ORDER BY mean_exec_time DESC
LIMIT 10;

# 3. Check table sizes
SELECT tablename, pg_size_pretty(pg_total_relation_size('public.' || tablename))
FROM pg_tables
WHERE schemaname = 'public' AND tablename LIKE 'social_%'
ORDER BY pg_total_relation_size('public.' || tablename) DESC;

# 4. Check index efficiency
SELECT schemaname, tablename, indexname, idx_scan, idx_tup_read, idx_tup_fetch
FROM pg_stat_user_indexes
WHERE schemaname = 'public' AND tablename LIKE 'social_%'
ORDER BY idx_scan DESC;
```

**Common Causes & Fixes**:

| Cause | Evidence | Fix |
|-------|----------|-----|
| **Query without index** | `idx_scan = 0` on key index | Add index (check missing_indexes) |
| **Full table scan** | `seq_scan > idx_scan * 100` | Verify index is used, check WHERE clause |
| **Connection pool exhausted** | Check Supabase connections | Increase max connections or reduce Edge Function concurrency |
| **Large DLQ queue** | `social_dlq_entries count > 100,000` | Archive old entries or partition table |
| **Slow upstream API** | Edge Function logs show API latency | Rate limit, batch smaller, or switch provider |

**Recovery Steps**:
1. Run ANALYZE to update statistics: `ANALYZE social_publishing_metrics;`
2. Check for missing indexes on frequently queried columns
3. If connection pool exhausted: Increase in Supabase dashboard (Networking)
4. If DLQ too large: Archive entries older than 30 days
5. Monitor latency after fix

---

## Scenario 4: DLQ Entries Not Processing (Stuck Retries)

**Symptoms**:
- DLQ depth growing (entries not retrying)
- `next_retry_at` in future, but cron job doesn't retry
- Manual retry works, but automatic retries stopped

**Investigation**:
```bash
# 1. Check if cleanup/retry cron jobs are running
SELECT jobid, jobname, schedule, last_run_success, last_run_time
FROM cron.job
WHERE jobname LIKE '%social%' OR jobname LIKE '%retry%';

# 2. Check cron job execution logs
SELECT * FROM cron.job_run_details
WHERE job_id IN (SELECT jobid FROM cron.job WHERE jobname LIKE '%social%')
ORDER BY start_time DESC
LIMIT 20;

# 3. Check for entries ready to retry
SELECT id, queue_entry_id, channel, retry_count, next_retry_at
FROM social_dlq_entries
WHERE next_retry_at <= NOW()
  AND retry_count < 5
ORDER BY next_retry_at ASC
LIMIT 10;

# 4. Manually trigger retry
SELECT * FROM (
  SELECT id FROM social_dlq_entries
  WHERE next_retry_at <= NOW() AND retry_count < 5
  LIMIT 1
) AS to_retry;
-- Then call dlq.retry(id) via Edge Function
```

**Common Causes & Fixes**:

| Cause | Evidence | Fix |
|-------|----------|-----|
| **pg_cron disabled** | `cron.job` table doesn't exist | Enable: `CREATE EXTENSION IF NOT EXISTS pg_cron;` |
| **Cron job paused** | `last_run_time` is old | Resume: `SELECT cron.unschedule('job_id');` then reschedule |
| **Exponential backoff maxed** | `retry_count = 5` | Entries won't auto-retry after 5 attempts |
| **Manual cleanup removed entries** | Entries missing from DLQ | Check audit logs for who deleted them |

**Recovery Steps**:
1. Verify pg_cron is enabled and jobs are scheduled
2. For stuck entries: Manual retry via `dlq.retry()` API
3. After 5 retries: Manual investigation required (check audit log for root cause)
4. Clean up: Delete entries if determined to be unrecoverable

---

## Scenario 5: Metrics Dashboard Showing No Data

**Symptoms**:
- Dashboard queries return empty results
- Metrics table exists but appears empty
- Last few hours have no metrics recorded

**Investigation**:
```bash
# 1. Check if metrics are being recorded
SELECT count(*) as total, 
       max(created_at) as latest,
       min(created_at) as oldest
FROM social_publishing_metrics;

# 2. Check if hourly rollup is working
SELECT count(*) as hourly_records,
       max(hour) as latest_hour
FROM social_publishing_metrics_hourly;

# 3. Check Edge Function is logging metrics
supabase functions get-logs social-orchestrator-persistence --tail 100 | grep "metrics:record"

# 4. Check if cron job for rollup is running
SELECT * FROM cron.job WHERE jobname = 'rollup_metrics';
SELECT * FROM cron.job_run_details WHERE job_id = (SELECT jobid FROM cron.job WHERE jobname = 'rollup_metrics') ORDER BY start_time DESC LIMIT 5;

# 5. Manual aggregation test
SELECT COUNT(*) as raw_records FROM social_publishing_metrics WHERE created_at > NOW() - INTERVAL '1 hour';
SELECT COUNT(*) as hourly_records FROM social_publishing_metrics_hourly WHERE hour = DATE_TRUNC('hour', NOW());
```

**Common Causes & Fixes**:

| Cause | Evidence | Fix |
|-------|----------|-----|
| **Metrics table empty** | `count(*) = 0` | Check if publishes are happening, logs in Edge Function |
| **Hourly rollup not running** | No new entries in hourly table | Reschedule cron job: `SELECT cron.schedule(...)` |
| **Retention policy deleted data** | Recent data missing | Check if cleanup function ran early |
| **Dashboard query wrong** | Metrics exist but query filters wrong | Verify time range, channel filters |

**Recovery Steps**:
1. Verify publishes are actually happening (check queue_entry status)
2. Force manual metrics aggregation: `SELECT rollup_publishing_metrics_hourly()`
3. Reschedule hourly rollup if cron failed
4. Recreate missing metrics from audit logs if needed (manual re-aggregation)

---

## Scenario 6: Audit Log Query Timeout

**Symptoms**:
- Dashboard loads slowly when viewing audit trail
- Query timeout errors in logs
- Audit log table has millions of entries

**Investigation**:
```bash
# 1. Check audit log size
SELECT COUNT(*) as total_entries,
       pg_size_pretty(pg_total_relation_size('public.social_audit_log')) as table_size,
       min(created_at) as oldest,
       max(created_at) as newest
FROM social_audit_log;

# 2. Check index efficiency
SELECT schemaname, tablename, indexname, idx_scan
FROM pg_stat_user_indexes
WHERE tablename = 'social_audit_log'
ORDER BY idx_scan DESC;

# 3. Explain slow query
EXPLAIN ANALYZE
SELECT * FROM social_audit_log
WHERE queue_id = 'some_id'
ORDER BY created_at DESC
LIMIT 100;

# 4. Check for missing index
SELECT * FROM pg_stat_user_indexes WHERE tablename = 'social_audit_log' AND indexname LIKE '%queue%';
```

**Common Causes & Fixes**:

| Cause | Evidence | Fix |
|-------|----------|-----|
| **Table too large** | > 10M rows, > 10GB | Partition table by month or archive old entries |
| **Missing index** | `idx_scan = 0` on `queue_id` | Create: `CREATE INDEX idx_social_audit_queue ON social_audit_log(queue_id);` |
| **Full table scan** | `seq_scan > idx_scan * 100` | Ensure WHERE clause uses indexed column |
| **Query without limit** | Query returns millions of rows | Add pagination/limits to query |

**Recovery Steps**:
1. Add missing indexes immediately
2. Limit query results: Add LIMIT and pagination
3. Archive entries older than 2 years (if quota constrained)
4. For persistent issues: Partition table by month (future work)

---

## Credential Rotation

**When**: After incident involving auth failure, or quarterly rotation

**Steps**:
```bash
# 1. Generate new credentials on each platform
# - LinkedIn: Settings → OAuth applications → Regenerate token
# - X/Twitter: Developer Portal → API Keys → Regenerate
# - Instagram/Meta: Graph API → Token Tools → Extend Token
# - TikTok: Developer Account → API Keys → Generate New
# - SendGrid: API Keys → Create New API Key
# - WordPress: Generate new token per site
# - Ghost: Admin API → Regenerate Key

# 2. Update Supabase Vault (one at a time to avoid downtime)
# UI: Supabase Dashboard → Settings → Vault
# Or CLI: supabase secrets set KEY=value

# 3. Wait 5 minutes for Edge Functions to load new secrets

# 4. Test by publishing to each channel
for channel in linkedin.enterprise x.alert instagram.reel tiktok.fast email.newsletter; do
  echo "Testing $channel..."
  curl -X POST https://.../(...test publish...)/
done

# 5. Revoke old credentials on each platform

# 6. Document in incident log: who, when, which credentials rotated
```

---

## Escalation Tree

```
On-Call Engineer (Page me)
  ↓ (if unsure or P1) 
Engineering Lead (Alert Slack)
  ↓ (if persistent)
Product Lead (Daily standup)
  ↓ (if external issue)
Platform Status (Twitter, status page)
```

**On-Call Engineer**: Diagnose, triage, attempt fix  
**Engineering Lead**: Escalate architectural issues, authorize fixes  
**Product Lead**: Communication with customers (if needed)

---

## Post-Incident

### After Resolution (within 1 hour)
- [ ] Mark incident resolved in status page
- [ ] Note timeline in incident tracking system
- [ ] Verify system stable (error rate < 1%, DLQ empty, latency normal)

### Post-Mortem (within 24 hours)
- [ ] Capture timeline: detection → acknowledgment → fix → resolution
- [ ] Root cause analysis: what went wrong and why
- [ ] Action items: prevent recurrence
- [ ] Documentation: update runbook if new scenario discovered

### Example Post-Mortem Template
```markdown
## [Date] Incident: [Title]

**Timeline**:
- 14:32 - Alert triggered (error rate spike to 80%)
- 14:35 - On-call engaged
- 14:40 - Root cause identified: LinkedIn token expired
- 14:45 - New token deployed
- 14:50 - System recovered (error rate < 1%)
- **TTR (Time To Resolution): 18 minutes**

**Root Cause**: Automated credential rotation failed silently

**Why**: Cron job for rotation didn't run (pg_cron was restarted)

**Prevention**: 
- Add monitoring alert for credential expiry (7 days before)
- Implement backup rotation method (manual trigger)
- Add health check for active credentials

**Owner**: [Name]
**Follow-up**: Implement credential monitoring by [date]
```

---

## Monitoring Checklist

Keep these metrics under continuous watch:

- [ ] **Error Rate**: < 5% per channel
- [ ] **DLQ Depth**: < 100 entries (indicates systematic issue if > 1000)
- [ ] **Latency (p95)**: < 5 seconds (alert if > 8s)
- [ ] **Audit Log**: Queries complete in < 100ms
- [ ] **Database**: CPU < 80%, connections < 90% of limit
- [ ] **Storage**: Used < 80% of quota
- [ ] **Edge Function**: Errors < 1%, availability > 99.9%
- [ ] **Cron Jobs**: Last run successful (check hourly)

---

## Quick Reference

| Problem | Quick Check | Quick Fix |
|---------|------------|-----------|
| All channels failing | `supabase status` | Redeploy Edge Function |
| Single channel failing | Check error code in DLQ | Rotate credentials |
| High latency | Check slow queries | ANALYZE tables, add index |
| DLQ not processing | Check cron jobs | Reschedule rollup job |
| Metrics missing | Check if publishes happening | Force manual rollup |
| Dashboard slow | Check audit log size | Archive old entries |

---

## Resources

- **Supabase Docs**: https://supabase.com/docs
- **PostgreSQL Docs**: https://www.postgresql.org/docs/
- **pg_cron**: https://github.com/citusdata/pg_cron
- **Platform Status Pages**:
  - LinkedIn: https://www.linkedin.com/psettings/system-status
  - X: https://www.xstatus.com
  - Instagram: https://developers.facebook.com/status
  - TikTok: https://www.tiktok.com

---

**Last Updated**: 2026-07-19  
**Maintained By**: Engineering Team  
**Review Frequency**: Quarterly (or after incidents)
