# RealSyncDynamics.AI — Incident Response Playbook

## Severity Levels

| Level | Description | Response Time | Escalation |
|-------|-------------|---|---|
| **P1** | Complete service outage, data loss, or security breach | 15 min | Immediate exec notification |
| **P2** | Major feature unavailable, significant performance degradation | 1 hour | Manager + on-call lead |
| **P3** | Non-critical feature issue, minor performance impact | 4 hours | On-call engineer |
| **P4** | Documentation issue, minor UI bug | Next business day | Standard ticketing |

## Critical Incidents (P1)

### Authentication System Down
**Symptoms:** Users cannot log in, Supabase Auth unreachable

**Action Plan:**
1. Verify Supabase status at https://status.supabase.com
2. Check VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in environment
3. If Supabase is operational:
   - Check browser console for CORS errors
   - Verify Supabase project not paused
   - Check JWT token expiration
4. Rollback last deployment if recently changed: `git revert <commit-sha> && git push origin main`
5. Notify affected users via status page: https://status.realsyncdynamics.ai

**Recovery Time Target:** 30 minutes

---

### Database Connection Failures
**Symptoms:** "Connection pooling exhausted", ERR_PGSQL_CONNECTION_FAILED, queries timeout

**Action Plan:**
1. Check Supabase project dashboard → Database → Connection Status
2. Review database query count vs. max connections (default 100)
3. Identify and kill long-running queries:
   ```sql
   SELECT pid, usename, query, query_start FROM pg_stat_activity 
   WHERE state != 'idle' AND query_start < NOW() - INTERVAL '5 minutes';
   
   SELECT pg_terminate_backend(pid) FROM pg_stat_activity 
   WHERE query LIKE '%<suspect_query>%';
   ```
4. If table locks detected:
   ```sql
   SELECT * FROM pg_locks WHERE NOT granted;
   ```
5. Contact Supabase support for connection pool rebalancing
6. If unresolved, failover to read replica or manual snapshot restore

**Recovery Time Target:** 15 minutes

---

### Data Corruption / Accidental Deletion
**Symptoms:** Missing records, unexpected data modifications, RLS policy misconfiguration

**Action Plan:**
1. **DO NOT make further changes** — freeze all writes
2. Identify scope: which tables, time range, affected tenants
3. Check Supabase automated backups (7-day retention)
4. Query audit logs:
   ```sql
   SELECT * FROM ai_tool_runs WHERE created_at > NOW() - INTERVAL '1 hour'
   ORDER BY created_at DESC;
   ```
5. Contact Supabase support to restore from point-in-time backup
6. Notify affected tenants after restoration
7. Post-incident: review RLS policies and add additional safeguards

**Recovery Time Target:** 2 hours (depends on backup restoration)

---

### Security Breach / API Key Exposure
**Symptoms:** Unauthorized API access, leaked Anthropic/Stripe keys in logs

**Action Plan:**
1. **Immediate:** Revoke compromised API keys in their respective platforms
2. Rotate all environment secrets:
   - Generate new SUPABASE_SERVICE_ROLE_KEY
   - Generate new ANTHROPIC_API_KEY
   - Generate new STRIPE_SECRET_KEY
   - Generate new RESEND_API_KEY
3. Update all environment variables in:
   - Cloudflare Pages project settings
   - Vercel/deployment pipeline
   - Local .env.local files (team)
4. Scan git history for exposed secrets:
   ```bash
   git log -p | grep -i "sk_live\|sk-ant\|SUPABASE_SERVICE"
   ```
5. If found in committed history, force-push remediation or contact GitHub support
6. Notify security@realsyncdynamics.ai and affected users
7. Enable MFA on all service provider accounts
8. File incident report with compliance team

**Recovery Time Target:** 30 minutes key rotation, 4 hours full audit

---

## Major Incidents (P2)

### High Latency / Slow API Responses
**Symptoms:** API responses >1000ms, timeout errors, dashboard loading slowly

**Diagnosis:**
```bash
# Check Sentry error trends
# https://sentry.io/projects/realsyncdynamics/

# Monitor Cloudflare Analytics
# https://dash.cloudflare.com/pages → RealSyncDynamics.AI

# Check Supabase function logs
supabase functions get-logs dashboard-intelligence --limit 50

# Monitor function duration
supabase functions get dashboard-intelligence
```

**Actions:**
1. Identify bottleneck: frontend bundle, API, or database
2. If frontend: clear Cloudflare cache, check bundle size
3. If API: check function logs for errors, profile slow queries
4. If database: check for missing indexes or table bloat
5. Temporary mitigation: increase function timeout, enable caching
6. Schedule optimization task for next sprint

---

### Webhook Delivery Failures
**Symptoms:** User-configured webhooks not firing, event delivery lag

**Diagnosis:**
```sql
SELECT * FROM webhook_events_log 
WHERE status = 'failed' AND created_at > NOW() - INTERVAL '1 hour'
LIMIT 20;
```

**Actions:**
1. Verify webhook URLs are still valid (not 404, 500 errors)
2. Check network connectivity from edge functions
3. Increase retry backoff:
   - 1st retry: 5 minutes
   - 2nd retry: 15 minutes
   - 3rd retry: 1 hour
4. Notify affected tenants with ETA for delivery
5. Manual resend of failed events if needed

---

### Memory Leak in Edge Functions
**Symptoms:** Function errors increase over time, eventual out-of-memory crashes

**Actions:**
1. Check Sentry error rate trending upward
2. Identify affected function and review recent changes
3. Deploy rollback to previous stable version
4. For long-term fix:
   - Profile heap usage with --inspect flag
   - Check for event listener accumulation
   - Review large object references in loops
5. Re-deploy fixed version with gradual rollout (10% → 50% → 100%)

---

## Standard Incidents (P3)

### Dashboard Insights Generation Slow
**Actions:**
1. Check `dashboard-intelligence` function logs
2. Query complexity: review compliance_risks and incidents tables for size
3. Add temporary caching (Redis or in-memory)
4. Implement incremental generation for large datasets

---

### Alert Rule Not Triggering
**Actions:**
1. Verify rule is enabled: `compliance_alert_rules.enabled = true`
2. Check rule conditions match actual data
3. Review `compliance-alert-trigger` function logs
4. Test rule manually by creating matching compliance_risk

---

## Post-Incident Checklist

After every incident (P1 and P2):

- [ ] Root cause identified and documented
- [ ] Temporary mitigation in place
- [ ] Long-term fix planned and estimated
- [ ] Customer communication sent (if P1)
- [ ] Incident ticket created with timeline
- [ ] Monitoring alert configured to catch future occurrences
- [ ] Team retrospective scheduled
- [ ] Documentation updated (runbooks, architecture)
- [ ] Prevention measures implemented

## Escalation Contacts

| Role | On-Call | Contact |
|------|---------|---------|
| **Engineering Lead** | TBD | +49 XXX XXXX |
| **DevOps/Infrastructure** | TBD | slack: #incident-response |
| **Security** | TBD | security@realsyncdynamics.ai |
| **Supabase Support** | | https://supabase.com/support |
| **Stripe Support** | | https://support.stripe.com |
| **Anthropic API Support** | | support@anthropic.com |

## Communication Template

**For Customer Notification (P1 Incident):**

Subject: `[INCIDENT] RealSyncDynamics.AI Service Disruption (2026-07-06 14:30 UTC)`

Body:
```
We are investigating a service disruption affecting compliance monitoring.

Timeline:
- 14:30 UTC: Incident detected
- 14:45 UTC: Root cause identified (database connection pool exhausted)
- 15:00 UTC: Service restored
- Ongoing: Performance optimization

Impact:
- 12 minutes of elevated error rates
- ~5% of API requests affected
- No data loss or security breach

We apologize for the disruption and thank you for your patience.

Next steps: Full incident report within 24 hours.

Status Page: https://status.realsyncdynamics.ai
```

## Monitoring & Alerting Rules

Key alerts to configure in Sentry/Cloudflare:

```
1. Error rate > 1% → Page on-call
2. API latency p95 > 1000ms → Slack #alerts
3. Database connection pool > 80% → Slack #alerts
4. Edge function cold start > 5s → Log only
5. Webhook delivery failure rate > 5% → Slack #alerts
6. Authentication failure spike → Immediate escalation
```

---

**Last Updated:** 2026-07-06  
**Version:** 1.0  
**Next Review:** Quarterly or after each incident
