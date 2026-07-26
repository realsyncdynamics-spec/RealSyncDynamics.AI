/**
 * Button Label Analyzer
 *
 * Validates button labels for clarity, consistency, and action-orientation
 */

import { ButtonLabelConfig, ButtonLabelIssue, UXFinding } from './types';

/**
 * Standard button label patterns for this application
 */
export const BUTTON_LABEL_CONFIG: ButtonLabelConfig = {
  // Preferred labels by action type
  preferred: [
    // Primary CTAs
    'Start Free Trial',
    'Get Started',
    'Create Account',
    'Sign Up',
    'Connect',
    'Connect Now',
    'Explore',
    'Learn More',
    'View Details',
    'See Pricing',
    // Actions
    'Save',
    'Submit',
    'Continue',
    'Next',
    'Confirm',
    'Create',
    'Add',
    'Edit',
    'Delete',
    'Cancel',
    'Close',
    'Back',
    'Download',
    'Export',
    'Import',
    'Refresh',
    'Retry',
    // Navigation
    'Go to Dashboard',
    'View Report',
    'Open Settings',
    'Manage',
    'Configure',
    'Setup',
    // Streaming/Loading
    'Loading...',
    'Saving...',
    'Processing...',
  ],

  // Deprecated/unclear labels to avoid
  deprecated: [
    'Click Here',
    'Submit Form',
    'Go',
    'Do It',
    'Try Now',
    'More',
    'Proceed',
    'Execute',
    'Enable',
    'Disable',
    'OK',
    'Yes',
    'No',
    'Maybe',
  ],

  // Action verbs that make labels clear
  actionVerbs: [
    'Start',
    'Create',
    'Connect',
    'View',
    'See',
    'Explore',
    'Learn',
    'Add',
    'Edit',
    'Delete',
    'Save',
    'Submit',
    'Download',
    'Export',
    'Import',
    'Configure',
    'Manage',
    'Setup',
    'Enable',
    'Disable',
    'Continue',
    'Go',
    'Return',
    'Copy',
    'Share',
    'Refresh',
    'Retry',
    'Restore',
    'Review',
    'Approve',
    'Reject',
    'Publish',
    'Archive',
    'Restore',
  ],
};

/**
 * Check if label starts with an action verb
 */
function hasActionVerb(label: string): boolean {
  const words = label.split(/\s+/);
  const firstWord = words[0].toLowerCase();
  return BUTTON_LABEL_CONFIG.actionVerbs.some(
    verb => verb.toLowerCase() === firstWord
  );
}

/**
 * Check if label is clear (not vague)
 */
function isClearLabel(label: string): boolean {
  const vaguePhrases = ['click here', 'submit', 'go', 'more', 'ok', 'do it'];
  const normalized = label.toLowerCase();

  if (vaguePhrases.includes(normalized)) return false;
  if (normalized.length < 3) return false;
  if (!hasActionVerb(label)) return false;

  return true;
}

/**
 * Check if label is consistent with similar buttons
 */
function checkConsistency(
  label: string,
  category: 'primary-cta' | 'secondary-cta' | 'action' | 'navigation'
): boolean {
  const categoryLabelMap: { [key: string]: string[] } = {
    'primary-cta': [
      'Start Free Trial',
      'Get Started',
      'Create Account',
      'Sign Up',
    ],
    'secondary-cta': ['Learn More', 'View Details', 'See Pricing'],
    action: [
      'Save',
      'Submit',
      'Continue',
      'Delete',
      'Add',
      'Edit',
    ],
    navigation: [
      'Go to Dashboard',
      'View Report',
      'Open Settings',
    ],
  };

  return categoryLabelMap[category]?.includes(label) ?? false;
}

/**
 * Analyze button label for UX issues
 */
export function analyzeButtonLabel(
  label: string,
  category: 'primary-cta' | 'secondary-cta' | 'action' | 'navigation' = 'action',
  location: string = 'unknown'
): ButtonLabelIssue | null {
  // Check for deprecated labels
  if (BUTTON_LABEL_CONFIG.deprecated.includes(label)) {
    return {
      button: label,
      currentLabel: label,
      location,
      issue: 'unclear',
      recommendation: `Label "${label}" is vague. Use an action verb instead. Example: "Start Free Trial" or "Connect Now"`,
    };
  }

  // Check for clarity
  if (!isClearLabel(label)) {
    return {
      button: label,
      currentLabel: label,
      location,
      issue: 'unclear',
      recommendation: `Label "${label}" isn't clear. Add an action verb. Example: "Create Account" instead of just "${label}"`,
    };
  }

  // Check for consistency with category
  if (!checkConsistency(label, category)) {
    const examples =
      category === 'primary-cta'
        ? 'Start Free Trial, Get Started'
        : category === 'secondary-cta'
        ? 'Learn More, View Details'
        : category === 'action'
        ? 'Save, Submit, Continue'
        : 'Go to Dashboard, View Report';

    return {
      button: label,
      currentLabel: label,
      location,
      issue: 'inconsistent',
      inconsistentWith: [`Expected ${category} pattern`],
      recommendation: `For ${category}, consider: ${examples}`,
    };
  }

  // Label is good
  return null;
}

/**
 * Find duplicate button labels that do different things
 */
export function detectDuplicateLabels(
  buttons: Array<{ label: string; location: string; action: string }>
): ButtonLabelIssue[] {
  const issues: ButtonLabelIssue[] = [];
  const labelMap = new Map<string, typeof buttons>();

  // Group by label
  buttons.forEach(btn => {
    if (!labelMap.has(btn.label)) {
      labelMap.set(btn.label, []);
    }
    labelMap.get(btn.label)!.push(btn);
  });

  // Find duplicates that do different things
  labelMap.forEach((instances, label) => {
    const uniqueActions = new Set(instances.map(i => i.action));
    if (uniqueActions.size > 1) {
      issues.push({
        button: label,
        currentLabel: label,
        location: instances[0].location,
        issue: 'inconsistent',
        inconsistentWith: instances
          .map(i => `${i.action} at ${i.location}`)
          .slice(1),
        recommendation: `Label "${label}" does different things in different places. Either rename buttons to be clear about their action, or consolidate the functionality.`,
      });
    }
  });

  return issues;
}

/**
 * Convert button issues to UX findings
 */
export function convertToFindings(
  issues: (ButtonLabelIssue | null)[]
): UXFinding[] {
  return issues
    .filter((issue): issue is ButtonLabelIssue => issue !== null)
    .map((issue, index) => ({
      id: `button-label-${index}`,
      category: 'labels',
      severity: issue.issue === 'unclear' ? 'high' : 'medium',
      title: `Button label unclear or inconsistent: "${issue.currentLabel}"`,
      description: issue.recommendation,
      location: issue.location,
      recommendation: issue.recommendation,
      autoFixable: issue.issue === 'unclear', // Can suggest fix for unclear labels
      fixStrategy: `Replace with action-oriented label. Example from preferred list`,
      examples: {
        current: issue.currentLabel,
        recommended: BUTTON_LABEL_CONFIG.preferred[0],
      },
    }));
}

/**
 * Validate all buttons in a component/page
 */
export function validateButtonLabels(
  buttons: Array<{
    label: string;
    location: string;
    category?: 'primary-cta' | 'secondary-cta' | 'action' | 'navigation';
  }>
): UXFinding[] {
  const issues: (ButtonLabelIssue | null)[] = [];

  // Analyze each button
  buttons.forEach(btn => {
    const issue = analyzeButtonLabel(
      btn.label,
      btn.category || 'action',
      btn.location
    );
    issues.push(issue);
  });

  // Check for duplicates doing different things
  const dupIssues = detectDuplicateLabels(
    buttons.map(b => ({
      label: b.label,
      location: b.location,
      action: b.label.toLowerCase(),
    }))
  );
  issues.push(...dupIssues);

  return convertToFindings(issues.filter(i => i !== null));
}
