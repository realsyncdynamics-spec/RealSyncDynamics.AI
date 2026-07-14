# RealSyncDynamics.AI — Feedback & Retrospective Templates

**Version:** 1.0.0  
**Status:** Operational  
**Effective Date:** 2026-07-12

---

## Overview

Standard templates for capturing feedback, conducting retrospectives, and driving continuous improvement across the organization.

---

## Post-Incident Retrospective

### Purpose
Learn from incidents to prevent recurrence and improve processes.

### Timing
- Conduct within 24-48 hours of incident resolution
- While details are fresh, team is available
- Allow time for initial stabilization

### Required Participants
- Incident commander
- All responders involved
- On-call engineer (if different from responders)
- Optional: Product lead, customer success (for customer-impacting incidents)

### Template

```markdown
# Incident Retrospective — [Incident Name]

## Incident Details

**Date & Time:** [Date], [Time UTC] to [Time UTC]  
**Duration:** [Hours:Minutes]  
**Incident ID:** [GitHub issue link]  
**Severity:** [P1/P2/P3/P4]  
**Impact:** [Summary of what affected]  

**Participants:**
- [Name] — Role
- [Name] — Role

---

## Timeline

What happened, in order. Include timestamps where possible.

| Time (UTC) | Event |
|----------|-------|
| 14:32 | Alert fired: Error rate >1% |
| 14:35 | On-call paged |
| 14:38 | Incident commander assigned |
| 14:42 | Root cause identified: Database connection leak |
| 14:55 | Edge function restarted |
| 15:03 | Error rate returned to normal |
| 15:10 | All-clear given, incident closed |

---

## Root Cause Analysis (5 Whys)

**Problem:** Database connection pool exhausted, leading to API errors

**Why 1:** Why did the connection pool exhaust?  
→ Edge function deployed without connection cleanup code

**Why 2:** Why wasn't connection cleanup tested?  
→ Local testing didn't stress the connection pool

**Why 3:** Why wasn't pool stress testing part of CI?  
→ Performance testing wasn't automated in pipeline

**Why 4:** Why wasn't this discovered earlier?  
→ Monitoring didn't have connection pool threshold alert

**Why 5:** Why wasn't alert configured?  
→ Setup process unclear, task was incomplete

---

## Impact Assessment

**Scope:**
- [ ] Customer-impacting: Yes / No
- [ ] Data loss: Yes / No
- [ ] Security exposure: Yes / No
- Affected users: ~[%] of customer base
- Revenue impact: ~$[amount] or "unknown"

**Duration:**
- Detection to acknowledgment: 3 minutes
- Time to mitigation: 31 minutes
- Time to resolution: 38 minutes

**Severity Justification:**
Why [P1/P2/P3]? [Brief explanation]

---

## Lessons Learned

### What Went Well
- ✅ Alert system functioned, detected issue quickly
- ✅ Team responded promptly, incident commander effective
- ✅ Clear communication in #critical-alerts
- ✅ Rollback plan executed cleanly

### What Could Improve
- ❌ Local testing insufficient for database load patterns
- ❌ Connection pool alerts not configured
- ❌ Deployment didn't run performance tests
- ❌ Code review missed missing cleanup code

### Surprising Discoveries
- [Notable finding or insight]
- [Process gap identified]

---

## Action Items

**Critical (Must implement before next release):**
1. [ ] Add connection cleanup to edge function template
   - Owner: @backend-lead
   - Due: [Date]
   - PR: [Link when done]

2. [ ] Configure connection pool alerts in Supabase
   - Owner: @sre
   - Due: [Date]
   - Dashboard link: [Link when done]

**Important (Implement this quarter):**
3. [ ] Add database connection stress test to CI
   - Owner: @devops
   - Due: [Date]
   - PR: [Link when done]

4. [ ] Document edge function connection management best practices
   - Owner: @tech-lead
   - Due: [Date]
   - Wiki link: [Link when done]

**Nice to Have (Backlog):**
5. [ ] Implement automatic connection pool optimization
   - Owner: [TBD]
   - Due: [No deadline]

---

## Follow-up

**Post-Incident Checks:**
- [ ] (1 week) Verify alert is working properly
- [ ] (1 week) Verify code change is in production
- [ ] (2 weeks) Confirm no similar incidents
- [ ] (1 month) Retrospective review: Did we prevent recurrence?

**Communication:**
- [ ] Incident report sent to stakeholders
- [ ] Action items tracked in GitHub
- [ ] Team training scheduled if needed
- [ ] Customer communication (if applicable)

---

## Documentation

**Runbook Update:** [Link to updated runbook]  
**Wiki Update:** [Link to new troubleshooting guide]  
**FAQ Addition:** [Link to new FAQ entry]  
**Alert Configuration:** [Link to alert settings]

---

## Sign-Off

**Incident Commander:** [Name] — ✓ Approved  
**Engineering Lead:** [Name] — ✓ Approved  
**Date Completed:** [Date]

---

```

---

## Weekly Team Sync Agenda

### Purpose
Lightweight weekly check-in on status, blockers, and quick wins.

### Schedule
**Every Monday, 10:00 AM UTC**  
Duration: 30 minutes  
Facilitator: Rotating team member (weekly)  
Location: Slack #engineering or video call

### Template

```markdown
# Weekly Sync — [Week of Date]

## Status Round-Robin (12 min)
Each person: 2 min on project status, blockers, wins.

### [Engineer Name]
- **Project:** [Feature/project]
- **Status:** On track / Behind / Blocked
- **Blocker:** [If any]
- **Win:** [This week's accomplishment]

### [Engineer Name]
[Same format]

---

## Team Blockers & Issues (10 min)

### Blocker 1: [Description]
- **Severity:** Critical / High / Medium / Low
- **Owner:** @person
- **ETA:** [Date] or "Investigating"
- **Action:** [What's being done]

### Blocker 2: [Description]
[Same format]

---

## Announcements (5 min)
- Upcoming meeting or deadline
- New tool or process change
- Recognition or celebration

---

## Quick Topics (3 min)
- Any urgent questions
- Next week's focus
- Reminders

---

**Notes:** [Capture key decisions or items for action]

---

## Next Week's Agenda
- [Any specific topics to cover]

```

---

## Monthly All-Hands Presentation Format

### Purpose
Company-wide update on progress, metrics, and team achievements.

### Schedule
**First Friday of each month, 3:00 PM UTC**  
Duration: 60 minutes (30 min presentation + 30 min Q&A/discussion)  
Presenter: Rotating team members (each person 2-3 times per year)

### Presentation Outline (45 slides for 30 min = 1 min per slide)

```markdown
# [Month] All-Hands: [Theme]

## Section 1: Business Metrics (5 min)

1. [Company logo + date]
2. MRR and growth trend
3. Customer acquisition
4. Customer retention / churn
5. Revenue targets vs. actual

## Section 2: Product & Features (10 min)

6. Roadmap progress
7. Features shipped this month
8. Customer usage metrics
9. Feature adoption (if applicable)
10. Next month preview
[... 5 more slides with visuals]

## Section 3: Technical Achievements (8 min)

16. Performance metrics (uptime, error rate, latency)
17. Deployment metrics (velocity, success rate)
18. Security & compliance status
19. Infrastructure health
20. Technical debt address
[... 5 more slides]

## Section 4: Team & Culture (5 min)

26. Team growth / hiring
27. Training & certifications completed
28. Team celebrations
29. Upcoming events or focus
30. Closing thoughts

---

## Design Guidelines
- Consistent branding and colors
- Large fonts (readable from distance)
- Few words per slide (avoid text-heavy)
- Visuals and charts preferred
- Stories and examples > raw data

## Presenter Tips
- Practice presentation beforehand
- Speak conversationally (not reading)
- Use presenter notes for reference
- Engage audience (ask questions)
- Have backup slide for common Q&A
```

---

## Quarterly Business Review (QBR) Structure

### Purpose
Strategic review of OKRs, business metrics, and roadmap alignment.

### Duration
4 hours (can be split over 2 sessions if preferred)

### Participants
- Executive team
- Engineering leadership
- Product leadership
- Finance

### Agenda

#### Session 1: OKR Review & Metrics (90 min)

```markdown
# Q3 2026 Business Review

## Part 1: Previous Quarter OKRs (30 min)

### Objective 1: [Achieved / At Risk / Off Track]
- Status: [% completion]
- KR1: [Result] — On Track / Missed
- KR2: [Result] — On Track / Missed
- KR3: [Result] — On Track / Missed
- Analysis: [Why?]

### Objective 2: [Status]
[Same format]

## Part 2: Business Metrics Dashboard (30 min)

- Revenue: $[amount] vs. target: $[amount]
- Customer acquisition: [number] vs. target: [number]
- Churn rate: [%] vs. target: [%]
- NPS: [score] vs. target: [score]
- Burn rate: $[amount]/month
- Runway: [months]

## Part 3: Operational Metrics (30 min)

- System uptime: [%] vs. target: [%]
- Error rate: [%] vs. target: [%]
- Deployment frequency: [/week] vs. target
- MTTR: [minutes] vs. target: [minutes]
- Customer satisfaction: [score] vs. target

---
```

#### Session 2: Next Quarter Planning & Roadmap (90 min)

```markdown
## Part 4: Next Quarter OKRs (45 min)

### Objective 1: [Strategic goal]
**Owner:** [Name]

**Key Results:**
1. [Specific result] — Confidence: [%]
2. [Specific result] — Confidence: [%]
3. [Specific result] — Confidence: [%]

**Dependencies:** [Other teams/resources needed]  
**Risks:** [What could go wrong]  
**Investment:** [Engineering weeks, budget]

### Objective 2: [Strategic goal]
[Same format]

---

## Part 5: Roadmap & Initiatives (45 min)

**Key Projects for Next Quarter:**
1. [Project name] — Owner: @person — ETA: [date]
2. [Project name] — Owner: @person — ETA: [date]
3. [Project name] — Owner: @person — ETA: [date]

**Resource Allocation:**
- Feature development: 60%
- Technical debt: 20%
- Experiments/learning: 10%
- Support/maintenance: 10%

**Risks & Contingencies:**
- Risk 1: [Impact] → Mitigation: [Plan]
- Risk 2: [Impact] → Mitigation: [Plan]

---

## Decisions & Action Items

- [ ] [Decision] — Decided by: @person
- [ ] [Action] — Owner: @person — Due: [date]

---
```

### QBR Artifacts

**Metrics Dashboard:** Prepared 1 week before meeting  
**OKR Workbook:** Shared for draft 2 weeks before  
**Meeting Notes:** Published within 24 hours  
**Action Items:** Tracked in GitHub with "QBR" label

---

## 360-Degree Feedback Form

### Purpose
Comprehensive feedback from multiple perspectives (peer, manager, self).

### Format
- Anonymous responses (collected via form tool)
- Completed 1 week before review meeting
- Aggregated by manager before discussion
- 5-point scale + written comments

### Categories

```markdown
# 360 Review for [Engineer Name]

## Communication & Collaboration (5 questions)

1. **Communicates effectively with team**
   - [ ] Strongly Disagree
   - [ ] Disagree
   - [ ] Neutral
   - [ ] Agree
   - [ ] Strongly Agree
   Comment: [Optional]

2. **Responds promptly to requests / questions**
   [Same scale + comment]

3. **Shares knowledge generously with others**
   [Same scale + comment]

4. **Works well across team boundaries**
   [Same scale + comment]

5. **Accepts feedback and acts on it**
   [Same scale + comment]

---

## Technical Excellence (5 questions)

6. **Writes clean, maintainable code**
   [Same scale + comment]

7. **Demonstrates strong problem-solving skills**
   [Same scale + comment]

8. **Takes ownership of assigned work**
   [Same scale + comment]

9. **Tests thoroughly before submitting code**
   [Same scale + comment]

10. **Stays current with technical trends**
    [Same scale + comment]

---

## Leadership & Growth (5 questions)

11. **Mentors or helps junior team members**
    [Same scale + comment]

12. **Shows initiative in improving processes**
    [Same scale + comment]

13. **Handles feedback professionally**
    [Same scale + comment]

14. **Demonstrates reliability and follow-through**
    [Same scale + comment]

15. **Has clear career goals and pursues them**
    [Same scale + comment]

---

## Open-Ended Feedback

16. **What are [Name]'s greatest strengths?**
    [Text response]

17. **What could [Name] work on to improve?**
    [Text response]

18. **Any additional feedback?**
    [Text response]

---

## Self-Assessment

**Rate yourself on the same 15 questions:**
[5-point scale for each]

**Reflection:**
- What have you accomplished this period?
- What challenges have you faced?
- Where do you want to grow?
- How can I (manager) support your growth?

---
```

---

## Pulse Survey (Monthly)

### Purpose
Quick temperature check on team health and satisfaction.

### Schedule
**Last Friday of each month**  
Duration: 5 minutes to complete  
Anonymity: Responses aggregated, no individual attribution

### Template

```markdown
# Monthly Pulse Survey — [Month] [Year]

1. **Overall, how satisfied are you with your work?**
   - [ ] Very Unsatisfied (1)
   - [ ] Unsatisfied (2)
   - [ ] Neutral (3)
   - [ ] Satisfied (4)
   - [ ] Very Satisfied (5)

2. **How would you rate the work-life balance this month?**
   - [ ] Very Poor (1)
   - [ ] Poor (2)
   - [ ] Adequate (3)
   - [ ] Good (4)
   - [ ] Excellent (5)

3. **How well is the team functioning?**
   - [ ] Very Poorly (1)
   - [ ] Poorly (2)
   - [ ] Adequately (3)
   - [ ] Well (4)
   - [ ] Excellently (5)

4. **How supported do you feel by leadership?**
   - [ ] Not at all (1)
   - [ ] Minimally (2)
   - [ ] Adequately (3)
   - [ ] Well (4)
   - [ ] Very Well (5)

5. **What's one thing going well right now?**
   [Text response]

6. **What's one thing we could improve?**
   [Text response]

7. **Is there anything blocking your productivity or happiness?**
   - [ ] No blockers
   - [ ] Minor issue: [describe]
   - [ ] Significant issue: [describe]

---

## Aggregated Results (Shared with team next day)

- Average satisfaction: [X/5]
- Work-life balance: [X/5]
- Team functioning: [X/5]
- Leadership support: [X/5]

### Trends
- [Positive trend noted]
- [Concern to address]

### Action Items
- [ ] [From survey feedback]

---
```

---

## Customer Feedback Synthesis Template

### Purpose
Regular capture and analysis of customer feedback for product and operations.

### Schedule
**Weekly synthesis (30 min)**  
Participants: Product, customer success, engineering leads

### Template

```markdown
# Customer Feedback Synthesis — Week of [Date]

## Feedback Categories

### Feature Requests
1. [Feature]: [Number] customers requested
   - Use cases: [Common patterns]
   - Priority: High / Medium / Low
   - Owner: [Assigned to product/engineering]

2. [Feature]: [Number] customers requested
   [Same format]

### Bug Reports
1. [Issue description]: [Number] reports
   - Severity: Critical / High / Medium / Low
   - Status: Investigating / In Progress / Fixed
   - Owner: [Assigned]

### Usage Patterns
- Most used features: [Feature 1], [Feature 2]
- Underused features: [Feature 3]
- Common pain points: [Area 1], [Area 2]

### Support Tickets
- High-volume issues: [Issue description]
- Frequently asked questions: [Q1], [Q2]
- Onboarding challenges: [Challenge 1]

---

## Insights & Recommendations

**What we learned:**
- [Customer insight 1]
- [Customer insight 2]

**Suggested actions:**
- [ ] [Action] — Priority: High — Owner: @person
- [ ] [Action] — Priority: Medium — Owner: @person

**Roadmap impact:**
- Should we adjust product priorities? [Yes/No]
- Should we add this to roadmap? [Yes/No]

---

## Communication to Team
- [ ] Feedback shared with engineering
- [ ] Roadmap updated (if needed)
- [ ] Customer success briefed
- [ ] Next week's focus communicated

---
```

---

## Templates & Tools

### Recommended Tools
- **Retrospectives:** Google Docs (live notes) + GitHub Issues (action tracking)
- **Surveys:** Typeform, Google Forms, or SurveySparrow (anonymous)
- **Feedback Collection:** Intercom (in-app), Zendesk (support)
- **Video Recording:** Loom for async video feedback
- **1-1 Notes:** Notion or Google Docs shared with employee

### Automation

**GitHub Automation:**
```yaml
name: Create Retrospective Issue
on:
  schedule:
    - cron: '0 14 1 * 0'  # Every Monday at 2 PM UTC

jobs:
  create_retro:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/github-script@v6
        with:
          script: |
            github.rest.issues.create({
              owner: context.repo.owner,
              repo: context.repo.repo,
              title: `Weekly Retrospective — ${new Date().toLocaleDateString()}`,
              body: '# Weekly Retrospective\n[Template content]',
              labels: ['retrospective', 'process']
            })
```

---

## Templates Gallery

All templates available in `docs/templates/`:
- `retrospective-template.md`
- `weekly-sync-template.md`
- `qbr-template.md`
- `360-feedback-template.md`
- `pulse-survey-template.md`
- `customer-feedback-template.md`

---

## Success Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| Retrospective completion | 100% | Weekly checklist |
| Action item completion | >80% | GitHub tracking |
| Feedback survey response rate | >90% | Form completion rate |
| 360-degree feedback depth | >3.5/5 avg | Comment word count |
| Customer feedback incorporation | >70% | Roadmap trace |
| Team sentiment trend | Stable/Improving | Monthly pulse average |

---

**Last Updated:** 2026-07-12  
**Next Review:** 2026-10-12 (quarterly)  
**Maintainer:** Engineering Manager & HR
