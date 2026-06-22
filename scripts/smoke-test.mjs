#!/usr/bin/env node
/**
 * End-to-end smoke test against the live Supabase project. Proves the
 * launch-critical path actually works (not just that tables exist):
 *   1. admin-create a confirmed throwaway user (no email sent)
 *   2. sign in as that user with the anon key (real RLS-scoped session)
 *   3. the handle_new_user trigger auto-created their profile
 *   4. write to the shared catalog + their library (RLS WITH CHECK passes)
 *   5. read back ONLY their own rows (RLS isolation)
 *   6. call the get_co_like_counts RPC
 *   7. admin-delete the user — FK cascade removes all their rows
 *
 * Creates and then DELETES a single throwaway user; cleans up in a finally block.
 * Usage: node scripts/smoke-test.mjs
 */
import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
try {
  const envFile = readFileSync(resolve(__dirname, '..', '.env.local'), 'utf-8')
  for (const line of envFile.split('\n')) {
    const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/)
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim()
  }
} catch { /* ignore */ }

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!url || !anonKey || !serviceKey) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY / SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const admin = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } })
const email = `smoke-${Date.now()}@bookswipe.test`
const password = 'Smoke-Test-Pw-12345!'
let userId = null
let failures = 0
const check = (ok, label, detail) => {
  console.log(`${ok ? '✓' : '✗'} ${label}${ok ? '' : ` — ${detail}`}`)
  if (!ok) failures++
}

try {
  const { data: created, error: createErr } = await admin.auth.admin.createUser({
    email, password, email_confirm: true,
  })
  check(!createErr && !!created?.user, 'admin create user', createErr?.message)
  if (createErr) throw createErr
  userId = created.user.id

  const anon = createClient(url, anonKey, { auth: { persistSession: false, autoRefreshToken: false } })
  const { error: signInErr } = await anon.auth.signInWithPassword({ email, password })
  check(!signInErr, 'sign in with password', signInErr?.message)
  if (signInErr) throw signInErr

  // handle_new_user trigger should have created a profile row.
  const { data: prof } = await anon.from('profiles').select('id').eq('id', userId)
  check(prof?.length === 1, 'auto-created profile (trigger)', `got ${prof?.length ?? 0} rows`)

  // Write to shared catalog (books INSERT policy: authenticated + title/author).
  const bookId = `smoke-book-${Date.now()}`
  const { error: bookErr } = await anon.from('books').upsert(
    { id: bookId, title: 'Smoke Test Book', author: 'Tester' },
    { onConflict: 'id', ignoreDuplicates: true },
  )
  check(!bookErr, 'insert into shared catalog', bookErr?.message)

  // Write to own library.
  const { error: ubErr } = await anon.from('user_books').upsert(
    { user_id: userId, book_id: bookId, updated_at: new Date().toISOString() },
    { onConflict: 'user_id,book_id' },
  )
  check(!ubErr, 'insert own user_books row', ubErr?.message)

  // Read back — unfiltered select must return ONLY own rows (RLS isolation).
  const { data: ownBooks, error: readErr } = await anon.from('user_books').select('book_id')
  check(!readErr && ownBooks?.length === 1 && ownBooks[0].book_id === bookId,
    'RLS: unfiltered read returns only own rows', readErr?.message || `got ${ownBooks?.length} rows`)

  // Collaborative-filtering RPC callable by an authenticated user.
  const { error: rpcErr } = await anon.rpc('get_co_like_counts', { liked_book_ids: [bookId] })
  check(!rpcErr, 'call get_co_like_counts RPC', rpcErr?.message)
} catch (e) {
  console.log('  (aborted:', e?.message || String(e), ')')
} finally {
  if (userId) {
    const { error: delErr } = await admin.auth.admin.deleteUser(userId)
    check(!delErr, 'cleanup: delete test user', delErr?.message)
    // Cascade check: the user's library rows should be gone.
    const { data: leftover } = await admin.from('user_books').select('book_id').eq('user_id', userId)
    check((leftover?.length ?? 0) === 0, 'FK cascade removed user rows', `${leftover?.length} leftover`)
  }
}

console.log(failures === 0 ? '\nALL SMOKE CHECKS PASSED' : `\n${failures} CHECK(S) FAILED`)
process.exit(failures === 0 ? 0 : 1)
