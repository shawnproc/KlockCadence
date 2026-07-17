import { createServiceClient } from '@/lib/supabase/server'

/**
 * Sliding-window rate limiter backed by the auth_rate_limits table.
 * Returns true if the request is allowed, false if the limit is exceeded.
 *
 * Fails OPEN: if the IP can't be determined or the ledger errors (e.g. table
 * missing), the request is allowed — the limiter must never lock out
 * legitimate users because of its own failure.
 */
export async function checkRateLimit(
  ip: string,
  action: string,
  limit: number,
  windowSeconds: number
): Promise<boolean> {
  if (!ip) return true
  const svc = createServiceClient()
  const since = new Date(Date.now() - windowSeconds * 1000).toISOString()
  try {
    const { count, error } = await svc
      .from('auth_rate_limits')
      .select('id', { count: 'exact', head: true })
      .eq('action', action)
      .eq('ip', ip)
      .gte('created_at', since)

    if (error) return true // fail open
    if ((count ?? 0) >= limit) return false

    await svc.from('auth_rate_limits').insert({ ip, action })
    // Opportunistic cleanup of this key's expired rows.
    await svc.from('auth_rate_limits').delete().eq('action', action).eq('ip', ip).lt('created_at', since)
    return true
  } catch {
    return true // fail open
  }
}

/** Extract the client IP from proxy headers (Vercel sets x-forwarded-for). */
export function clientIp(request: Request): string {
  const fwd = request.headers.get('x-forwarded-for') ?? ''
  return fwd.split(',')[0]?.trim() ?? ''
}
