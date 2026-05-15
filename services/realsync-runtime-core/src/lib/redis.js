import Redis from 'ioredis'
import { config } from '../config.js'

let client = null

export const getRedis = async () => {
  if (client) return client
  client = new Redis(config.redis.url, {
    lazyConnect: true,
    retryStrategy: (t) => Math.min(t * 100, 3000),
  })
  await client.connect()
  return client
}
