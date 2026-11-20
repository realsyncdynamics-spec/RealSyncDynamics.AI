/**
 * SF-005: OFFLINE server-only PostgreSQL adapter.
 * Inject an already authenticated, server-owned pg client. This module never
 * opens a connection, reads credentials, runs a model or deploys anything.
 * The private SQL contract must be reviewed and installed separately.
 */
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const TOKEN = /^[A-Za-z0-9._:-]{8,100}$/;
const WORKER = /^[A-Za-z0-9._:-]{4,100}$/;
function object(x) { return x !== null && typeof x === 'object' && !Array.isArray(x); }
function required(x, pattern, label) {
  if (typeof x !== 'string' || !pattern.test(x)) throw Error('factory_' + label + '_invalid');
}
function positive(x, label) {
  if (!Number.isSafeInteger(x) || x < 1) throw Error('factory_' + label + '_invalid');
}
function snapshot(x, taskId) {
  if (!object(x) || !object(x.goal) || x.goal.jobId !== taskId ||
      x.goal.requireHumanReview !== true || !Array.isArray(x.events) ||
      x.events.length === 0 || !Array.isArray(x.nextSteps)) {
    throw Error('factory_snapshot_invalid');
  }
  if (JSON.stringify(x).length > 65536) throw Error('factory_snapshot_too_large');
  return JSON.stringify(x);
}
function response(result) {
  if (!object(result) || !Number.isSafeInteger(result.version) ||
      result.version < 1 || typeof result.replayed !== 'boolean') {
    throw Error('factory_db_invalid_response');
  }
  return Object.freeze({ version: result.version, replayed: result.replayed });
}
async function queryOne(client, sql, values) {
  let out;
  try {
    out = await client.query(sql, values);
  } catch {
    // Fail closed. Keep raw SQL error details outside user-facing surfaces.
    throw Error('factory_db_write_failed');
  }
  if (!object(out) || !Array.isArray(out.rows) || out.rows.length !== 1 ||
      !object(out.rows[0]?.result)) {
    throw Error('factory_db_invalid_response');
  }
  return out.rows[0].result;
}
export function createFactoryLoopDbAdapter(client) {
  if (!object(client) || typeof client.query !== 'function') {
    throw Error('factory_pg_client_required');
  }
  const identity = (taskId, tenantId) => {
    required(taskId, UUID, 'task_id');
    required(tenantId, UUID, 'tenant_id');
  };
  return Object.freeze({
    async init({ taskId, tenantId, idempotencyKey, state }) {
      identity(taskId, tenantId);
      required(idempotencyKey, TOKEN, 'idempotency_key');
      const body = snapshot(state, taskId);
      if (state.status !== 'ready' || state.checkpointVersion !== 1 ||
          state.events.length !== 1 || state.events[0]?.type !== 'loop_created') {
        throw Error('factory_initial_state_invalid');
      }
      return response(await queryOne(client,
        'SELECT factory_runtime.loop_init($1::uuid,$2::uuid,$3,$4::jsonb,$5::jsonb) AS result',
        [taskId, tenantId, idempotencyKey, body, JSON.stringify(state.events[0])]));
    },
    async claim({ taskId, tenantId, workerId, leaseSeconds = 300 }) {
      identity(taskId, tenantId);
      required(workerId, WORKER, 'worker_id');
      if (!Number.isSafeInteger(leaseSeconds) || leaseSeconds < 30 || leaseSeconds > 900) {
        throw Error('factory_lease_seconds_invalid');
      }
      const r = await queryOne(client,
        'SELECT factory_runtime.loop_claim($1::uuid,$2::uuid,$3,$4::int) AS result',
        [taskId, tenantId, workerId, leaseSeconds]);
      if (!Number.isSafeInteger(r.lease_epoch) || r.lease_epoch < 1 ||
          !Number.isSafeInteger(r.version) || r.version < 1 ||
          typeof r.lease_expires_at !== 'string') {
        throw Error('factory_db_invalid_response');
      }
      return Object.freeze({
        version: r.version, leaseEpoch: r.lease_epoch, leaseExpiresAt: r.lease_expires_at,
      });
    },
    async heartbeat({ taskId, tenantId, workerId, leaseEpoch, leaseSeconds = 300 }) {
      identity(taskId, tenantId);
      required(workerId, WORKER, 'worker_id');
      positive(leaseEpoch, 'lease_epoch');
      if (!Number.isSafeInteger(leaseSeconds) || leaseSeconds < 30 || leaseSeconds > 900) {
        throw Error('factory_lease_seconds_invalid');
      }
      const r = await queryOne(client,
        'SELECT factory_runtime.loop_heartbeat($1::uuid,$2::uuid,$3,$4::bigint,$5::int) AS result',
        [taskId, tenantId, workerId, leaseEpoch, leaseSeconds]);
      if (!Number.isSafeInteger(r.lease_epoch) || r.lease_epoch !== leaseEpoch ||
          !Number.isSafeInteger(r.version) || r.version < 1 ||
          typeof r.lease_expires_at !== 'string') {
        throw Error('factory_db_invalid_response');
      }
      return Object.freeze({
        version: r.version, leaseEpoch: r.lease_epoch, leaseExpiresAt: r.lease_expires_at,
      });
    },
    async release({ taskId, tenantId, workerId, leaseEpoch }) {
      identity(taskId, tenantId);
      required(workerId, WORKER, 'worker_id');
      positive(leaseEpoch, 'lease_epoch');
      const r = await queryOne(client,
        'SELECT factory_runtime.loop_release($1::uuid,$2::uuid,$3,$4::bigint) AS result',
        [taskId, tenantId, workerId, leaseEpoch]);
      if (r.released !== true || r.lease_epoch !== leaseEpoch) {
        throw Error('factory_db_invalid_response');
      }
      return Object.freeze({ released: true, leaseEpoch });
    },
    async commit({ taskId, tenantId, expectedVersion, workerId, leaseEpoch,
                   idempotencyKey, state }) {
      identity(taskId, tenantId);
      positive(expectedVersion, 'expected_version');
      positive(leaseEpoch, 'lease_epoch');
      required(workerId, WORKER, 'worker_id');
      required(idempotencyKey, TOKEN, 'idempotency_key');
      const body = snapshot(state, taskId);
      if (state.checkpointVersion !== expectedVersion + 1 ||
          state.events.length < 2) throw Error('factory_checkpoint_version_invalid');
      return response(await queryOne(client,
        'SELECT factory_runtime.loop_commit($1::uuid,$2::uuid,$3::bigint,$4,$5::bigint,$6,$7::jsonb,$8::jsonb) AS result',
        [taskId, tenantId, expectedVersion, workerId, leaseEpoch,
          idempotencyKey, body, JSON.stringify(state.events.at(-1))]));
    },
    async read({ taskId, tenantId }) {
      identity(taskId, tenantId);
      const r = await queryOne(client,
        'SELECT factory_runtime.loop_read($1::uuid,$2::uuid) AS result',
        [taskId, tenantId]);
      if (!object(r.snapshot) || !Number.isSafeInteger(r.version) || r.version < 1 ||
          r.snapshot.checkpointVersion !== r.version ||
          r.snapshot.goal?.jobId !== taskId) throw Error('factory_db_invalid_response');
      return Object.freeze({ state: r.snapshot, version: r.version });
    },
  });
}
