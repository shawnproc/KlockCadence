import { storeTokens, getTokens } from '../tokens'
import type { IntegrationType } from '@/types'

const TYPE: IntegrationType = 'gusto'
const TOKEN_URL = 'https://api.gusto.com/oauth/token'

interface GustoTokenResponse {
  access_token: string
  refresh_token: string
  expires_in: number
}

export async function exchangeGustoCode(orgId: string, code: string): Promise<void> {
  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      client_id: process.env.GUSTO_CLIENT_ID!,
      client_secret: process.env.GUSTO_CLIENT_SECRET!,
      redirect_uri: process.env.GUSTO_REDIRECT_URI!,
    }),
  })
  if (!res.ok) throw new Error(`Gusto token exchange failed: ${await res.text()}`)
  const data = (await res.json()) as GustoTokenResponse

  // Get company ID from /me endpoint
  const meRes = await fetch('https://api.gusto.com/v1/me', {
    headers: { Authorization: `Bearer ${data.access_token}` },
  })
  const me = (await meRes.json()) as { roles?: { payroll_admin?: { companies?: { id: string }[] } } }
  const companyId = me?.roles?.payroll_admin?.companies?.[0]?.id ?? null

  await storeTokens(orgId, TYPE, {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresAt: new Date(Date.now() + data.expires_in * 1000),
    realmId: companyId ? String(companyId) : null,
  })
}

async function getValidGustoToken(orgId: string): Promise<{ token: string; companyId: string }> {
  const stored = await getTokens(orgId, TYPE)
  if (!stored) throw new Error('Gusto not connected')
  if (!stored.realmId) throw new Error('Gusto company ID missing')

  let token = stored.accessToken
  if (new Date() >= stored.expiresAt) {
    const res = await fetch(TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: stored.refreshToken,
        client_id: process.env.GUSTO_CLIENT_ID!,
        client_secret: process.env.GUSTO_CLIENT_SECRET!,
      }),
    })
    if (!res.ok) throw new Error(`Gusto refresh failed: ${await res.text()}`)
    const data = (await res.json()) as GustoTokenResponse
    token = data.access_token
    await storeTokens(orgId, TYPE, {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresAt: new Date(Date.now() + data.expires_in * 1000),
      realmId: stored.realmId,
    })
  }

  return { token, companyId: stored.realmId }
}

export async function gustoGet<T>(orgId: string, path: string): Promise<T> {
  const { token } = await getValidGustoToken(orgId)
  const res = await fetch(`https://api.gusto.com${path}`, {
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
  })
  if (!res.ok) throw new Error(`Gusto GET ${path} failed: ${await res.text()}`)
  return res.json() as Promise<T>
}

export async function gustoPost<T>(orgId: string, path: string, body: unknown): Promise<T> {
  const { token } = await getValidGustoToken(orgId)
  const res = await fetch(`https://api.gusto.com${path}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify(body),
  })
  if (!res.ok) throw new Error(`Gusto POST ${path} failed: ${await res.text()}`)
  return res.json() as Promise<T>
}

export interface GustoEmployee {
  id: string
  first_name: string
  last_name: string
  email: string
  terminated: boolean
}

export async function listGustoEmployees(orgId: string): Promise<GustoEmployee[]> {
  const { companyId } = await getValidGustoToken(orgId)
  const { token } = await getValidGustoToken(orgId)
  const res = await fetch(`https://api.gusto.com/v1/companies/${companyId}/employees`, {
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
  })
  if (!res.ok) throw new Error(`Gusto employees fetch failed: ${await res.text()}`)
  const list = (await res.json()) as GustoEmployee[]
  return list.filter((e) => !e.terminated)
}
