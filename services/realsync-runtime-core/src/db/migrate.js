import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import postgres from 'postgres'
import { config } from '../config.js'

const __dir = dirname(fileURLToPath(import.meta.url))
const sql = postgres(config.db.url)

const migrate = async () => {
  console.log('Running migrations...')
  const schema = readFileSync(join(__dir, 'schema.sql'), 'utf8')
  await sql.unsafe(schema)
  console.log('Migrations complete.')
  await sql.end()
}

migrate().catch((err) => {
  console.error('Migration failed:', err)
  process.exit(1)
})
