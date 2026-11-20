/** Fixed, offline-only composition of existing RealSync modules. */
import { recordReaOutput, createCodingHandoff } from '../handoff/bridge.mjs';
import { prepareReview } from '../handoff/review.mjs';
import { createGoalLoop, submitLoopEvidence, createNextStepsDocument } from '../loop/engine.mjs';
import { composeOfflineIntegration } from './compose.mjs';

const operations = Object.freeze({
  recordReaOutput, createCodingHandoff, prepareReview,
  createGoalLoop, submitLoopEvidence, createNextStepsDocument,
});
export function prepareOfflineIntegration(input) {
  return composeOfflineIntegration(input, operations);
}
