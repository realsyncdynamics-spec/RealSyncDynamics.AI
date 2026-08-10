/**
 * k6 Load Test: Cloudflare Workers JWT Verification Canary
 *
 * Purpose: Validate Worker performance under load (100 req/sec sustained)
 * Target metrics:
 *   - Error rate: <0.5%
 *   - p95 latency: <100ms
 *   - p99 latency: <150ms
 *   - Success rate: >99.5%
 *
 * Usage:
 *   k6 run --duration 5m --vus 10 scripts/k6-verify-jwt-load.js
 *
 *   --duration 5m     : Run for 5 minutes
 *   --vus 10          : 10 virtual users (concurrent requests)
 *   --rps 100         : Rate limit to 100 requests per second
 */

import http from 'k6/http';
import { check, group, sleep } from 'k6';
import { Rate, Trend, Counter } from 'k6/metrics';

// Environment configuration
const STAGING_API = __ENV.API_URL || 'https://staging-api.realsyncdynamics.ai';
const TEST_JWT = __ENV.TEST_JWT || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...';

// Custom metrics
const errorRate = new Rate('error_rate');
const successRate = new Rate('success_rate');
const latency = new Trend('latency_ms');
const workerLatency = new Trend('worker_latency_ms');
const originLatency = new Trend('origin_latency_ms');
const verifyJwtCount = new Counter('verify_jwt_requests');
const expiredTokenRejections = new Counter('expired_token_rejections');
const invalidSignatureRejections = new Counter('invalid_signature_rejections');

// Load profile: ramp up, hold, ramp down
export const options = {
  stages: [
    { duration: '1m', target: 5 },    // Ramp-up to 5 VUs over 1 minute
    { duration: '3m', target: 10 },   // Hold at 10 VUs (100 req/sec) for 3 minutes
    { duration: '1m', target: 0 },    // Ramp-down to 0 over 1 minute
  ],
  thresholds: {
    'error_rate': ['p(95) < 0.005'],     // 95th percentile error rate < 0.5%
    'latency_ms': ['p(95) < 100'],       // 95th percentile latency < 100ms
    'success_rate': ['p(95) > 0.995'],   // 95th percentile success > 99.5%
  },
};

/**
 * Test scenario: Call verify-jwt Worker with valid token
 */
function testVerifyJwtValid() {
  const payload = JSON.stringify({});
  const params = {
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${TEST_JWT}`,
    },
    timeout: '10s',
  };

  const startTime = Date.now();
  const response = http.post(`${STAGING_API}/api/auth/verify-jwt`, payload, params);
  const elapsedMs = Date.now() - startTime;

  verifyJwtCount.add(1);
  latency.add(elapsedMs);

  // Detect canary vs. origin based on latency
  if (elapsedMs < 100) {
    workerLatency.add(elapsedMs);
  } else {
    originLatency.add(elapsedMs);
  }

  const checks = check(response, {
    'status is 200': (r) => r.status === 200,
    'response has ok field': (r) => {
      try {
        return JSON.parse(r.body).ok === true;
      } catch {
        return false;
      }
    },
    'response has user_id': (r) => {
      try {
        return !!JSON.parse(r.body).user_id;
      } catch {
        return false;
      }
    },
    'latency < 300ms': (r) => elapsedMs < 300,
  });

  if (checks) {
    successRate.add(true);
  } else {
    errorRate.add(true);
  }
}

/**
 * Test scenario: Call verify-jwt with expired token
 * (Expected: 401 with "expired_token" error)
 */
function testVerifyJwtExpired() {
  const expiredToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJleHAiOjE2OTM1MDAwMDB9...';
  const params = {
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${expiredToken}`,
    },
    timeout: '10s',
  };

  const startTime = Date.now();
  const response = http.post(`${STAGING_API}/api/auth/verify-jwt`, '', params);
  const elapsedMs = Date.now() - startTime;

  latency.add(elapsedMs);

  const checks = check(response, {
    'status is 401': (r) => r.status === 401,
    'error is expired_token': (r) => {
      try {
        return JSON.parse(r.body).error === 'expired_token';
      } catch {
        return false;
      }
    },
  });

  if (checks) {
    expiredTokenRejections.add(1);
    successRate.add(true);
  } else {
    errorRate.add(true);
  }
}

/**
 * Test scenario: Call verify-jwt with invalid signature
 * (Expected: 401 with "invalid_token" error)
 */
function testVerifyJwtInvalidSignature() {
  const tampered = `${TEST_JWT.slice(0, -10)}tampered!!!`;
  const params = {
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${tampered}`,
    },
    timeout: '10s',
  };

  const startTime = Date.now();
  const response = http.post(`${STAGING_API}/api/auth/verify-jwt`, '', params);
  const elapsedMs = Date.now() - startTime;

  latency.add(elapsedMs);

  const checks = check(response, {
    'status is 401': (r) => r.status === 401,
    'error is invalid_token': (r) => {
      try {
        return JSON.parse(r.body).error === 'invalid_token';
      } catch {
        return false;
      }
    },
  });

  if (checks) {
    invalidSignatureRejections.add(1);
    successRate.add(true);
  } else {
    errorRate.add(true);
  }
}

/**
 * Test scenario: Missing Authorization header
 * (Expected: 401 with "missing_token" error)
 */
function testVerifyJwtMissingAuth() {
  const params = {
    headers: {
      'Content-Type': 'application/json',
    },
    timeout: '10s',
  };

  const startTime = Date.now();
  const response = http.post(`${STAGING_API}/api/auth/verify-jwt`, '', params);
  const elapsedMs = Date.now() - startTime;

  latency.add(elapsedMs);

  const checks = check(response, {
    'status is 401': (r) => r.status === 401,
    'error is missing_token': (r) => {
      try {
        return JSON.parse(r.body).error === 'missing_token';
      } catch {
        return false;
      }
    },
  });

  if (checks) {
    successRate.add(true);
  } else {
    errorRate.add(true);
  }
}

/**
 * Main test function
 * - 80% of traffic: valid token (success path)
 * - 10% of traffic: expired token (error path)
 * - 5% of traffic: invalid signature (error path)
 * - 5% of traffic: missing auth (error path)
 */
export default function () {
  group('Verify JWT - Valid Token (80%)', testVerifyJwtValid);

  sleep(0.05); // 50ms between requests per VU

  // Sample error cases (10%, 5%, 5%)
  const random = Math.random();
  if (random < 0.1) {
    group('Verify JWT - Expired Token (10%)', testVerifyJwtExpired);
  } else if (random < 0.15) {
    group('Verify JWT - Invalid Signature (5%)', testVerifyJwtInvalidSignature);
  } else if (random < 0.2) {
    group('Verify JWT - Missing Auth (5%)', testVerifyJwtMissingAuth);
  }

  sleep(0.1); // 100ms between iterations
}

/**
 * Setup: Called once at the start
 * (Useful for initializing test data, checking endpoint health, etc.)
 */
export function setup() {
  // Health check: verify API is reachable
  const healthResponse = http.get(`${STAGING_API}/health`);
  check(healthResponse, {
    'API is healthy': (r) => r.status === 200,
  });

  if (healthResponse.status !== 200) {
    throw new Error(`API health check failed: ${healthResponse.status}`);
  }

  return { apiReady: true };
}

/**
 * Teardown: Called once at the end
 * (Useful for reporting, cleanup, etc.)
 */
export function teardown(data) {
  if (!data.apiReady) {
    console.error('Test setup failed, skipping teardown');
    return;
  }

  // Summary statistics (logged to stdout + file)
  console.log(`
╔═══════════════════════════════════════════════════════════╗
║       JWT Verification Worker - Load Test Results        ║
╠═══════════════════════════════════════════════════════════╣
║ Total Requests:               ${verifyJwtCount.value}
║ Success Rate:                 ${((successRate.value / verifyJwtCount.value) * 100).toFixed(2)}%
║ Error Rate:                   ${((errorRate.value / verifyJwtCount.value) * 100).toFixed(2)}%
║
║ Latency (all paths):
║   Mean:                       ${latency.value.mean.toFixed(2)}ms
║   p50:                        ${latency.value.percentile(50).toFixed(2)}ms
║   p95:                        ${latency.value.percentile(95).toFixed(2)}ms
║   p99:                        ${latency.value.percentile(99).toFixed(2)}ms
║
║ Worker Path (canary, <100ms):
║   Requests:                   ${workerLatency.count}
║   Mean:                       ${(workerLatency.value.mean || 0).toFixed(2)}ms
║   p95:                        ${(workerLatency.value.percentile(95) || 0).toFixed(2)}ms
║
║ Origin Path (fallback, ≥100ms):
║   Requests:                   ${originLatency.count}
║   Mean:                       ${(originLatency.value.mean || 0).toFixed(2)}ms
║   p95:                        ${(originLatency.value.percentile(95) || 0).toFixed(2)}ms
║
║ Error Details:
║   Expired Tokens Rejected:    ${expiredTokenRejections.value}
║   Invalid Signatures Rejected: ${invalidSignatureRejections.value}
╚═══════════════════════════════════════════════════════════╝
  `);
}
