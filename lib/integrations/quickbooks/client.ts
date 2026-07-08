import { storeTokens, getTokens } from '../tokens'
import type { IntegrationType } from '@/types'

const TYPE: IntegrationType = 'quickbooks'

const BASE_URL =
  process.env.QBO_ENVIRONMENT === 'sandbox'
    ? 'https://sandbox-quickbooks.api.intuit.com'
    : 'https://quickbooks.api.intuit.com'

const TOKEN_URL = 'https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer'

interface QBOTokenResponse {
  access_token: string
  refresh_token: string
  expires_in: number
  x_refresh_token_expires_in: number
  token_type: string
}

export async function exchangeCode(
  orgId: string,
  code: string,
  realmId: string
): Promise<void> {
  const clientId = process.env.QBO_CLIENT_ID!
  const clientSecret = process.env.QBO_CLIENT_SECRET!
  const redirectUri = process.env.QBO_REDIRECT_URI!
  const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString('base64')

  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${credentials}`,
      'Content-Type': 'application/x-www-form-urlencoded',
      Accept: 'application/json',
    },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: redirectUri,
    }),
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`QBO token exchange failed: ${text}`)
  }

  const data = (await res.json()) as QBOTokenResponse
  await storeTokens(orgId, TYPE, {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresAt: new Date(Date.now() + data.expires_in * 1000),
    realmId,
  })
}

async function refreshAccessToken(orgId: string, refreshToken: string, realmId: string | null): Promise<string> {
  const clientId = process.env.QBO_CLIENT_ID!
  const clientSecret = process.env.QBO_CLIENT_SECRET!
  const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString('base64')

  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${credentials}`,
      'Content-Type': 'application/x-www-form-urlencoded',
      Accept: 'application/json',
    },
    body: new URLSearchParams({ grant_type: 'refresh_token', refresh_token: refreshToken }),
  })

  if (!res.ok) throw new Error(`QBO refresh failed: ${await res.text()}`)

  const data = (await res.json()) as QBOTokenResponse
  await storeTokens(orgId, TYPE, {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresAt: new Date(Date.now() + data.expires_in * 1000),
    realmId,
  })
  return data.access_token
}

async function getValidToken(orgId: string): Promise<{ token: string; realmId: string }> {
  const stored = await getTokens(orgId, TYPE)
  if (!stored) throw new Error('QuickBooks not connected for this organization')
  if (!stored.realmId) throw new Error('QuickBooks realm ID missing')

  let token = stored.accessToken
  if (new Date() >= stored.expiresAt) {
    token = await refreshAccessToken(orgId, stored.refreshToken, stored.realmId)
  }
  return { token, realmId: stored.realmId }
}

export async function qboGet<T>(orgId: string, path: string): Promise<T> {
  const { token, realmId } = await getValidToken(orgId)
  const url = `${BASE_URL}/v3/company/${realmId}${path}?minorversion=65`
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
  })
  if (!res.ok) throw new Error(`QBO GET ${path} failed: ${await res.text()}`)
  return res.json() as Promise<T>
}

export async function qboPost<T>(orgId: string, path: string, body: unknown): Promise<T> {
  const { token, realmId } = await getValidToken(orgId)
  const url = `${BASE_URL}/v3/company/${realmId}${path}?minorversion=65`
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify(body),
  })
  if (!res.ok) throw new Error(`QBO POST ${path} failed: ${await res.text()}`)
  return res.json() as Promise<T>
}

export async function qboQuery<T>(orgId: string, query: string): Promise<T> {
  const { token, realmId } = await getValidToken(orgId)
  const url = `${BASE_URL}/v3/company/${realmId}/query?query=${encodeURIComponent(query)}&minorversion=65`
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
  })
  if (!res.ok) throw new Error(`QBO query failed: ${await res.text()}`)
  return res.json() as Promise<T>
}

export async function disconnectQBO(orgId: string): Promise<void> {
  const stored = await getTokens(orgId, TYPE)
  if (!stored) return

  const clientId = process.env.QBO_CLIENT_ID!
  const clientSecret = process.env.QBO_CLIENT_SECRET!
  const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString('base64')

  await fetch('https://developer.api.intuit.com/v2/oauth2/tokens/revoke', {
    method: 'POST',
    headers: {
      Authorization: `Basic ${credentials}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({ token: stored.accessToken }),
  })
}

// Fetch QBO employees for employee mapping UI
export interface QBOEmployee {
  Id: string
  DisplayName: string
  PrimaryEmailAddr?: { Address: string }
  Active: boolean
}

export async function listQBOEmployees(orgId: string): Promise<QBOEmployee[]> {
  type QueryResponse = { QueryResponse: { Employee?: QBOEmployee[] } }
  const data = await qboQuery<QueryResponse>(orgId, 'select * from Employee where Active=true MAXRESULTS 100')
  return data.QueryResponse.Employee ?? []
}

// Fetch QBO service items (map to charge codes)
export interface QBOServiceItem {
  Id: string
  Name: string
  FullyQualifiedName: string
  Active: boolean
  Type: string
}

export async function listQBOServiceItems(orgId: string): Promise<QBOServiceItem[]> {
  type QueryResponse = { QueryResponse: { Item?: QBOServiceItem[] } }
  const data = await qboQuery<QueryResponse>(
    orgId,
    "select * from Item where Type='Service' and Active=true MAXRESULTS 100"
  )
  return data.QueryResponse.Item ?? []
}
