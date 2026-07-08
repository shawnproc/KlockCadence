-- ============================================================
-- Migration 011: Weekly Labor Distribution RPC
-- Like get_labor_distribution but grouped by week, for CSV export.
-- ============================================================

CREATE OR REPLACE FUNCTION get_labor_distribution_weekly(
  p_org_id  uuid,
  p_month   date
)
RETURNS TABLE (
  employee_name      text,
  charge_code        text,
  contract_number    text,
  is_billable        boolean,
  hours              numeric,
  week_start_date    date,
  month              date
)
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT
    u.full_name                          AS employee_name,
    cc.code                              AS charge_code,
    COALESCE(cc.contract_number, '')     AS contract_number,
    cc.is_billable                       AS is_billable,
    SUM(te.hours)                        AS hours,
    ts.week_start_date                   AS week_start_date,
    DATE_TRUNC('month', p_month)::date   AS month
  FROM timesheet_entries te
  JOIN users        u  ON u.id  = te.user_id
  JOIN charge_codes cc ON cc.id = te.charge_code_id
  JOIN timesheets   ts ON ts.id = te.timesheet_id
  WHERE
    te.org_id = p_org_id
    AND te.work_date >= DATE_TRUNC('month', p_month)::date
    AND te.work_date <  (DATE_TRUNC('month', p_month) + INTERVAL '1 month')::date
    AND ts.status IN ('submitted', 'approved')
  GROUP BY
    u.full_name, cc.code, cc.contract_number, cc.is_billable, ts.week_start_date
  ORDER BY
    u.full_name, ts.week_start_date, cc.is_billable DESC, cc.code;
$$;

GRANT EXECUTE ON FUNCTION get_labor_distribution_weekly(uuid, date) TO authenticated;
GRANT EXECUTE ON FUNCTION get_labor_distribution_weekly(uuid, date) TO service_role;
