/**
 * CLI: npm run voice:readiness [-- --json]
 * Gibt nur den Readiness-Report aus. Env-Werte werden nicht gedruckt.
 */
import { runVoiceReadinessCli } from './readiness-report.js';

const code = runVoiceReadinessCli({
  argv: process.argv.slice(2),
  env: process.env,
  stdout: (chunk) => {
    process.stdout.write(chunk);
  },
  stderr: (chunk) => {
    process.stderr.write(chunk);
  },
});

process.exit(code);
