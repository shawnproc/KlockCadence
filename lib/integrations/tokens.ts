import { createServiceClient } from '@/lib/supabase/server'
import { encryptToken, decryptToken } from './encryption'
import type { IntegrationType } from '@/types'

export interface StoredTokens {
  accessToken: string
  refreshToken: string
  expiresAt: Date
  realmId: string | null
}

export async function storeTokens(
  orgId: string,
  integrationType: IntegrationType,
  tokens: StoredTokens
): Promise<void> {
  const svc = createServiceClient()
  const { error } = await svc
    .from('integrations')
    .upsert(
      {
        org_id: orgId,
        integration_type: integrationType,
        status: 'connected',
        access_token_enc: encryptToken(tokens.accessToken),
        refresh_token_enc: encryptToken(tokens.refreshToken),
        token_expires_at: tokens.expiresAt.toISOString(),
        realm_id: tokens.realmId,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'org_id,integration_type' }
    )
  if (error) throw new Error(`Failed to store tokens: ${error.message}`)
}

export async function getTokens(
  orgId: string,
  integrationType: IntegrationType
): Promise<StoredTokens | null> {
  const svc = createServiceClient()
  const { data } = await svc
    .from('integrations')
    .select('access_token_enc, refresh_token_enc, token_expires_at, realm_id, status')
    .eq('org_id', orgId)
    .eq('integration_type', integrationType)
    .single()

  if (!data || data.status === 'disconnected' || !data.access_token_enc || !data.refresh_token_enc) {
    return null
  }

  return {
    accessToken: decryptToken(data.access_token_enc as string),
    refreshToken: decryptToken(data.refresh_token_enc as string),
    expiresAt: new Date(data.token_expires_at as string),
    realmId: data.realm_id as string | null,
  }
}

export async function clearTokens(orgId: string, integrationType: IntegrationType): Promise<void> {
  const svc = createServiceClient()
  await svc
    .from('integrations')
    .update({
      status: 'disconnected',
      access_token_enc: null,
      refresh_token_enc: null,
      token_expires_at: null,
      realm_id: null,
      last_error_message: null,
      updated_at: new Date().toISOString(),
    })
    .eq('org_id', orgId)
    .eq('integration_type', integrationType)
}
