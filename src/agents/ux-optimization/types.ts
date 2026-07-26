/**
 * UX Optimization Agent - Type Definitions
 */

export interface UXFinding {
  id: string;
  category: 'contrast' | 'labels' | 'accessibility' | 'consistency' | 'navigation';
  severity: 'critical' | 'high' | 'medium' | 'low';
  title: string;
  description: string;
  location: string; // file path or URL
  lineNumber?: number;
  recommendation: string;
  autoFixable: boolean;
  fixStrategy?: string; // How to auto-fix this
  examples?: {
    current: string;
    recommended: string;
  };
}

export interface ColorContrastIssue {
  element: string;
  textColor: string;
  backgroundColor: string;
  ratio: number;
  required: number;
  wcagLevel: 'AAA' | 'AA' | 'fail';
}

export interface ButtonLabelIssue {
  button: string;
  currentLabel: string;
  location: string;
  issue: 'unclear' | 'inconsistent' | 'non-action-verb';
  inconsistentWith?: string[];
  recommendation: string;
}

export interface AccessibilityIssue {
  element: string;
  issue: 'missing-alt-text' | 'missing-aria-label' | 'missing-role' | 'color-only-indicator';
  location: string;
  impact: string;
}

export interface UXAnalysisResult {
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

export interface UXCheckOptions {
  checkContrast?: boolean;
  checkLabels?: boolean;
  checkAccessibility?: boolean;
  checkConsistency?: boolean;
  checkNavigation?: boolean;
  wcagLevel?: 'AA' | 'AAA'; // Default: AA
}

export interface ButtonLabelConfig {
  preferred: string[];
  deprecated: string[];
  actionVerbs: string[];
}

export interface ColorPalette {
  name: string;
  colors: {
    [key: string]: {
      hex: string;
      rgb: { r: number; g: number; b: number };
      luminance: number;
    };
  };
}
