/** Synthetic example: metadata handoff -> untrusted proposal -> reviewable diff. */
import { REPOSITORY, createCodingHandoff, handoffDigest, recordReaOutput, sha256 } from './bridge.mjs';
import { prepareReview } from './review.mjs';

export function runSyntheticHandoffDemo() {
  const jobId = 'SF-003-demo';
  const commitSha = 'a'.repeat(40); // Fake test-only SHA, never checked out.
  const evidence = recordReaOutput({
    jobId, repository: REPOSITORY, commitSha,
    rawJson: '{"modules":[{"name":"fictional-hello.js"}],"note":"synthetic demonstration only"}',
  });
  const task = createCodingHandoff({
    jobId, repository: REPOSITORY, commitSha,
    goal: 'Refine a fictional hello message inside the demo fixture only.',
    provider: 'codex', evidence,
  });
  const path = 'examples/factory-demo/hello.js';
  const before = 'export const greeting = "Hallo";\n';
  const proposal = {
    schemaVersion: 1, jobId,
    handoffSha256: handoffDigest(task),
    changes: [{ path, baseSha256: sha256(before), newContent: 'export const greeting = "Hallo aus dem Demo-Worker";\n' }],
  };
  return prepareReview(task, proposal, { [path]: before });
}

if (process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href) {
  const result = runSyntheticHandoffDemo();
  process.stdout.write(`${JSON.stringify({ ...result, patch: undefined }, null, 2)}\n`);
}
