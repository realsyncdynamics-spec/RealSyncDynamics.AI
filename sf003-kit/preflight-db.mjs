/** Check the actual PG backend before any destructive test SQL. */
export async function verifyLocalDatabase(pool, expectedName) {
  const state = await pool.query(`
    SELECT current_database() AS db_name,
           host(inet_server_addr()) AS address,
           inet_server_port() AS port,
           current_setting('is_superuser') AS superuser,
           pg_is_in_recovery() AS recovery
  `);
  const r = state.rows[0];
  if (!r || r.db_name !== expectedName ||
      !['127.0.0.1', '::1'].includes(r.address) ||
      Number(r.port) !== 55432 || r.superuser !== 'on' || r.recovery) {
    console.error('SF003 local-only preflight rejected:', JSON.stringify({db_name:r?.db_name,address:r?.address,port:r?.port,superuser:r?.superuser,recovery:r?.recovery}));
    throw new Error('local PostgreSQL server identity/privilege check failed');
  }
  const existing = await pool.query(`
    SELECT n.nspname FROM pg_catalog.pg_namespace n
    WHERE n.nspname !~ '^pg_'
      AND n.nspname NOT IN ('information_schema','public','sf003_test')
    UNION ALL
    SELECT 'public has objects' FROM pg_catalog.pg_class c
      JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace
    WHERE n.nspname='public' AND c.relkind IN ('r','p','v','m','f')
    LIMIT 1
  `);
  if (existing.rows.length) throw new Error('test database contains non-test objects');
}
