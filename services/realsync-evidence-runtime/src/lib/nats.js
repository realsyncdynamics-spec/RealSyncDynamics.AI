import { connect, StringCodec, JSONCodec } from 'nats'
import { config } from '../config.js'

export const sc = StringCodec()
export const jc = JSONCodec()

let nc = null

export const getNats = async () => {
  if (nc && !nc.isClosed()) return nc
  nc = await connect({
    servers: config.nats.url,
    user: config.nats.user,
    pass: config.nats.password,
    reconnect: true,
    maxReconnectAttempts: -1,
  })
  return nc
}

export const publish = async (subject, payload) => {
  const n = await getNats()
  n.publish(subject, jc.encode(payload))
}
