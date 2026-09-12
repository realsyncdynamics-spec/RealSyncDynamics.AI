# Staging Test Guide
**Phase 4 Pre-Launch Testing**

Before deploying to production (2026-08-01), all tests in this guide must pass.

## Setup

### Prerequisites
- [ ] Phase 4 infrastructure deployed to staging Supabase project
- [ ] All 9 social channel API credentials configured in Supabase Vault (staging)
- [ ] Edge Function `social-orchestrator-persistence` deployed
- [ ] Database migrations applied
- [ ] Local development environment ready (`npm install`, `npm run dev`)

### Test Data
Create a test tenant and sample posts for repeatable testing:

```typescript
// Use staging Supabase credentials
const supabase = createClient(
  process.env.SUPABASE_URL_STAGING,
  process.env.SUPABASE_ANON_KEY_STAGING
);

// Create test tenant
const { data: tenant } = await supabase
  .from('tenants')
  .insert({ name: 'Phase 4 Test Tenant', created_at: new Date() })
  .select()
  .single();

// Create test social queue entries
const testPosts = [
  { channel: 'linkedin.enterprise', title: 'Test LinkedIn Post' },
  { channel: 'x.alert', title: 'Test X Alert' },
  { channel: 'instagram.reel', title: 'Test Instagram Reel' },
  // ... etc for all 9 channels
];
```

---

## Test Suite 1: Basic Publishing (All 9 Channels)

Each test: publish one post, verify success, check metrics.

### Test 1.1: LinkedIn Enterprise
```
Objective: Publish to LinkedIn company page
Expected: Post appears in feed, externalId recorded in queue_entry
Steps:
1. Create SocialPost with channel='linkedin.enterprise'
2. Call LinkedInPublisher.publish(post)
3. Verify response.ok === true
4. Check social_audit_log: event_type='publish_succeeded'
5. Check social_publishing_metrics: status='succeeded'
Pass Criteria: Post visible on LinkedIn company page, < 5s latency
```

### Test 1.2: LinkedIn Legal (DPO)
```
Objective: Publish as DPO using personal profile
Expected: Post appears in DPO's feed with proper framing
Steps:
1. Create SocialPost with channel='linkedin.legal'
2. Verify authorId is DPO user
3. Call LinkedInPublisher with profile='legal'
4. Verify response contains externalId
Pass Criteria: Post visible, uses DPO signature if applicable
```

### Test 1.3: X (Twitter)
```
Objective: Post alert to X
Expected: Tweet appears in feed, under 280 characters
Steps:
1. Create SocialPost with channel='x.alert'
2. Verify body.length <= 280
3. Call XPublisher.publish(post)
4. Verify response.ok === true
5. Verify tweet_id in externalId
Pass Criteria: Tweet live on timeline < 3 seconds
```

### Test 1.4: Instagram Reel
```
Objective: Post reel caption to Instagram
Expected: Caption appears on reel, hook-led framing
Steps:
1. Create SocialPost with channel='instagram.reel'
2. Verify body uses short hook format
3. Call MetaPublisher.publish(post)
4. Verify Instagram Post ID in response
Pass Criteria: Caption live < 5 seconds
```

### Test 1.5: TikTok
```
Objective: Post short-form to TikTok
Expected: Caption and hook visible
Steps:
1. Create SocialPost with channel='tiktok.fast'
2. Verify body.length <= 280 (TikTok caption limit)
3. Call TikTokPublisher.publish(post)
4. Verify tiktok_video_id in response
Pass Criteria: Post live < 5 seconds
```

### Test 1.6: WordPress Blog
```
Objective: Publish full blog post to WordPress
Expected: Post appears in WordPress blog with title, body, tags
Steps:
1. Create SocialPost with channel='wordpress.blog'
2. Extract title from first line of body
3. Call WordPressPublisher.publish(post)
4. Verify response.ok === true
5. Query WordPress /wp-json/wp/v2/posts to verify post exists
Pass Criteria: Post visible on WordPress blog, tags applied
```

### Test 1.7: Ghost Blog
```
Objective: Publish to Ghost CMS
Expected: Post in draft or published state, markdown-to-HTML conversion works
Steps:
1. Create SocialPost with channel='ghost.blog'
2. Call GhostPublisher.publish(post)
3. Verify response.ok === true
4. Query Ghost Admin API: GET /ghost/api/admin/posts/{id}
5. Verify body was converted to HTML
Pass Criteria: Post in Ghost with correct formatting
```

### Test 1.8: Email Newsletter
```
Objective: Send email to subscriber list
Expected: Email arrives in test inboxes, tracking enabled
Steps:
1. Create SocialPost with channel='email.newsletter'
2. Configure test recipients: [test1@staging.local, test2@staging.local]
3. Call EmailPublisher.publish(post)
4. Verify response.ok === true
5. Check inboxes: emails received within 10 seconds
Pass Criteria: Emails in all inboxes with tracking pixels
```

### Test 1.9: Webhook Custom
```
Objective: Invoke custom webhook (n8n/Zapier integration)
Expected: Webhook receives payload, n8n workflow triggered
Steps:
1. Create SocialPost with channel='webhook.custom'
2. Configure webhook URL to n8n test endpoint
3. Call WebhookPublisher.publish(post)
4. Verify response.ok === true
5. Check n8n execution logs: webhook received
Pass Criteria: Webhook payload correctly formatted, n8n workflow triggered
```

---

## Test Suite 2: Failure Scenarios & Retry Logic

### Test 2.1: Rate Limit Error (LinkedIn)
```
Objective: Verify DLQ creation and exponential backoff
Steps:
1. Publish 100 posts to LinkedIn rapidly
2. LinkedIn returns rate_limit_exceeded error
3. Verify DLQ entry created with error_code='RATE_LIMIT'
4. Verify next_retry_at = NOW() + 60 seconds
5. Wait 60s, retry manually: dlq.retry(dlqId)
6. Verify retry_count incremented to 1, next_retry_at = NOW() + 120s
7. Repeat to verify backoff: 60s, 120s, 240s, 480s, 960s (cap)
Pass Criteria: Exponential backoff works, max 960s between retries
```

### Test 2.2: Authentication Error (Bad Token)
```
Objective: Verify auth errors don't trigger retry (4xx error)
Steps:
1. Configure wrong API key for X
2. Publish post to X
3. Verify error: UNAUTHORIZED or FORBIDDEN
4. Verify DLQ entry created with error_code='UNAUTHORIZED'
5. Verify next_retry_at is set (will eventually timeout)
6. Manual review of error: should alert ops to rotate token
Pass Criteria: No infinite retry loop, error flagged for manual review
```

### Test 2.3: Network Timeout
```
Objective: Verify timeout errors trigger retry with backoff
Steps:
1. Simulate network timeout (firewall rule or mock)
2. Publish to affected channel
3. Verify error: NETWORK_TIMEOUT
4. Verify DLQ entry created
5. Verify next_retry_at = NOW() + 60s
6. Restore network, wait for retry
7. Verify post eventually succeeds
Pass Criteria: Transient errors recover via retry, permanent errors tracked
```

### Test 2.4: Partial Failure (Multi-Channel Batch)
```
Objective: Verify batch with some successes, some failures
Steps:
1. Create batch of 5 posts across 5 different channels
2. Simulate failure on channels 2 and 4
3. Verify channels 1, 3, 5 publish successfully
4. Verify channels 2, 4 have DLQ entries
5. Retry failed entries
6. Verify all eventually succeed
Pass Criteria: Batch publishes don't block each other, partial failures isolated
```

---

## Test Suite 3: Metrics & Observability

### Test 3.1: Metrics Recording
```
Objective: Verify metrics captured for every publish
Steps:
1. Publish 10 posts across different channels
2. Verify 10 entries in social_publishing_metrics with status='succeeded'
3. Verify latency_ms is populated (not null)
4. Check timestamp ordering: created_at matches publish time (±1s)
Pass Criteria: All metrics recorded, no gaps
```

### Test 3.2: Hourly Rollup Aggregation
```
Objective: Verify hourly metrics aggregation
Steps:
1. Publish 50 posts over 10 minutes
2. Wait 60 minutes for cron to run
3. Query social_publishing_metrics_hourly for current hour
4. Verify total_attempts = 50
5. Verify succeeded + failed = 50
6. Verify avg_latency_ms is reasonable (50-5000ms)
Pass Criteria: Hourly rollup creates one row per channel per hour
```

### Test 3.3: Error Rate Calculation
```
Objective: Verify error rate metrics are accurate
Steps:
1. Create 100 publishes: 90 succeed, 10 fail
2. Wait for hourly rollup
3. Query social_publishing_metrics_hourly
4. Verify error_rate = 10.00 (%)
5. Verify succeeded = 90, failed = 10
Pass Criteria: Error rate calculation correct to 2 decimals
```

### Test 3.4: Audit Trail Completeness
```
Objective: Verify audit log has full trail for single publish
Steps:
1. Publish one post, record queueId
2. Query social_audit_log WHERE queue_id = queueId
3. Verify sequence of events:
   - publish_attempted (status='pending')
   - publish_succeeded (status='published', externalId populated)
4. Verify metadata captured (channel, error_code if failed)
5. Verify created_at timestamps are sequential
Pass Criteria: Audit trail enables complete reconstruction of publish lifecycle
```

---

## Test Suite 4: Load Testing (Optional)

### Test 4.1: Bulk Publish Performance
```
Objective: Verify system handles daily batch volume
Steps:
1. Generate 1,000 SocialPosts across all 9 channels
2. Publish all in rapid succession (< 5 minutes)
3. Verify response time per publish < 5 seconds
4. Monitor database: CPU, connections, storage growth
5. Query slow logs: Verify no queries take > 1 second
Pass Criteria: 1,000 publishes processed, p95 latency < 5 seconds
```

### Test 4.2: DLQ Under Load
```
Objective: Verify DLQ performs well with many retry candidates
Steps:
1. Simulate 500 failures
2. DLQ now has 500 entries
3. Query dlq.list(): Should be < 100ms
4. Batch retry 100 entries: Should be < 1 second total
5. Verify index on next_retry_at is used
Pass Criteria: DLQ queries remain fast even with large queues
```

### Test 4.3: Metrics Storage Growth
```
Objective: Verify metrics table doesn't grow too fast
Steps:
1. Publish 1,000 posts
2. Verify social_publishing_metrics has 1,000 rows
3. Calculate storage: 1,000 rows × ~200 bytes = ~200KB
4. Estimate growth: 1,000 posts/day × 30 days = 30K rows/month
5. Verify storage won't exceed quota in 6 months
Pass Criteria: Storage projection acceptable for budget
```

---

## Test Suite 5: Integration Scenarios

### Test 5.1: End-to-End Compliance Flow
```
Objective: Verify audit trail supports compliance requirements
Steps:
1. Publish a post (request for evidence)
2. Query audit trail via social_audit_log
3. Extract: event timestamps, channel, external IDs, error codes
4. Verify data can be exported to CSV for auditor review
5. Verify cannot be modified (append-only behavior)
Pass Criteria: Complete audit trail suitable for regulatory review
```

### Test 5.2: Channel-Specific Configuration
```
Objective: Verify each channel uses correct credentials from Vault
Steps:
1. Publish to each channel
2. Verify correct API endpoint was called (intercept requests)
3. Verify auth header matches channel credential
4. Try with wrong credential: Should fail quickly with clear error
Pass Criteria: Each channel uses correct and only correct credential
```

### Test 5.3: Graceful Degradation
```
Objective: Verify one channel failure doesn't block others
Steps:
1. Disable LinkedIn API temporarily
2. Publish batch: LinkedIn, X, Instagram
3. Verify LinkedIn fails (DLQ entry created)
4. Verify X and Instagram succeed
5. Re-enable LinkedIn, retry
6. Verify LinkedIn now succeeds
Pass Criteria: Independent channel failure handling
```

---

## Sign-Off Checklist

- [ ] All 9 channels tested individually (Test Suite 1)
- [ ] Failure scenarios verified (Test Suite 2)
- [ ] Metrics recording validated (Test Suite 3)
- [ ] Load testing completed (Test Suite 4, optional but recommended)
- [ ] Integration scenarios passed (Test Suite 5)
- [ ] Edge Function logs show no errors
- [ ] No database errors or constraint violations
- [ ] Monitoring dashboard data looks reasonable
- [ ] Team walked through test results
- [ ] **Sign-off**: Testing approved by [Name], [Date]

---

## Rollback Procedure

If tests fail and production hasn't been launched yet:

1. Identify failure category (channel-specific, infrastructure, config)
2. Fix in feature branch
3. Re-test in staging
4. Do NOT merge to main until tests pass
5. Document issue and resolution in runbook

If tests pass but production launch encounters issues:

1. Within 30 minutes of launch: Pause new publishes
2. Isolate failing channel or operation
3. Investigate via audit logs and metrics
4. Fix (credential rotation, API endpoint change, etc.)
5. Gradually resume publishes, monitor metrics
6. Post-mortem: Update runbooks with lessons learned
