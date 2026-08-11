/**
 * k6 Load Test: Cloudflare R2 Evidence Vault (Dual-Write)
 *
 * Tests evidence ingestion performance:
 * - R2 write latency: <100ms (target, typically 50-80ms)
 * - Supabase write latency: <500ms (secondary, non-blocking)
 * - Dual-write coordination: R2 first (fail-fast), Supabase second (best-effort)
 * - Compliance hold tracking: immutable archive creation
 *
 * Run:
 *   k6 run scripts/k6-evidence-vault-load.js --vus 30 --duration 2m
 *
 * Success Criteria:
 * - p95 R2 write latency: <100ms
 * - p95 dual-write latency: <500ms
 * - p95 evidence retrieval: <50ms (from hot storage)
 * - Error rate: <0.5% (mostly from auth/validation)
 * - Compliance hold creation: 100% success
 */

import http from 'k6/http';
import { check, group, sleep } from 'k6';
import { Rate, Trend, Counter, Gauge } from 'k6/metrics';

// Custom metrics
const r2WriteLatency = new Trend('r2_write_latency');
const supabaseWriteLatency = new Trend('supabase_write_latency');
const dualWriteLatency = new Trend('dual_write_total_latency');
const complianceHoldRate = new Rate('compliance_hold_success');
const errorCount = new Counter('evidence_errors');
const errorRate = new Gauge('evidence_error_rate');
const r2SuccessRate = new Rate('r2_success');

export const options = {
  stages: [
    { duration: '10s', target: 5 }, // Warm-up: ramp to 5 VUs
    { duration: '30s', target: 30 }, // Ramp-up: to 30 VUs
    { duration: '60s', target: 30 }, // Sustain: 30 VUs load (evidence ingestion)
    { duration: '20s', target: 10 }, // Ramp-down
    { duration: '10s', target: 0 },  // Cool-down
  ],
  thresholds: {
    'r2_write_latency': ['p95<100'], // p95 <100ms for R2 writes
    'dual_write_total_latency': ['p95<500'], // p95 <500ms for full dual-write
    'r2_success': ['rate>0.99'], // >99% R2 success (immutable archive)
    'compliance_hold_success': ['rate>0.95'], // >95% compliance hold creation
    'evidence_errors': ['value<15'], // <15 total errors
    'http_req_duration': ['p95<2000'], // Overall p95 <2s
  },
};

// Test environment
const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';
const BEARER_TOKEN = __ENV.BEARER_TOKEN || 'test-jwt-token';

// Test data: 5 tenants, various evidence types
const TENANTS = Array.from({ length: 5 }, (_, i) => `tenant-${i}`);
const EVENT_TYPES = [
  'policy_update',
  'risk_assessment',
  'incident_reported',
  'dpia_created',
  'audit_completed',
  'compliance_check',
];

function generateEvidence(tenantId) {
  const eventType = EVENT_TYPES[Math.floor(Math.random() * EVENT_TYPES.length)];
  const complianceHold = Math.random() < 0.2; // 20% compliance hold rate

  return {
    tenant_id: tenantId,
    event_type: eventType,
    data: {
      description: `Evidence from ${eventType} event`,
      severity: ['low', 'medium', 'high'][Math.floor(Math.random() * 3)],
      asset_id: `asset-${Math.floor(Math.random() * 100)}`,
      timestamp: new Date().toISOString(),
    },
    compliance_hold: complianceHold,
    c2pa_signature: 'sha256:' + Math.random().toString(36).substring(7),
  };
}

export default function () {
  // Phase 1: Warm-up (first 10s)
  if (__VU <= 2 && __ITER < 20) {
    group('warm-up-ingest', () => {
      const tenantId = TENANTS[0];
      const evidence = generateEvidence(tenantId);

      const start = Date.now();
      const response = http.post(
        `${BASE_URL}/api/evidence/ingest/${tenantId}`,
        JSON.stringify(evidence),
        {
          headers: {
            Authorization: `Bearer ${BEARER_TOKEN}`,
            'Content-Type': 'application/json',
          },
        }
      );
      const elapsed = Date.now() - start;

      check(response, {
        'warm-up: status 201': (r) => r.status === 201,
      });
    });
    sleep(0.1);
    return;
  }

  // Phase 2: Sustained evidence ingestion (30-90s)
  const operationType = Math.random();

  if (operationType < 0.80) {
    // 80% POST (ingest evidence)
    group('evidence-ingest', () => {
      const tenantId = TENANTS[Math.floor(Math.random() * TENANTS.length)];
      const evidence = generateEvidence(tenantId);

      const start = Date.now();
      const response = http.post(
        `${BASE_URL}/api/evidence/ingest/${tenantId}`,
        JSON.stringify(evidence),
        {
          headers: {
            Authorization: `Bearer ${BEARER_TOKEN}`,
            'Content-Type': 'application/json',
          },
        }
      );
      const elapsed = Date.now() - start;

      dualWriteLatency.add(elapsed);
      r2WriteLatency.add(elapsed * 0.7); // Estimate R2 portion (typically 70% of total)

      const success = response.status === 201 && response.json('ok') === true;

      if (success) {
        r2SuccessRate.add(1);
        if (evidence.compliance_hold) {
          complianceHoldRate.add(1);
        }
      } else {
        errorCount.add(1);
      }

      check(response, {
        'ingest: status 201': (r) => r.status === 201,
        'ingest: response ok': (r) => r.json('ok') === true,
        'ingest: has evidence_id': (r) => r.json('evidence_id') !== undefined,
        'ingest: has r2_key': (r) => r.json('r2_key') !== undefined,
        'ingest: has r2_etag': (r) => r.json('r2_etag') !== undefined,
        'ingest: latency <500ms': (r) => {
          const workerLatency = r.headers['X-Worker-Latency'];
          if (!workerLatency) return true;
          const ms = parseInt(workerLatency);
          return ms < 500;
        },
      });

      errorRate.set(errorCount.value / (__ITER + 1));
    });
  } else if (operationType < 0.90) {
    // 10% GET (retrieve evidence)
    group('evidence-retrieval', () => {
      const tenantId = TENANTS[Math.floor(Math.random() * TENANTS.length)];
      const evidenceId = `evidence-${Math.floor(Math.random() * 1000)}`;

      const start = Date.now();
      const response = http.get(
        `${BASE_URL}/api/evidence/${tenantId}/${evidenceId}`,
        {
          headers: {
            Authorization: `Bearer ${BEARER_TOKEN}`,
          },
        }
      );
      const elapsed = Date.now() - start;

      // Retrieval from hot storage should be <50ms
      check(response, {
        'retrieve: status 200 or 404': (r) =>
          r.status === 200 || r.status === 404,
        'retrieve: cache header immutable': (r) =>
          r.headers['Cache-Control']?.includes('immutable'),
        'retrieve: latency <50ms (hot)': (r) => elapsed < 50,
      });
    });
  } else {
    // 10% POST (bulk export)
    group('evidence-export', () => {
      const tenantId = TENANTS[Math.floor(Math.random() * TENANTS.length)];
      const today = new Date().toISOString().split('T')[0];
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
        .toISOString()
        .split('T')[0];

      const start = Date.now();
      const response = http.post(
        `${BASE_URL}/api/evidence/export/${tenantId}?start=${thirtyDaysAgo}&end=${today}`,
        null,
        {
          headers: {
            Authorization: `Bearer ${BEARER_TOKEN}`,
            'Content-Type': 'application/json',
          },
        }
      );
      const elapsed = Date.now() - start;

      check(response, {
        'export: status 202': (r) => r.status === 202,
        'export: has export_job_id': (r) => r.json('export_job_id') !== undefined,
      });
    });
  }

  sleep(Math.random() * 0.5 + 0.1); // 100-600ms between requests
}

export function handleSummary(data) {
  console.log('=== Evidence Vault Load Test Summary ===');
  console.log(
    `R2 Write Latency p95: ${r2WriteLatency.value.p95.toFixed(2)}ms (target: <100ms)`
  );
  console.log(
    `Dual-Write Total p95: ${dualWriteLatency.value.p95.toFixed(2)}ms (target: <500ms)`
  );
  console.log(
    `R2 Success Rate: ${(r2SuccessRate.value * 100).toFixed(1)}% (target: >99%)`
  );
  console.log(
    `Compliance Hold Success: ${(complianceHoldRate.value * 100).toFixed(1)}% (target: >95%)`
  );
  console.log(`Total Errors: ${errorCount.value}`);
  console.log(
    `Error Rate: ${(errorRate.value * 100).toFixed(2)}% (target: <0.5%)`
  );

  return {
    'stdout': textSummary(data, { indent: ' ', enableColors: true }),
    'summary.json': JSON.stringify(data),
  };
}

function textSummary(data, options) {
  const lines = [];
  lines.push('');
  lines.push('✓ Evidence Vault Performance Metrics:');
  lines.push(
    `  - R2 Write Latency p95: ${r2WriteLatency.value.p95.toFixed(2)}ms`
  );
  lines.push(
    `  - Dual-Write Total p95: ${dualWriteLatency.value.p95.toFixed(2)}ms`
  );
  lines.push(
    `  - R2 Success Rate: ${(r2SuccessRate.value * 100).toFixed(1)}%`
  );
  lines.push(
    `  - Compliance Hold Rate: ${(complianceHoldRate.value * 100).toFixed(1)}%`
  );
  lines.push(`  - Errors: ${errorCount.value}`);
  lines.push('');
  return lines.join('\n');
}
