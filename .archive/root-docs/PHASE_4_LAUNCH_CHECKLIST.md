# Phase 4 Launch Readiness Checklist
**Target Go-Live: 2026-08-01** (43 days from 2026-07-19)

## Pre-Launch: Infrastructure Setup (Week 1-2)

### Database & Migrations
- [ ] `supabase db push` to deploy Phase 3 migrations
  - social_dlq_entries (Dead Letter Queue)
  - social_publishing_metrics (time-series metrics)
  - social_publishing_metrics_hourly (aggregated metrics)
  - social_audit_log (compliance trail)
  - RLS policies verified (Service Role access only)

### Scheduled Maintenance Tasks
- [ ] Enable PostgreSQL `pg_cron` extension in Supabase Cloud console
- [ ] Schedule daily cleanup: `SELECT cron.schedule('cleanup_social_dlq', '0 2 * * *', 'SELECT cleanup_social_dlq()')`
- [ ] Schedule hourly rollup: `SELECT cron.schedule('rollup_metrics', '0 * * * *', 'SELECT rollup_publishing_metrics_hourly()')`
- [ ] Verify cron jobs are active: `SELECT * FROM cron.job`

### Edge Functions Deployment
- [ ] `supabase functions deploy social-orchestrator-persistence`
- [ ] Verify function is accessible: Test via curl or Supabase dashboard
- [ ] Set environment variables (if needed): Confirm SUPABASE_URL, SERVICE_ROLE_KEY are injected
- [ ] Test all 8 operations: dlq:enqueue, dlq:list, dlq:retry, dlq:remove, metrics:record, metrics:get, audit:log, audit:get

### API Keys & Secrets
- [ ] Store in Supabase Vault (never in code):
  - LINKEDIN_ACCESS_TOKEN
  - SENDGRID_API_KEY
  - META_ACCESS_TOKEN
  - TIKTOK_ACCESS_TOKEN
  - X_API_KEY
  - WORDPRESS_API_TOKEN (for each site)
  - GHOST_ADMIN_API_KEY (for each site)
- [ ] Verify Edge Functions can read from Vault
- [ ] Test publisher initialization with real credentials (staging environment)

---

## Testing: Staging Environment (Week 2-3)

### End-to-End Publishing Flow
- [ ] Publish to LinkedIn (enterprise profile)
- [ ] Publish to X (alert)
- [ ] Publish to Instagram (reel)
- [ ] Publish to TikTok (fast)
- [ ] Publish to WordPress blog
- [ ] Publish to Ghost blog
- [ ] Send via Email (SendGrid)
- [ ] Verify all 9 channels work

### Failure Scenarios & Retry
- [ ] Simulate rate limit error → verify DLQ entry created
- [ ] Simulate auth error (bad token) → verify error logged, no infinite retries
- [ ] Simulate network timeout → verify exponential backoff kicks in
- [ ] Manual retry via DLQ → verify next_retry_at recalculated
- [ ] Max retry exceeded (5 retries) → verify auto-cleanup after 30 days

### Metrics & Monitoring
- [ ] Verify metrics recorded for every publish attempt
- [ ] Check hourly rollup aggregation (wait 1 hour)
- [ ] Query p95/p99 latencies (dashboard-ready)
- [ ] Verify audit log has complete trail for single publish operation
- [ ] Test dashboard queries on metrics_hourly table (< 100ms response)

### Load Testing (Optional)
- [ ] Publish 1,000 posts in bulk (simulating daily batch)
- [ ] Verify DLQ processes retries under load
- [ ] Monitor metrics table growth (storage, index efficiency)
- [ ] Profile slow queries: `SELECT * FROM pg_stat_statements ORDER BY mean_exec_time DESC`

---

## Pre-Launch: Admin & Operations (Week 3-4)

### Monitoring & Alerting
- [ ] Set up Sentry alerts for publishing errors
- [ ] Configure Supabase alerts: query slowdowns, storage quota, connection pool exhaustion
- [ ] Create dashboard: publishing success rate, error rate by channel, DLQ depth
- [ ] Escalation path defined: on-call engineer, runbook

### Runbooks & Documentation
- [ ] How to investigate a failed publish (audit log trace)
- [ ] How to manually retry a DLQ entry
- [ ] How to diagnose rate limiting (check metrics_hourly error_rate)
- [ ] How to restore from backup (Supabase PITR)
- [ ] Performance tuning: when to partition social_publishing_metrics table

### Team Training
- [ ] Engineering team walkthrough of persistence layer
- [ ] Support team trained on manual retry procedures
- [ ] Product team briefed on new social channel capabilities

---

## Launch Day: Deployment (2026-08-01)

### Pre-Launch Checks (T-24h)
- [ ] Verify all staging tests passed
- [ ] Review monitoring dashboards (baseline established)
- [ ] Check Edge Function logs for errors
- [ ] Confirm API keys are rotated and fresh
- [ ] Database backups are current (`supabase db download-backup`)

### Production Deployment (T-0)
- [ ] Merge PR #842 to main
- [ ] Trigger production deployment: `supabase db push` (production project)
- [ ] Trigger Edge Function deploy: `supabase functions deploy social-orchestrator-persistence` (production)
- [ ] Smoke test: Publish one post to each channel
- [ ] Verify metrics recorded in production
- [ ] Verify audit log shows complete trail

### Post-Launch (T+1h, T+4h, T+24h)
- [ ] Monitor error rates across all channels
- [ ] Check DLQ depth (should be near 0 for successful launches)
- [ ] Verify cron jobs executed (cleanup, rollup)
- [ ] Review metrics_hourly data: latency distribution, success rates
- [ ] Gradual traffic increase: batch publishes every hour, monitor

---

## Post-Launch: Operations (Week 5+)

### Weekly Tasks
- [ ] Review DLQ entries (why did they fail? patterns?)
- [ ] Analyze metrics: Are latencies acceptable? Error rates trending?
- [ ] Check storage growth: Is social_publishing_metrics table growing as expected?
- [ ] Verify cron jobs still running: `SELECT * FROM cron.job WHERE jobname LIKE 'cleanup%' OR jobname LIKE 'rollup%'`

### Monthly Tasks
- [ ] Archive old audit logs (> 2 years) to cold storage if quota constrained
- [ ] Analyze channel performance: Which channels have highest error rates?
- [ ] Plan optimization: Partition metrics table if > 100M rows/month
- [ ] Capacity planning: Disk space, connection pool, query performance

### Quarterly Tasks
- [ ] Review retention policies: Are 30-day DLQ retention and 2-year audit retention still appropriate?
- [ ] Cost analysis: Storage, Edge Function invocations, database operations
- [ ] Performance audit: Slow query log, index utilization

---

## Known Issues & Workarounds

### Vercel Deployment Failure
**Status**: Non-blocking. Frontend preview deployment has environment config issue.
**Workaround**: Monitor Cloudflare Pages instead (verified working).
**Resolution**: Review Vercel project settings (rootDirectory configuration).

### Exponential Backoff Max Reached
**Behavior**: After 5 retries (960s max), entries remain in DLQ indefinitely.
**Solution**: Manual intervention or auto-delete policy (currently: 30-day cleanup).
**Future Enhancement**: Webhook notification for max-retry entries.

---

## Success Criteria (Go-Live Definition)

✅ All 9 social channels publishing successfully  
✅ DLQ processing retries without data loss  
✅ Metrics collected and aggregated hourly  
✅ Audit logs complete for regulatory compliance  
✅ Error rates < 5% across all channels  
✅ P95 latency < 5 seconds (publisher-side)  
✅ Zero unhandled exceptions in Edge Functions  
✅ All scheduled cron jobs executing reliably  
✅ On-call rotation established and trained  
✅ Runbooks & escalation paths documented  

---

## Contingency Plans

### If Publishing Success Rate Falls Below 95%
1. Check Edge Function logs: `supabase functions get-logs social-orchestrator-persistence`
2. Verify API credentials in Vault haven't expired
3. Check channel-specific rate limits (platform status pages)
4. Rollback to previous commit if recent change introduced regression
5. Escalate: Page on-call engineer

### If DLQ Grows Unbounded (> 10,000 entries)
1. Investigate root cause: Check error_code frequency
2. Implement circuit breaker: Pause publishing to failing channel
3. Manual remediation: Identify batch of bad entries, delete or re-categorize
4. Post-mortem: What caused systematic failure? Fix root cause.

### If Metrics Table Grows Too Fast (> 1M rows/day)
1. Verify hourly rollup is running (check cron.job log)
2. Consider archiving raw metrics > 30 days
3. Implement data retention policy: Delete metrics_hourly > 2 years
4. Partition social_publishing_metrics by month for better query performance

---

## Timeline Summary

| Phase | Duration | Owner | Status |
|-------|----------|-------|--------|
| **Infrastructure Setup** | Week 1-2 | DevOps/Backend | 📋 Not started |
| **Staging Testing** | Week 2-3 | QA/Engineering | 📋 Not started |
| **Admin & Runbooks** | Week 3-4 | Product/Engineering | 📋 Not started |
| **Launch Day** | 2026-08-01 | Engineering/On-call | 📋 Scheduled |
| **Post-Launch Monitoring** | Week 5+ | On-call rotation | 📋 Ongoing |

**Current Date**: 2026-07-19  
**Days Until Launch**: 43  
**Status**: Phase 3 code complete, Phase 4 prep documentation ready, ready for merge

---

## Related Documentation

- [`PERSISTENCE.md`](./src/core/social-orchestrator/PERSISTENCE.md) — Full persistence layer implementation guide
- [`distributionQueue.ts`](./src/core/social-orchestrator/distributionQueue.ts) — In-memory infrastructure classes & real publishers
- [`postTemplates.ts`](./src/core/social-orchestrator/postTemplates.ts) — Channel-specific post templates & character budgets
- [`types.ts`](./src/core/social-orchestrator/types.ts) — Type definitions for social orchestrator module
- PR #842 — Phase 3 completion + Postgres persistence layer implementation
