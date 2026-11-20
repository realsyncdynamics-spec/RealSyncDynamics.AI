/**
 * SF-003 local-only destructive test target validation.
 * The URI format is deliberately restricted: query-string overrides such as
 * ?host=... or ?sslmode=... cannot silently redirect the PG client.
 * This is a guardrail, not proof against SSH port forwarding or a rogue local proxy.
 */
export function approvedTestUrl(raw, env = process.env) {
  if (env.SF003_DISPOSABLE_DB !== 'YES' || env.SF003_SCHEMA_RESET !== 'YES') {
    throw new Error('SF003_DISPOSABLE_DB=YES and SF003_SCHEMA_RESET=YES required');
  }
  if (typeof raw !== 'string' || raw.length === 0 || raw.length > 1024) {
    throw new Error('SF003_TEST_DATABASE_URL required (max 1024 bytes)');
  }
  let u;
  try { u = new URL(raw); }
  catch { throw new Error('invalid PostgreSQL URI'); }
  if (!['postgres:', 'postgresql:'].includes(u.protocol) ||
      !['127.0.0.1', '[::1]'].includes(u.hostname) ||
      u.port !== '55432' ||
      !/^\/sf003_test_[a-z0-9_]{1,40}$/.test(u.pathname) ||
      !/^[a-z][a-z0-9_]{1,32}$/.test(u.username) ||
      !u.password ||
      u.search || u.hash) {
    throw new Error('unsafe target: use postgres://USER:PASSWORD@127.0.0.1:55432/sf003_test_NAME (no URL parameters)');
  }
  return raw;
}
