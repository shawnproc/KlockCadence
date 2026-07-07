/**
 * Seed Script — Red Drum Holdings LLC
 * Run: npx ts-node --project tsconfig.json scripts/seed.ts
 * Requires: SUPABASE_SERVICE_ROLE_KEY and NEXT_PUBLIC_SUPABASE_URL in env
 */
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

const ORG_ID = 'a1b2c3d4-0001-0001-0001-000000000001'

const EMPLOYEES = [
  { email: 'marcus.hayes@reddrumholdingsllc.com', full_name: 'Marcus D. Hayes', role: 'admin', department: 'Operations', hire_date: '2019-03-15' },
  { email: 'sara.whitfield@reddrumholdingsllc.com', full_name: 'Sara T. Whitfield', role: 'finance', department: 'Finance', hire_date: '2020-07-01' },
  { email: 'devonte.rivers@reddrumholdingsllc.com', full_name: 'DeVonte L. Rivers', role: 'manager', department: 'Engineering', hire_date: '2021-01-10' },
  { email: 'anita.kowalski@reddrumholdingsllc.com', full_name: 'Anita Kowalski', role: 'manager', department: 'Program Management', hire_date: '2020-11-05' },
  { email: 'tyrell.brooks@reddrumholdingsllc.com', full_name: 'Tyrell J. Brooks', role: 'employee', department: 'Engineering', hire_date: '2022-02-14' },
  { email: 'priya.nair@reddrumholdingsllc.com', full_name: 'Priya Nair', role: 'employee', department: 'Engineering', hire_date: '2022-06-20' },
  { email: 'james.okeefe@reddrumholdingsllc.com', full_name: 'James O\'Keefe', role: 'employee', department: 'Program Management', hire_date: '2023-03-01' },
  { email: 'layla.chen@reddrumholdingsllc.com', full_name: 'Layla Chen', role: 'employee', department: 'Engineering', hire_date: '2023-08-14' },
  { email: 'roberto.silva@reddrumholdingsllc.com', full_name: 'Roberto Silva', role: 'employee', department: 'Program Management', hire_date: '2021-05-17' },
  { email: 'destiny.walker@reddrumholdingsllc.com', full_name: 'Destiny Walker', role: 'employee', department: 'Engineering', hire_date: '2024-01-08' },
  { email: 'hassan.ahmed@reddrumholdingsllc.com', full_name: 'Hassan Ahmed', role: 'employee', department: 'Program Management', hire_date: '2022-09-19' },
  { email: 'claire.dupont@reddrumholdingsllc.com', full_name: 'Claire Dupont', role: 'employee', department: 'Engineering', hire_date: '2023-11-27' },
  { email: 'nathaniel.stone@reddrumholdingsllc.com', full_name: 'Nathaniel Stone', role: 'employee', department: 'Engineering', hire_date: '2020-04-06' },
  { email: 'maya.patel@reddrumholdingsllc.com', full_name: 'Maya Patel', role: 'employee', department: 'Program Management', hire_date: '2021-10-12' },
  // Phase 2 employees — added for specific anomaly scenarios
  { email: 'sarah.johnson@reddrumholdingsllc.com', full_name: 'Sarah Johnson', role: 'employee', department: 'Engineering', hire_date: '2023-06-01' },
  { email: 'james.williams@reddrumholdingsllc.com', full_name: 'James Williams', role: 'employee', department: 'Program Management', hire_date: '2022-04-15' },
  { email: 'david.chen@reddrumholdingsllc.com', full_name: 'David Chen', role: 'employee', department: 'Engineering', hire_date: '2021-08-23' },
]

const CHARGE_CODE_IDS = {
  navy: 'cc000001-0001-0001-0001-000000000001',
  afrl: 'cc000002-0001-0001-0001-000000000001',
  dha: 'cc000003-0001-0001-0001-000000000001',
  overhead: 'cc000004-0001-0001-0001-000000000001',
}

async function getMonday(weeksAgo: number): Promise<string> {
  const now = new Date()
  const dayOfWeek = now.getDay()
  const daysToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek
  const monday = new Date(now)
  monday.setDate(now.getDate() + daysToMonday - weeksAgo * 7)
  return monday.toISOString().split('T')[0]!
}

function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr)
  d.setDate(d.getDate() + days)
  return d.toISOString().split('T')[0]!
}

function randomHours(base = 8, variance = 0.5): number {
  const raw = base + (Math.random() - 0.5) * variance * 2
  return Math.round(raw * 4) / 4 // round to nearest 0.25
}

async function seed() {
  console.log('🌱 Seeding Red Drum Holdings LLC...')

  const userIds: Record<string, string> = {}

  for (const emp of EMPLOYEES) {
    const { data: authData, error } = await supabase.auth.admin.createUser({
      email: emp.email,
      password: 'KlockCadence2025!',
      email_confirm: true,
    })

    if (error && !error.message.includes('already registered')) {
      console.error(`Failed to create auth user ${emp.email}:`, error.message)
      continue
    }

    const userId = authData?.user?.id
    if (!userId) {
      const { data: existing } = await supabase.auth.admin.listUsers()
      const found = existing?.users?.find((u) => u.email === emp.email)
      if (!found) { console.error(`Could not find user ${emp.email}`); continue }
      userIds[emp.email] = found.id
    } else {
      userIds[emp.email] = userId
    }

    const { error: profileError } = await supabase.from('users').upsert({
      id: userIds[emp.email],
      org_id: ORG_ID,
      full_name: emp.full_name,
      email: emp.email,
      role: emp.role,
      department: emp.department,
      hire_date: emp.hire_date,
    })

    if (profileError) console.error(`Profile error ${emp.email}:`, profileError.message)
    else console.log(`  ✓ ${emp.full_name} (${emp.role})`)
  }

  // Leave balances
  console.log('\n📊 Seeding leave balances...')
  for (const emp of EMPLOYEES) {
    const uid = userIds[emp.email]
    if (!uid) continue
    for (const lt of ['annual', 'sick'] as const) {
      const accrued = lt === 'annual' ? randomHours(80, 20) : randomHours(120, 30)
      const used = randomHours(accrued * 0.3, 8)
      await supabase.from('leave_balances').upsert({
        org_id: ORG_ID, user_id: uid, leave_type: lt,
        accrued_hours: accrued, used_hours: used, pending_hours: 0,
        last_accrual_date: new Date().toISOString().split('T')[0],
      })
    }
  }

  // Timesheets — 4 weeks of data for employees
  console.log('\n🕐 Seeding timesheets...')
  const employees = EMPLOYEES.filter((e) => ['employee', 'manager'].includes(e.role))

  for (let weekAgo = 4; weekAgo >= 1; weekAgo--) {
    const weekStart = await getMonday(weekAgo)
    for (const emp of employees) {
      const uid = userIds[emp.email]
      if (!uid) continue

      const { data: ts } = await supabase.from('timesheets').insert({
        org_id: ORG_ID, user_id: uid, week_start_date: weekStart,
        status: weekAgo > 1 ? 'approved' : 'submitted',
        certified_by_employee: true,
        certified_at: addDays(weekStart, 4) + 'T17:00:00Z',
        approved_by: weekAgo > 1 ? userIds['devonte.rivers@reddrumholdingsllc.com'] : null,
        approved_at: weekAgo > 1 ? addDays(weekStart, 5) + 'T10:00:00Z' : null,
      }).select().single()

      if (!ts) continue

      const codePrimary = emp.department === 'Engineering' ? CHARGE_CODE_IDS.navy : CHARGE_CODE_IDS.dha
      for (let d = 0; d < 5; d++) {
        const workDate = addDays(weekStart, d)
        const mainHours = randomHours(7.5, 0.5)
        const overheadHours = 8 - mainHours

        await supabase.from('timesheet_entries').insert([
          {
            org_id: ORG_ID, timesheet_id: ts.id, user_id: uid,
            charge_code_id: codePrimary, work_date: workDate,
            hours: mainHours, entry_created_at: workDate + 'T09:00:00Z',
          },
          ...(overheadHours > 0 ? [{
            org_id: ORG_ID, timesheet_id: ts.id, user_id: uid,
            charge_code_id: CHARGE_CODE_IDS.overhead, work_date: workDate,
            hours: overheadHours, entry_created_at: workDate + 'T17:00:00Z',
          }] : []),
        ])
      }
    }
  }

  // Pre-seeded anomalies
  console.log('\n⚠️  Seeding anomalies...')
  const destinyId = userIds['destiny.walker@reddrumholdingsllc.com']
  const hassanId = userIds['hassan.ahmed@reddrumholdingsllc.com']
  const claireId = userIds['claire.dupont@reddrumholdingsllc.com']

  if (destinyId) {
    await supabase.from('anomalies').insert({
      org_id: ORG_ID, user_id: destinyId,
      anomaly_type: 'unauthorized_balance_edit', severity: 'critical',
      description: 'Leave balance modified without approved request. Annual leave accrued_hours: 40 → 120. Actor: system admin.',
    })
  }
  if (hassanId) {
    await supabase.from('anomalies').insert({
      org_id: ORG_ID, user_id: hassanId,
      anomaly_type: 'missing_timesheet', severity: 'high',
      description: 'Timesheet not submitted for week of ' + await getMonday(2),
    })
  }
  if (claireId) {
    for (let i = 0; i < 3; i++) {
      await supabase.from('anomalies').insert({
        org_id: ORG_ID, user_id: claireId,
        anomaly_type: 'late_entry_pattern', severity: i === 2 ? 'high' : 'low',
        description: i === 2
          ? 'Pattern: 3 late timesheet entries in the past 30 days'
          : `Late entry: work_date=${await getMonday(i + 1)}, entry submitted 30+ hours after work date`,
      })
    }
  }

  // Phase 2 anomalies — specific scenarios driving KlockCadence value story
  const sarahId = userIds['sarah.johnson@reddrumholdingsllc.com']
  const jamesWilliamsId = userIds['james.williams@reddrumholdingsllc.com']
  const davidChenId = userIds['david.chen@reddrumholdingsllc.com']

  if (sarahId) {
    await supabase.from('anomalies').insert({
      org_id: ORG_ID, user_id: sarahId,
      anomaly_type: 'unauthorized_balance_edit', severity: 'critical',
      created_at: '2026-07-04T14:14:00Z',
      description: 'Annual leave balance reduced by 8 hours without an approved leave request. Balance changed from 54.0h to 46.0h on Jul 4 2026 at 2:14 PM by finance user. No corresponding approved leave request found for this period.',
    })
  }
  if (jamesWilliamsId) {
    await supabase.from('anomalies').insert({
      org_id: ORG_ID, user_id: jamesWilliamsId,
      anomaly_type: 'missing_timesheet', severity: 'high',
      created_at: '2026-06-30T08:00:00Z',
      description: 'Timesheet not submitted for week of Jun 23 – Jun 27 2026. Friday deadline passed 72 hours ago. Contract FA8750-22-C-0012 has unbilled hours.',
    })
  }
  if (davidChenId) {
    await supabase.from('anomalies').insert({
      org_id: ORG_ID, user_id: davidChenId,
      anomaly_type: 'hours_shortage', severity: 'high',
      created_at: '2026-07-05T09:00:00Z',
      description: 'Week of Jun 30 – Jul 4 2026 shows 32 hours logged. 8 hour gap unaccounted for. No approved leave request covers the missing hours.',
    })
  }

  // Leave requests
  console.log('\n🏖️  Seeding leave requests...')
  const tyrell = userIds['tyrell.brooks@reddrumholdingsllc.com']
  const priya = userIds['priya.nair@reddrumholdingsllc.com']
  const roberto = userIds['roberto.silva@reddrumholdingsllc.com']

  if (tyrell) {
    await supabase.from('leave_requests').insert({
      org_id: ORG_ID, user_id: tyrell, leave_type: 'annual',
      requested_hours: 16, start_date: addDays(await getMonday(0), 7), end_date: addDays(await getMonday(0), 8),
      status: 'pending', employee_notes: 'Family vacation',
    })
  }
  const devonteId = userIds['devonte.rivers@reddrumholdingsllc.com']
  const anitaId = userIds['anita.kowalski@reddrumholdingsllc.com']

  if (priya) {
    await supabase.from('leave_requests').insert({
      org_id: ORG_ID, user_id: priya, leave_type: 'sick',
      requested_hours: 8, start_date: addDays(await getMonday(1), 2), end_date: addDays(await getMonday(1), 2),
      status: 'approved', reviewed_by: devonteId ?? null, reviewed_at: addDays(await getMonday(1), 1) + 'T10:00:00Z',
    })
  }
  if (roberto) {
    await supabase.from('leave_requests').insert({
      org_id: ORG_ID, user_id: roberto, leave_type: 'annual',
      requested_hours: 40, start_date: addDays(await getMonday(0), 14), end_date: addDays(await getMonday(0), 18),
      status: 'denied', reviewed_by: anitaId ?? null, reviewed_at: new Date().toISOString(),
      reviewer_notes: 'Insufficient balance for this period.',
    })
  }

  console.log('\n✅ Seed complete!')
  console.log('\n📋 Test credentials:')
  console.log('  Admin:   marcus.hayes@reddrumholdingsllc.com / KlockCadence2025!')
  console.log('  Finance: sara.whitfield@reddrumholdingsllc.com / KlockCadence2025!')
  console.log('  Manager: devonte.rivers@reddrumholdingsllc.com / KlockCadence2025!')
  console.log('  Employee: tyrell.brooks@reddrumholdingsllc.com / KlockCadence2025!')
}

seed().catch((e) => {
  console.error('Seed failed:', e)
  process.exit(1)
})
