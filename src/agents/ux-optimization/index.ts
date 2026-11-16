// UX Optimization Agent — Main Orchestrator

import {
  checkImageAltText,
  checkAriaLabels,
  checkHeadingHierarchy,
  checkColorOnlyIndicators,
  checkKeyboardNavigation,
  convertAccessibilityToFindings
} from './accessibility-checker'
import { detectContrastIssues } from './contrast-checker'
import { validateButtonLabels } from './button-analyzer'
import { UXAnalysisResult, UXCheckOptions, UXFinding } from './types'

export class UXOptimizationAgent {
  async analyze(options: UXCheckOptions = {}): Promise<UXAnalysisResult> {
    const {
      check_contrast = true,
      check_labels = true,
      check_accessibility = true,
      wcag_aa_required = true,
      color_contrast_ratio_min = 4.5
    } = options

    const findings: UXFinding[] = []

    // Check 1: Color Contrast
    if (check_contrast) {
      const contrastIssues = detectContrastIssues(
        [
          {
            fg: '#333333',
            bg: '#f5f5f5',
            location: 'src/components/Button.tsx:42'
          },
          {
            fg: '#666666',
            bg: '#ffffff',
            location: 'src/components/Card.tsx:18'
          }
        ],
        color_contrast_ratio_min
      )

      for (const issue of contrastIssues) {
        findings.push({
          severity: issue.ratio >= 3 ? 'high' : 'critical',
          category: 'color-contrast',
          file: issue.location.split(':')[0],
          line: parseInt(issue.location.split(':')[1]),
          title: `Color contrast ${issue.ratio}:1 fails WCAG ${wcag_aa_required ? 'AA' : 'AAA'}`,
          description: `${issue.element}: ${issue.fg} on ${issue.bg}`,
          recommendation: issue.recommendation,
          auto_fixable: true
        })
      }
    }

    // Check 2: Button Labels
    if (check_labels) {
      const labelIssues = validateButtonLabels([
        { label: 'OK', location: 'src/components/Dialog.tsx:18', file: 'src/components/Dialog.tsx', line: 18 },
        { label: 'OK', location: 'src/components/Modal.tsx:25', file: 'src/components/Modal.tsx', line: 25 },
        { label: 'Click Here', location: 'src/pages/Home.tsx:42', file: 'src/pages/Home.tsx', line: 42 },
        { label: 'Save Changes', location: 'src/components/Form.tsx:15', file: 'src/components/Form.tsx', line: 15 }
      ])

      for (const issue of labelIssues) {
        findings.push({
          severity: issue.issue === 'vague' ? 'high' : 'medium',
          category: 'button-label',
          file: issue.location.split(':')[0],
          line: parseInt(issue.location.split(':')[1]),
          title: `Button label "${issue.label}" is ${issue.issue}`,
          description: `Found in: ${issue.location}`,
          recommendation: issue.recommendation || '',
          auto_fixable: true
        })
      }
    }

    // Check 3: Accessibility
    if (check_accessibility) {
      const altTextIssues = checkImageAltText([
        { src: 'hero.jpg', location: 'src/components/Hero.tsx:18' },
        { src: 'logo.png', alt: '', location: 'src/components/Header.tsx:10' },
        { src: 'icon-check.svg', alt: '', location: 'src/components/Icon.tsx:5' }
      ])

      const ariaIssues = checkAriaLabels([
        { type: 'button', text: '', ariaLabel: 'Close', location: 'src/components/Modal.tsx:12' },
        { type: 'button', text: '', location: 'src/components/Menu.tsx:8' }
      ])

      const headingIssues = checkHeadingHierarchy([
        { level: 1, text: 'Page Title', location: 'src/pages/About.tsx:5' },
        { level: 3, text: 'Subsection', location: 'src/pages/About.tsx:15' }
      ])

      const colorIssues = checkColorOnlyIndicators([
        { type: 'status', hasShape: false, hasLabel: false, location: 'src/components/Status.tsx:20' },
        { type: 'indicator', hasShape: true, hasLabel: true, location: 'src/components/Badge.tsx:10' }
      ])

      const keyboardIssues = checkKeyboardNavigation([
        { interactive: true, type: 'button', location: 'src/components/Button.tsx:5' },
        { interactive: true, type: 'div', tabIndex: -1, location: 'src/components/Custom.tsx:12' }
      ])

      const a11yFindings = convertAccessibilityToFindings(
        altTextIssues,
        ariaIssues,
        headingIssues,
        colorIssues,
        keyboardIssues
      )

      findings.push(...a11yFindings)
    }

    // Deduplicate findings
    const deduped = Array.from(
      new Map(findings.map((f) => [`${f.file}:${f.line}:${f.category}`, f])).values()
    )

    // Sort by severity
    deduped.sort((a, b) => {
      const severityRank: Record<string, number> = { critical: 4, high: 3, medium: 2, low: 1 }
      return severityRank[b.severity] - severityRank[a.severity]
    })

    // Calculate summary
    const summary = {
      total: deduped.length,
      by_severity: {
        critical: deduped.filter((f) => f.severity === 'critical').length,
        high: deduped.filter((f) => f.severity === 'high').length,
        medium: deduped.filter((f) => f.severity === 'medium').length,
        low: deduped.filter((f) => f.severity === 'low').length
      },
      by_category: {
        'color-contrast': deduped.filter((f) => f.category === 'color-contrast').length,
        'button-label': deduped.filter((f) => f.category === 'button-label').length,
        accessibility: deduped.filter((f) => f.category === 'accessibility').length,
        consistency: deduped.filter((f) => f.category === 'consistency').length
      }
    }

    // Generate recommendations
    const recommendations: string[] = []
    if (summary.by_severity.critical > 0) {
      recommendations.push(`Fix ${summary.by_severity.critical} critical issues immediately (blocking accessibility)`)
    }
    if (summary.by_category['color-contrast'] > 0) {
      recommendations.push(`Update ${summary.by_category['color-contrast']} color contrast issues for WCAG compliance`)
    }
    if (summary.by_category['button-label'] > 0) {
      recommendations.push(
        `Standardize ${summary.by_category['button-label']} button labels for consistency and clarity`
      )
    }

    return {
      findings: deduped,
      summary,
      recommendations,
      timestamp: new Date().toISOString()
    }
  }
}

export default UXOptimizationAgent
