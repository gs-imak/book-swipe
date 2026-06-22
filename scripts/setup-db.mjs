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

// Load any missing vars from .env.local into process.env (URL + key both, so we
// never silently target a stale hardcoded project).
try {
  const envFile = readFileSync(resolve(__dirname, '..', '.env.local'), 'utf-8')
  for (const line of envFile.split('\n')) {
    const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/)
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim()
  }
} catch { /* ignore */ }

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!url || !serviceKey) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in env / .env.local')
  process.exit(1)
}

const projectRef = url.match(/https:\/\/([^.]+)\./)?.[1] || 'YOUR_PROJECT'

const supabase = createClient(url, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
  db: { schema: 'public' },
})

async function setupTables() {
  console.log('Checking database tables...')

  // Test connection first
  const { error } = await supabase.from('profiles').select('id').limit(1)

  // 42P01 = Postgres "undefined table"; PGRST205 = PostgREST "not in schema
  // cache". Both mean the schema hasn't been applied to this project yet.
  const tableMissing =
    error && (error.code === '42P01' || error.code === 'PGRST205' ||
      /schema cache|does not exist/i.test(error.message || ''))

  if (tableMissing) {
    // Table doesn't exist — we need to run the SQL
    console.log('Tables do not exist yet. You need to run the SQL in the Supabase dashboard.')
    console.log('')
    console.log(`1. Go to: https://supabase.com/dashboard/project/${projectRef}/sql`)
    console.log('2. Paste the contents of lib/supabase-schema.sql')
    console.log('3. Click "Run"')
    console.log('')
    console.log('Alternatively, set SUPABASE_DB_PASSWORD and run:')
    console.log(`  npx supabase db query --db-url "postgresql://postgres:YOUR_PASSWORD@db.${projectRef}.supabase.co:5432/postgres" -f lib/supabase-schema.sql`)
    process.exit(1)
  } else if (error) {
    console.log('Connection error:', error.message)
    process.exit(1)
  } else {
    console.log('✓ Tables already exist! Database is ready.')

    // Verify all tables, including the shelf-sync tables.
    const tables = [
      'profiles', 'books', 'user_books', 'reviews', 'reading_progress',
      'swipe_history', 'user_shelves', 'user_book_shelves',
    ]
    let allOk = true
    for (const table of tables) {
      const { error: e } = await supabase.from(table).select('*').limit(0)
      if (e) {
        allOk = false
        console.log(`✗ Table "${table}" — ${e.message}`)
      } else {
        console.log(`✓ Table "${table}" — OK`)
      }
    }

    // Verify the RPCs exist. Called with service_role (auth.uid() is null), so:
    //  - get_co_like_counts returns rows (here: empty) → exists.
    //  - delete_my_account raises "not authenticated" (it guards on auth.uid())
    //    → that specific error proves it exists WITHOUT deleting anything.
    const { error: coErr } = await supabase.rpc('get_co_like_counts', { liked_book_ids: [] })
    console.log(coErr && !/not authenticated/i.test(coErr.message)
      ? `✗ RPC get_co_like_counts — ${coErr.message}`
      : '✓ RPC get_co_like_counts — OK')

    const { error: delErr } = await supabase.rpc('delete_my_account')
    const delExists = !delErr || /not authenticated/i.test(delErr.message)
    console.log(delExists ? '✓ RPC delete_my_account — OK (guard fired, nothing deleted)' : `✗ RPC delete_my_account — ${delErr.message}`)

    if (!allOk) process.exitCode = 1
  }
}

setupTables()
