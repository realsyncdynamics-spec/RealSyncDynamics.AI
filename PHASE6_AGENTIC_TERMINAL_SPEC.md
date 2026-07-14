# Phase 6: Agentic Terminal Booking Experience

**Status**: Specification (Ready for Implementation)  
**Priority**: High – Core Platform-First MVP Differentiator  
**Timeline**: Weeks 1-3 (parallel with Phase 5 deployment)  
**Branch**: `claude/phase6-agentic-terminal`

---

## Overview

Phase 6 transforms user registration and package booking from isolated form workflows into **live events within the Governance Runtime terminal**. The terminal becomes the sales channel, compliance engine, and onboarding interface simultaneously.

### Core Principle
> **Everything is an event. Every user action in the terminal generates a cryptographically-sealed event in the Evidence Chain.**

---

## Terminal Command Specification

### 1. `/scan <URL>`
**Initiator**: User on landing page or existing dashboard  
**Flow**:
```
T+00s INPUT  /scan https://example.com
T+00.5s SC   🔍 Initializing Scanner at EU-Frankfurt Edge
T+01s SC     Header-Check: X-OpenAI-Beta detected
T+01.5s DR   🕵️ Drift Detection: 3 third-party trackers
T+02s AI     🤖 AI-System Classification: 5 high-risk endpoints found
T+02.5s RISK ⚠️ CRITICAL: openai/gpt-4o without DPA
T+03s EV     ✓ Evidence sealed: SHA256:abc123...
T+03.2s OUT  ➤ SUMMARY: 17 compliance gaps detected

┌─ TRIAGE AGENT ─────────────────────┐
│ I found 17 AI-systems & 3 trackers. │
│ Your site needs GROWTH tier access  │
│ to auto-register these systems.     │
│ Type /upgrade to unlock.            │
└────────────────────────────────────┘
```

**Agent Decision Tree**:
- If free_tier + findings < 5 → `/audit` recommendation
- If free_tier + findings 5-10 → `/upgrade to Starter` nudge
- If free_tier + findings > 10 → `/upgrade to Growth` strong push
- If paid + findings > limit → `/upgrade to next tier` upsell

**Events Generated**:
```typescript
event('scan.initiated', {
  url: string,
  tier: UserTier,
  region: 'eu-frankfurt' | 'us-east' | 'ap-southeast',
  timestamp: ISO8601,
  scanId: UUID,
});

event('scan.completed', {
  scanId: UUID,
  findingsCount: number,
  riskLevel: 'critical' | 'high' | 'medium' | 'low',
  systemsClassified: number,
  evidenceHash: SHA256,
  recommendedTier: 'starter' | 'growth' | 'agency' | 'scale',
});
```

---

### 2. `/upgrade <TIER>`
**Initiator**: Agent recommendation or direct user command  
**Precondition**: User must be authenticated OR `/register` flow active  
**Flow**:
```
T+00s INPUT  /upgrade growth
T+00.5s BK   💳 Loading GROWTH package (€249/mo)
T+01s BK     Features: 50 scans/mo, AI-Classification, Custom Frameworks
T+01.5s BK   ✓ Checkout link: https://checkout.realsync.ai/growth-2024-07

┌─ PAYMENT AGENT ────────────────────┐
│ Click the link to complete payment. │
│ Or type /pay <email> for invoice.   │
│ Your 14-day trial starts now.       │
└────────────────────────────────────┘

T+02s EV     ✓ Event sealed: SHA256:xyz789...
```

**Payment Flow**:
- User clicks Stripe checkout link → returns with session ID
- Terminal detects session completion → `subscription.activated` event
- Evidence-Agent seals transaction immediately
- Dashboard updates in real-time

**Events Generated**:
```typescript
event('subscription.upgrade_initiated', {
  userId: UUID,
  fromTier: 'free_tier' | 'starter' | 'growth' | ...,
  toTier: 'starter' | 'growth' | 'agency' | ...,
  planKey: string,
  checkoutUrl: string,
  expiresAt: ISO8601, // link validity 15 min
});

event('subscription.activated', {
  userId: UUID,
  tier: string,
  validFrom: ISO8601,
  validUntil: ISO8601,
  seatsIncluded: number,
  evidenceHash: SHA256,
});
```

---

### 3. `/audit <SCANID>`
**Initiator**: User or Triage-Agent (automatic on free tier)  
**Prerequisites**: Must have `scan.completed` event with findings  
**Flow**:
```
T+00s INPUT  /audit scan_abc123
T+00.5s AD   📋 Generating Compliance Audit (Free)
T+01s AD     ✓ Evidence-Chain: 5 items sealed
T+02s AD     ✓ Audit PDF generated: audit_abc123.pdf
T+02.5s OUT  Download: https://evidence.realsync.ai/audit_abc123.pdf

┌─ AUDIT AGENT ──────────────────────┐
│ Your free audit expires in 7 days.  │
│ Upgrade to STARTER to get yearly    │
│ compliance reports automatically.   │
│ Type /upgrade starter              │
└────────────────────────────────────┘
```

**Free Audit Limitations**:
- Max 1 audit per 7 days
- No historical tracking
- Basic PDF only (no DOCX/XLSX)
- Expires after 30 days
- Evidence not anchored to blockchain

**Paid Audit Features**:
- Unlimited audits
- Multi-format export (PDF, DOCX, XLSX)
- 2-year retention
- Evidence blockchain anchoring
- Scheduled delivery (daily/weekly/monthly)

**Events Generated**:
```typescript
event('audit.generated', {
  scanId: UUID,
  auditId: UUID,
  format: 'pdf' | 'docx' | 'xlsx',
  fileSize: number,
  frameworks: string[],
  controls: number,
  evidenceCount: number,
  expiresAt: ISO8601,
});
```

---

### 4. `/register [EMAIL]`
**Initiator**: First-time user OR agent nudge post-scan  
**Context**: Can be invoked from scan/audit flow without leaving terminal  
**Flow**:
```
T+00s INPUT  /register (or just press Enter after /scan)
T+00.5s REG  📧 What's your email?
T+01s INPUT  user@company.com
T+01.5s REG  🔐 Sending verification link...
T+02s OUT    Check your inbox for verification link

[User clicks link → OAuth flow]

T+03s REG    ✓ Account created: user@company.com
T+03.2s REG  ✓ Free tier activated (3 scans/month)
T+03.5s EV   ✓ Account event sealed: SHA256:def456...

┌─ ONBOARDING AGENT ─────────────────┐
│ Welcome! Your first scan is free.   │
│ Type /scan <url> to start, or       │
│ /upgrade to skip the 3-scan limit.  │
└────────────────────────────────────┘
```

**Registration Events**:
```typescript
event('account.created', {
  userId: UUID,
  email: string,
  tier: 'free_tier',
  verificationToken: string,
  verifiedAt: null,
  evidenceHash: SHA256,
});

event('email.verified', {
  userId: UUID,
  email: string,
  verifiedAt: ISO8601,
  evidenceHash: SHA256,
});
```

---

### 5. `/pay <TIER>` (Alternative: Direct Invoice)
**Initiator**: User who prefers invoice/wire transfer  
**Flow**:
```
T+00s INPUT  /pay growth
T+00.5s BK   📨 Sending invoice to billing@company.com
T+01s BK     Invoice#: INV-2024-001-GROWTH
T+01.5s BK   Amount: €249.00 (first month)
T+02s BK     Due: 7 days from now
T+02.5s OUT  IBAN transfer details included in email

T+03s EV     ✓ Invoice event logged: SHA256:ghi789...
```

**Invoice Workflow**:
- Generates PDF invoice via Edge Function
- Sends via SendGrid to customer email
- Creates unpaid subscription (valid after payment received)
- Payment confirmation triggers `subscription.activated` event

---

### 6. `/help` & `/status`
**Quick Commands**:
- `/help` → Display all available commands & syntax
- `/status` → Show current account status, tier, remaining scans
- `/history` → Show last 5 scans & audits

---

## Agent Decision Architecture

### Triage Agent (Post-Scan)
**Responsibility**: Analyze findings → recommend action  
**Logic Tree**:

```
IF findings.count < 5:
  → Recommend: AUDIT (free) + STARTER upgrade
ELSE IF findings.count 5-10:
  → Recommend: GROWTH tier
ELSE IF findings.count 10-20:
  → Recommend: GROWTH + Custom Frameworks
ELSE:
  → Recommend: AGENCY tier + dedicated support

IF findings.riskLevel == 'critical':
  → Add urgency: "Compliance breach detected. Immediate action needed."

IF user.tier == 'free_tier' AND findings.count > user.scanLimit:
  → "You've used your free scans. /upgrade to continue."
```

### Payment Agent (On `/upgrade`)
**Responsibility**: Process payments, handle edge cases  
**Actions**:
- Create Stripe checkout session (15-min link validity)
- Poll for session completion
- On success → trigger `subscription.activated` event
- On failure → retry with `/pay` fallback (invoice)
- Timeout (no payment) → suggest `/pay` invoice option

### Audit Agent (On `/audit`)
**Responsibility**: Generate compliance reports  
**Actions**:
- Check tier permissions (free = 1/week, paid = unlimited)
- Aggregate frameworks + controls from findings
- Generate PDF (free) or multi-format (paid)
- Seal to Evidence-Chain with SHA256
- Serve download link with 30-day expiry (free) or persistent (paid)

---

## Database Schema Extensions

### New Tables

#### `terminal_sessions`
```sql
CREATE TABLE terminal_sessions (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id),
  tenant_id UUID NOT NULL,
  created_at TIMESTAMP DEFAULT now(),
  last_command_at TIMESTAMP,
  command_count INTEGER DEFAULT 0,
  current_context JSONB, -- e.g., { scanId: 'abc123', pendingUpgrade: true }
  is_active BOOLEAN DEFAULT true,
  FOREIGN KEY (tenant_id) REFERENCES tenants(id),
  CONSTRAINT rls_tenant_check CHECK (tenant_id IS NOT NULL)
);

-- RLS: Enable. Policy: tenant_id = auth.user_tenant_id()
```

#### `terminal_commands`
```sql
CREATE TABLE terminal_commands (
  id UUID PRIMARY KEY,
  session_id UUID NOT NULL REFERENCES terminal_sessions(id),
  user_id UUID NOT NULL REFERENCES auth.users(id),
  tenant_id UUID NOT NULL,
  command TEXT NOT NULL, -- e.g., '/scan https://example.com'
  parsed_command JSONB, -- { type: 'scan', args: { url: '...' } }
  status 'pending' | 'executing' | 'success' | 'error',
  result JSONB, -- Agent response + any events
  error_message TEXT,
  executed_at TIMESTAMP,
  FOREIGN KEY (tenant_id) REFERENCES tenants(id)
);

-- RLS: Enable. Policy: tenant_id = auth.user_tenant_id()
```

#### `terminal_events`
```sql
-- Links terminal events to the Evidence-Chain
CREATE TABLE terminal_events (
  id UUID PRIMARY KEY,
  terminal_command_id UUID REFERENCES terminal_commands(id),
  event_type TEXT NOT NULL, -- e.g., 'subscription.activated'
  event_payload JSONB NOT NULL,
  event_hash SHA256 NOT NULL, -- Cryptographic seal
  created_at TIMESTAMP DEFAULT now(),
  FOREIGN KEY (tenant_id) REFERENCES tenants(id)
);

-- RLS: Enable. Policy: tenant_id = auth.user_tenant_id()
```

---

## React Hook: `useAgenticTerminal`

```typescript
export function useAgenticTerminal() {
  const { activeTenantId } = useTenant();
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<TerminalMessage[]>([]);
  const [isExecuting, setIsExecuting] = useState(false);

  const executeCommand = useCallback(
    async (command: string): Promise<void> => {
      // 1. Parse command (/scan, /upgrade, etc.)
      const parsed = parseCommand(command);

      // 2. Create terminal_command entry
      const cmdId = await createTerminalCommand(sessionId, command, parsed);

      // 3. Invoke appropriate agent (Triage, Payment, Audit, etc.)
      const agentResponse = await invokeAgent(parsed.type, parsed.args);

      // 4. Log result + any generated events
      await logTerminalCommandResult(cmdId, agentResponse);

      // 5. Update local messages + evidence chain
      setMessages([...messages, { role: 'user', content: command }, ...agentResponse.messages]);
    },
    [sessionId, messages, activeTenantId]
  );

  return {
    sessionId,
    messages,
    isExecuting,
    executeCommand,
    status: /* account status */,
  };
}
```

---

## UI: Terminal Component

### `TerminalInterface.tsx`

**Layout**:
```
┌──────────────────────────────────────────┐
│ RealSync Governance Runtime (Beta)       │
│ EU-Frankfurt · Session: sess_abc123      │
├──────────────────────────────────────────┤
│ [Previous messages + agent responses]    │
│                                          │
│ T+03.5s EV   ✓ Account event sealed...   │
│                                          │
│ Type /help for commands.                 │
├──────────────────────────────────────────┤
│ ❯ /scan [CURSOR HERE]                    │
└──────────────────────────────────────────┘
```

**Features**:
- Command auto-completion (Ctrl+Space)
- Color-coded output (events, errors, info)
- Live streaming of agent responses (simulated via setTimeout)
- Copy-to-clipboard for links & hashes
- Dark theme (Obsidian/Titanium palette)
- Responsive to mobile (reduced font size)

---

## Integration Points

### Landing Page
- "Run Scan" button → Opens terminal in modal/fullscreen
- Terminal handles everything from /scan through /upgrade
- No redirect to separate forms

### Dashboard
- `/app/terminal` route for existing users
- Terminal sidebar panel (minimize/maximize)
- Terminal session persistence across page navigations

### Stripe Checkout
- Checkout session ID passed to terminal
- Terminal polls Stripe API for payment status
- On success → `subscription.activated` event + auto-refresh dashboard

---

## Security Considerations

### Command Injection Prevention
- Whitelist allowed commands: `/scan`, `/upgrade`, `/audit`, `/register`, `/pay`, `/help`, `/status`, `/history`
- Parse arguments strictly (URL validation, email regex, UUID format)
- No shell execution – commands are enum-based

### Event Sealing
- Every event generating command triggers Evidence-Chain entry
- SHA256 hash computed on server (not client)
- Hash linked to user ID + tenant ID + timestamp
- Immutable audit trail

### Payment Security
- `/upgrade` does NOT process payment directly
- Links to Stripe-hosted checkout (PCI DSS compliance)
- Session validation via Stripe API before `subscription.activated` event
- Invoice generation via Edge Function (never expose API keys to client)

---

## Rollout Strategy

### Week 1: Terminal Core
- [ ] Implement `useAgenticTerminal` hook
- [ ] Build `TerminalInterface` UI component
- [ ] Implement command parser + whitelist
- [ ] Connect to Supabase tables (terminal_sessions, terminal_commands)

### Week 2: Agent Integration
- [ ] Triage Agent (post-scan recommendations)
- [ ] Payment Agent (Stripe checkout + invoice fallback)
- [ ] Audit Agent (PDF generation)
- [ ] Evidence-Chain sealing

### Week 3: Landing Page + Dashboard Integration
- [ ] Replace "Run Scan" → Terminal modal
- [ ] Dashboard `/app/terminal` route
- [ ] Session persistence
- [ ] Mobile responsiveness
- [ ] QA + security audit

---

## Success Metrics

| Metric | Target |
|--------|--------|
| Terminal usage (% of users reaching `/scan` phase) | > 60% |
| Conversion to paid (from terminal upgrade nudge) | > 15% |
| Average session duration | > 2 minutes |
| Command completion rate (no errors) | > 90% |
| Perceived speed (T+03s to first audit) | Consistent < 3s |

---

## Future Enhancements

### Phase 6.2: Multi-Tenant Terminal
- Team collaboration in same terminal session
- Shared scan results + recommendations
- Audit approval workflows (`/approve <auditId>`)

### Phase 6.3: Terminal Webhooks
- Integrate with Slack (`/notify-slack`)
- Email alerts for critical findings
- Zapier/IFTTT integration

### Phase 6.4: Advanced Queries
- `/report <framework>` – Generate framework-specific report
- `/compare <scanId1> <scanId2>` – Diff two scans
- `/export <format>` – Bulk export compliance data

---

**Document Version**: 1.0  
**Last Updated**: 2026-07-07  
**Approvals**: Pending Implementation Review
