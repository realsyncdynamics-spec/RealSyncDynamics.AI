# Operational Metrics Dashboards — Phase 6 Setup

**Version:** 1.0.0  
**Created:** 2026-07-12  
**Status:** Ready for Implementation  
**Owner:** [DevOps/SRE Lead]

---

## Overview

Comprehensive dashboard infrastructure for tracking operational excellence metrics across all dimensions: reliability, performance, cost, team development, and business impact.

**Primary Audience:** Engineering leadership, team members, stakeholders  
**Update Frequency:** Real-time (automated)  
**Review Cycles:** Daily standup, weekly review, monthly analysis

---

## Dashboard Architecture

```
Operational Excellence Hub (Main Dashboard)
├── Real-Time Health Dashboard
│   ├── Uptime & Availability
│   ├── Error Rate & SLOs
│   ├── API Latency (p50/p95/p99)
│   └── Current Incidents
├── Weekly Performance Dashboard
│   ├── Build Success Rate
│   ├── Deployment Frequency
│   ├── MTTR Trend
│   └── Team Velocity
├── Team Development Dashboard
│   ├── Certification Progress
│   ├── Training Completion
│   ├── Team Satisfaction
│   └── Attrition Risk
├── Cost Optimization Dashboard
│   ├── Infrastructure Costs
│   ├── Cost per Customer
│   ├── Budget vs. Actual
│   └── Cost Reduction Tracking
└── Monthly Business Dashboard
    ├── Revenue & MRR
    ├── Customer Acquisition
    ├── Churn Rate
    └── NPS & Satisfaction
```

---

## 1. Real-Time Health Dashboard

### Purpose
Live visibility into system health and operational status for incident response and daily monitoring.

### Metrics to Display

**Uptime & Availability**
```
Display:
- Current uptime percentage (vs. 99.9% SLO)
- Downtime incidents (last 24h)
- Critical alerts active (count)
- System status: GREEN / YELLOW / RED

Source: Cloudflare Pages + Sentry
Update: Every 1 minute
Alert: If below 99.9% or RED status
```

**Error Rate & Performance**
```
Display:
- Current error rate (target: <1%)
- Error rate trend (24h graph)
- Top 5 error types (with counts)
- Error rate vs. historical average

Source: Sentry dashboard API
Update: Every 5 minutes
Alert: If >0.5% (yellow), >1% (red)
```

**API Latency**
```
Display:
- Current p50 latency (target: <200ms)
- Current p95 latency (target: <500ms)
- Current p99 latency (target: <1000ms)
- Latency trend (24h graph)
- Latency by endpoint (top 10)

Source: Sentry + Cloudflare Analytics
Update: Every 5 minutes
Alert: If p95 >400ms (yellow), >600ms (red)
```

**Current Incidents**
```
Display:
- Active incident count
- Incident severity breakdown (P1/P2/P3/P4)
- Time since last incident started
- Incident timeline (last 7 days)
- Average time to resolution

Source: GitHub Issues (incident label) + Sentry
Update: Real-time (when incident created/resolved)
Alert: New incidents appear immediately
```

**Database Health**
```
Display:
- Database connection pool usage (%)
- Current connections (vs. 100 max)
- Query performance (p95 latency)
- Storage usage (GB vs. quota)
- Replication lag (if applicable)

Source: Supabase monitoring API
Update: Every 1 minute
Alert: If connections >80%, storage >80%, lag >1s
```

### Implementation

**Hosting:** Grafana or custom dashboard (HTML/React)  
**Data Sources:**
- Sentry API (errors, performance, uptime)
- Cloudflare API (traffic, performance)
- Supabase API (database metrics)
- GitHub API (incidents)

**Setup Steps:**
1. [ ] Create Grafana organization (or use web dashboard)
2. [ ] Configure Sentry data source
3. [ ] Configure Cloudflare data source
4. [ ] Configure Supabase data source
5. [ ] Build dashboard panels (use templates below)
6. [ ] Set up alerting rules
7. [ ] Configure auto-refresh (every 5 min)
8. [ ] Test with sample data
9. [ ] Share link in #engineering for daily standup

---

## 2. Weekly Performance Dashboard

### Purpose
Track development velocity, build quality, and deployment health for weekly team sync.

### Metrics to Display

**Build Success Rate**
```
Display:
- Total builds this week: [count]
- Successful builds: [count] ([%])
- Failed builds: [count] ([%])
- Average build time: [duration]
- Build success trend (last 4 weeks line chart)

Source: GitHub Actions API
Update: After each build
Alert: If success rate <95%

Target: 98%+
```

**Deployment Frequency**
```
Display:
- Deployments this week: [count]
- Deployments per day (trend)
- Average deployment duration: [minutes]
- Rollbacks this week: [count]
- Last deployment: [time ago]

Source: GitHub (merged PRs) + Cloudflare deployments
Update: Real-time on deployment
Alert: If rollbacks >1

Target: 3-5 deployments/week
```

**Mean Time to Recovery (MTTR)**
```
Display:
- MTTR this week: [minutes]
- MTTR last week: [minutes]
- MTTR trend (last 4 weeks)
- MTTR by severity (P1/P2/P3)
- Median vs. average MTTR

Source: Incident tracking (GitHub + Sentry)
Update: When incident resolved
Alert: If MTTR >45 minutes

Target: <20 minutes
```

**Code Review Velocity**
```
Display:
- PRs merged this week: [count]
- Average PR review time: [hours]
- PRs pending review: [count]
- Review cycle time trend (last 4 weeks)

Source: GitHub API
Update: After each PR merge
Alert: If review time >48 hours

Target: <24 hour average review time
```

**Test Coverage**
```
Display:
- Current unit test coverage: [%]
- Coverage trend (last 4 weeks)
- E2E test pass rate: [%]
- Smoke test pass rate: [%]

Source: CI pipeline (test reports)
Update: After each test run
Alert: If coverage <85%

Target: >85% coverage
```

### Implementation

**Hosting:** Grafana dashboard or spreadsheet (if dashboard not ready)  
**Data Sources:** GitHub API, CI/CD logs  
**Refresh:** After each CI/CD event, min once daily

**Setup Steps:**
1. [ ] Extract metrics from GitHub Actions API
2. [ ] Configure weekly aggregation (Friday reporting)
3. [ ] Build dashboard panels
4. [ ] Connect to team Slack for weekly notifications
5. [ ] Schedule weekly review (Monday morning)

---

## 3. Team Development Dashboard

### Purpose
Track team growth, certifications, and engagement for quarterly reviews.

### Metrics to Display

**Certification Progress**
```
Display:
- Total team members: [count]
- Contributor level: [count] ([%])
- Practitioner level: [count] ([%])
- Expert level: [count] ([%])
- Staff engineer level: [count] ([%])
- In training: [count]

Source: Manual tracking (spreadsheet/database)
Update: Monthly (after reviews)
Alert: If progress lags behind targets

Target (Q4 2026):
- 100% at Contributor or above
- 50% at Practitioner or above
```

**Role-Based Track Progress**
```
Display:
- Full-Stack: [#]/[count] in program
- Backend: [#]/[count] in program
- Frontend: [#]/[count] in program
- DevOps/SRE: [#]/[count] in program
- Security: [#]/[count] in program

By track:
- Week 1-2: [#] in foundation
- Week 3-8: [#] in specialization
- Week 9-12: [#] in capstone
```

**Training Completion Rate**
```
Display:
- Onboarding completion (Week 1-12 progress)
- Module completion rates (by engineer)
- Time to first PR: [average days]
- Time to independent work: [average days]

Target:
- Week 2: First PR merged
- Week 4: First production feature
- Week 12: Independent contributor
```

**Team Satisfaction**
```
Display:
- Current satisfaction (1-10): [score]
- Satisfaction trend (monthly)
- Work-life balance: [score]
- Career growth satisfaction: [score]
- Team dynamics: [score]

Source: Monthly pulse survey
Update: Monthly (first of month)
Alert: If satisfaction <8/10

Target: >8.5/10 by Q4
```

**Attrition Risk**
```
Display:
- Team turnover (annual %): [%]
- Retention rate: [%]
- High-risk members: [count] [names]
- Exit feedback themes: [list]

Monitor: Satisfaction scores, engagement, feedback
Alert: If anyone scores <7/10 (needs 1:1)

Target: >95% retention
```

### Implementation

**Hosting:** Google Sheets (for easy team access) + Grafana  
**Data Sources:**
- Manual entry (certifications)
- GitHub tracking (onboarding milestones)
- Pulse surveys (satisfaction)

**Setup Steps:**
1. [ ] Create Google Sheet template for tracking
2. [ ] Share access with engineering team
3. [ ] Set up monthly update reminders
4. [ ] Configure auto-calculations
5. [ ] Create Grafana dashboard pulling from sheet

---

## 4. Cost Optimization Dashboard

### Purpose
Track infrastructure spending and cost efficiency for monthly reviews and budgeting.

### Metrics to Display

**Monthly Infrastructure Costs**
```
Display:
- Current month spend: $[amount]
- Budget vs. actual: $[variance]
- Cost by service:
  - Supabase: $[amount]
  - Cloudflare: $[amount]
  - Stripe: $[amount] (transaction fees)
  - Sentry: $[amount]
  - Resend: $[amount]
  - Other: $[amount]

Source: Service invoices + transaction data
Update: Monthly (1st of month)
Alert: If >10% over budget

Target: $[budget amount]
```

**Cost per Customer**
```
Display:
- Total customers: [count]
- Monthly infrastructure cost: $[amount]
- Cost per customer: $[amount]
- Cost per customer trend (last 12 months)

Calculation: Total monthly cost / active customers
Update: Monthly
Alert: If >$[threshold]

Target: <$[optimal cost]
```

**Cost Reduction Progress**
```
Display:
- Current quarter reduction: [%]
- YTD reduction: [%]
- Annual target: [%]
- Initiatives completed: [count]
- Cost saved: $[amount]

Examples of savings:
- Query optimization: $[savings]
- Caching improvements: $[savings]
- Reserved capacity: $[savings]

Target (end of 2026): -30-40% vs. Q3 baseline
```

**Resource Utilization**
```
Display:
- Database: [%] of quota used
- Storage: [GB] / [quota GB]
- Bandwidth: [GB] / [quota GB]
- API rate limits: [%] of daily quota

Alert: If >80% of any quota
Action: Plan capacity upgrade if needed
```

### Implementation

**Hosting:** Google Sheets or custom dashboard  
**Data Sources:** Service invoices, billing APIs  
**Review:** Monthly during financial review

---

## 5. Monthly Business Dashboard

### Purpose
Track business metrics aligned with revenue and growth for stakeholder reporting.

### Metrics to Display

**Revenue Metrics**
```
Display:
- Monthly Recurring Revenue (MRR): $[amount]
- MRR growth: [%] month-over-month
- MRR by plan tier:
  - Free/Trial: [count]
  - Pro: [count]
  - Enterprise: [count]

Source: Stripe API
Update: Daily
Alert: If MRR growth <0%

Target: 10-15% MRR growth monthly
```

**Customer Acquisition**
```
Display:
- New customers this month: [count]
- Customer acquisition rate: [/month]
- CAC (Customer Acquisition Cost): $[amount]
- CAC payback period: [months]

Calculation:
- New customers = signups - existing
- CAC = (Marketing + Sales cost) / new customers

Target: <[X] month payback period
```

**Churn & Retention**
```
Display:
- Monthly churn rate: [%]
- Customer retention rate: [%]
- Churn by plan tier:
  - Free: [%]
  - Pro: [%]
  - Enterprise: [%]

Calculation: (Customers at end - new) / customers at start
Update: Monthly
Alert: If churn >5%

Target: <3% monthly churn
```

**Customer Satisfaction (NPS)**
```
Display:
- Net Promoter Score (NPS): [score]
- Promoters: [%]
- Passives: [%]
- Detractors: [%]
- NPS trend (quarterly)

Source: Customer survey
Update: Quarterly
Alert: If NPS <40

Target: >50 NPS
```

### Implementation

**Hosting:** Metabase or Google Sheets  
**Data Sources:** Stripe API, Supabase (usage data), surveys  
**Review Frequency:** Monthly all-hands

---

## Dashboard Implementation Timeline

### Week 1 (July 12-18)
- [ ] Set up data sources (Sentry, Cloudflare, Supabase APIs)
- [ ] Create real-time health dashboard (minimum viable)
- [ ] Test dashboard with live data
- [ ] Share link in #engineering

### Week 2-3 (July 19-Aug 1)
- [ ] Add weekly performance dashboard
- [ ] Implement weekly automated reporting
- [ ] Connect to Slack for notifications
- [ ] Train team on reading dashboards

### Week 4+ (Aug 1+)
- [ ] Add team development tracking
- [ ] Integrate cost tracking
- [ ] Add business metrics
- [ ] Monthly dashboard review scheduled

---

## Dashboard Tools Recommendation

**Option 1: Grafana (Recommended)**
- Pros: Real-time, beautiful, integrates with Sentry/Cloudflare/Supabase
- Cons: Requires setup, learning curve
- Cost: Free (self-hosted) or $75-900/month (Cloud)
- Setup time: 4-6 hours

**Option 2: Google Sheets (Quick Start)**
- Pros: Familiar, no setup, easy to share
- Cons: Manual updates, slower for real-time
- Cost: Free
- Setup time: 1-2 hours

**Option 3: Custom Dashboard (React)**
- Pros: Fully customized, integrated with app
- Cons: Development effort required
- Cost: Engineering time
- Setup time: 2-3 weeks

**Recommendation:** Start with Google Sheets (Week 1) + Grafana (Week 2-3)

---

## Alerting Rules

### Critical Alerts (Page on-call engineer)
- Uptime <99% for >5 minutes
- Error rate >2% for >5 minutes
- Database unavailable
- API latency p95 >1000ms

### High Alerts (Slack #alerts)
- Uptime <99.9% for >10 minutes
- Error rate >1% for >10 minutes
- Build success rate <95%
- MTTR >60 minutes

### Medium Alerts (Slack #engineering)
- Uptime <99.95% for >20 minutes
- Certification progress behind target
- Cost >10% over budget
- Review time >48 hours average

---

## Success Metrics for Dashboards

| Metric | Target | Measurement |
|--------|--------|-------------|
| Dashboard availability | 99.9% | Uptime tracking |
| Data freshness | <5 min | Last update timestamp |
| Team adoption | >80% | Daily active users |
| Insight quality | >4/5 | Feedback survey |
| Alert accuracy | >90% | True positive rate |

---

## Maintenance & Review Schedule

**Weekly:** Review during Friday retrospective  
**Monthly:** Full dashboard review, update targets  
**Quarterly:** Strategic review, add new metrics  
**Annual:** Complete dashboard redesign assessment

---

**Next Steps:**
1. Assign dashboard owner (DevOps/SRE lead)
2. Set up initial data sources (real-time health only)
3. Schedule dashboard training for team
4. Begin weekly metric reviews
5. Expand dashboard over next 4 weeks

**Owner:** [TBD]  
**Last Updated:** 2026-07-12  
**Next Review:** After Week 1 retrospective (July 19)
