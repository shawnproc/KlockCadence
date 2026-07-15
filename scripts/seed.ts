/**
 * Seed Script — Red Drum Holdings LLC
 * Run: npx ts-node --project tsconfig.json scripts/seed.ts
 * Requires: SUPABASE_SERVICE_ROLE_KEY and NEXT_PUBLIC_SUPABASE_URL in env
 *
 * Minimal seed: exactly one user per role and per department.
 *   admin / Operations, finance / Finance, manager / Engineering,
 *   employee / Program Management.
 *
 * Includes one DCAA scenario: the employee is approved for 8h of leave
 * but 16h are deducted from the balance. The 8h over-deduction is
 * unaccounted for and surfaces as a CRITICAL unauthorized_balance_edit
 * anomaly. Live over-deductions like this are caught by the
 * detect_unauthorized_balance_edit trigger (see migration 013).
 */
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

const ORG_ID = 'a1b2c3d4-0001-0001-0001-000000000001'

// One person per role and per department.
const EMPLOYEES = [
  { email: 'marcus.hayes@reddrumholdingsllc.com', full_name: 'Marcus D. Hayes', role: 'admin', department: 'Operations', hire_date: '2019-03-15' },
  { email: 'sara.whitfield@reddrumholdingsllc.com', full_name: 'Sara T. Whitfield', role: 'finance', department: 'Finance', hire_date: '2020-07-01' },
  { email: 'devonte.rivers@reddrumholdingsllc.com', full_name: 'DeVonte L. Rivers', role: 'manager', department: 'Engineering', hire_date: '2021-01-10' },
  { email: 'james.okeefe@reddrumholdingsllc.com', full_name: 'James O\'Keefe', role: 'employee', department: 'Program Management', hire_date: '2023-03-01' },
]

// The employee at the center of the unauthorized-balance-edit scenario.
const SCENARIO_EMPLOYEE_EMAIL = 'james.okeefe@reddrumholdingsllc.com'
const SCENARIO_APPROVED_HOURS = 8   // hours the employee was actually approved for
const SCENARIO_DEDUCTED_HOURS = 16  // hours actually removed from the balance
const SCENARIO_ANNUAL_ACCRUED = 80

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
    else console.log(`  ✓ ${emp.full_name} (${emp.role} / ${emp.department})`)
  }

  // Leave balances
  console.log('\n📊 Seeding leave balances...')
  for (const emp of EMPLOYEES) {
    const uid = userIds[emp.email]
    if (!uid) continue
    for (const lt of ['annual', 'sick'] as const) {
      const isScenario = emp.email === SCENARIO_EMPLOYEE_EMAIL && lt === 'annual'
      // Scenario: 16h deducted (used) against an 80h accrual → 64h available.
      const accrued = isScenario ? SCENARIO_ANNUAL_ACCRUED : (lt === 'annual' ? randomHours(80, 20) : randomHours(120, 30))
      const used = isScenario ? SCENARIO_DEDUCTED_HOURS : randomHours(accrued * 0.3, 8)
      await supabase.from('leave_balances').upsert({
        org_id: ORG_ID, user_id: uid, leave_type: lt,
        accrued_hours: accrued, used_hours: used, pending_hours: 0,
        last_accrual_date: new Date().toISOString().split('T')[0],
      })
    }
  }

  // Timesheets — 4 weeks of data for employees and managers
  console.log('\n🕐 Seeding timesheets...')
  const employees = EMPLOYEES.filter((e) => ['employee', 'manager'].includes(e.role))
  const approverId = userIds['devonte.rivers@reddrumholdingsllc.com']

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
        approved_by: weekAgo > 1 ? approverId ?? null : null,
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

  // Scenario: employee approved for 8h leave, but 16h deducted from balance.
  console.log('\n🏖️  Seeding leave request for the balance-edit scenario...')
  const scenarioUid = userIds[SCENARIO_EMPLOYEE_EMAIL]

  if (scenarioUid) {
    // The one leave request the employee actually submitted and had approved — 8h.
    await supabase.from('leave_requests').insert({
      org_id: ORG_ID, user_id: scenarioUid, leave_type: 'annual',
      requested_hours: SCENARIO_APPROVED_HOURS,
      start_date: addDays(await getMonday(1), 2), end_date: addDays(await getMonday(1), 2),
      status: 'approved',
      reviewed_by: approverId ?? null,
      reviewed_at: addDays(await getMonday(1), 1) + 'T10:00:00Z',
      employee_notes: 'Single personal day.',
      reviewer_notes: 'Approved — 8 hours.',
    })

    // The unauthorized over-deduction: 16h were removed but only 8h were approved.
    const unaccounted = SCENARIO_DEDUCTED_HOURS - SCENARIO_APPROVED_HOURS
    console.log('\n⚠️  Seeding unauthorized_balance_edit anomaly...')
    await supabase.from('anomalies').insert({
      org_id: ORG_ID, user_id: scenarioUid,
      anomaly_type: 'unauthorized_balance_edit', severity: 'critical',
      description:
        `Annual leave balance reduced by ${SCENARIO_DEDUCTED_HOURS.toFixed(1)}h, but only ` +
        `${SCENARIO_APPROVED_HOURS.toFixed(1)}h was covered by an approved leave request. ` +
        `${unaccounted.toFixed(1)}h were deducted without authorization — no approved request accounts ` +
        `for the difference. Balance manipulation flagged for review.`,
    })
  }

  console.log('\n✅ Seed complete!')
  console.log('\n📋 Test credentials:')
  console.log('  Admin:    marcus.hayes@reddrumholdingsllc.com / KlockCadence2025!')
  console.log('  Finance:  sara.whitfield@reddrumholdingsllc.com / KlockCadence2025!')
  console.log('  Manager:  devonte.rivers@reddrumholdingsllc.com / KlockCadence2025!')
  console.log('  Employee: james.okeefe@reddrumholdingsllc.com / KlockCadence2025!')
}

seed().catch((e) => {
  console.error('Seed failed:', e)
  process.exit(1)
})
