-- ============================================================
-- Migration 006: Employee Policy Acknowledgment
-- DCAA requires documented proof that employees have read
-- and acknowledged the organization's timekeeping policy.
-- ============================================================

-- Add policy fields to organizations
ALTER TABLE organizations
  ADD COLUMN policy_version          text        NOT NULL DEFAULT '1.0',
  ADD COLUMN policy_version_updated_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN policy_text             text        NOT NULL DEFAULT '';

-- Populate all existing orgs with the standard DCAA timekeeping policy
UPDATE organizations SET policy_text = $$TIMEKEEPING POLICY AND PROCEDURES

1. POLICY STATEMENT
All employees are required to accurately record all time worked on a daily basis. Accurate timekeeping is a critical compliance requirement under Defense Contract Audit Agency (DCAA) regulations applicable to all federal government contractors.

2. DAILY RECORDING REQUIREMENT
Employees must enter time daily as work is performed. Pre-dated entries, post-dated entries, and batch entries covering multiple days without supervisory authorization are prohibited. All hours must be allocated to the correct charge code corresponding to the contract or indirect activity performed.

3. WORK DESCRIPTIONS
Every time entry requires a written description of work performed. Descriptions must accurately and specifically describe the nature of work performed on the specified contract or indirect activity. Vague or generic descriptions are not acceptable. A minimum of 10 characters is required per entry.

4. WEEKLY SUBMISSION DEADLINE
Completed timesheets must be certified and submitted no later than 11:59 PM on Friday of the applicable work week. Late submissions require written supervisory approval and a written justification for the delay.

5. FALSE CLAIMS ACT NOTICE
By certifying a timesheet, the employee makes a legal attestation that all entries are true, accurate, and complete to the best of their knowledge. Deliberate falsification of timesheets or intentional mischarging of labor to incorrect contracts may constitute a violation of the False Claims Act (31 U.S.C. §§ 3729-3733), punishable by civil penalties of $13,946 to $27,894 per false claim plus treble damages, and potential criminal prosecution.

6. CORRECTIONS AND ADJUSTMENTS
All corrections to previously submitted timesheets require supervisor approval and a written justification. The original entry, the correction, and the approving supervisor are permanently maintained in the immutable audit trail. No retroactive changes may be made to certified timesheets without documented authorization.

7. PROXY ENTRIES
In cases of employee absence due to travel, illness, or other approved circumstances, a supervisor may enter time on behalf of an employee. All proxy entries must be documented with a written justification of at least 50 characters and must be acknowledged by the employee upon return.

8. RECORD RETENTION
All timekeeping records, including electronic records, audit trails, and policy acknowledgments, are maintained for a minimum of seven (7) years per FAR 4.703 and applicable contract requirements.

9. POLICY ACKNOWLEDGMENT REQUIREMENT
All employees must acknowledge this policy upon hire and annually thereafter. Failure to acknowledge within 7 calendar days of hire or within 7 days of a policy update will be flagged as a compliance anomaly in the organization's audit system.

10. VIOLATIONS
Intentional mischarging, falsification of timekeeping records, or failure to comply with this policy is grounds for disciplinary action up to and including termination of employment, and may result in civil or criminal prosecution under applicable federal law.$$
WHERE policy_text = '';

-- ============================================================
-- POLICY ACKNOWLEDGMENTS TABLE (insert-only)
-- ============================================================

CREATE TABLE policy_acknowledgments (
  id               uuid        PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id           uuid        NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
  user_id          uuid        NOT NULL REFERENCES users(id)         ON DELETE RESTRICT,
  policy_version   text        NOT NULL,
  acknowledged_at  timestamptz NOT NULL DEFAULT now(),
  ip_address       text        NOT NULL DEFAULT ''
);

CREATE INDEX idx_policy_ack_org_id   ON policy_acknowledgments(org_id);
CREATE INDEX idx_policy_ack_user_id  ON policy_acknowledgments(user_id);
CREATE INDEX idx_policy_ack_version  ON policy_acknowledgments(policy_version);
CREATE INDEX idx_policy_ack_datetime ON policy_acknowledgments(acknowledged_at);

-- ============================================================
-- RLS — insert-only for employees (own rows), readable by admin
-- ============================================================

ALTER TABLE policy_acknowledgments ENABLE ROW LEVEL SECURITY;

-- Employees can read their own acknowledgments;
-- managers / admin / finance can read all in org
CREATE POLICY "users_read_own_or_privileged_read_all_acks"
  ON policy_acknowledgments FOR SELECT
  USING (
    org_id = auth_org_id()
    AND (
      user_id = auth.uid()
      OR auth_user_role() IN ('admin', 'finance', 'manager')
    )
  );

-- Any authenticated org member can insert their own acknowledgment
CREATE POLICY "users_insert_own_ack"
  ON policy_acknowledgments FOR INSERT
  WITH CHECK (
    org_id = auth_org_id()
    AND user_id = auth.uid()
  );

-- No UPDATE or DELETE policies — effectively insert-only

-- ============================================================
-- Extend anomaly_type enum
-- ============================================================

ALTER TYPE anomaly_type ADD VALUE IF NOT EXISTS 'policy_unacknowledged';
