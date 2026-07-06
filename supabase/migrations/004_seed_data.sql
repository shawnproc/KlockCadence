-- ============================================================
-- Seed Data: Red Drum Holdings LLC
-- Run via scripts/seed.ts for auth user creation
-- This file seeds non-auth tables only
-- ============================================================

-- NOTE: auth.users must be created first via scripts/seed.ts
-- This migration is referenced by the seed script for table data

-- ============================================================
-- Organizations
-- ============================================================
insert into organizations (id, name, slug, fiscal_year_start, holiday_schedule) values
  ('a1b2c3d4-0001-0001-0001-000000000001', 'Red Drum Holdings LLC', 'red-drum-holdings', '2024-01-01', 'federal');

-- ============================================================
-- Charge Codes
-- ============================================================
insert into charge_codes (id, org_id, code, description, contract_number, is_billable, is_active) values
  ('cc000001-0001-0001-0001-000000000001', 'a1b2c3d4-0001-0001-0001-000000000001', 'N00024-23-C-6301', 'Navy Systems Engineering Support', 'N00024-23-C-6301', true, true),
  ('cc000002-0001-0001-0001-000000000001', 'a1b2c3d4-0001-0001-0001-000000000001', 'FA8750-22-C-0012', 'AFRL Software Development', 'FA8750-22-C-0012', true, true),
  ('cc000003-0001-0001-0001-000000000001', 'a1b2c3d4-0001-0001-0001-000000000001', 'HQ0034-24-C-0089', 'DHA Program Management', 'HQ0034-24-C-0089', true, true),
  ('cc000004-0001-0001-0001-000000000001', 'a1b2c3d4-0001-0001-0001-000000000001', 'G&A-OVERHEAD', 'General & Administrative / Overhead', null, false, true);

-- ============================================================
-- Leave Policies (Federal Contractor Defaults)
-- ============================================================
insert into leave_policies (org_id, leave_type, accrual_rate_per_pay_period, max_accrual_hours, carryover_cap_hours, tenure_tier) values
  -- Annual leave by tenure tier
  ('a1b2c3d4-0001-0001-0001-000000000001', 'annual', 3.0769, 160, 80, 'year_0_1'),
  ('a1b2c3d4-0001-0001-0001-000000000001', 'annual', 4.6154, 200, 120, 'year_1_3'),
  ('a1b2c3d4-0001-0001-0001-000000000001', 'annual', 6.1538, 240, 160, 'year_3_5'),
  ('a1b2c3d4-0001-0001-0001-000000000001', 'annual', 7.6923, 320, 200, 'year_5_plus'),
  -- Sick leave (uniform rate)
  ('a1b2c3d4-0001-0001-0001-000000000001', 'sick', 4.0, 240, 240, 'year_0_1'),
  ('a1b2c3d4-0001-0001-0001-000000000001', 'sick', 4.0, 240, 240, 'year_1_3'),
  ('a1b2c3d4-0001-0001-0001-000000000001', 'sick', 4.0, 240, 240, 'year_3_5'),
  ('a1b2c3d4-0001-0001-0001-000000000001', 'sick', 4.0, 240, 240, 'year_5_plus');
