-- Demo anomalies — a spread of DISTINCT types/severities for the feed.
-- Run manually in the Supabase SQL Editor against a seeded org. Looks users
-- up by email, so there are no UUIDs to fill in. Run ONCE (re-running inserts
-- duplicates; use the feed's "Remove duplicates" if needed).
-- NOT a migration — this must not run automatically in every environment.

insert into anomalies (org_id, user_id, anomaly_type, severity, description)
select u.org_id, u.id, v.anomaly_type::anomaly_type, v.severity::anomaly_severity, v.description
from (values
  ('james.okeefe@reddrumholdingsllc.com',  'unauthorized_balance_edit', 'critical', 'Annual leave balance reduced by 16.0h but only 8.0h was covered by an approved request. 8.0h deducted without authorization.'),
  ('devonte.rivers@reddrumholdingsllc.com','missing_timesheet',         'high',     'Timesheet not submitted for the most recent completed week. Friday deadline has passed.'),
  ('james.okeefe@reddrumholdingsllc.com',  'hours_shortage',            'high',     'Week shows 32.0h logged; 8.0h gap unaccounted for, with no approved leave covering it.'),
  ('james.okeefe@reddrumholdingsllc.com',  'missing_accrual',           'medium',   'Annual leave accrual not processed in 19 days (expected every 14).'),
  ('devonte.rivers@reddrumholdingsllc.com','late_entry_pattern',        'low',      'Late timesheet entry recorded more than 30 hours after the work date.')
) as v(email, anomaly_type, severity, description)
join users u on u.email = v.email and u.org_id = 'a1b2c3d4-0001-0001-0001-000000000001';
