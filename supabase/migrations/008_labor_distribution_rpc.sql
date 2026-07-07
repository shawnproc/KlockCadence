-- ============================================================
-- Migration 008: Labor Distribution RPC
-- Aggregates approved/submitted timesheet hours by employee
-- and charge code for a given calendar month.
-- Used for monthly GL journal entries and QuickBooks export.
-- ============================================================

CREATE OR REPLACE FUNCTION get_labor_distribution(
  p_org_id  uuid,
  p_month   date  -- any date in the target month, e.g. '2024-01-01'
)
RETURNS TABLE (
  employee_name     text,
  employee_email    text,
  department        text,
  charge_code       text,
  charge_description text,
  contract_number   text,
  is_billable       boolean,
  total_hours       numeric,
  has_proxy_hours   boolean
)
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT
    u.full_name                          AS employee_name,
    u.email                              AS employee_email,
    u.department                         AS department,
    cc.code                              AS charge_code,
    cc.description                       AS charge_description,
    COALESCE(cc.contract_number, '')     AS contract_number,
    cc.is_billable                       AS is_billable,
    SUM(te.hours)                        AS total_hours,
    bool_or(te.is_proxy_entry)           AS has_proxy_hours
  FROM timesheet_entries te
  JOIN users       u   ON u.id  = te.user_id
  JOIN charge_codes cc ON cc.id = te.charge_code_id
  JOIN timesheets   ts ON ts.id = te.timesheet_id
  WHERE
    te.org_id = p_org_id
    AND te.work_date >= DATE_TRUNC('month', p_month)::date
    AND te.work_date <  (DATE_TRUNC('month', p_month) + INTERVAL '1 month')::date
    AND ts.status IN ('submitted', 'approved')
  GROUP BY
    u.full_name, u.email, u.department,
    cc.code, cc.description, cc.contract_number, cc.is_billable
  ORDER BY
    u.full_name, cc.is_billable DESC, cc.code;
$$;

GRANT EXECUTE ON FUNCTION get_labor_distribution(uuid, date) TO authenticated;
GRANT EXECUTE ON FUNCTION get_labor_distribution(uuid, date) TO service_role;
