// Platform Intelligence Orchestrator — Master Coordinator
// Coordinates 5 sub-agents, aggregates findings, creates GitHub issues, posts to Slack

import { serve } from 'https://deno.land/std@0.208.0/http/server.ts'

interface Finding {
  agent: string
  severity: 'critical' | 'high' | 'medium' | 'low'
  category: string
  file: string
  line?: number
  title: string
  description: string
  recommendation: string
  auto_fixable: boolean
}

interface OrchestratorResult {
  timestamp: string
  total_findings: number
  findings_by_severity: Record<string, number>
  findings_by_agent: Record<string, number>
  auto_fixed: number
  manual_review: number
  github_issues_created: number
  slack_posted: boolean
  status: 'success' | 'failure'
}

// Sample analysis functions (to be populated by sub-agents)
async function analyzeUX(): Promise<Finding[]> {
  // Placeholder: UX Optimization Agent
  // In Phase 2a, this calls src/agents/ux-optimization/index.ts
  return [
    {
      agent: 'UX Optimization',
      severity: 'high',
      category: 'Color Contrast',
      file: 'src/components/Button.tsx',
      line: 42,
      title: 'Button text fails WCAG AA contrast',
      description: 'Text color #666666 on background #f5f5f5 has ratio 3.2:1 (needs 4.5:1)',
      recommendation: 'Use #333333 (text) on #f5f5f5 (background) for 7.1:1 ratio',
      auto_fixable: true
    },
    {
      agent: 'UX Optimization',
      severity: 'medium',
      category: 'Button Labels',
      file: 'src/components/Dialog.tsx',
      line: 18,
      title: 'Vague button label "OK"',
      description: 'Button labeled "OK" is non-specific. Context suggests "Confirm Delete".',
      recommendation: 'Change label to "Confirm Delete" or "Cancel"',
      auto_fixable: true
    }
  ]
}

async function analyzeJourney(): Promise<Finding[]> {
  // Placeholder: Customer Journey Agent (Phase 2b)
  return []
}

async function analyzeDashboard(): Promise<Finding[]> {
  // Placeholder: Dashboard Evolution Agent (Phase 2c)
  return []
}

async function analyzeRouting(): Promise<Finding[]> {
  // Placeholder: Routing Quality Agent (Phase 2d)
  return []
}

async function analyzeStripe(): Promise<Finding[]> {
  // Placeholder: Stripe Business Agent (Phase 2e)
  return []
}

async function deduplicateFindings(findings: Finding[]): Promise<Finding[]> {
  // Group by (file, rule category) and keep highest severity
  const grouped = new Map<string, Finding>()

  for (const f of findings) {
    const key = `${f.file}:${f.category}`
    const existing = grouped.get(key)

    if (!existing || severityRank(f.severity) > severityRank(existing.severity)) {
      grouped.set(key, f)
    }
  }

  return Array.from(grouped.values()).sort((a, b) =>
    severityRank(b.severity) - severityRank(a.severity)
  )
}

function severityRank(sev: string): number {
  const ranks: Record<string, number> = { critical: 4, high: 3, medium: 2, low: 1 }
  return ranks[sev] || 0
}

async function createGitHubIssues(findings: Finding[]): Promise<number> {
  // Placeholder: Create GitHub issues for high+critical findings
  // Real implementation calls GitHub API via environment variables

  const critical_and_high = findings.filter(f =>
    f.severity === 'critical' || f.severity === 'high'
  )

  console.log(`Would create ${critical_and_high.length} GitHub issues:`)
  for (const f of critical_and_high) {
    console.log(`  [${f.severity.toUpperCase()}] ${f.title} (${f.file}:${f.line})`)
  }

  return critical_and_high.length
}

async function postToSlack(result: OrchestratorResult): Promise<boolean> {
  // Placeholder: Post summary to Slack #platform-evolution
  // Real implementation calls Slack API via SLACK_WEBHOOK_URL

  const message = `
:robot: Platform Intelligence Report — ${result.timestamp}

Total findings: ${result.total_findings}
• Critical: ${result.findings_by_severity['critical'] || 0}
• High: ${result.findings_by_severity['high'] || 0}
• Medium: ${result.findings_by_severity['medium'] || 0}
• Low: ${result.findings_by_severity['low'] || 0}

Auto-fixed: ${result.auto_fixed}
Manual review: ${result.manual_review}
GitHub issues: ${result.github_issues_created}
  `.trim()

  console.log('Slack message preview:')
  console.log(message)

  return true
}

async function applyAutoFixes(findings: Finding[]): Promise<number> {
  // Placeholder: Apply auto-fixable findings
  // Real implementation modifies files and commits to git

  const autofixable = findings.filter(f => f.auto_fixable)

  console.log(`Would apply ${autofixable.length} auto-fixes:`)
  for (const f of autofixable) {
    console.log(`  - ${f.file}:${f.line} (${f.category})`)
  }

  return autofixable.length
}

// Main orchestrator function
async function orchestrate(): Promise<OrchestratorResult> {
  const timestamp = new Date().toISOString()

  console.log(`[${timestamp}] Platform Intelligence Orchestrator starting...`)

  // Step 1: Run all sub-agents in parallel
  const [ux, journey, dashboard, routing, stripe] = await Promise.all([
    analyzeUX(),
    analyzeJourney(),
    analyzeDashboard(),
    analyzeRouting(),
    analyzeStripe()
  ])

  let allFindings = [...ux, ...journey, ...dashboard, ...routing, ...stripe]
  console.log(`Collected ${allFindings.length} findings from all agents`)

  // Step 2: Deduplicate
  allFindings = await deduplicateFindings(allFindings)
  console.log(`After deduplication: ${allFindings.length} findings`)

  // Step 3: Create GitHub issues
  const issuesCreated = await createGitHubIssues(allFindings)

  // Step 4: Post to Slack
  const slackPosted = await postToSlack({
    timestamp,
    total_findings: allFindings.length,
    findings_by_severity: {
      critical: allFindings.filter(f => f.severity === 'critical').length,
      high: allFindings.filter(f => f.severity === 'high').length,
      medium: allFindings.filter(f => f.severity === 'medium').length,
      low: allFindings.filter(f => f.severity === 'low').length
    },
    findings_by_agent: {
      ux: ux.length,
      journey: journey.length,
      dashboard: dashboard.length,
      routing: routing.length,
      stripe: stripe.length
    },
    auto_fixed: 0,  // Updated after auto-fixes
    manual_review: allFindings.filter(f => !f.auto_fixable).length,
    github_issues_created: issuesCreated,
    slack_posted: slackPosted,
    status: 'success'
  })

  // Step 5: Apply auto-fixes
  const autoFixed = await applyAutoFixes(allFindings)

  const result: OrchestratorResult = {
    timestamp,
    total_findings: allFindings.length,
    findings_by_severity: {
      critical: allFindings.filter(f => f.severity === 'critical').length,
      high: allFindings.filter(f => f.severity === 'high').length,
      medium: allFindings.filter(f => f.severity === 'medium').length,
      low: allFindings.filter(f => f.severity === 'low').length
    },
    findings_by_agent: {
      ux: ux.length,
      journey: journey.length,
      dashboard: dashboard.length,
      routing: routing.length,
      stripe: stripe.length
    },
    auto_fixed: autoFixed,
    manual_review: allFindings.filter(f => !f.auto_fixable).length,
    github_issues_created: issuesCreated,
    slack_posted: slackPosted,
    status: 'success'
  }

  console.log(`[${timestamp}] Orchestrator complete:`, result)
  return result
}

serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 })
  }

  try {
    const result = await orchestrate()
    return new Response(JSON.stringify(result), {
      headers: { 'Content-Type': 'application/json' }
    })
  } catch (error) {
    console.error('Orchestrator error:', error)
    return new Response(JSON.stringify({ status: 'failure', error: String(error) }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }
})
