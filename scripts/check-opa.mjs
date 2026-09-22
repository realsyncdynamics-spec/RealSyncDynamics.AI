import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

// Pin Conftest v0.56.0 by digest; update tag and digest together.
const image =
  process.env.CONFTEST_IMAGE ??
  'openpolicyagent/conftest:v0.56.0@sha256:6e3fe2e577e745ad30dedc651806ba009f66cf62e12b06fdb99b840c1048ec76';
const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const projectDir = path.resolve(scriptDir, '..');
const dockerMount = `type=bind,source=${projectDir},target=/project`;

const commands = [
  ['verify', '-p', 'policy/opa'],
  ['test', '-p', 'policy/opa', 'wrangler-workers.toml', 'wrangler.toml'],
];

for (const args of commands) {
  const result = spawnSync('docker', ['run', '--rm', '--mount', dockerMount, '-w', '/project', '--entrypoint', 'conftest', image, ...args], {
    stdio: 'inherit',
  });

  if (result.error) {
    console.error(`[check:opa] docker invocation failed: ${result.error.message}`);
    process.exit(1);
  }

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}
