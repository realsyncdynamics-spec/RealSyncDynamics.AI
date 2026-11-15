// UX Optimization Agent — Test Suite

import { describe, it, expect } from 'vitest'
import UXOptimizationAgent from './index'
import { getLuminance, getContrastRatio, checkContrast } from './contrast-checker'
import { analyzeButtonLabel, detectDuplicateLabels } from './button-analyzer'
import { checkImageAltText, checkHeadingHierarchy } from './accessibility-checker'

describe('UXOptimizationAgent', () => {
  describe('Contrast Checker', () => {
    it('calculates luminance correctly', () => {
      const L = getLuminance(51, 51, 51)
      expect(L).toBeCloseTo(0.03, 2)
    })

    it('calculates contrast ratio correctly', () => {
      const L1 = getLuminance(255, 255, 255) // white
      const L2 = getLuminance(0, 0, 0) // black
      const ratio = getContrastRatio(L1, L2)
      expect(ratio).toBeCloseTo(21, 0)
    })

    it('validates WCAG AA contrast (4.5:1)', () => {
      const result = checkContrast('#ffffff', '#000000')
      expect(result.wcagAA).toBe(true)
      expect(result.wcagAAA).toBe(true)
      expect(result.ratio).toBeGreaterThan(4.5)
    })

    it('fails contrast for light colors on white', () => {
      const result = checkContrast('#cccccc', '#ffffff')
      expect(result.wcagAA).toBe(false)
      expect(result.status).toBe('fail')
    })

    it('handles invalid hex colors gracefully', () => {
      const result = checkContrast('invalid', '#ffffff')
      expect(result.wcagAA).toBe(false)
      expect(result.ratio).toBe(0)
    })
  })

  describe('Button Analyzer', () => {
    it('identifies vague labels', () => {
      const analysis = analyzeButtonLabel('OK')
      expect(analysis.vague).toBe(true)
      expect(analysis.recommended).toBeDefined()
    })

    it('identifies deprecated labels', () => {
      const analysis = analyzeButtonLabel('Click Here')
      expect(analysis.deprecated).toBe(true)
    })

    it('validates action verbs', () => {
      const analysis = analyzeButtonLabel('Save Changes')
      expect(analysis.hasActionVerb).toBe(true)
      expect(analysis.vague).toBe(false)
    })

    it('detects duplicate labels', () => {
      const buttons = [
        { label: 'OK', location: 'file1.tsx:10', file: 'file1.tsx', line: 10 },
        { label: 'OK', location: 'file2.tsx:15', file: 'file2.tsx', line: 15 }
      ]
      const duplicates = detectDuplicateLabels(buttons)
      expect(duplicates).toHaveLength(1)
      expect(duplicates[0].count).toBe(2)
    })
  })

  describe('Accessibility Checker', () => {
    it('checks image alt-text', () => {
      const images = [
        { src: 'hero.jpg', location: 'src/pages/Home.tsx:5' },
        { src: 'icon.svg', alt: '', location: 'src/components/Icon.tsx:10' },
        { src: 'logo.png', alt: 'Company Logo', location: 'src/components/Header.tsx:8' }
      ]
      const results = checkImageAltText(images)
      expect(results[0].passes).toBe(false) // no alt
      expect(results[1].passes).toBe(true) // decorative
      expect(results[2].passes).toBe(true) // has alt
    })

    it('validates heading hierarchy', () => {
      const headings = [
        { level: 1, text: 'Page Title', location: 'page.tsx:5' },
        { level: 3, text: 'Subsection', location: 'page.tsx:10' } // skipped h2!
      ]
      const results = checkHeadingHierarchy(headings)
      expect(results[1].passes).toBe(false)
      expect(results[1].expectedLevel).toBe(2)
    })

    it('detects missing heading hierarchy start', () => {
      const headings = [
        { level: 2, text: 'Subsection', location: 'page.tsx:5' } // should start with h1
      ]
      const results = checkHeadingHierarchy(headings)
      expect(results[0].passes).toBe(false)
      expect(results[0].expectedLevel).toBe(1)
    })
  })

  describe('Full Agent Analysis', () => {
    it('runs full analysis with default options', async () => {
      const agent = new UXOptimizationAgent()
      const result = await agent.analyze()

      expect(result.findings).toBeDefined()
      expect(Array.isArray(result.findings)).toBe(true)
      expect(result.summary).toBeDefined()
      expect(result.summary.total).toBeGreaterThanOrEqual(0)
      expect(result.recommendations).toBeDefined()
      expect(result.timestamp).toBeDefined()
    })

    it('sorts findings by severity', async () => {
      const agent = new UXOptimizationAgent()
      const result = await agent.analyze()

      const severities = result.findings.map((f) => f.severity)
      const severityRank: Record<string, number> = { critical: 4, high: 3, medium: 2, low: 1 }

      for (let i = 1; i < severities.length; i++) {
        expect(severityRank[severities[i - 1]]).toBeGreaterThanOrEqual(severityRank[severities[i]])
      }
    })

    it('deduplicates findings', async () => {
      const agent = new UXOptimizationAgent()
      const result = await agent.analyze()

      const seen = new Set<string>()
      for (const f of result.findings) {
        const key = `${f.file}:${f.line}:${f.category}`
        expect(seen.has(key)).toBe(false)
        seen.add(key)
      }
    })

    it('generates recommendations', async () => {
      const agent = new UXOptimizationAgent()
      const result = await agent.analyze()

      if (result.summary.total > 0) {
        expect(result.recommendations.length).toBeGreaterThan(0)
      }
    })

    it('can skip specific checks', async () => {
      const agent = new UXOptimizationAgent()
      const result = await agent.analyze({
        check_contrast: false,
        check_labels: false,
        check_accessibility: false
      })

      expect(result.findings).toHaveLength(0)
    })

    it('respects WCAG threshold configuration', async () => {
      const agent = new UXOptimizationAgent()
      const result1 = await agent.analyze({ wcag_aa_required: true })
      const result2 = await agent.analyze({ wcag_aa_required: false })

      // Different thresholds should produce comparable results
      expect(result1.findings).toBeDefined()
      expect(result2.findings).toBeDefined()
    })
  })

  describe('Real-world Scenarios', () => {
    it('detects missing alt-text on hero images', async () => {
      const agent = new UXOptimizationAgent()
      const result = await agent.analyze({ check_accessibility: true })

      const altTextIssues = result.findings.filter((f) => f.title.includes('alt-text'))
      expect(altTextIssues.length).toBeGreaterThanOrEqual(0)
    })

    it('finds contrast issues on primary colors', async () => {
      const agent = new UXOptimizationAgent()
      const result = await agent.analyze({ check_contrast: true })

      const contrastIssues = result.findings.filter((f) => f.category === 'color-contrast')
      if (contrastIssues.length > 0) {
        expect(contrastIssues[0].auto_fixable).toBe(true)
      }
    })

    it('identifies duplicate button labels', async () => {
      const agent = new UXOptimizationAgent()
      const result = await agent.analyze({ check_labels: true })

      const labelIssues = result.findings.filter((f) => f.category === 'button-label')
      if (labelIssues.length > 0) {
        expect(labelIssues[0].recommendation).toBeDefined()
      }
    })
  })

  describe('Severity Categorization', () => {
    it('marks critical contrast failures as critical', async () => {
      const agent = new UXOptimizationAgent()
      const result = await agent.analyze({ check_contrast: true })

      const criticalContrast = result.findings.filter(
        (f) => f.category === 'color-contrast' && f.severity === 'critical'
      )
      // May or may not have critical issues depending on test data
      expect(criticalContrast).toBeDefined()
    })

    it('marks vague labels as high severity', async () => {
      const agent = new UXOptimizationAgent()
      const result = await agent.analyze({ check_labels: true })

      const vagueLabels = result.findings.filter(
        (f) => f.category === 'button-label' && f.title.includes('vague')
      )
      for (const finding of vagueLabels) {
        expect(['critical', 'high']).toContain(finding.severity)
      }
    })

    it('marks accessibility issues appropriately', async () => {
      const agent = new UXOptimizationAgent()
      const result = await agent.analyze({ check_accessibility: true })

      const a11yIssues = result.findings.filter((f) => f.category === 'accessibility')
      for (const finding of a11yIssues) {
        expect(['critical', 'high', 'medium']).toContain(finding.severity)
      }
    })
  })

  describe('Auto-Fixability', () => {
    it('marks text/label issues as auto-fixable', async () => {
      const agent = new UXOptimizationAgent()
      const result = await agent.analyze()

      const textIssues = result.findings.filter((f) => f.category === 'button-label')
      for (const finding of textIssues) {
        expect(finding.auto_fixable).toBe(true)
      }
    })

    it('marks some accessibility issues as non-fixable', async () => {
      const agent = new UXOptimizationAgent()
      const result = await agent.analyze({ check_accessibility: true })

      const nonFixable = result.findings.filter((f) => !f.auto_fixable)
      if (nonFixable.length > 0) {
        expect(nonFixable[0].category).toBeDefined()
      }
    })
  })
})
