import { neon } from '@neondatabase/serverless'

let _sql

/**
 * Neon serverless SQL client (tagged template).
 * Lazy init so missing DATABASE_URL does not break imports during build analysis.
 */
export function getSql() {
  const url = process.env.DATABASE_URL
  if (!url) throw new Error('DATABASE_URL is required')
  if (!_sql) _sql = neon(url)
  return _sql
}
