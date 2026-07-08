import { createServiceClient } from '@/lib/supabase/server'
import { listQBOEmployees } from './client'

export interface AutoMatchResult {
  matched: number
  unmatched: string[]
}

export async function autoMatchQBOEmployees(orgId: string): Promise<AutoMatchResult> {
  const svc = createServiceClient()

  const [{ data: kcUsers }, qboEmployees] = await Promise.all([
    svc.from('users').select('id, full_name, email').eq('org_id', orgId),
    listQBOEmployees(orgId),
  ])

  const qboByEmail = new Map(
    qboEmployees
      .filter((e) => e.PrimaryEmailAddr?.Address)
      .map((e) => [e.PrimaryEmailAddr!.Address.toLowerCase(), e])
  )
  const qboByName = new Map(
    qboEmployees.map((e) => [e.DisplayName.toLowerCase().trim(), e])
  )

  let matched = 0
  const unmatched: string[] = []

  for (const user of kcUsers ?? []) {
    const emailKey = (user.email as string).toLowerCase()
    const nameKey = (user.full_name as string).toLowerCase().trim()
    const qboEmployee = qboByEmail.get(emailKey) ?? qboByName.get(nameKey)

    if (qboEmployee) {
      await svc.from('integration_mappings').upsert(
        {
          org_id: orgId,
          integration_type: 'quickbooks',
          kc_user_id: user.id,
          external_id: qboEmployee.Id,
          external_name: qboEmployee.DisplayName,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'org_id,integration_type,kc_user_id' }
      )
      matched++
    } else {
      unmatched.push(user.full_name as string)
    }
  }

  return { matched, unmatched }
}
