import 'dotenv/config'

const required = (key) => {
  const val = process.env[key]
  if (!val) throw new Error(`Missing required env: ${key}`)
  return val
}

export const config = {
  nodeEnv: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT || '5000'),
  logLevel: process.env.LOG_LEVEL || 'info',

  internalApiKey: required('GATEWAY_INTERNAL_API_KEY'),

  db: {
    url: required('EVIDENCE_RUNTIME_DATABASE_URL'),
  },

  nats: {
    url: required('NATS_URL'),
    user: process.env.NATS_USER || 'realsync-evidence',
    password: process.env.NATS_PASSWORD,
  },

  storagePath: process.env.STORAGE_PATH || '/data/evidence',

  // How long ready exports remain downloadable before expiring.
  exportTtlMs: parseInt(process.env.EXPORT_TTL_MS || String(7 * 24 * 60 * 60 * 1000)),
}
