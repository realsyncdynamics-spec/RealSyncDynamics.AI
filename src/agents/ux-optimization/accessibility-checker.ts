/**
 * Accessibility Checker
 *
 * Validates WCAG accessibility compliance (alt text, ARIA labels, semantic HTML, etc.)
 */

import { AccessibilityIssue, UXFinding } from './types';

/**
 * Check for missing alt text on images
 */
export function checkImageAltText(
  images: Array<{ src: string; alt?: string; location: string }>
): AccessibilityIssue[] {
  return images
    .filter(img => !img.alt || img.alt.trim() === '')
    .map(img => ({
      element: `<img src="${img.src}">`,
      issue: 'missing-alt-text' as const,
      location: img.location,
      impact:
        'Screen readers cannot describe the image to visually impaired users. This is critical for understanding content.',
    }));
}

/**
 * Check for missing ARIA labels on interactive elements
 */
export function checkAriaLabels(
  elements: Array<{
    type: 'button' | 'icon-button' | 'link' | 'input';
    text?: string;
    ariaLabel?: string;
    location: string;
  }>
): AccessibilityIssue[] {
  return elements
    .filter(el => {
      // icon-buttons must have aria-label
      if (el.type === 'icon-button' && !el.ariaLabel) return true;
      // inputs must have label or aria-label
      if (el.type === 'input' && !el.text && !el.ariaLabel) return true;
      return false;
    })
    .map(el => ({
      element: `<${el.type}>`,
      issue: 'missing-aria-label' as const,
      location: el.location,
      impact: `Screen reader users won't know the purpose of this ${el.type}. Add aria-label or associated <label>`,
    }));
}

/**
 * Check for color-only indicators (without text)
 */
export function checkColorOnlyIndicators(
  indicators: Array<{
    description: string;
    location: string;
    hasText: boolean;
    hasPattern: boolean;
  }>
): AccessibilityIssue[] {
  return indicators
    .filter(ind => !ind.hasText && !ind.hasPattern)
    .map(ind => ({
      element: ind.description,
      issue: 'color-only-indicator' as const,
      location: ind.location,
      impact:
        'Color-blind users cannot distinguish meaning. Add text label, icon, or pattern in addition to color.',
    }));
}

/**
 * Check for proper heading hierarchy
 */
export function checkHeadingHierarchy(
  headings: Array<{ level: number; text: string; location: string }>
): AccessibilityIssue[] {
  const issues: AccessibilityIssue[] = [];

  for (let i = 1; i < headings.length; i++) {
    const prev = headings[i - 1];
    const curr = headings[i];
    const levelJump = curr.level - prev.level;

    // Check for skipped levels (h1 -> h3 is bad, should be h1 -> h2)
    if (levelJump > 1 && prev.level !== 0) {
      issues.push({
        element: `<h${curr.level}>${curr.text}</h${curr.level}>`,
        issue: 'missing-role' as const,
        location: curr.location,
        impact: `Heading hierarchy skipped level (h${prev.level} -> h${curr.level}). Screen readers rely on proper structure. Use h${prev.level + 1} instead.`,
      });
    }
  }

  return issues;
}

/**
 * Check for keyboard navigation support
 */
export function checkKeyboardNavigation(
  elements: Array<{
    type: string;
    isClickable: boolean;
    hasTabindex: boolean;
    location: string;
  }>
): AccessibilityIssue[] {
  return elements
    .filter(el => el.isClickable && !el.hasTabindex && el.type === 'div')
    .map(el => ({
      element: `<${el.type}> (clickable)`,
      issue: 'missing-role' as const,
      location: el.location,
      impact:
        'Custom clickable elements need tabindex="0" or use a proper button element for keyboard navigation.',
    }));
}

/**
 * Convert accessibility issues to UX findings
 */
export function convertAccessibilityToFindings(
  issues: AccessibilityIssue[]
): UXFinding[] {
  return issues.map((issue, index) => {
    const severityMap: { [key: string]: 'critical' | 'high' | 'medium' } = {
      'missing-alt-text': 'high',
      'missing-aria-label': 'high',
      'missing-role': 'medium',
      'color-only-indicator': 'high',
    };

    return {
      id: `a11y-${issue.issue}-${index}`,
      category: 'accessibility',
      severity: severityMap[issue.issue] || 'medium',
      title: `Accessibility issue: ${issue.issue}`,
      description: issue.impact,
      location: issue.location,
      recommendation: getAccessibilityFix(issue),
      autoFixable: false, // Accessibility fixes need human judgment
    };
  });
}

/**
 * Get specific fix recommendation for each accessibility issue
 */
function getAccessibilityFix(issue: AccessibilityIssue): string {
  switch (issue.issue) {
    case 'missing-alt-text':
      return 'Add alt attribute to image describing content. Example: alt="Dashboard showing compliance score"';

    case 'missing-aria-label':
      return 'Add aria-label for screen readers. Example: aria-label="Close notification"';

    case 'missing-role':
      return 'Use semantic HTML elements (button, nav, main) or add role attribute. Example: role="button" with tabindex="0"';

    case 'color-only-indicator':
      return 'Add text, icon, or pattern alongside color. Example: "✓ Complete" instead of just green dot';

    default:
      return 'Fix this accessibility issue to comply with WCAG standards';
  }
}

/**
 * WCAG Common Violations Checklist
 */
export const WCAG_CHECKLIST = {
  'Level A': [
    '1.1.1 Non-text Content - Provide text alternatives',
    '1.2.1 Audio-only and Video-only (Prerecorded) - Provide alternatives',
    '1.3.1 Info and Relationships - Use semantic markup',
    '1.4.1 Use of Color - Cannot rely on color alone',
    '2.1.1 Keyboard - All functionality available via keyboard',
    '2.1.2 No Keyboard Trap - Focus is visible and movable',
    '2.2.1 Timing Adjustable - Allow users to adjust time limits',
    '2.3.1 Three Flashes or Below - No content flashes >3 times/sec',
    '2.4.1 Bypass Blocks - Skip navigation available',
    '3.1.1 Language of Page - Page language declared',
    '3.2.1 On Focus - No unexpected context changes',
    '3.3.1 Error Identification - Error messages clear',
    '4.1.1 Parsing - Valid HTML structure',
    '4.1.2 Name, Role, Value - Proper semantics for widgets',
  ],

  'Level AA': [
    '1.4.3 Contrast (Minimum) - Text contrast ≥ 4.5:1',
    '1.4.5 Images of Text - Use actual text instead',
    '2.4.3 Focus Order - Logical tab order',
    '2.4.7 Focus Visible - Focus indicator always visible',
    '3.2.2 On Input - Predictable behavior on input',
    '3.3.2 Labels or Instructions - Clear labels for inputs',
    '3.3.3 Error Suggestion - Helpful error messages',
    '3.3.4 Error Prevention - Confirmations for important actions',
  ],

  'Level AAA': [
    '1.4.6 Contrast (Enhanced) - Text contrast ≥ 7:1',
    '2.4.8 Focus Visible (Enhanced) - Clear focus indicators',
    '3.3.5 Help - Context-sensitive help available',
  ],
};

/**
 * Quick accessibility audit
 */
export function quickAccessibilityAudit(
  content: string
): { score: number; issues: string[] } {
  const issues: string[] = [];
  let score = 100;

  // Check for basic WCAG compliance indicators in code
  if (!content.includes('alt=')) {
    issues.push('No alt attributes found (images need descriptions)');
    score -= 10;
  }

  if (!content.includes('aria-')) {
    issues.push('No ARIA attributes found (consider semantic HTML + ARIA)');
    score -= 5;
  }

  if (!content.includes('<button') && content.includes('onClick')) {
    issues.push(
      'Custom click handlers on non-button elements (use <button>)'
    );
    score -= 10;
  }

  if (!content.includes('role=') && !content.includes('<nav')) {
    issues.push('Navigation structure unclear (use <nav> or role="navigation")');
    score -= 5;
  }

  if (!content.includes('lang=') && !content.includes('lang')) {
    issues.push('Page language not declared');
    score -= 3;
  }

  return {
    score: Math.max(0, score),
    issues,
  };
}
