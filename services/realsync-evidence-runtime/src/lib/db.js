import postgres from 'postgres'
import { config } from '../config.js'

let db = null

export const getDb = () => {
  if (!db) {
    db = postgres(config.db.url, {
      max: 10,
      idle_timeout: 30,
      connect_timeout: 10,
      onnotice: () => {},
    })
  }
  return db
}
