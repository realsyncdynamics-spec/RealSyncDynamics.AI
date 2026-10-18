export type McAgentStatus = 'pending' | 'running' | 'waiting' | 'idle' | 'completed' | 'failed' | 'killed' | 'unbekannt'

export type McAgent = {
  id: string
  description: string
  type: string
  status: McAgentStatus
  startedAt: number
  endedAt?: number
  tools: number
  lastTool?: string
  isBackground: boolean
}

export type McTaskStatus = 'pending' | 'in_progress' | 'completed'

export type McTask = {
  id: string
  subject: string
  status: McTaskStatus
  blockedBy: string[]
  source: 'task' | 'todo'
}

export type McFile = {
  path: string
  reads: number
  edits: number
  isCreated: boolean
  isDeleted: boolean
  lastAt: number
}

export type McReading = {
  at: number
  tokens: number
  window: number
  percent: number
  costUsd?: number
  input?: number
  output?: number
  cacheRead?: number
  cacheWrite?: number
}

export type McCheckKind = 'test' | 'build' | 'lint' | 'typecheck'

export type McCheck = {
  command: string
  kind: McCheckKind
  isOk: boolean
  at: number
}

export type McChange = { code: string; path: string }

export type McGit = {
  at: number
  isOk: boolean
  error?: string
  branch?: string
  head?: string
  upstream?: string
  ahead?: number
  behind?: number
  changes: McChange[]
}

export type McPrCheck = { name: string; state: string }

export type McPr = {
  number: number
  title: string
  branch: string
  isDraft: boolean
  mergeable: string
  review: string
  url: string
  sha: string
  labels: string[]
  checks: McPrCheck[]
}

export type McIssue = { number: number; title: string }

export type McGithub = {
  at: number
  isOk: boolean
  error?: string
  repo: string
  current: McPr | null
  open: McPr[]
  p0: McIssue[] | null
  p1: McIssue[] | null
}

export type McDecision = 'wartet' | 'freigegeben' | 'abgebrochen' | 'protokolliert'

export type McSafetyEvent = {
  id: string
  at: number
  tool: string
  command: string
  category: string
  label: string
  summary: string
  lines: string[]
  decision: McDecision
}

export type McTurn = {
  prompt: string
  startedAt: number
  reads: number
  edits: number
}

export type McView = 'overview' | 'agents' | 'files' | 'context' | 'github' | 'safety' | 'diff'

export type McDiff = { path: string; source: string; note?: string } | null

declare module 'claude-code' {
  interface PluginState {
    'realsync-mission-control': {
      agents: McAgent[]
      tasks: McTask[]
      files: McFile[]
      readings: McReading[]
      checks: McCheck[]
      git: McGit | null
      github: McGithub | null
      safety: McSafetyEvent[]
      turn: McTurn | null
      view: McView
      diff: McDiff
    }
  }
}
