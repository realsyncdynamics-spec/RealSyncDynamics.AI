# UX Optimization Agent

Autonomous analyzer for UI/UX quality, accessibility, and consistency.

## Overview

The UX Optimization Agent continuously checks the platform for:
- **Color Contrast** — WCAG AA/AAA compliance for text readability
- **Button Labels** — Clarity, consistency, and action-orientation
- **Accessibility** — Alt text, ARIA labels, keyboard navigation, semantic HTML
- **Navigation** — Clear structure, consistent patterns, discoverability

## Usage

### Quick Start

```typescript
import { UXOptimizationAgent } from '@/agents/ux-optimization';

// Run full analysis
const result = await UXOptimizationAgent.analyze({
  checkContrast: true,
  checkLabels: true,
  checkAccessibility: true,
  wcagLevel: 'AA',
});

console.log(`Found ${result.summary.total} issues`);
console.log(`Critical: ${result.summary.critical}`);
result.recommendations.forEach(rec => console.log(`- ${rec}`));
```

### Selective Checks

```typescript
// Only check color contrast
const result = await UXOptimizationAgent.analyze({
  checkContrast: true,
  checkLabels: false,
  checkAccessibility: false,
});
```

## Modules

### `contrast-checker.ts`

Validates WCAG color contrast compliance.

**Functions:**
- `hexToRgb(hex)` — Convert hex to RGB
- `getLuminance(rgb)` — Calculate relative luminance (WCAG)
- `getContrastRatio(color1, color2)` — Calculate contrast ratio
- `checkContrast(textColor, bg, isLargeText)` — Validate WCAG compliance
- `detectContrastIssues()` — Find all contrast problems in theme

**Example:**

```typescript
import { checkContrast } from '@/agents/ux-optimization/contrast-checker';

const result = checkContrast('#333333', '#FFFFFF');
console.log(`Ratio: ${result.ratio}:1`);
console.log(`Meets AA: ${result.wcagAA}`);
console.log(`Meets AAA: ${result.wcagAAA}`);
```

### `button-analyzer.ts`

Validates button labels for clarity and consistency.

**Functions:**
- `analyzeButtonLabel(label, category, location)` — Check single button
- `detectDuplicateLabels(buttons)` — Find buttons with same label doing different things
- `validateButtonLabels(buttons)` — Validate array of buttons

**Standard Patterns:**

```typescript
// Good button labels
✅ "Start Free Trial"
✅ "Connect Salesforce"
✅ "Save Changes"
✅ "Delete Account"

// Avoid
❌ "Click Here"
❌ "Submit"
❌ "Go"
❌ "OK"
```

**Example:**

```typescript
import { analyzeButtonLabel } from '@/agents/ux-optimization/button-analyzer';

const issue = analyzeButtonLabel('Click Here', 'primary-cta', 'MainLanding.tsx');
if (issue) {
  console.log(`Issue: ${issue.recommendation}`);
}
```

### `accessibility-checker.ts`

Validates WCAG accessibility compliance.

**Functions:**
- `checkImageAltText(images)` — Detect missing alt attributes
- `checkAriaLabels(elements)` — Detect missing ARIA labels
- `checkColorOnlyIndicators(indicators)` — Find color-only indicators
- `checkHeadingHierarchy(headings)` — Validate heading levels
- `checkKeyboardNavigation(elements)` — Check keyboard support
- `quickAccessibilityAudit(html)` — Quick compliance check

**WCAG Standards:**

Level A (minimum):
- Non-text content has text alternatives
- Keyboard navigation works
- Color not the only way to convey information

Level AA (recommended):
- Contrast ratio ≥ 4.5:1 for normal text
- Text alternatives for images
- Keyboard accessible

Level AAA (enhanced):
- Contrast ratio ≥ 7:1
- Enhanced focus indicators
- Context-sensitive help

**Example:**

```typescript
import { checkImageAltText } from '@/agents/ux-optimization/accessibility-checker';

const issues = checkImageAltText([
  { src: 'dashboard.png', location: 'Dashboard.tsx' },
  { src: 'logo.svg', alt: 'Company Logo', location: 'Header.tsx' },
]);

console.log(`Missing alt text: ${issues.length}`);
```

## Configuration

Edit button label preferences in `button-analyzer.ts`:

```typescript
export const BUTTON_LABEL_CONFIG: ButtonLabelConfig = {
  preferred: [
    'Start Free Trial',
    'Get Started',
    // Add more as needed
  ],
  deprecated: [
    'Click Here',
    'Submit',
    // Add anti-patterns here
  ],
  actionVerbs: [
    'Start', 'Create', 'Connect', 'View',
    // List of clear action words
  ],
};
```

## Output Format

```typescript
interface UXAnalysisResult {
  timestamp: string;
  agent: 'ux-optimization';
  findings: UXFinding[];
  summary: {
    total: number;
    critical: number;
    high: number;
    medium: number;
    low: number;
    autoFixable: number;
  };
  recommendations: string[];
}

interface UXFinding {
  id: string;
  category: 'contrast' | 'labels' | 'accessibility' | 'consistency' | 'navigation';
  severity: 'critical' | 'high' | 'medium' | 'low';
  title: string;
  description: string;
  location: string;
  lineNumber?: number;
  recommendation: string;
  autoFixable: boolean;
  fixStrategy?: string;
  examples?: { current: string; recommended: string };
}
```

## Severity Guidelines

**🔴 Critical** (fixes required immediately)
- WCAG AA contrast failures
- Missing alt text on important images
- Broken keyboard navigation
- Color-only information conveyance

**🟠 High** (should fix soon)
- Vague button labels ("Click Here")
- Inconsistent heading hierarchy
- Missing ARIA labels on interactive elements
- Meets AA but not AAA contrast

**🟡 Medium** (nice to fix)
- Minor label inconsistencies
- Enhanced accessibility (AAA level)
- Non-critical accessibility improvements

**🟢 Low** (consider for next cycle)
- Code quality observations
- Style consistency
- Non-blocking improvements

## Testing

```bash
# Run UX agent tests
npm test -- src/agents/ux-optimization/index.test.ts

# Run specific test
npm test -- src/agents/ux-optimization/index.test.ts -t "should detect WCAG AA compliance"
```

## Auto-Fixable Issues

The agent can auto-fix these categories:
- ✅ Color contrast variants (suggest lighter/darker version)
- ✅ Button label suggestions (recommend action verb)
- ✅ Alt text generation suggestions
- ✅ ARIA label templates

Manual review needed for:
- ⚠️ Heading hierarchy restructuring
- ⚠️ Major layout changes
- ⚠️ Semantic HTML conversion

## Integration with Platform Intelligence

The UX Optimization Agent is one of 5 sub-agents in the Platform Intelligence system:

1. **UX Optimization** (this module) — Colors, labels, accessibility
2. Customer Journey — Signup/onboarding/checkout flows
3. Dashboard Evolution — Feature placement, discoverability
4. Routing Quality — Orphaned pages, dead links
5. Stripe Business — Pricing alignment, billing logic

The orchestrator (`platform-intelligence-orchestrator`) runs all agents daily at 06:00 UTC and on-push.

## Examples

### Checking Contrast

```typescript
import { detectContrastIssues, REALSYNC_PALETTE } from '@/agents/ux-optimization';

const issues = detectContrastIssues();
issues.forEach(issue => {
  if (issue.status === 'fail') {
    console.log(`🔴 ${issue.textColor} on ${issue.backgroundColor}: ${issue.ratio}:1`);
  }
});
```

### Validating Button Labels

```typescript
import { validateButtonLabels } from '@/agents/ux-optimization';

const buttons = [
  { label: 'Click Here', location: 'Header.tsx', category: 'primary-cta' },
  { label: 'Learn More', location: 'Hero.tsx', category: 'secondary-cta' },
];

const findings = validateButtonLabels(buttons);
findings.forEach(finding => {
  console.log(`${finding.severity.toUpperCase()}: ${finding.title}`);
  console.log(`Recommendation: ${finding.recommendation}`);
});
```

### Quick Accessibility Check

```typescript
import { quickAccessibilityAudit } from '@/agents/ux-optimization';

const html = document.body.innerHTML;
const audit = quickAccessibilityAudit(html);

console.log(`Accessibility score: ${audit.score}%`);
audit.issues.forEach(issue => console.log(`- ${issue}`));
```

## References

- [WCAG 2.1 Guidelines](https://www.w3.org/WAI/WCAG21/quickref/)
- [Color Contrast Analyzer](https://www.tpgi.com/color-contrast-checker/)
- [Accessible Colors Tool](https://accessible-colors.com/)
- [Web Accessibility by Google](https://www.udacity.com/course/web-accessibility--ud891)

## Contributing

To add new checks:

1. Create a checker function in appropriate module
2. Add type definitions to `types.ts`
3. Integrate into `UXOptimizationAgent.analyze()`
4. Add tests to `index.test.ts`
5. Document in this README

## Status

**Phase 2 Implementation** ✅ Complete
- ✅ Contrast checker (WCAG AA/AAA)
- ✅ Button analyzer (label clarity & consistency)
- ✅ Accessibility checker (alt text, ARIA, semantic HTML)
- ✅ Tests & documentation
- 🔄 Integration with orchestrator (in progress)

**Next:**
- Hook into codebase scanner to analyze actual React components
- GitHub issue creation for findings
- Auto-fix PR generation
