/**
 * Public API of the Rule Engine package.
 *
 * Bei Phase-9-Migration wird dieses File nach
 * `packages/compliance-rules/src/index.ts` verschoben.
 */
export {
  getAllRules,
  getRule,
  evaluateRule,
  evaluateAll,
  filterBySeverity,
  calculateScore,
} from './evaluator';

export type {
  ComplianceRule,
  RuleCondition,
  Finding,
  Severity,
  RuleCategory,
  Operator,
} from './types';

export { RULE_ENGINE_VERSION } from './types';
