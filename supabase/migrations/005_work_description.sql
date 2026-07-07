-- ============================================================
-- Migration 005: Work Description Required Field
-- DCAA CAM compliance — all timesheet entries must have
-- documented work descriptions (NOT NULL, minimum 10 chars)
-- ============================================================

-- Step 1: Rename notes → work_description
alter table timesheet_entries rename column notes to work_description;

-- Step 2: Backfill all existing NULL values with a DCAA-compliant placeholder
-- (existing seed data has no descriptions; approved timesheets are locked so
--  employees cannot edit them — this placeholder satisfies the constraint)
update timesheet_entries
set work_description = 'Work performed on assigned contract activities.'
where work_description is null;

-- Step 3: Enforce NOT NULL
alter table timesheet_entries alter column work_description set not null;

-- Step 4: Enforce minimum 10-character length
alter table timesheet_entries
add constraint work_description_min_length
check (length(trim(work_description)) >= 10);
