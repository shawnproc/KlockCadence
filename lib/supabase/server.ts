import { createServerClient } from '@supabase/ssr'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'

// Strip UTF-8 BOM (U+FEFF) that PowerShell can inject when piping env vars to the Vercel CLI
const clean = (s: string | undefined) => (s || '').replace(/^﻿/, '')

export async function createClient() {
  const cookieStore = await cookies()

  return createServerClient(
    clean(process.env.NEXT_PUBLIC_SUPABASE_URL),
    clean(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY),
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // Server component — cookie mutation ignored
          }
        },
      },
    }
  )
}

export function createServiceClient() {
  return createSupabaseClient(
    clean(process.env.NEXT_PUBLIC_SUPABASE_URL),
    clean(process.env.SUPABASE_SERVICE_ROLE_KEY),
    { auth: { persistSession: false, autoRefreshToken: false } }
  )
}
