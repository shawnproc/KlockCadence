/**
 * Phase 2 database patch — run once against the live Supabase instance.
 * Safe to re-run: all writes are idempotent (upsert or existence-checked inserts).
 *
 * Run: npx ts-node --project tsconfig.json scripts/patch-phase2.ts
 */
import * as fs from 'fs'
import * as path from 'path'
import { createClient } from '@supabase/supabase-js'

// ── Load .env.local ───────────────────────────────────────────────────────────
const envFile = path.join(process.cwd(), '.env.local')
if (fs.existsSync(envFile)) {
  for (const line of fs.readFileSync(envFile, 'utf-8').split('\n')) {
    const eq = line.indexOf('=')
    if (eq > 0 && !line.startsWith('#')) {
      const key = line.slice(0, eq).trim()
      const val = line.slice(eq + 1).trim()
      if (key && val) process.env[key] = val
    }
  }
}

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

const ORG_ID = 'a1b2c3d4-0001-0001-0001-000000000001'

const NEW_EMPLOYEES = [
  { email: 'sarah.johnson@reddrumholdingsllc.com',  full_name: 'Sarah Johnson',  role: 'employee', department: 'Engineering',         hire_date: '2023-06-01' },
  { email: 'james.williams@reddrumholdingsllc.com', full_name: 'James Williams', role: 'employee', department: 'Program Management', hire_date: '2022-04-15' },
  { email: 'david.chen@reddrumholdingsllc.com',     full_name: 'David Chen',     role: 'employee', department: 'Engineering',         hire_date: '2021-08-23' },
]

const PHASE2_ANOMALIES = [
  {
    email: 'sarah.johnson@reddrumholdingsllc.com',
    anomaly_type: 'unauthorized_balance_edit',
    severity: 'critical',
    created_at: '2026-07-04T14:14:00Z',
    description: 'Annual leave balance reduced by 8 hours without an approved leave request. Balance changed from 54.0h to 46.0h on Jul 4 2026 at 2:14 PM by finance user. No corresponding approved leave request found for this period.',
  },
  {
    email: 'james.williams@reddrumholdingsllc.com',
    anomaly_type: 'missing_timesheet',
    severity: 'high',
    created_at: '2026-06-30T08:00:00Z',
    description: 'Timesheet not submitted for week of Jun 23 – Jun 27 2026. Friday deadline passed 72 hours ago. Contract FA8750-22-C-0012 has unbilled hours.',
  },
  {
    email: 'david.chen@reddrumholdingsllc.com',
    anomaly_type: 'hours_shortage',
    severity: 'high',
    created_at: '2026-07-05T09:00:00Z',
    description: 'Week of Jun 30 – Jul 4 2026 shows 32 hours logged. 8 hour gap unaccounted for. No approved leave request covers the missing hours.',
  },
]

function randomHours(base = 80, variance = 20) {
  const raw = base + (Math.random() - 0.5) * variance * 2
  return Math.round(raw * 4) / 4
}

async function patch() {
  console.log('🔧 Running Phase 2 patch...\n')

  // ── 1. Create auth users + profiles ────────────────────────────────────────
  console.log('👤 Creating new employees...')
  const userIds: Record<string, string> = {}

  for (const emp of NEW_EMPLOYEES) {
    const { data: authData, error } = await supabase.auth.admin.createUser({
      email: emp.email,
      password: 'KlockCadence2025!',
      email_confirm: true,
    })

    let uid: string | undefined

    if (error?.message.includes('already registered')) {
      const { data: existing } = await supabase.auth.admin.listUsers()
      uid = existing?.users?.find((u) => u.email === emp.email)?.id
    } else if (error) {
      console.error(`  ✗ Auth error for ${emp.email}:`, error.message)
      continue
    } else {
      uid = authData?.user?.id
    }

    if (!uid) { console.error(`  ✗ Could not resolve UID for ${emp.email}`); continue }
    userIds[emp.email] = uid

    const { error: profileError } = await supabase.from('users').upsert({
      id: uid,
      org_id: ORG_ID,
      full_name: emp.full_name,
      email: emp.email,
      role: emp.role,
      department: emp.department,
      hire_date: emp.hire_date,
    })

    if (profileError) {
      console.error(`  ✗ Profile error for ${emp.email}:`, profileError.message)
    } else {
      console.log(`  ✓ ${emp.full_name} (${emp.role})`)
    }
  }

  // ── 2. Leave balances (upsert — safe) ──────────────────────────────────────
  console.log('\n📊 Upserting leave balances...')
  for (const emp of NEW_EMPLOYEES) {
    const uid = userIds[emp.email]
    if (!uid) continue
    for (const lt of ['annual', 'sick'] as const) {
      const accrued = lt === 'annual' ? randomHours(80, 20) : randomHours(120, 30)
      const used = randomHours(accrued * 0.3, 8)
      const { error } = await supabase.from('leave_balances').upsert({
        org_id: ORG_ID, user_id: uid, leave_type: lt,
        accrued_hours: accrued, used_hours: used, pending_hours: 0,
        last_accrual_date: new Date().toISOString().split('T')[0],
      })
      if (error) console.error(`  ✗ Balance error (${emp.email}, ${lt}):`, error.message)
    }
    console.log(`  ✓ ${emp.full_name}`)
  }

  // ── 3. Update Destiny Walker's existing anomaly description ────────────────
  console.log('\n✏️  Updating Destiny Walker anomaly description...')
  const { data: destinyUser } = await supabase
    .from('users')
    .select('id')
    .eq('org_id', ORG_ID)
    .eq('email', 'destiny.walker@reddrumholdingsllc.com')
    .single()

  if (destinyUser) {
    const { error } = await supabase
      .from('anomalies')
      .update({ description: 'Annual leave accrued_hours: 54 → 46. Balance reduced by 8 hours without an approved leave request. No corresponding leave request found.' })
      .eq('org_id', ORG_ID)
      .eq('user_id', destinyUser.id)
      .eq('anomaly_type', 'unauthorized_balance_edit')

    if (error) console.error('  ✗', error.message)
    else console.log('  ✓ Description updated')
  } else {
    console.log('  ⚠ Destiny Walker not found — skipping')
  }

  // ── 4. Insert Phase 2 anomalies (skip if already exists) ───────────────────
  console.log('\n⚠️  Inserting Phase 2 anomalies...')
  for (const a of PHASE2_ANOMALIES) {
    const uid = userIds[a.email]
    if (!uid) { console.log(`  ⚠ No UID for ${a.email} — skipping`); continue }

    // Check for existing anomaly of this type for this user
    const { data: existing } = await supabase
      .from('anomalies')
      .select('id')
      .eq('org_id', ORG_ID)
      .eq('user_id', uid)
      .eq('anomaly_type', a.anomaly_type)
      .maybeSingle()

    if (existing) {
      console.log(`  ⟳ Already exists for ${a.email} (${a.anomaly_type}) — skipping`)
      continue
    }

    const { error } = await supabase.from('anomalies').insert({
      org_id: ORG_ID,
      user_id: uid,
      anomaly_type: a.anomaly_type,
      severity: a.severity,
      created_at: a.created_at,
      description: a.description,
    })

    if (error) console.error(`  ✗ Anomaly error (${a.email}):`, error.message)
    else console.log(`  ✓ ${a.severity.toUpperCase()} anomaly → ${a.email}`)
  }

  console.log('\n✅ Phase 2 patch complete!')
  console.log('\n📋 New test credentials:')
  console.log('  sarah.johnson@reddrumholdingsllc.com  / KlockCadence2025!')
  console.log('  james.williams@reddrumholdingsllc.com / KlockCadence2025!')
  console.log('  david.chen@reddrumholdingsllc.com     / KlockCadence2025!')
}

patch().catch((e) => {
  console.error('Patch failed:', e)
  process.exit(1)
})
