# Phase 5: Post-Launch Operations Guide

**Effective**: 2026-08-02 (Day after go-live)  
**Owner**: Engineering + DevOps + On-Call Team  
**Duration**: Ongoing (first 90 days critical, then steady-state)

---

## Overview

After production launch on 2026-08-01, the social-orchestrator persistence layer requires active monitoring, maintenance, and optimization. This guide covers operational tasks for the first 90 days and beyond.

---

## Phase 5a: First 24 Hours Post-Launch (Day 1)

### Continuous Monitoring (T+0 to T+24h)

**Every 5 minutes**:
```sql
SELECT
  (SELECT COUNT(*) FROM social_dlq_entries) as dlq_depth,
  (SELECT COUNT(*) FROM social_publishing_metrics WHERE status = 'failed' AND created_at > NOW() - INTERVAL '5 minutes') as failed_5min,
  (SELECT COUNT(*) FROM social_publishing_metrics WHERE status = 'succeeded' AND created_at > NOW() - INTERVAL '5 minutes') as succeeded_5min,
  NOW() as timestamp;
```

**Dashboard checks**:
- DLQ depth (target: 0-10)
- Error rate (target: < 5%)
- P95 latency (target: < 5s)
- All channels green

**Alert response**:
- Any P1 alert → Follow ON_CALL_RUNBOOK.md Section 2
- Escalate immediately if metrics diverge from expected

### Hourly Checkpoints (T+1h, T+2h, ..., T+24h)

1. **Error Rate Trend**
```sql
SELECT
  DATE_TRUNC('hour', created_at) as hour,
  COUNT(*) as total,
  COUNT(CASE WHEN status = 'failed' THEN 1 END) as failed,
  ROUND(100.0 * COUNT(CASE WHEN status = 'failed' THEN 1 END) / COUNT(*), 2) as error_rate_percent
FROM social_publishing_metrics
WHERE created_at > NOW() - INTERVAL '24 hours'
GROUP BY DATE_TRUNC('hour', created_at)
ORDER BY hour DESC;
```

2. **Channel Health**
```sql
SELECT
  channel,
  COUNT(*) as publishes,
  COUNT(CASE WHEN status = 'failed' THEN 1 END) as failed,
  ROUND(AVG(latency_ms), 0) as avg_latency_ms,
  ROUND(PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY latency_ms), 0) as p95_latency_ms
FROM social_publishing_metrics
WHERE created_at > NOW() - INTERVAL '1 hour'
GROUP BY channel
ORDER BY channel;
```

3. **DLQ Status by Error Type**
```sql
SELECT
  error_code,
  COUNT(*) as count,
  MAX(retry_count) as max_retries,
  COUNT(CASE WHEN next_retry_at IS NULL THEN 1 END) as stuck_entries
FROM social_dlq_entries
WHERE created_at > NOW() - INTERVAL '1 hour'
GROUP BY error_code
ORDER BY count DESC;
```

### Daily Report (24h mark)

Document in Slack #incident-response:

```
📊 LAUNCH DAY SUMMARY (T+24h)

System Health: ✅ GREEN / ⚠️ YELLOW / 🔴 RED

Metrics:
  - Total publishes: [X]
  - Success rate: [Y]%
  - Error rate: [Z]%
  - P95 latency: [A]ms
  - DLQ depth (peak): [B]
  - DLQ depth (final): [C]

Channel Status:
  - LinkedIn: ✅ / ⚠️ / 🔴
  - X: ✅ / ⚠️ / 🔴
  - Instagram: ✅ / ⚠️ / 🔴
  - TikTok: ✅ / ⚠️ / 🔴
  - Email: ✅ / ⚠️ / 🔴
  - WordPress: ✅ / ⚠️ / 🔴
  - Ghost: ✅ / ⚠️ / 🔴
  - Webhook: ✅ / ⚠️ / 🔴

Issues: [List any resolved incidents]
Actions Taken: [Describe any interventions]
Next Steps: [Monitoring plan for next 24h]
```

---

## Phase 5b: First Week (Days 2-7)

### Daily Tasks (5 min each)

1. **System Health Check**
   - DLQ depth < 50? ✅
   - Error rate < 5%? ✅
   - No P1 alerts? ✅
   - All channels green? ✅

2. **Sentry Review**
   - New error types? Note for investigation
   - Error rate trend? ✅ Stable / ⚠️ Growing
   - Unhandled exceptions? Investigate

3. **On-Call Handoff**
   - Summarize overnight issues
   - Alert thresholds appropriate?
   - Any credential rotations needed?

### Weekly Meeting (End of Week 1)

**Attendees**: On-Call Lead, Engineering Lead, DevOps Lead, Product Lead

**Agenda** (30 min):

1. **Deployment Success** (5 min)
   - Launch execution review
   - Any critical issues? How resolved?
   - Team performance feedback

2. **System Stability** (10 min)
   - Error rates by channel
   - Latency trends
   - DLQ patterns (any systematic issues?)
   - Infrastructure load (DB, Edge Functions)

3. **Operational Learnings** (10 min)
   - Alerts: Too noisy? Missing critical alerts?
   - Runbooks: Any procedures that need updating?
   - Team feedback: What worked? What needs improvement?

4. **First Optimizations** (5 min)
   - Adjust alert thresholds based on observed behavior
   - Plan any immediate fixes (if needed)

**Output**: Updated runbooks, adjusted thresholds, next week priorities

---

## Phase 5c: First Month (Days 8-31)

### Weekly Tasks

**Monday (Weekly Standup)**:
- [ ] Review error logs from past week
- [ ] Check DLQ patterns (any new error types?)
- [ ] Review Sentry trends
- [ ] Update on-call handoff notes

**Wednesday (Mid-week Check)**:
- [ ] Verify cron jobs executed (cleanup, rollup)
- [ ] Check database size growth
- [ ] Review slow query logs
- [ ] Monitor connection pool usage

**Friday (Weekly Report)**:
- [ ] Compile performance metrics
- [ ] Document any incidents + resolutions
- [ ] Update runbooks with lessons learned
- [ ] Plan next week priorities

### Performance Analysis (Weekly)

**Latency Breakdown**:
```sql
SELECT
  channel,
  ROUND(MIN(latency_ms), 0) as min_ms,
  ROUND(PERCENTILE_CONT(0.25) WITHIN GROUP (ORDER BY latency_ms), 0) as p25_ms,
  ROUND(PERCENTILE_CONT(0.50) WITHIN GROUP (ORDER BY latency_ms), 0) as p50_ms,
  ROUND(PERCENTILE_CONT(0.75) WITHIN GROUP (ORDER BY latency_ms), 0) as p75_ms,
  ROUND(PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY latency_ms), 0) as p95_ms,
  ROUND(PERCENTILE_CONT(0.99) WITHIN GROUP (ORDER BY latency_ms), 0) as p99_ms,
  ROUND(MAX(latency_ms), 0) as max_ms
FROM social_publishing_metrics
WHERE created_at > NOW() - INTERVAL '7 days'
GROUP BY channel
ORDER BY p95_ms DESC;
```

**Error Trend**:
```sql
SELECT
  DATE_TRUNC('day', created_at) as day,
  channel,
  COUNT(*) as total,
  COUNT(CASE WHEN status = 'failed' THEN 1 END) as failed,
  ROUND(100.0 * COUNT(CASE WHEN status = 'failed' THEN 1 END) / COUNT(*), 2) as error_rate_percent
FROM social_publishing_metrics
WHERE created_at > NOW() - INTERVAL '7 days'
GROUP BY DATE_TRUNC('day', created_at), channel
ORDER BY day DESC, error_rate_percent DESC;
```

### Monthly Review Meeting (End of Month)

**Attendees**: Same as weekly + Product Lead

**Agenda** (60 min):

1. **Launch Retrospective** (15 min)
   - Deployment execution review
   - Incident postmortems (if any)
   - Team learnings documented?

2. **System Performance** (15 min)
   - Overall error rate: [X]%
   - Average latency: [Y]ms
   - DLQ trend: Growing / Stable / Declining
   - Any channels underperforming?

3. **Operational Health** (15 min)
   - Alert fatigue? Adjust thresholds
   - Runbook effectiveness? Update procedures
   - Team capacity: Sustainable on-call rotation?
   - Training needs identified?

4. **Optimization Plan** (15 min)
   - Quick wins (< 1 day): 
   - Medium effort (1-3 days):
   - Large effort (> 3 days):

5. **Next Month Priorities** (5 min)
   - Optimization focus
   - Capacity improvements
   - New monitoring/alerting

---

## Phase 5d: Months 2-3 (Days 32-90)

### Bi-Weekly Tasks

**Odd Weeks**:
- [ ] Performance deep-dive
- [ ] Database maintenance check
- [ ] Slow query analysis
- [ ] Credential rotation schedule

**Even Weeks**:
- [ ] Error pattern analysis
- [ ] Channel-specific optimization
- [ ] Capacity planning update
- [ ] On-call feedback session

### Key Milestones

**Day 30**: First major retrospective
- Are we on track?
- Any systemic issues to fix?
- Runbooks effective?

**Day 60**: Mid-cycle review
- Performance trending positively?
- Team confidence in operations?
- Ready for optimization phase?

**Day 90**: End of Phase 5
- System stable and predictable?
- Team fully trained?
- Optimization backlog ready?
- Transition to steady-state operations?

---

## Maintenance Tasks (Ongoing)

### Daily (Automated via Cron)

```
02:00 UTC: cleanup_social_dlq()
  - Delete entries > 30 days old
  - Delete entries with retry_count > 5
  - Log cleanup stats

00 * * * *: rollup_publishing_metrics_hourly()
  - Aggregate raw metrics to hourly
  - Calculate error rates, latencies
  - Log rollup stats
```

**Verification Query**:
```sql
SELECT 
  jobname, 
  last_run_status, 
  last_run_time 
FROM cron.job 
WHERE jobname LIKE 'cleanup%' OR jobname LIKE 'rollup%';
```

### Weekly (Manual)

1. **Database Maintenance**
   ```sql
   -- Analyze tables for query planner optimization
   ANALYZE social_dlq_entries;
   ANALYZE social_publishing_metrics;
   ANALYZE social_audit_log;
   
   -- Reindex if needed (check pg_stat_user_indexes)
   REINDEX INDEX CONCURRENTLY idx_social_dlq_channel;
   ```

2. **Audit Log Archive** (if quota constrained)
   ```sql
   -- Archive old audit logs (> 2 years)
   SELECT COUNT(*) FROM social_audit_log 
   WHERE created_at < NOW() - INTERVAL '2 years';
   
   -- Export to cold storage, then delete locally
   ```

3. **Credential Rotation Schedule**
   - LinkedIn: Monthly
   - X: Monthly
   - Meta: Monthly
   - TikTok: Every 90 days
   - SendGrid: Every 90 days
   - WordPress: Every 6 months
   - Ghost: Every 6 months

### Monthly (Manual)

1. **Performance Audit**
   ```sql
   -- Top 10 slowest queries
   SELECT 
     query, 
     calls, 
     mean_exec_time, 
     max_exec_time 
   FROM pg_stat_statements 
   ORDER BY mean_exec_time DESC 
   LIMIT 10;
   
   -- Missing indexes?
   SELECT schemaname, tablename, indexname 
   FROM pg_indexes 
   WHERE schemaname = 'public' AND tablename LIKE 'social_%';
   ```

2. **Storage Analysis**
   ```sql
   -- Table and index sizes
   SELECT
     schemaname,
     tablename,
     ROUND(pg_total_relation_size(schemaname||'.'||tablename)/1024/1024.0, 2) as size_mb,
     ROUND(pg_table_size(schemaname||'.'||tablename)/1024/1024.0, 2) as table_mb,
     ROUND(pg_indexes_size(schemaname||'.'||tablename)/1024/1024.0, 2) as indexes_mb
   FROM pg_stat_user_tables
   WHERE schemaname = 'public' AND tablename LIKE 'social_%'
   ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;
   ```

3. **Capacity Planning**
   - Current storage: [X] MB
   - Growth rate: [Y] MB/day
   - Projected 6-month: [Z] MB
   - Budget: [N] GB
   - **Action**: Plan partitioning if > 80% utilized

### Quarterly (Strategic)

1. **Performance Optimization**
   - Identify slow channels
   - Implement query optimizations
   - Add indexes if beneficial
   - Archive historical metrics if needed

2. **Capacity Planning**
   - Upgrade database if needed
   - Scale Edge Functions if threshold exceeded
   - Plan for growth

3. **Security Audit**
   - Verify RLS policies still effective
   - Check for unauthorized access attempts
   - Rotate all credentials (fresh tokens)
   - Review access logs

4. **Disaster Recovery Drill**
   - Test backup restoration
   - Verify point-in-time recovery
   - Document recovery time

---

## Escalation Path (Post-Launch)

### P1 (15 min response)
- On-Call Engineer investigates
- Error rate > 10% OR DLQ > 500 OR all channels failing
- Page Engineering Lead if unresolved after 10 min

### P2 (30 min response)
- On-Call Engineer investigates
- Error rate 5-10% OR DLQ 100-500 OR multiple channels failing
- Escalate to Engineering Lead if unresolved after 20 min

### P3 (1 hour response)
- Triage and document
- Error rate 1-5% OR single channel issue
- Escalate only if pattern emerging

### P4 (Next business day)
- Log in issue tracker
- Address during normal work
- No escalation

---

## Team Handoff: Operational Support

After Phase 5a (first 24h), support transitions to:

**On-Call** (24/7 for P1/P2):
- Incident response
- Emergency fixes
- Credential rotation
- Escalation decisions

**DevOps** (Business hours):
- Infrastructure optimization
- Database maintenance
- Performance tuning
- Capacity planning

**Engineering** (Business hours):
- Root cause analysis
- Feature improvements
- Optimization work
- Runbook updates

---

## Optimization Roadmap (Post-Month 1)

### Quick Wins (< 1 day)
- [ ] Adjust alert thresholds based on observed behavior
- [ ] Optimize slow queries (add indexes)
- [ ] Cache frequently-accessed metadata
- [ ] Batch retry operations

### Medium-Term (1-3 weeks)
- [ ] Implement adaptive backoff (rate-limit vs auth vs network)
- [ ] Add webhook alerts for DLQ entries
- [ ] Cross-channel retry coordination (failover)
- [ ] Export metrics to Datadog/Grafana

### Long-Term (1-3 months)
- [ ] Manual retry dashboard in admin UI
- [ ] Partition metrics table (when > 100M rows/month)
- [ ] Predictive alerting (ML-based anomaly detection)
- [ ] Multi-region redundancy (if scaling)

---

## Success Indicators (First 90 Days)

✅ **Technical**:
- Error rate consistently < 5%
- P95 latency consistently < 5s
- DLQ depth stays < 50 (except during platform outages)
- No unhandled exceptions
- All cron jobs executing reliably

✅ **Operational**:
- On-call team confident with procedures
- Runbooks prove accurate and complete
- Incident response < 15min for P1
- Team capacity sustainable
- Zero missed escalations

✅ **Business**:
- All 9 channels publishing reliably
- Customer complaints minimal
- No data loss
- Cost projections on track
- Ready for scaling

---

## Checklist: First 90 Days

### Week 1 ✅
- [ ] Launch day monitoring complete
- [ ] Daily health checks passing
- [ ] Weekly meeting scheduled
- [ ] Runbooks updated with learnings

### Weeks 2-4 ✅
- [ ] No P1 incidents unresolved > 15min
- [ ] Error rate stable < 5%
- [ ] Team rotation established
- [ ] Monthly retrospective completed

### Weeks 5-12 ✅
- [ ] Performance optimizations completed
- [ ] Capacity planning done
- [ ] Alert thresholds tuned
- [ ] Team fully independent
- [ ] Ready for steady-state operations

---

## Transition to Steady-State (Day 91+)

After 90 days, assuming success indicators met:

1. **Move to Monthly Cycles**
   - Shift from weekly to monthly reviews
   - Reduce active monitoring (automated alerts handle most)
   - Focus on optimization rather than stabilization

2. **Plan Next Phase**
   - Feature enhancements
   - Platform scaling
   - New channel integrations
   - Advanced analytics

3. **Document Lessons Learned**
   - What worked well?
   - What needs improvement?
   - Training materials for new team members
   - Runbook refinement

---

**End of Phase 5 Operations Guide**

**Next Phase**: Phase 6 (Optimization & Scaling) begins Day 91

