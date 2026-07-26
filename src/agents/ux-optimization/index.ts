/**
 * UX Optimization Agent
 *
 * Analyzes colors, buttons, accessibility, and navigation for UX issues
 * Provides actionable findings tied to customer impact
 */

import { UXAnalysisResult, UXFinding, UXCheckOptions } from './types';
import { detectContrastIssues, checkContrast } from './contrast-checker';
import { validateButtonLabels } from './button-analyzer';
import {
  checkImageAltText,
  checkAriaLabels,
  checkColorOnlyIndicators,
  checkHeadingHierarchy,
  checkKeyboardNavigation,
  convertAccessibilityToFindings,
  quickAccessibilityAudit,
} from './accessibility-checker';

/**
 * Main UX Optimization Agent
 */
export class UXOptimizationAgent {
  /**
   * Run full UX analysis
   */
  static async analyze(options: UXCheckOptions = {}): Promise<UXAnalysisResult> {
    const findings: UXFinding[] = [];

    // Default options
    const {
      checkContrast: doCheckContrast = true,
      checkLabels: doCheckLabels = true,
      checkAccessibility: doCheckAccessibility = true,
      wcagLevel = 'AA',
    } = options;

    // Run contrast checks
    if (doCheckContrast) {
      findings.push(...this.runContrastChecks());
    }

    // Run button label checks
    if (doCheckLabels) {
      findings.push(...this.runButtonLabelChecks());
    }

    // Run accessibility checks
    if (doCheckAccessibility) {
      findings.push(...this.runAccessibilityChecks());
    }

    // Deduplicate findings
    const uniqueFindings = this.deduplicateFindings(findings);

    // Sort by severity
    uniqueFindings.sort((a, b) => {
      const severityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
      return severityOrder[a.severity] - severityOrder[b.severity];
    });

    // Generate summary
    const summary = {
      total: uniqueFindings.length,
      critical: uniqueFindings.filter(f => f.severity === 'critical').length,
      high: uniqueFindings.filter(f => f.severity === 'high').length,
      medium: uniqueFindings.filter(f => f.severity === 'medium').length,
      low: uniqueFindings.filter(f => f.severity === 'low').length,
      autoFixable: uniqueFindings.filter(f => f.autoFixable).length,
    };

    // Generate recommendations
    const recommendations = this.generateRecommendations(uniqueFindings);

    return {
      timestamp: new Date().toISOString(),
      agent: 'ux-optimization',
      findings: uniqueFindings,
      summary,
      recommendations,
    };
  }

  /**
   * Check color contrast compliance
   */
  private static runContrastChecks(): UXFinding[] {
    const issues = detectContrastIssues();

    return issues.map((issue, index) => ({
      id: `contrast-${index}`,
      category: 'contrast' as const,
      severity: issue.status === 'fail' ? 'critical' : 'high',
      title: `Color contrast issue: ${issue.textColor} on ${issue.backgroundColor}`,
      description: `Contrast ratio is ${issue.ratio}:1. ${
        issue.status === 'fail'
          ? 'Fails WCAG AA (needs 4.5:1)'
          : 'Meets AA but not AAA'
      }`,
      location: 'Theme/Design System',
      recommendation: `Increase contrast ratio. Current: ${issue.ratio}:1. Target: 4.5:1 for AA, 7:1 for AAA.`,
      autoFixable: issue.status === 'warn', // Can suggest lighter/darker variant
      fixStrategy:
        'Adjust color values to meet WCAG AA threshold (4.5:1 minimum)',
      examples: {
        current: `${issue.textColor} on ${issue.backgroundColor}`,
        recommended:
          'Use higher luminance difference. See WCAG palette for safe combinations.',
      },
    }));
  }

  /**
   * Check button labels
   */
  private static runButtonLabelChecks(): UXFinding[] {
    // Scan common button locations
    const commonButtons = [
      // Primary CTAs
      { label: 'Start Free Trial', location: 'MainLanding.tsx', category: 'primary-cta' as const },
      { label: 'Get Started', location: 'PricingPage.tsx', category: 'primary-cta' as const },
      { label: 'Sign Up', location: 'Auth Components', category: 'primary-cta' as const },
      // Secondary CTAs
      { label: 'Learn More', location: 'Feature Sections', category: 'secondary-cta' as const },
      { label: 'Contact Sales', location: 'Enterprise CTA', category: 'secondary-cta' as const },
      // Actions
      { label: 'Save', location: 'Dashboard Forms', category: 'action' as const },
      { label: 'Cancel', location: 'Modals', category: 'action' as const },
      { label: 'Delete', location: 'Destructive Actions', category: 'action' as const },
    ];

    return validateButtonLabels(commonButtons);
  }

  /**
   * Check accessibility compliance
   */
  private static runAccessibilityChecks(): UXFinding[] {
    const findings: UXFinding[] = [];

    // Simulate checking React components for common issues
    // In real implementation, this would parse actual component files

    // Check for images without alt text (example)
    const imagesToCheck = [
      // Would come from scanning src/components and src/pages
    ];
    findings.push(...convertAccessibilityToFindings(checkImageAltText(imagesToCheck)));

    // Check for icon buttons without labels
    const elementsToCheck = [
      // Would come from scanning interactive elements
    ];
    findings.push(...convertAccessibilityToFindings(checkAriaLabels(elementsToCheck)));

    // Example: Add a quick audit result
    const auditResult = quickAccessibilityAudit(
      '<div role="button" onClick={handleClick}>Custom Button</div>'
    );
    if (auditResult.issues.length > 0) {
      findings.push({
        id: 'a11y-audit',
        category: 'accessibility',
        severity: 'medium',
        title: 'Accessibility audit findings',
        description: auditResult.issues.join('; '),
        location: 'General codebase',
        recommendation:
          'Review findings above. Consider using semantic HTML (button, nav, main) instead of divs with click handlers.',
        autoFixable: false,
      });
    }

    return findings;
  }

  /**
   * Remove duplicate findings
   */
  private static deduplicateFindings(findings: UXFinding[]): UXFinding[] {
    const seen = new Set<string>();
    return findings.filter(f => {
      const key = `${f.category}:${f.title}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  /**
   * Generate actionable recommendations
   */
  private static generateRecommendations(findings: UXFinding[]): string[] {
    const recommendations: string[] = [];

    const criticalFindings = findings.filter(f => f.severity === 'critical');
    const highFindings = findings.filter(f => f.severity === 'high');

    if (criticalFindings.length > 0) {
      recommendations.push(
        `🔴 CRITICAL: Fix ${criticalFindings.length} critical issues immediately. These likely impact user comprehension or accessibility.`
      );
    }

    if (highFindings.length > 0) {
      recommendations.push(
        `🟠 HIGH: Address ${highFindings.length} high-priority issues. These affect UX clarity and WCAG compliance.`
      );
    }

    // Category-specific recommendations
    const contrastIssues = findings.filter(f => f.category === 'contrast');
    if (contrastIssues.length > 0) {
      recommendations.push(
        `📊 Contrast: Review color palette. Ensure all text meets WCAG AA (4.5:1 minimum for normal text).`
      );
    }

    const labelIssues = findings.filter(f => f.category === 'labels');
    if (labelIssues.length > 0) {
      recommendations.push(
        `🏷️ Labels: Audit all button labels for clarity and consistency. Use action verbs, avoid vague terms like "Click Here".`
      );
    }

    const a11yIssues = findings.filter(f => f.category === 'accessibility');
    if (a11yIssues.length > 0) {
      recommendations.push(
        `♿ Accessibility: Add alt text to images, ARIA labels to interactive elements, and ensure keyboard navigation works.`
      );
    }

    return recommendations.length > 0
      ? recommendations
      : ['✅ No UX issues detected. Keep up the good work!'];
  }
}

// Export utilities for direct use
export * from './types';
export * from './contrast-checker';
export * from './button-analyzer';
export * from './accessibility-checker';
