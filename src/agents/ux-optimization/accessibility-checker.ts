// Accessibility Checker — WCAG 2.1 Level A + AA Compliance

import { AccessibilityIssue, UXFinding } from './types'

export const WCAG_CHECKLIST = {
  level_a: [
    '1.1.1 Non-text Content (alt-text for images)',
    '1.4.1 Use of Color (not sole means of conveying info)',
    '2.1.1 Keyboard (all functionality available via keyboard)',
    '2.4.1 Bypass Blocks (skip links)',
    '3.1.1 Language of Page (lang attribute)',
    '4.1.1 Parsing (valid HTML)'
  ],
  level_aa: [
    '1.4.3 Contrast (Minimum) (4.5:1 for normal text)',
    '1.4.5 Images of Text (avoid)',
    '2.4.3 Focus Order (logical tab order)',
    '2.4.7 Focus Visible (visible focus indicator)',
    '3.2.1 On Focus (no unexpected context changes)',
    '3.3.1 Error Identification (describe what went wrong)',
    '3.3.4 Error Prevention (confirmation for legal/financial)',
    '4.1.2 Name, Role, Value (ARIA labels)'
  ]
}

export interface ImageAltCheck {
  location: string
  src: string
  alt?: string
  passes: boolean
  recommendation?: string
}

export function checkImageAltText(
  images: Array<{ src: string; alt?: string; location: string }>
): ImageAltCheck[] {
  return images.map((img) => {
    const isDecorative = img.src.includes('icon') || img.src.includes('decoration')
    const hasAlt = img.alt !== undefined && img.alt !== null
    const altLength = img.alt?.length || 0

    let passes = false
    let recommendation: string | undefined

    if (!hasAlt) {
      passes = false
      recommendation = `Add alt text: ${isDecorative ? 'alt=""' : 'alt="Descriptive text about image"'}`
    } else if (isDecorative && altLength > 0) {
      passes = false
      recommendation = 'Decorative image should have alt="" (empty) instead of descriptive text'
    } else if (!isDecorative && altLength === 0) {
      passes = false
      recommendation = 'Content image needs descriptive alt text (not empty)'
    } else if (altLength < 5 && !isDecorative) {
      passes = false
      recommendation = 'Alt text too short. Provide descriptive text about image content.'
    } else {
      passes = true
    }

    return {
      location: img.location,
      src: img.src,
      alt: img.alt,
      passes,
      recommendation: passes ? undefined : recommendation
    }
  })
}

export interface AriaLabelCheck {
  location: string
  type: string
  text?: string
  ariaLabel?: string
  passes: boolean
  recommendation?: string
}

export function checkAriaLabels(
  elements: Array<{ type: 'button' | 'icon' | 'link'; text?: string; ariaLabel?: string; location: string }>
): AriaLabelCheck[] {
  return elements.map((el) => {
    const hasVisibleText = el.text && el.text.trim().length > 0
    const hasAriaLabel = el.ariaLabel && el.ariaLabel.trim().length > 0

    let passes = true
    let recommendation: string | undefined

    if (el.type === 'button' || el.type === 'icon') {
      if (!hasVisibleText && !hasAriaLabel) {
        passes = false
        recommendation = `Icon-only button needs aria-label="${el.type} name"`
      }
    } else if (el.type === 'link') {
      if (!hasVisibleText && !hasAriaLabel) {
        passes = false
        recommendation = 'Link without visible text needs aria-label'
      }
    }

    return {
      location: el.location,
      type: el.type,
      text: el.text,
      ariaLabel: el.ariaLabel,
      passes,
      recommendation
    }
  })
}

export interface HeadingCheck {
  location: string
  level: number
  text: string
  passes: boolean
  expectedLevel?: number
}

export function checkHeadingHierarchy(headings: Array<{ level: number; text: string; location: string }>): HeadingCheck[] {
  const checks: HeadingCheck[] = []

  // Should start with h1
  if (headings.length > 0 && headings[0].level !== 1) {
    checks.push({
      location: headings[0].location,
      level: headings[0].level,
      text: headings[0].text,
      passes: false,
      expectedLevel: 1
    })
  }

  // No skipping levels (h1 → h3 is bad, should be h1 → h2)
  for (let i = 1; i < headings.length; i++) {
    const prev = headings[i - 1]
    const curr = headings[i]
    const levelDiff = curr.level - prev.level

    if (levelDiff > 1) {
      checks.push({
        location: curr.location,
        level: curr.level,
        text: curr.text,
        passes: false,
        expectedLevel: prev.level + 1
      })
    } else {
      checks.push({
        location: curr.location,
        level: curr.level,
        text: curr.text,
        passes: true
      })
    }
  }

  return checks
}

export interface ColorIndicatorCheck {
  location: string
  element: string
  passes: boolean
  recommendation?: string
}

export function checkColorOnlyIndicators(
  elements: Array<{ type: 'status' | 'indicator'; hasShape?: boolean; hasLabel?: boolean; location: string }>
): ColorIndicatorCheck[] {
  return elements.map((el) => {
    const passes = el.hasShape || el.hasLabel

    return {
      location: el.location,
      element: el.type,
      passes,
      recommendation: !passes ? 'Status/indicator must have shape or text, not just color' : undefined
    }
  })
}

export interface KeyboardNavCheck {
  location: string
  element: string
  passes: boolean
  recommendation?: string
}

export function checkKeyboardNavigation(
  elements: Array<{ interactive: boolean; tabIndex?: number; location: string; type: string }>
): KeyboardNavCheck[] {
  return elements.map((el) => {
    let passes = true
    let recommendation: string | undefined

    if (el.interactive) {
      if (el.tabIndex === undefined || el.tabIndex === null) {
        // OK for native buttons/links
        if (!['button', 'a', 'input'].includes(el.type.toLowerCase())) {
          passes = false
          recommendation = `Interactive element needs tabIndex="0"`
        }
      } else if (el.tabIndex < 0 && el.interactive) {
        passes = false
        recommendation = 'Interactive element has negative tabIndex (not keyboard accessible)'
      }
    }

    return {
      location: el.location,
      element: el.type,
      passes,
      recommendation
    }
  })
}

export function convertAccessibilityToFindings(
  altTextIssues: ImageAltCheck[],
  ariaIssues: AriaLabelCheck[],
  headingIssues: HeadingCheck[],
  colorIssues: ColorIndicatorCheck[],
  keyboardIssues: KeyboardNavCheck[]
): UXFinding[] {
  const findings: UXFinding[] = []

  // Alt-text findings
  for (const issue of altTextIssues) {
    if (!issue.passes) {
      findings.push({
        severity: 'high',
        category: 'accessibility',
        file: issue.location.split(':')[0],
        line: parseInt(issue.location.split(':')[1]),
        title: `Missing or incorrect alt-text for image`,
        description: `Image: ${issue.src}`,
        recommendation: issue.recommendation || '',
        auto_fixable: true
      })
    }
  }

  // ARIA findings
  for (const issue of ariaIssues) {
    if (!issue.passes) {
      findings.push({
        severity: 'high',
        category: 'accessibility',
        file: issue.location.split(':')[0],
        line: parseInt(issue.location.split(':')[1]),
        title: `Missing aria-label on ${issue.type}`,
        description: `${issue.type} has no visible text and no aria-label`,
        recommendation: issue.recommendation || '',
        auto_fixable: true
      })
    }
  }

  // Heading findings
  for (const issue of headingIssues) {
    if (!issue.passes) {
      findings.push({
        severity: 'medium',
        category: 'accessibility',
        file: issue.location.split(':')[0],
        line: parseInt(issue.location.split(':')[1]),
        title: `Heading hierarchy broken`,
        description: `Found <h${issue.level}> but expected <h${issue.expectedLevel}>`,
        recommendation: `Change to h${issue.expectedLevel} or insert missing heading level`,
        auto_fixable: true
      })
    }
  }

  // Color-only findings
  for (const issue of colorIssues) {
    if (!issue.passes) {
      findings.push({
        severity: 'medium',
        category: 'accessibility',
        file: issue.location.split(':')[0],
        line: parseInt(issue.location.split(':')[1]),
        title: `Status indicator uses color only`,
        description: `${issue.element} must use shape or text in addition to color`,
        recommendation: issue.recommendation || '',
        auto_fixable: false
      })
    }
  }

  // Keyboard nav findings
  for (const issue of keyboardIssues) {
    if (!issue.passes) {
      findings.push({
        severity: 'high',
        category: 'accessibility',
        file: issue.location.split(':')[0],
        line: parseInt(issue.location.split(':')[1]),
        title: `Interactive element not keyboard accessible`,
        description: `${issue.element} cannot be accessed via Tab key`,
        recommendation: issue.recommendation || '',
        auto_fixable: false
      })
    }
  }

  return findings
}

export async function quickAccessibilityAudit(htmlContent: string): Promise<number> {
  // Fast A11y score 0-100
  let score = 100
  const issues = [
    { pattern: /<img[^>]*>/g, penalty: 5, name: 'image-without-alt' },
    { pattern: /<button[^>]*>[^<]*<\/button>/g, penalty: 3, name: 'button-no-aria' },
    { pattern: /<h[2-6]/g, penalty: 2, name: 'possible-hierarchy-break' }
  ]

  for (const issue of issues) {
    const matches = htmlContent.match(issue.pattern) || []
    if (matches.length > 0) {
      score -= matches.length * issue.penalty
    }
  }

  return Math.max(0, score)
}
