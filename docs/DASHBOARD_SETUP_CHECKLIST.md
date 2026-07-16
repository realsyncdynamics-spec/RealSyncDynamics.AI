# Real-Time Health Dashboard — Setup Checklist

**Target Deployment:** End of Week 1 (Friday, July 18, 2026)  
**Platform:** Grafana (Recommended) or Google Sheets (Quick Start)  
**Owner:** DevOps/SRE Lead  
**Audience:** Engineering team (daily standup access)

---

## Prerequisites

- [ ] Grafana Cloud account (or self-hosted Grafana instance)
- [ ] Sentry API token (view:events, view:organization)
- [ ] Cloudflare API token (analytics read permission)
- [ ] Supabase project API access
- [ ] GitHub organization access (for incident tracking)
- [ ] Team member with dashboard edit permissions

---

## Step 1: API Credentials Setup (Monday-Tuesday)

### Sentry API Configuration
- [ ] Login to Sentry dashboard (https://sentry.io)
- [ ] Navigate: Settings → Auth Tokens
- [ ] Create new token with scopes:
  - [ ] `event:read`
  - [ ] `org:read`
  - [ ] `project:read`
- [ ] Copy token to secure location (1Password/vault)
- [ ] Label: "RealSyncDynamics Dashboard Integration"
- [ ] Note expiration date (6 months recommended)

**Verify:** `curl -H "Authorization: Bearer YOUR_TOKEN" https://sentry.io/api/0/organizations/realsyncdynamics/events/`

### Cloudflare API Configuration
- [ ] Login to Cloudflare dashboard (https://dash.cloudflare.com)
- [ ] Navigate: Account Settings → API Tokens
- [ ] Create custom token with permissions:
  - [ ] `Analytics` → `Read` on all zones
  - [ ] `Account` → `Read`
- [ ] Copy token and verify restrictions:
  - [ ] Zone: Include specific zone (your domain)
  - [ ] TTL: 90 days
- [ ] Label: "RealSyncDynamics Dashboard"

**Verify:** `curl -X GET "https://api.cloudflare.com/client/v4/accounts" -H "Authorization: Bearer YOUR_TOKEN"`

### Supabase Monitoring Configuration
- [ ] Login to Supabase dashboard (https://app.supabase.com)
- [ ] Navigate: Project Settings → API
- [ ] Copy `anon` key (public, safe for dashboard)
- [ ] Copy project URL: `https://YOUR_PROJECT.supabase.co`
- [ ] Enable monitoring: Settings → Monitoring (if available)

**Verify:** `curl -X GET "https://YOUR_PROJECT.supabase.co/rest/v1/" -H "apikey: YOUR_ANON_KEY"`

### GitHub Organization Setup (Optional - for incident tracking)
- [ ] Create GitHub personal access token
- [ ] Scopes: `repo:read`, `read:org`
- [ ] Label: "Incident Dashboard Integration"

---

## Step 2: Data Source Configuration in Grafana (Wednesday)

### Add Sentry Data Source
- [ ] Grafana → Configuration → Data Sources → Add new
- [ ] Select: **Sentry**
- [ ] Configure:
  - Name: `Sentry Production`
  - URL: `https://sentry.io/api/0/`
  - Organization Slug: `realsyncdynamics`
  - Project: `production` (or your project name)
  - API Token: [paste from Step 1]
  - [ ] Save & Test (should return green)

### Add Cloudflare Data Source
- [ ] Grafana → Configuration → Data Sources → Add new
- [ ] Select: **Cloudflare** (if plugin available) or use JSON API
- [ ] Configure:
  - Name: `Cloudflare Analytics`
  - API Token: [paste from Step 1]
  - Zone ID: [your domain zone ID]
  - [ ] Save & Test

### Add Supabase Data Source (if using GraphQL endpoint)
- [ ] Grafana → Configuration → Data Sources → Add new
- [ ] Select: **GraphQL** or **Postgres** (if direct connection)
- [ ] Configure for monitoring queries
- [ ] [ ] Save & Test

---

## Step 3: Dashboard Panels — Uptime & Availability (Wednesday-Thursday)

### Panel 1: Current Uptime Percentage
```
Metric: Sentry uptime (vs. 99.9% SLO)
Query: Sentry `stats` endpoint for uptime
Display: Large stat showing percentage (green if >99.9%, yellow if 99-99.9%, red if <99%)
Refresh: Every 1 minute
```

- [ ] Create new dashboard: "Production Health"
- [ ] Add new panel → Stat
- [ ] Data source: Sentry Production
- [ ] Query: `uptime` metric
- [ ] Threshold: 99.9% (green), 99% (yellow), 0% (red)
- [ ] Title: "System Uptime (vs. 99.9% SLO)"

### Panel 2: Downtime Incidents (Last 24h)
```
Metric: Count of downtime events
Query: Sentry events with tag "incident:true"
Display: Table with timestamp, duration, severity
Refresh: Every 5 minutes
```

- [ ] Add new panel → Table
- [ ] Query: Filter events where `tags.incident = true` AND timestamp > now-24h
- [ ] Columns: timestamp, duration_minutes, severity
- [ ] Title: "Downtime Incidents (Last 24h)"

### Panel 3: Critical Alerts Active
```
Metric: Count of active critical alerts
Query: Sentry alert rules with severity='critical' and status='active'
Display: Large number
Refresh: Real-time
Alert: Trigger if > 0
```

- [ ] Add new panel → Stat
- [ ] Query: Count of active critical alerts
- [ ] Thresholds: 0 (green), 1+ (red)
- [ ] Title: "Active Critical Alerts"

### Panel 4: System Status Indicator
```
Display: GREEN / YELLOW / RED status
Logic:
- GREEN: uptime >= 99.9% AND error_rate < 1% AND p95_latency < 500ms
- YELLOW: uptime >= 99% OR error_rate >= 1% OR p95_latency >= 500ms
- RED: uptime < 99% OR error_rate > 2% OR p95_latency > 1000ms
```

- [ ] Add new panel → Gauge or large stat
- [ ] Calculate composite health score
- [ ] Color zones: 90+ (green), 70-89 (yellow), <70 (red)
- [ ] Title: "Overall System Health"

---

## Step 4: Dashboard Panels — Error Rate & Performance (Thursday)

### Panel 5: Current Error Rate
```
Metric: Percentage of requests resulting in errors
Query: Sentry error count / total events
Display: Large stat with sparkline (24h trend)
Refresh: Every 5 minutes
Alert: >0.5% (yellow), >1% (red)
```

- [ ] Add new panel → Stat with sparkline
- [ ] Query: `(error_events / total_events) * 100`
- [ ] Thresholds: 1% (red), 0.5% (yellow)
- [ ] Title: "Error Rate (Target: <1%)"

### Panel 6: Top 5 Error Types
```
Metric: Most common error types this day
Query: Sentry error groups sorted by frequency
Display: Bar chart or table
```

- [ ] Add new panel → Bar chart or table
- [ ] Query: Group errors by `error_type`, count, sort descending
- [ ] Limit: Top 5
- [ ] Title: "Top 5 Error Types"

### Panel 7: Error Rate Trend (24h)
```
Metric: Error rate over time (last 24 hours)
Query: Sentry histogram of error rate
Display: Time series line graph
Refresh: Every 5 minutes
```

- [ ] Add new panel → Time series
- [ ] Query: `error_rate` time series, last 24h, 10-minute buckets
- [ ] Overlay target line at 1%
- [ ] Title: "Error Rate Trend (24h)"

### Panel 8: API Latency - Percentiles
```
Metrics:
- p50 latency (target <200ms)
- p95 latency (target <500ms)
- p99 latency (target <1000ms)
Query: Sentry performance metrics
Display: Three stat cards side-by-side
Refresh: Every 5 minutes
Alert: p95 >400ms (yellow), >600ms (red)
```

- [ ] Add 3 new panels (Stat type)
- [ ] Query Sentry performance module:
  - [ ] `response_time_p50` → Panel 1
  - [ ] `response_time_p95` → Panel 2
  - [ ] `response_time_p99` → Panel 3
- [ ] Thresholds for each:
  - p50: 300 (yellow), 500 (red)
  - p95: 500 (yellow), 600 (red)
  - p99: 1000 (yellow), 1500 (red)

### Panel 9: API Latency Trend (24h)
```
Metric: Latency percentiles over time
Query: Time series of p50, p95, p99
Display: Multi-line graph with color coding
```

- [ ] Add new panel → Time series (multi-line)
- [ ] Query: `response_time_p50`, `response_time_p95`, `response_time_p99`
- [ ] Colors: green (p50), yellow (p95), red (p99)
- [ ] Title: "API Latency Trend (24h)"

---

## Step 5: Dashboard Panels — Incidents & Database (Thursday)

### Panel 10: Current Incidents
```
Metric: Active incident count and severity breakdown
Query: GitHub issues with label 'incident'
Display: Stat + breakdown table
Refresh: Real-time
Alert: Any P1 incident
```

- [ ] Add new panel → Stat
- [ ] Query: Count of open issues with `label:incident`
- [ ] Title: "Active Incidents"

### Panel 11: Incident Severity Breakdown
```
Metric: P1/P2/P3/P4 incident distribution
Query: GitHub issues grouped by priority label
Display: Pie chart or table
```

- [ ] Add new panel → Pie chart
- [ ] Query: Count issues by severity label (P1, P2, P3, P4)
- [ ] Title: "Incident Severity Breakdown"

### Panel 12: Database Health
```
Metrics:
- Connection pool usage (%)
- Query performance (p95 latency)
- Storage usage (GB)
Query: Supabase monitoring API
Display: Three stat panels
Refresh: Every 1 minute
Alert: Connections >80%, storage >80%
```

- [ ] Add 3 new panels → Stat type
- [ ] Configure Supabase monitoring queries:
  - [ ] `db_connections_used / db_connections_max * 100`
  - [ ] `query_latency_p95_ms`
  - [ ] `storage_used_gb / storage_quota_gb * 100`
- [ ] Thresholds:
  - Connections: 80 (yellow), 95 (red)
  - Latency: 500 (yellow), 1000 (red)
  - Storage: 80 (yellow), 95 (red)

---

## Step 6: Alerting Rules Configuration (Friday)

### Critical Alerts (Page on-call engineer)
```
- Uptime <99% for >5 minutes
- Error rate >2% for >5 minutes
- Database unavailable
- API latency p95 >1000ms for >5 minutes
```

- [ ] Grafana → Alerting → Alert rules
- [ ] Create alert rule: "Uptime Below 99%"
  - Condition: `uptime_pct < 99`
  - Duration: 5 minutes
  - Action: Send to PagerDuty / email
  
- [ ] Create alert rule: "Error Rate Critical"
  - Condition: `error_rate > 2`
  - Duration: 5 minutes
  - Action: Page on-call
  
- [ ] Create alert rule: "Database Unavailable"
  - Condition: `db_available = false`
  - Duration: 1 minute
  - Action: Page on-call

### High Alerts (Slack #alerts channel)
```
- Uptime <99.9% for >10 minutes
- Error rate >1% for >10 minutes
- API latency p95 >500ms for >10 minutes
```

- [ ] Create alert rules for each metric above
- [ ] Action: Send to Slack #alerts

### Medium Alerts (Slack #engineering channel)
```
- Uptime <99.95% for >20 minutes
- Build success rate <95%
- Review time >48 hours average
```

- [ ] Create alert rules
- [ ] Action: Send to Slack #engineering

---

## Step 7: Dashboard Polish & Deployment (Friday)

### Layout & Styling
- [ ] Organize panels into logical sections:
  - Section 1: Uptime & Availability (Panels 1-4)
  - Section 2: Error Rate (Panels 5-7)
  - Section 3: API Latency (Panels 8-9)
  - Section 4: Incidents (Panels 10-11)
  - Section 5: Database Health (Panel 12)

- [ ] Set auto-refresh: **every 5 minutes**
- [ ] Add dashboard description: "Real-time production health monitoring"
- [ ] Set refresh dropdown visible to viewers
- [ ] Configure time range picker (default: last 24h)

### Access & Sharing
- [ ] Save dashboard: "Production Health"
- [ ] Set to **Public** (or Grafana organization public)
- [ ] Generate shareable link
- [ ] Copy link to #engineering announcement

### Testing
- [ ] Verify all panels load data (no errors)
- [ ] Test time range changes (1h, 24h, 7d)
- [ ] Verify refresh working (watch timestamps update)
- [ ] Test alerts: manually trigger one to confirm notification works
- [ ] Check mobile responsiveness (if applicable)

---

## Step 8: Team Training & Documentation (Friday)

### Dashboard Interpretation Guide
- [ ] Create 1-page guide: "How to Read the Production Health Dashboard"
  - What each metric means
  - Target values and thresholds
  - What to do if red/yellow
  - Escalation paths

- [ ] Record 5-10 minute video walkthrough (optional)

### Announcement to Team
```markdown
🎯 **Production Health Dashboard LIVE**

Our real-time monitoring dashboard is now available for daily standup use.

📊 **Access:** [Dashboard link]

**Key Metrics:**
- System Uptime (target: 99.9% SLO)
- Error Rate (target: <1%)
- API Latency p50/p95/p99
- Current Incidents (severity breakdown)
- Database Health (connections, storage, performance)

**Refresh:** Every 5 minutes  
**Updates:** Real-time when incidents occur

**How to interpret:**
- 🟢 GREEN: All metrics within target
- 🟡 YELLOW: Warning threshold (>10 min = escalate)
- 🔴 RED: Critical threshold (immediate escalation)

**Alert Channels:**
- 🔴 Critical: PagerDuty page to on-call
- 🟡 High: Slack #alerts
- ⚪ Medium: Slack #engineering

Questions? See [Dashboard Guide] or ask in #engineering.

Let's ship with confidence! 🚀
```

- [ ] Post to #engineering
- [ ] Link guide and video (if recorded)
- [ ] Schedule 15-min demo call if needed

---

## Verification Checklist (End of Friday)

- [ ] Dashboard loads without errors
- [ ] All 12 panels displaying real data
- [ ] Refresh rate working (5-minute updates)
- [ ] Alerts configured and tested
- [ ] Team link shared in #engineering
- [ ] At least 3 team members confirmed access
- [ ] Documentation published
- [ ] Ready for Monday daily standup use

---

## Success Criteria

✅ Real-time health dashboard live by end of Week 1  
✅ All 5 metric categories visible (uptime, errors, latency, incidents, database)  
✅ Alert rules functioning with correct severity levels  
✅ Team can access and interpret metrics  
✅ Alerts firing correctly (tested)  
✅ Dashboard available for daily standup Monday morning

---

**Next Step:** Week 2-3 → Deploy Weekly Performance Dashboard  
**Owner:** DevOps/SRE Lead  
**Deadline:** Friday, July 18, 2026
