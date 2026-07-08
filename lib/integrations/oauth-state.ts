import { hmacSign } from './encryption'

interface OAuthState {
  orgId: string
  userId: string
  issuedAt: number
}

const STATE_TTL_MS = 15 * 60 * 1000 // 15 minutes

export function createOAuthState(orgId: string, userId: string): string {
  const payload = `${orgId}:${userId}:${Date.now()}`
  const sig = hmacSign(payload)
  return Buffer.from(`${payload}:${sig}`).toString('base64url')
}

export function verifyOAuthState(state: string): OAuthState | null {
  try {
    const decoded = Buffer.from(state, 'base64url').toString()
    const parts = decoded.split(':')
    if (parts.length !== 4) return null
    const [orgId, userId, tsStr, sig] = parts as [string, string, string, string]
    const payload = `${orgId}:${userId}:${tsStr}`
    if (hmacSign(payload) !== sig) return null
    const issuedAt = parseInt(tsStr, 10)
    if (Date.now() - issuedAt > STATE_TTL_MS) return null
    return { orgId, userId, issuedAt }
  } catch {
    return null
  }
}
