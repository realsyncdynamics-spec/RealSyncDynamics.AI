import 'dotenv/config'

const required = (key) => {
  const val = process.env[key]
  if (!val) throw new Error(`Missing required env: ${key}`)
  return val
}

export const config = {
  nodeEnv: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT || '4000'),
  logLevel: process.env.LOG_LEVEL || 'info',

  internalApiKey: required('GATEWAY_INTERNAL_API_KEY'),
  jwtSecret: required('JWT_SECRET'),

  db: {
    url: required('RUNTIME_CORE_DATABASE_URL'),
  },

  redis: {
    url: required('REDIS_URL'),
  },

  nats: {
    url: required('NATS_URL'),
    user: process.env.NATS_USER || 'realsync-core',
    password: process.env.NATS_PASSWORD,
  },

  evidenceRuntime: {
    url: process.env.EVIDENCE_RUNTIME_URL || 'http://realsync-evidence-runtime:5000',
    apiKey: process.env.GATEWAY_INTERNAL_API_KEY,
  },
}
