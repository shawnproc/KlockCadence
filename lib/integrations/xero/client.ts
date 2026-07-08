import { storeTokens, getTokens } from '../tokens'
import type { IntegrationType } from '@/types'

const TYPE: IntegrationType = 'xero'
const TOKEN_URL = 'https://identity.xero.com/connect/token'

interface XeroTokenResponse {
  access_token: string
  refresh_token: string
  expires_in: number
  id_token?: string
}

export async function exchangeXeroCode(orgId: string, code: string): Promise<void> {
  const credentials = Buffer.from(
    `${process.env.XERO_CLIENT_ID!}:${process.env.XERO_CLIENT_SECRET!}`
  ).toString('base64')

  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${credentials}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: process.env.XERO_REDIRECT_URI!,
    }),
  })
  if (!res.ok) throw new Error(`Xero token exchange failed: ${await res.text()}`)
  const data = (await res.json()) as XeroTokenResponse

  // Get tenant (organisation) ID
  const tenantsRes = await fetch('https://api.xero.com/connections', {
    headers: { Authorization: `Bearer ${data.access_token}`, 'Content-Type': 'application/json' },
  })
  const tenants = (await tenantsRes.json()) as { tenantId: string; tenantName: string }[]
  const tenantId = tenants[0]?.tenantId ?? null

  await storeTokens(orgId, TYPE, {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresAt: new Date(Date.now() + data.expires_in * 1000),
    realmId: tenantId,
  })
}

async function getValidXeroToken(orgId: string): Promise<{ token: string; tenantId: string }> {
  const stored = await getTokens(orgId, TYPE)
  if (!stored) throw new Error('Xero not connected')
  if (!stored.realmId) throw new Error('Xero tenant ID missing')

  let token = stored.accessToken
  if (new Date() >= stored.expiresAt) {
    const credentials = Buffer.from(
      `${process.env.XERO_CLIENT_ID!}:${process.env.XERO_CLIENT_SECRET!}`
    ).toString('base64')
    const res = await fetch(TOKEN_URL, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${credentials}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({ grant_type: 'refresh_token', refresh_token: stored.refreshToken }),
    })
    if (!res.ok) throw new Error(`Xero refresh failed: ${await res.text()}`)
    const data = (await res.json()) as XeroTokenResponse
    token = data.access_token
    await storeTokens(orgId, TYPE, {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresAt: new Date(Date.now() + data.expires_in * 1000),
      realmId: stored.realmId,
    })
  }

  return { token, tenantId: stored.realmId }
}

export async function xeroPost<T>(orgId: string, path: string, body: unknown): Promise<T> {
  const { token, tenantId } = await getValidXeroToken(orgId)
  const res = await fetch(`https://api.xero.com${path}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Xero-tenant-id': tenantId,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify(body),
  })
  if (!res.ok) throw new Error(`Xero POST ${path} failed: ${await res.text()}`)
  return res.json() as Promise<T>
}

export async function xeroGet<T>(orgId: string, path: string): Promise<T> {
  const { token, tenantId } = await getValidXeroToken(orgId)
  const res = await fetch(`https://api.xero.com${path}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      'Xero-tenant-id': tenantId,
      Accept: 'application/json',
    },
  })
  if (!res.ok) throw new Error(`Xero GET ${path} failed: ${await res.text()}`)
  return res.json() as Promise<T>
}
