# Phase 6.3 Specification: Dashboard Enhancements

**Status:** Planning Phase
**Scope:** 3 Weeks (21 days)
**Target Deployment:** End of development cycle
**Success Criteria:** All immediate enhancements completed with 0 TypeScript errors

---

## Overview

Phase 6.3 builds on Phase 6.2 (Collaborative Terminal) with four critical enhancements:
1. **Email Notifications** - Real-time alerts on team actions and approvals
2. **Real-Time Updates** - WebSocket-based polling replacement for 5s → instant updates
3. **Audit Export** - PDF/CSV export with digital signatures and compliance metadata
4. **Role Editing** - Change member roles inline without removal/re-invitation

---

## Week 1: Email Notifications & Real-Time Updates

### Email Notification System

**Database Schema Addition:**
```sql
-- Notification preferences (per user/tenant)
CREATE TABLE notification_preferences (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  email_on_invite BOOLEAN DEFAULT true,
  email_on_approval_pending BOOLEAN DEFAULT true,
  email_on_approval_action BOOLEAN DEFAULT true,
  email_on_member_join BOOLEAN DEFAULT true,
  email_on_command_executed BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  CONSTRAINT notification_preferences_unique UNIQUE(user_id, tenant_id)
);
```

**Edge Function: `notify-terminal-event`**
- Triggered by database triggers on terminal tables
- Sends transactional emails via SendGrid
- Respects user notification preferences
- Includes action context (who, what, when, approval link)

**Email Templates:**
1. `member-invited.html` - You've been invited to a terminal session
2. `approval-pending.html` - Action required: audit awaits approval
3. `approval-approved.html` - Your audit has been approved
4. `approval-rejected.html` - Your audit was rejected (includes reason)
5. `member-joined.html` - New team member joined session

**UI: Notification Preferences Panel**
- Location: Settings → Notifications
- Toggle switches per event type
- Email preview
- Test email button
- Unsubscribe link in footer

---

### Real-Time Updates via WebSocket

**Architecture:**
- Replace 5-second polling in ActivityLogPanel, ApprovalQueuePanel
- Use Supabase Realtime (built-in PostgRES listening)
- Subscribe to specific tables scoped by tenant_id
- Auto-reconnect with exponential backoff

**Implementation:**
```typescript
// useRealtimeActivityLog hook (replaces manual polling)
function useRealtimeActivityLog(sessionId: string, tenantId: string) {
  const [activities, setActivities] = useState<ActivityLogEntry[]>([]);
  
  useEffect(() => {
    const subscription = supabase
      .from('terminal_activity_log')
      .on('INSERT', (payload) => {
        // Filter by sessionId + tenantId
        if (payload.new.session_id === sessionId && payload.new.tenant_id === tenantId) {
          setActivities((prev) => [payload.new, ...prev]);
        }
      })
      .subscribe();
    
    return () => subscription.unsubscribe();
  }, [sessionId, tenantId]);
  
  return { activities };
}

// useRealtimeApprovals hook
function useRealtimeApprovals(sessionId: string, tenantId: string) {
  const [approvals, setApprovals] = useState<ApprovalRequest[]>([]);
  
  useEffect(() => {
    const subscription = supabase
      .from('terminal_approvals')
      .on('*', (payload) => {
        // Fetch full state on any change
        fetchApprovals();
      })
      .subscribe();
    
    return () => subscription.unsubscribe();
  }, []);
  
  return { approvals };
}
```

**UI Changes:**
- ActivityLogPanel: Remove 5s polling → use useRealtimeActivityLog
- ApprovalQueuePanel: Remove manual refresh button → real-time updates
- Add live indicator (green dot) showing connection status
- Show timestamp "just now" for instant updates

**Benefits:**
- Latency: 5000ms → <100ms
- Network: 12 requests/min → 0 (only events)
- UX: "Refresh" button removed, changes instant

---

## Week 2: Audit Export & Role Editing

### Audit Export (PDF/CSV)

**Edge Function: `export-audit`**
```typescript
interface ExportRequest {
  auditId: string;
  format: 'pdf' | 'csv' | 'xlsx';
  includeSignature: boolean;
  tenantId: string;
}

interface ExportedAudit {
  url: string;
  format: string;
  size: number;
  expiresAt: Date;
  signatureVerified: boolean;
}
```

**PDF Export (using pdfkit + signature):**
- Header: Tenant name, session ID, export timestamp
- Section 1: Audit metadata (auditId, commandId, requestor)
- Section 2: Findings summary (type, severity, count by category)
- Section 3: Compliance mapping (DSGVO articles, EU AI Act sections)
- Section 4: Digital signature (SHA256 hash + tenant signing key)
- Footer: "Exported from RealSync Dynamics.AI" + verification link

**CSV Export (for spreadsheet analysis):**
- Columns: auditId, commandId, finding_type, severity, description, dsgvo_article, ai_act_section, remediation, status, created_at
- One row per finding
- Can be imported into Excel/Sheets for custom analysis

**XLSX Export (Excel with formatting):**
- Multiple sheets: Summary, Findings, Compliance Map, Audit Trail
- Conditional formatting (severity → colors)
- Pivot tables (findings by type, by severity)
- Macros disabled (security)

**Database Schema:**
```sql
CREATE TABLE audit_exports (
  id UUID PRIMARY KEY,
  audit_id UUID NOT NULL REFERENCES terminal_audits(id),
  user_id UUID NOT NULL REFERENCES auth.users(id),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  format TEXT CHECK (format IN ('pdf', 'csv', 'xlsx')),
  url TEXT NOT NULL, -- S3 signed URL
  file_size INTEGER,
  signature_hash VARCHAR(64), -- SHA256
  signature_verified_at TIMESTAMP WITH TIME ZONE,
  expires_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  CONSTRAINT audit_exports_tenant_fk FOREIGN KEY (tenant_id) REFERENCES tenants(id)
);
```

**UI Component: `AuditExportPanel`**
- Appears in ApprovalQueuePanel when audit is approved
- Dropdown menu: PDF, CSV, XLSX
- Download button with file size
- "Verify signature" link (checks SHA256 vs blockchain/anchor service)
- Recent exports list with expiry countdown

---

### Role Editing UI

**Current Flow (problematic):**
1. Owner views member → wants to change editor → viewer
2. Must remove member (is_active = false)
3. Must re-invite as viewer
4. User loses session history context

**New Flow:**
1. Owner clicks member card → expand inline
2. Dropdown shows current role (editor) + available roles
3. Click new role → update via API (single call)
4. Activity log: "Changed role of User X from editor → viewer"
5. No removal/re-invitation, no session interruption

**Database Schema:**
```sql
-- Modify terminal_session_members to allow role updates
-- Add audit column
CREATE TABLE terminal_member_role_changes (
  id UUID PRIMARY KEY,
  member_id UUID NOT NULL REFERENCES terminal_session_members(id),
  old_role TEXT NOT NULL,
  new_role TEXT NOT NULL,
  changed_by UUID NOT NULL REFERENCES auth.users(id),
  reason TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  CONSTRAINT member_role_changes_tenant_fk FOREIGN KEY (tenant_id) REFERENCES tenants(id)
);
```

**Hook: `useUpdateMemberRole` (new)**
```typescript
function useUpdateMemberRole(sessionId: string, tenantId: string) {
  const updateRole = async (memberId: string, newRole: TerminalRole, reason?: string) => {
    // 1. Update terminal_session_members
    // 2. Create terminal_member_role_changes entry
    // 3. Log to terminal_activity_log
    // 4. Send notification email if enabled
    return { success: true };
  };
  
  return { updateRole, loading, error };
}
```

**UI Component: `MemberRoleEditor`**
- Inline dropdown in TeamCollaborationPanel member list
- Shows current role + available roles
- Disabled for self-edit (prevent owner removing themselves)
- Confirmation for downgrade (editor → viewer loses access)
- Activity logged immediately

**Changes to TeamCollaborationPanel:**
- Replace "Remove" button with "Edit" menu
- Menu options: Change role, Remove, View activity
- Inline role dropdown for quick changes
- Icon badge showing if member lost/gained permissions

---

## Week 3: Integration & Polish

### Dashboard Consolidation
- Refactor TerminalSessionDashboard to show notification badge counts
- "3 pending approvals" badge on approvals tab
- "2 new team members" badge on team tab
- Real-time badge updates via WebSocket

### Testing
- Unit tests for notification preferences
- Integration tests for WebSocket subscriptions
- E2E tests for export flow (generate → verify signature → download)
- E2E tests for role editing (change → verify activity log)

### Documentation
- Update PHASE6_3_IMPLEMENTATION_SUMMARY.md
- API docs for export endpoint
- Email template customization guide
- WebSocket reconnection troubleshooting

---

## Technical Decisions

### Email Provider
- **Chosen: SendGrid** (most reliable, good compliance)
- Alternatives: AWS SES (cheaper, less reliable), Resend (new, unproven)
- Why: Cost vs. reliability tradeoff for compliance use case

### WebSocket vs. Polling
- **Chosen: WebSocket (Supabase Realtime)**
- Alternatives: Server-Sent Events (SSE), manual polling
- Why: Built-in to Supabase, no additional infrastructure, auto-reconnect

### Export Format
- **Chosen: All three (PDF/CSV/XLSX)**
- PDF: Compliance audits, board reporting
- CSV: Data analysis, custom processing
- XLSX: Excel-native users, pivot tables
- Signature: SHA256 hash in metadata (future: blockchain anchor)

---

## Database Schema Changes

### New Tables (Week 1)
```sql
notification_preferences (users × tenants)
```

### New Tables (Week 2)
```sql
audit_exports (with S3 integration)
terminal_member_role_changes (audit trail)
```

### Trigger Updates
- `terminal_session_members` → emit notifications on INSERT/DELETE
- `terminal_approvals` → emit notifications on status UPDATE
- `terminal_session_members` → log to terminal_activity_log on role UPDATE

### Indexes
- notification_preferences(user_id, tenant_id, created_at)
- audit_exports(tenant_id, audit_id, created_at DESC)
- terminal_member_role_changes(member_id, created_at DESC)

---

## API Endpoints (Edge Functions)

| Function | Trigger | Input | Output |
|----------|---------|-------|--------|
| notify-terminal-event | DB trigger | event data | email sent |
| export-audit | HTTP POST | auditId, format | signed S3 URL |
| update-member-role | HTTP PATCH | memberId, newRole | success + activity |
| get-notifications | HTTP GET | userId, tenantId | list of unread |
| mark-notification-read | HTTP PATCH | notificationId | success |

---

## Performance Targets

| Metric | Target | Current |
|--------|--------|---------|
| Activity update latency | <100ms | 5000ms |
| Email delivery | <5s | N/A |
| PDF export time | <3s | N/A |
| Role update latency | <500ms | N/A |

---

## Rollout Plan

### Week 1
- Monday: Database schema + notification preferences table
- Tuesday: SendGrid integration + email templates
- Wednesday: Notification Edge Function + testing
- Thursday: Real-time WebSocket hooks + ActivityLogPanel refactor
- Friday: ApprovalQueuePanel refactor + WebSocket testing

### Week 2
- Monday: Audit export schema + S3 integration
- Tuesday: PDF export Edge Function + signature
- Wednesday: CSV/XLSX export + AuditExportPanel UI
- Thursday: Role editing schema + useUpdateMemberRole hook
- Friday: MemberRoleEditor UI + integration testing

### Week 3
- Monday: Dashboard consolidation + badge counts
- Tuesday: Comprehensive testing (unit + E2E)
- Wednesday: Documentation + API guides
- Thursday: Performance optimization + edge case handling
- Friday: Final deployment + monitoring setup

---

## Success Metrics

✅ Email notifications sent <5s after events
✅ Activity log updates appear <100ms (real-time)
✅ Audit exports generated <3s
✅ Role edits reflected instantly across all users
✅ 100% of notifications respect user preferences
✅ Zero data loss in WebSocket reconnection
✅ All exports verified with valid signatures
✅ Zero TypeScript errors (strict mode)
✅ Bundle size impact <25 KB gzipped
✅ All Cloudflare deployments successful

---

## Future Enhancements (Phase 6.4+)

- [ ] Approval delegation (assign to backup approver)
- [ ] Two-person rule (2 approvals required for critical actions)
- [ ] Compliance report generation (DSGVO § 32 audit evidence)
- [ ] Activity log archival (S3 + Glacier for long-term retention)
- [ ] Approval SLA tracking (escalate if pending >24h)
- [ ] Blockchain anchoring (immutable proof of approval)
- [ ] Workspace-level analytics dashboard (KPIs across sessions)
- [ ] Custom approval workflows (n8n automation integration)

---

## Compliance & Security

✅ Email delivery is encrypted in transit (TLS)
✅ Notification preferences use multi-tenant isolation (RLS)
✅ WebSocket connections authenticated via Supabase JWT
✅ Export signatures use tenant-specific signing keys
✅ S3 URLs are short-lived (1-day expiry) and signed
✅ All audit trails immutable (no UPDATE/DELETE on audit tables)
✅ GDPR: Export deletion removes S3 objects + database records

---

**Ready to begin Phase 6.3 Week 1: Email Notifications & Real-Time Updates**
