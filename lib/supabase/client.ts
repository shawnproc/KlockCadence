import { createBrowserClient } from '@supabase/ssr'

// Strip UTF-8 BOM (U+FEFF) that PowerShell can inject when piping env vars to the Vercel CLI
const clean = (s: string | undefined) => (s || '').replace(/^﻿/, '')

export function createClient() {
  return createBrowserClient(
    clean(process.env.NEXT_PUBLIC_SUPABASE_URL),
    clean(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)
  )
}
