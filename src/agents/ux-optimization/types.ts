// UX Optimization Agent — Type Definitions

export type Severity = 'critical' | 'high' | 'medium' | 'low'
export type Category = 'color-contrast' | 'button-label' | 'accessibility' | 'consistency'
export type Status = 'pass' | 'warn' | 'fail'

export interface UXFinding {
  severity: Severity
  category: Category
  file: string
  line?: number
  title: string
  description: string
  recommendation: string
  auto_fixable: boolean
  details?: Record<string, unknown>
}

export interface ContrastResult {
  foreground: string
  background: string
  ratio: number
  wcagAA: boolean
  wcagAAA: boolean
  status: Status
}

export interface ButtonLabelIssue {
  location: string
  label: string
  issue: 'vague' | 'inconsistent' | 'duplicate'
  recommendation?: string
}

export interface AccessibilityIssue {
  type: 'alt-text' | 'aria-label' | 'heading' | 'color-only' | 'keyboard'
  location: string
  element: string
  issue: string
  recommendation?: string
}

export interface UXAnalysisResult {
  findings: UXFinding[]
  summary: {
    total: number
    by_severity: Record<Severity, number>
    by_category: Record<Category, number>
  }
  recommendations: string[]
  timestamp: string
}

export interface UXCheckOptions {
  check_contrast?: boolean
  check_labels?: boolean
  check_accessibility?: boolean
  wcag_aa_required?: boolean
  color_contrast_ratio_min?: number
}
