// Button Label Analyzer — Consistency & Clarity Checks

import { ButtonLabelIssue } from './types'

export const BUTTON_LABEL_CONFIG = {
  preferred: [
    'Create',
    'Edit',
    'Delete',
    'Save',
    'Cancel',
    'Close',
    'Add',
    'Remove',
    'Submit',
    'Search',
    'Filter',
    'Export',
    'Import',
    'Download',
    'Upload',
    'Send',
    'Reply',
    'Confirm',
    'Approve',
    'Reject',
    'Next',
    'Back',
    'Finish'
  ],
  deprecated: [
    'OK',
    'Yes',
    'No',
    'Click',
    'Click Here',
    'Here',
    'Link',
    'More',
    'Read More',
    'Continue',
    'Do It',
    'Go',
    'Submit Form'
  ],
  actionVerbs: [
    'Add',
    'Create',
    'Edit',
    'Delete',
    'Save',
    'Cancel',
    'Close',
    'Remove',
    'Export',
    'Import',
    'Download',
    'Upload',
    'Send',
    'Reply',
    'Confirm',
    'Approve',
    'Reject',
    'Search',
    'Filter'
  ]
}

export interface ButtonLabelAnalysis {
  label: string
  vague: boolean
  deprecated: boolean
  hasActionVerb: boolean
  recommended?: string
}

export function analyzeButtonLabel(label: string): ButtonLabelAnalysis {
  const trimmed = label.trim()
  const isVague =
    /^(ok|yes|no|click|click here|submit|continue|go|do it|here)$/i.test(trimmed) ||
    trimmed.length < 2

  const isDeprecated = BUTTON_LABEL_CONFIG.deprecated.some((d) =>
    d.toLowerCase() === trimmed.toLowerCase()
  )

  const hasActionVerb = BUTTON_LABEL_CONFIG.actionVerbs.some((v) =>
    trimmed.toLowerCase().startsWith(v.toLowerCase())
  )

  let recommended: string | undefined
  if (isVague) {
    // Suggest a more specific label
    if (trimmed.toLowerCase() === 'ok' || trimmed.toLowerCase() === 'submit') {
      recommended = 'Use specific action: "Save", "Confirm", "Send", etc.'
    } else if (trimmed.toLowerCase() === 'click' || trimmed.toLowerCase() === 'click here') {
      recommended = 'Describe what happens: "Edit Profile", "View Details", etc.'
    } else if (trimmed.toLowerCase() === 'continue') {
      recommended = 'Be specific: "Next Step", "Proceed to Checkout", etc.'
    }
  }

  return {
    label: trimmed,
    vague: isVague,
    deprecated: isDeprecated,
    hasActionVerb,
    recommended
  }
}

export interface DuplicateLabelCluster {
  label: string
  count: number
  locations: Array<{ file: string; line?: number }>
  issue: string
}

export function detectDuplicateLabels(
  buttons: Array<{ label: string; location: string; file: string; line?: number }>
): DuplicateLabelCluster[] {
  const grouped = new Map<string, typeof buttons>()

  for (const btn of buttons) {
    const key = btn.label.toLowerCase()
    if (!grouped.has(key)) {
      grouped.set(key, [])
    }
    grouped.get(key)!.push(btn)
  }

  return Array.from(grouped.entries())
    .filter(([_, btns]) => btns.length > 1)
    .map(([label, btns]) => ({
      label,
      count: btns.length,
      locations: btns.map((b) => ({ file: b.file, line: b.line })),
      issue: `Button label "${label}" used ${btns.length} times. Are all occurrences doing the same thing?`
    }))
}

export function validateButtonLabels(
  buttons: Array<{ label: string; location: string; file: string; line?: number }>
): ButtonLabelIssue[] {
  const issues: ButtonLabelIssue[] = []

  // Check each button
  for (const btn of buttons) {
    const analysis = analyzeButtonLabel(btn.label)

    if (analysis.vague) {
      issues.push({
        location: btn.location,
        label: btn.label,
        issue: 'vague',
        recommendation: analysis.recommended
      })
    }

    if (analysis.deprecated) {
      issues.push({
        location: btn.location,
        label: btn.label,
        issue: 'inconsistent',
        recommendation: `"${btn.label}" is deprecated. Use action verbs instead (Create, Save, Delete, etc.)`
      })
    }
  }

  // Check for duplicates
  const duplicates = detectDuplicateLabels(buttons)
  for (const dup of duplicates) {
    for (const loc of dup.locations) {
      issues.push({
        location: `${loc.file}:${loc.line || '?'}`,
        label: dup.label,
        issue: 'duplicate',
        recommendation: `"${dup.label}" used ${dup.count} times. Verify consistency or consolidate.`
      })
    }
  }

  return issues
}
