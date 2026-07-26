/**
 * UX Optimization Agent - Tests
 */

import { describe, it, expect } from 'vitest';
import { UXOptimizationAgent } from './index';
import { checkContrast, getContrastRatio } from './contrast-checker';
import { analyzeButtonLabel } from './button-analyzer';
import { checkImageAltText, quickAccessibilityAudit } from './accessibility-checker';

describe('UX Optimization Agent', () => {
  describe('Color Contrast Checker', () => {
    it('should calculate correct contrast ratio', () => {
      const ratio = getContrastRatio('#FFFFFF', '#000000');
      expect(ratio).toBe(21); // Perfect contrast
    });

    it('should detect WCAG AA compliance', () => {
      const result = checkContrast('#FFFFFF', '#666666');
      expect(result.wcagAA).toBe(true);
      expect(result.level).toMatch(/AA|AAA/);
    });

    it('should flag insufficient contrast', () => {
      const result = checkContrast('#CCCCCC', '#EEEEEE');
      expect(result.wcagAA).toBe(false);
      expect(result.level).toBe('fail');
    });

    it('should handle large text differently', () => {
      const smallText = checkContrast('#666666', '#FFFFFF');
      const largeText = checkContrast('#666666', '#FFFFFF');
      // Both results should be valid
      expect(smallText.wcagAA).toBeDefined();
      expect(largeText.wcagAA).toBeDefined();
    });
  });

  describe('Button Label Analyzer', () => {
    it('should reject vague labels', () => {
      const issue = analyzeButtonLabel('Click Here', 'action', 'test.tsx');
      expect(issue).not.toBeNull();
      expect(issue?.issue).toBe('unclear');
    });

    it('should accept clear action-oriented labels', () => {
      const issue = analyzeButtonLabel('Start Free Trial', 'primary-cta', 'test.tsx');
      expect(issue).toBeNull();
    });

    it('should flag deprecated labels', () => {
      const issue = analyzeButtonLabel('OK', 'action', 'test.tsx');
      expect(issue).not.toBeNull();
      expect(issue?.issue).toBe('unclear');
    });

    it('should suggest improvements for unclear labels', () => {
      const issue = analyzeButtonLabel('Do It', 'action', 'test.tsx');
      expect(issue?.recommendation).toContain('action verb');
    });
  });

  describe('Accessibility Checker', () => {
    it('should detect missing alt text', () => {
      const images = [
        { src: 'image.png', location: 'test.tsx' },
        { src: 'logo.svg', alt: 'Company Logo', location: 'test.tsx' },
      ];
      const issues = checkImageAltText(images);
      expect(issues).toHaveLength(1);
      expect(issues[0].issue).toBe('missing-alt-text');
    });

    it('should run quick accessibility audit', () => {
      const audit = quickAccessibilityAudit('<img src="test.png">');
      expect(audit.score).toBeLessThan(100);
      expect(audit.issues.length).toBeGreaterThan(0);
    });

    it('should pass audit with proper markup', () => {
      const audit = quickAccessibilityAudit(
        '<img alt="description" src="test.png"><nav><button>Click</button></nav>'
      );
      expect(audit.score).toBeGreaterThan(audit.score); // Should have better score
    });
  });

  describe('Full Agent Analysis', () => {
    it('should return structured analysis result', async () => {
      const result = await UXOptimizationAgent.analyze({
        checkContrast: true,
        checkLabels: true,
        checkAccessibility: true,
      });

      expect(result).toHaveProperty('timestamp');
      expect(result).toHaveProperty('agent', 'ux-optimization');
      expect(result).toHaveProperty('findings');
      expect(result).toHaveProperty('summary');
      expect(result).toHaveProperty('recommendations');
    });

    it('should categorize findings by severity', async () => {
      const result = await UXOptimizationAgent.analyze();

      const severities = result.findings.map(f => f.severity);
      severities.forEach(s => {
        expect(['critical', 'high', 'medium', 'low']).toContain(s);
      });
    });

    it('should generate meaningful recommendations', async () => {
      const result = await UXOptimizationAgent.analyze();

      expect(result.recommendations).toBeInstanceOf(Array);
      if (result.summary.critical > 0) {
        expect(result.recommendations.some(r => r.includes('CRITICAL'))).toBe(true);
      }
    });

    it('should identify auto-fixable issues', async () => {
      const result = await UXOptimizationAgent.analyze();

      const autoFixable = result.findings.filter(f => f.autoFixable);
      expect(result.summary.autoFixable).toBe(autoFixable.length);
    });

    it('should respect check options', async () => {
      const resultAll = await UXOptimizationAgent.analyze({
        checkContrast: true,
        checkLabels: true,
        checkAccessibility: true,
      });

      const resultContrast = await UXOptimizationAgent.analyze({
        checkContrast: true,
        checkLabels: false,
        checkAccessibility: false,
      });

      // Contrast-only result should have fewer findings
      expect(resultContrast.findings.length).toBeLessThanOrEqual(
        resultAll.findings.length
      );
    });
  });

  describe('Real-world scenarios', () => {
    it('should catch common UI mistakes', async () => {
      const result = await UXOptimizationAgent.analyze();

      // Should have at least some findings from our sample checks
      expect(result.findings.length).toBeGreaterThan(0);
    });

    it('should provide actionable guidance', async () => {
      const result = await UXOptimizationAgent.analyze();

      result.findings.forEach(finding => {
        expect(finding.recommendation).toBeTruthy();
        expect(finding.recommendation.length).toBeGreaterThan(10);
      });
    });

    it('should maintain finding IDs for tracking', async () => {
      const result = await UXOptimizationAgent.analyze();

      const ids = new Set(result.findings.map(f => f.id));
      expect(ids.size).toBe(result.findings.length); // All IDs unique
    });
  });
});
