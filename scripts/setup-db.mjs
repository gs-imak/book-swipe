#!/usr/bin/env node
/**
 * Check the Supabase schema setup.
 *
 * PostgREST can't execute arbitrary DDL, so this script does NOT create
 * tables. It verifies the connection and reports which tables exist; the
 * schema itself must be applied from lib/supabase-schema.sql via the
 * Supabase dashboard SQL editor or `npx supabase db query`.
 *
 * Usage: node scripts/setup-db.mjs
 */

import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))

const url = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://gdnupcdsuuzzwxtazgpv.supabase.co'
const key = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!key) {
  // Try reading from .env.local
  try {
    const envFile = readFileSync(resolve(__dirname, '..', '.env.local'), 'utf-8')
    const match = envFile.match(/SUPABASE_SERVICE_ROLE_KEY=(.+)/)
    if (match) {
      process.env.SUPABASE_SERVICE_ROLE_KEY = match[1].trim()
    }
  } catch { /* ignore */ }
}

const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!serviceKey) {
  console.error('Missing SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const supabase = createClient(url, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
  db: { schema: 'public' },
})

async function setupTables() {
  console.log('Checking database tables...')

  // Test connection first
  const { error } = await supabase.from('profiles').select('id').limit(1)

  if (error && error.code === '42P01') {
    // Table doesn't exist — we need to run the SQL
    console.log('Tables do not exist yet. You need to run the SQL in the Supabase dashboard.')
    console.log('')
    console.log('1. Go to: https://supabase.com/dashboard/project/gdnupcdsuuzzwxtazgpv/sql')
    console.log('2. Paste the contents of lib/supabase-schema.sql')
    console.log('3. Click "Run"')
    console.log('')
    console.log('Alternatively, set SUPABASE_DB_PASSWORD and run:')
    console.log('  npx supabase db query --db-url "postgresql://postgres:YOUR_PASSWORD@db.gdnupcdsuuzzwxtazgpv.supabase.co:5432/postgres" -f lib/supabase-schema.sql')
    process.exit(1)
  } else if (error) {
    console.log('Connection error:', error.message)
    process.exit(1)
  } else {
    console.log('✓ Tables already exist! Database is ready.')

    // Verify all tables
    const tables = ['profiles', 'books', 'user_books', 'reviews', 'reading_progress', 'swipe_history']
    for (const table of tables) {
      const { error: e } = await supabase.from(table).select('*').limit(0)
      if (e) {
        console.log(`✗ Table "${table}" — ${e.message}`)
      } else {
        console.log(`✓ Table "${table}" — OK`)
      }
    }
  }
}

setupTables()
