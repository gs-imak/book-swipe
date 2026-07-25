"use client"

import type { SupabaseClient } from "@supabase/supabase-js"

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn("[BookSwipe] Supabase env vars missing — cloud sync disabled")
}

/** Sync, dependency-free config check — safe to import anywhere. */
export function isSupabaseConfigured(): boolean {
  return !!(supabaseUrl && supabaseAnonKey)
}

// Lazy singleton: @supabase/supabase-js is ~100KB of client JS that most
// sessions (anonymous, local-only) never need. The type-only import above is
// erased at build time; the real module loads on the first getSupabase() call
// — i.e. when auth/sync actually runs — instead of riding in the root bundle.
let _clientPromise: Promise<SupabaseClient | null> | null = null

export function getSupabase(): Promise<SupabaseClient | null> {
  if (!supabaseUrl || !supabaseAnonKey) return Promise.resolve(null)
  if (!_clientPromise) {
    _clientPromise = import("@supabase/supabase-js").then(({ createClient }) =>
      createClient(supabaseUrl, supabaseAnonKey, {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
        },
      })
    )
  }
  return _clientPromise
}
