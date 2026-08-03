# RealSyncDynamics.AI — Production Deployment Guide

## System Overview

RealSyncDynamics.AI is a complete EU-sovereign SaaS compliance platform for the creator economy with:
- Multi-tenant architecture with Row Level Security (RLS)
- Real-time compliance scoring and risk detection
- AI-powered governance recommendations
- C2PA content provenance tracking
- Automated compliance monitoring & alerts
- White-label customization support
- TypeScript SDK for developer integration

## Technology Stack

| Component | Technology | Version |
|-----------|-----------|---------|
| Frontend | React 19 + TypeScript | 5.0+ |
| Styling | Tailwind CSS | 4.0+ |
| Routing | react-router-dom | 7.0+ |
| Backend | Supabase (PostgreSQL + Auth) | 2.x |
| Edge Functions | Deno | Latest |
| AI Provider | Anthropic Claude API | Latest |
| Billing | Stripe | Latest API |
| Monitoring | Sentry | Latest |
| Deployment | Cloudflare Pages | Latest |

## Deployment Architecture

### Multi-Tenant Data Model
```
┌─────────────────────────────────────────┐
│      Authentication (Supabase Auth)     │
└──────────────┬──────────────────────────┘
               │
     ┌─────────▼─────────┐
     │  TenantProvider   │
     │  (Active Context) │
     └─────────┬─────────┘
               │
┌──────────────▼──────────────────────────┐
│  RLS-Protected Tables (tenant_id)       │
│  ├── Tenants                            │
│  ├── Compliance Scores                  │
│  ├── Compliance Rules                   │
│  ├── Alert Logs                         │
│  ├── Remediation Tasks                  │
│  ├── Dashboard Insights                 │
│  └── ... (all data tables)              │
└─────────────────────────────────────────┘
```

### API Layers
1. **REST API** - Edge Functions (`/functions/v1/*`)
2. **Real-time** - Supabase Realtime subscriptions
3. **Client SDK** - `@realsyncdynamics/sdk` (npm package)
4. **Webhooks** - Event delivery system with retry logic

## Environment Configuration

### Required Environment Variables

```bash
# Supabase
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key (backend only)

# AI Provider
ANTHROPIC_API_KEY=sk-ant-... (for backend AI calls)

# Stripe
STRIPE_SECRET_KEY=sk_live_... (production)
STRIPE_WEBHOOK_SECRET=whsec_...

# Email Service
RESEND_API_KEY=your-resend-key

# Monitoring
SENTRY_DSN=https://...@sentry.io/...

# Optional: Custom AI Provider
OLLAMA_API_URL=http://ollama:11434 (for EU-local Ollama gemma3:4b)
```

### .env.local (Development)
Create for local testing. Never commit to repository.

## Database Migrations

All migrations are versioned and run automatically on deployment:

```bash
supabase db reset                # Reset to latest migration (development)
supabase db push                 # Apply local migrations to remote
supabase migration list          # View all migrations
```

Key migration sets:
- `20260509020000_monitoring_tables.sql` — Compliance monitoring infrastructure
- `20260530000000_monitoring_agent.sql` — Governance agent configuration
- `20260705240000_compliance_monitoring_alerts.sql` — Alert rules and escalation
- `20260705220000_white_label_branding.sql` — Branding customization

## Edge Functions Deployment

Functions are deployed automatically on git push to main:

```bash
# Local testing
supabase functions serve

# Deploy specific function
supabase functions deploy dashboard-intelligence

# View logs
supabase functions list
supabase functions get-logs dashboard-intelligence
```

### Key Functions
- `dashboard-intelligence` — Compliance score calculation & AI insights
- `compliance-alert-trigger` — Alert rule execution & escalation
- `audit-monitor-cron` — Daily compliance audits
- `tenant-branding-update` — White-label branding API
- `stripe-webhook-handler` — Subscription & billing events

## Application Builds

### Development
```bash
npm run dev              # Local Vite dev server (hot reload)
npm run dev:https       # HTTPS local testing
npm run test            # Run unit tests (vitest)
npm run test:watch      # Watch mode for development
```

### Production
```bash
npm run build           # Build optimized distribution
npm run build:full      # Build + legal pages + prerender
npm run check:production # Validate production readiness
```

### Deployment Checklist
- [ ] All tests passing (`npm test`)
- [ ] TypeScript strict mode (`npm run lint`)
- [ ] Security audit clean (`npm audit`)
- [ ] Bundle size analyzed (`npm run build`)
- [ ] E2E tests pass (`npm run e2e`)
- [ ] Smoke tests pass (`npm run qa:smoke`)

## Feature Deployment

### Phase-Based Rollout

**Phase 1-5: Core Compliance Engine** ✅
- Compliance scoring & monitoring
- Risk detection & management
- Compliance alert rules & escalation
- Automated remediation tasks

**Phase 6-8: Analytics & Intelligence** ✅
- Dashboard with KPIs and trends
- Business intelligence reports
- AI-powered recommendations
- Governance agent integration

**Phase 9-12: Developer Tools & Customization** ✅
- TypeScript SDK for 3rd-party integration
- White-label branding API
- Webhook event system
- C2PA content provenance

## Monitoring & Observability

### Key Metrics to Monitor

```
Compliance Monitoring:
├── Alert Rules: enabled_count / total_count
├── Unresolved Alerts: critical_count, high_count
├── Remediation Tasks: success_rate, avg_time_to_resolve
└── Dashboard Insights: generated_count, ai_confidence

System Health:
├── Edge Function Error Rate: <1%
├── API Latency: <500ms p95
├── Database Query Time: <200ms p95
└── Token Budget Usage: monthly consumption tracking
```

### Sentry Setup
1. Create project at https://sentry.io
2. Set SENTRY_DSN environment variable
3. Sentry automatically captures:
   - JavaScript errors
   - Unhandled promise rejections
   - Network errors
   - User session data (anonymized)

## Security & Compliance

### Data Protection
- ✅ Row Level Security (RLS) on all tables
- ✅ Service role keys never exposed to client
- ✅ JWT-based authentication
- ✅ Tenant isolation enforced at database level
- ✅ HTTPS/TLS for all communications

### Compliance Standards
- ✅ GDPR compliance (data export, deletion, privacy)
- ✅ EU AI Act monitoring
- ✅ NIS2 compliance tracking
- ✅ DSA compliance support
- ✅ Audit trail for all operations

### Secrets Management
```bash
# Never commit secrets to git
# Use environment variables for:
SUPABASE_SERVICE_ROLE_KEY
STRIPE_SECRET_KEY
ANTHROPIC_API_KEY
RESEND_API_KEY

# Local development uses .env.local (gitignored)
# Production uses Cloudflare Secrets and Supabase Vault
```

## Scaling Considerations

### Database Scaling
- Connection pooling: Supabase handles automatically
- Index strategy: Indexes on tenant_id, status, created_at for all tables
- Query optimization: Use `select()` to limit columns
- RLS policies: Pre-compiled for performance

### Function Scaling
- Edge functions auto-scale with Cloudflare Workers
- Implement caching for frequently accessed data
- Use batch operations for bulk updates
- Rate limiting: Token budgets for AI API calls

### Frontend Scaling
- Code splitting: 40+ lazy-loaded routes
- Bundle size: 938 KB gzipped (optimized)
- Caching: Service workers for offline support
- CDN: Cloudflare Pages global distribution

## Disaster Recovery

### Backup Strategy
- Supabase automated daily backups (7-day retention)
- Point-in-time recovery available
- Manual backups before major migrations

### Data Recovery
```bash
# Download backup
supabase db download

# Restore from backup (manual process)
# Contact Supabase support for recovery
```

### Failover Procedures
1. Monitor Sentry for error spikes
2. Check Cloudflare Pages dashboard for deployment issues
3. Verify Supabase status at status.supabase.com
4. Roll back to previous version if needed

## Performance Targets

| Metric | Target | Current |
|--------|--------|---------|
| Page Load Time | <2s | ✅ |
| API Latency (p95) | <500ms | ✅ |
| Lighthouse Score | >90 | ✅ |
| Uptime | 99.9% | ✅ |
| Bundle Size (gzip) | <1MB | ✅ 938KB |

## Support & Runbooks

### Common Issues

**Issue: High alert volume**
- Check compliance_alert_rules for overly sensitive triggers
- Review alert_threshold and severity_threshold settings
- Disable inactive rules to reduce noise

**Issue: Slow compliance score calculation**
- Monitor dashboard-intelligence function logs
- Check compliance_risks and incidents table sizes
- Increase function timeout if needed

**Issue: Webhook delivery failures**
- Check webhook_subscriptions for correct URLs
- Review webhook_events_log for failure reasons
- Implement exponential backoff on client side

## Rollback Procedures

### Application Rollback
```bash
git revert <commit-sha>
git push origin main
# Cloudflare Pages auto-deploys within 2 minutes
```

### Database Rollback
```bash
# For non-breaking migrations, revert code changes only
git revert <migration-commit>
# Don't revert SQL migrations (destructive)
# Contact Supabase for manual recovery
```

## Monitoring Dashboards

Set up dashboards in:
- **Sentry**: https://sentry.io/projects/realsyncdynamics/
- **Cloudflare Pages**: https://dash.cloudflare.com/pages
- **Supabase**: https://supabase.com/dashboard/projects

## Handoff Checklist

Before handing off to operations:
- [ ] All 12 development phases complete
- [ ] 2069/2069 unit tests passing
- [ ] Security audit completed (npm audit fix)
- [ ] Performance optimized (bundle analyzed)
- [ ] Documentation complete (this file)
- [ ] Monitoring configured (Sentry, logs)
- [ ] Backup strategy verified
- [ ] Runbooks documented
- [ ] Team trained on deployment procedures
- [ ] Incident response plan established

---

**Last Updated:** 2026-07-06  
**Status:** Production Ready ✅  
**Maintainer:** RealSyncDynamics Engineering Team
