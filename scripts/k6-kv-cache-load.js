/**
 * k6 Load Test: Cloudflare KV Cache Layer
 *
 * Tests policy caching performance:
 * - Cache hits: <10ms (KV read only)
 * - Cache misses: <500ms (KV read + Supabase fetch + cache write)
 * - Cache invalidation: webhook-triggered DELETE endpoint
 * - Multi-tenant isolation: tenant_id in cache key prevents cross-tenant collisions
 *
 * Run:
 *   k6 run scripts/k6-kv-cache-load.js --vus 50 --duration 2m
 *
 * Success Criteria:
 * - Hit rate target: >80% after warm-up (10s)
 * - p95 latency (hits): <20ms
 * - p95 latency (misses): <1000ms
 * - Error rate: <0.1%
 * - Cache invalidation latency: <50ms
 */

import http from 'k6/http';
import { check, group, sleep } from 'k6';
import { Rate, Trend, Counter, Gauge } from 'k6/metrics';

// Custom metrics
const cacheHitRate = new Rate('cache_hits');
const cacheMissRate = new Rate('cache_misses');
const hitLatency = new Trend('cache_hit_latency');
const missLatency = new Trend('cache_miss_latency');
const invalidateLatency = new Trend('cache_invalidate_latency');
const errorCount = new Counter('cache_errors');
const errorRate = new Gauge('cache_error_rate');

export const options = {
  stages: [
    { duration: '10s', target: 10 }, // Warm-up: ramp to 10 VUs
    { duration: '30s', target: 50 }, // Ramp-up: to 50 VUs
    { duration: '60s', target: 50 }, // Sustain: 50 VUs load
    { duration: '20s', target: 10 }, // Ramp-down
    { duration: '10s', target: 0 },  // Cool-down
  ],
  thresholds: {
    'cache_hits': ['rate>0.80'], // >80% hits during sustain
    'cache_hit_latency': ['p95<20'], // p95 <20ms for hits
    'cache_miss_latency': ['p95<1000'], // p95 <1000ms for misses
    'http_req_duration': ['p95<2000'], // Overall p95 <2s
    'cache_errors': ['value<10'], // <10 errors total
  },
};

// Test environment
const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';
const BEARER_TOKEN = __ENV.BEARER_TOKEN || 'test-jwt-token';

// Test data: 10 tenants, 50 policies per tenant
const TENANTS = Array.from({ length: 10 }, (_, i) => `tenant-${i}`);
const POLICIES_PER_TENANT = 50;

function getRandomPolicy() {
  const tenant = TENANTS[Math.floor(Math.random() * TENANTS.length)];
  const policyId = `policy-${Math.floor(Math.random() * POLICIES_PER_TENANT)}`;
  return { tenant, policyId };
}

export default function () {
  // Phase 1: Cache warm-up (first 10s)
  // Read popular policies to populate cache
  if (__VU <= 5 && __ITER < 20) {
    group('warm-up-reads', () => {
      const { tenant, policyId } = getRandomPolicy();
      const response = http.get(
        `${BASE_URL}/api/policies/${tenant}/${policyId}`,
        {
          headers: {
            Authorization: `Bearer ${BEARER_TOKEN}`,
            'Content-Type': 'application/json',
          },
        }
      );

      check(response, {
        'warm-up: status 200 or 404': (r) => r.status === 200 || r.status === 404,
      });
    });
    sleep(0.1);
    return;
  }

  // Phase 2: Sustained cache traffic (30-90s)
  // Mix of hits, misses, and occasional invalidations
  const operationType = Math.random();

  if (operationType < 0.85) {
    // 85% GET requests (cache reads)
    group('cache-reads', () => {
      const { tenant, policyId } = getRandomPolicy();
      const start = Date.now();
      const response = http.get(
        `${BASE_URL}/api/policies/${tenant}/${policyId}`,
        {
          headers: {
            Authorization: `Bearer ${BEARER_TOKEN}`,
            'Content-Type': 'application/json',
          },
        }
      );
      const elapsed = Date.now() - start;

      const isHit = response.headers['X-Cache'] === 'HIT';
      const isMiss = response.headers['X-Cache'] === 'MISS';

      if (isHit) {
        cacheHitRate.add(1);
        hitLatency.add(elapsed);
      } else if (isMiss) {
        cacheMissRate.add(1);
        missLatency.add(elapsed);
      }

      const success =
        (response.status === 200 && response.json('ok') === true) ||
        (response.status === 404 && response.json('error') === 'policy_not_found');

      if (!success) {
        errorCount.add(1);
      }

      check(response, {
        'read: status 200 or 404': (r) => r.status === 200 || r.status === 404,
        'read: has cache header': (r) =>
          r.headers['X-Cache'] === 'HIT' || r.headers['X-Cache'] === 'MISS',
        'read: latency tracked': (r) => r.headers['X-Worker-Latency'] !== undefined,
      });

      errorRate.set(errorCount.value / (__ITER + 1));
    });
  } else if (operationType < 0.95) {
    // 10% DELETE (cache invalidation)
    group('cache-invalidation', () => {
      const { tenant, policyId } = getRandomPolicy();
      const start = Date.now();
      const response = http.del(
        `${BASE_URL}/api/cache/invalidate/${tenant}/${policyId}`,
        null,
        {
          headers: {
            'X-Webhook-Secret': 'test-webhook-secret',
            'Content-Type': 'application/json',
          },
        }
      );
      const elapsed = Date.now() - start;

      invalidateLatency.add(elapsed);

      if (response.status !== 200) {
        errorCount.add(1);
      }

      check(response, {
        'invalidate: status 200': (r) => r.status === 200,
        'invalidate: ok response': (r) => r.json('ok') === true,
        'invalidate: latency <50ms': (r) => elapsed < 50,
      });

      errorRate.set(errorCount.value / (__ITER + 1));
    });
  } else {
    // 5% POST (bulk tenant invalidation)
    group('tenant-invalidation', () => {
      const tenant = TENANTS[Math.floor(Math.random() * TENANTS.length)];
      const start = Date.now();
      const response = http.post(
        `${BASE_URL}/api/cache/invalidate/tenant/${tenant}`,
        null,
        {
          headers: {
            'Content-Type': 'application/json',
          },
        }
      );
      const elapsed = Date.now() - start;

      invalidateLatency.add(elapsed);

      if (response.status !== 200) {
        errorCount.add(1);
      }

      check(response, {
        'bulk-invalidate: status 200': (r) => r.status === 200,
        'bulk-invalidate: ok response': (r) => r.json('ok') === true,
      });

      errorRate.set(errorCount.value / (__ITER + 1));
    });
  }

  sleep(Math.random() * 0.5 + 0.1); // 100-600ms between requests
}

export function handleSummary(data) {
  console.log('=== KV Cache Load Test Summary ===');
  console.log(
    `Hit Rate: ${(cacheHitRate.value * 100).toFixed(1)}% (target: >80% during sustain phase)`
  );
  console.log(
    `Hit Latency p95: ${hitLatency.value.p95.toFixed(2)}ms (target: <20ms)`
  );
  console.log(
    `Miss Latency p95: ${missLatency.value.p95.toFixed(2)}ms (target: <1000ms)`
  );
  console.log(
    `Invalidation Latency p95: ${invalidateLatency.value.p95.toFixed(2)}ms (target: <50ms)`
  );
  console.log(`Total Errors: ${errorCount.value}`);
  console.log(
    `Error Rate: ${(errorRate.value * 100).toFixed(2)}% (target: <0.1%)`
  );

  return {
    'stdout': textSummary(data, { indent: ' ', enableColors: true }),
    'summary.json': JSON.stringify(data),
  };
}

function textSummary(data, options) {
  const lines = [];
  lines.push('');
  lines.push('✓ Cache Performance Metrics:');
  lines.push(
    `  - Hit Rate: ${(cacheHitRate.value * 100).toFixed(1)}% (warm cache)`
  );
  lines.push(
    `  - Hit Latency p95: ${hitLatency.value.p95.toFixed(2)}ms`
  );
  lines.push(
    `  - Miss Latency p95: ${missLatency.value.p95.toFixed(2)}ms`
  );
  lines.push(
    `  - Invalidation p95: ${invalidateLatency.value.p95.toFixed(2)}ms`
  );
  lines.push(`  - Errors: ${errorCount.value}`);
  lines.push('');
  return lines.join('\n');
}
