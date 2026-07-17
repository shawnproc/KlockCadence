/**
 * Canonical default DCAA timekeeping policy. Used as the starting policy for new
 * organizations. Admins can edit and publish new versions via the Policy Manager.
 *
 * Section 3 explicitly prohibits CUI / classified / sensitive content in work
 * descriptions, so the free-text fields stay non-sensitive by design.
 */
export const DEFAULT_TIMEKEEPING_POLICY = `TIMEKEEPING POLICY AND PROCEDURES

1. POLICY STATEMENT
All employees are required to accurately record all time worked on a daily basis. Accurate timekeeping is a critical compliance requirement under Defense Contract Audit Agency (DCAA) regulations applicable to all federal government contractors.

2. DAILY RECORDING REQUIREMENT
Employees must enter time daily as work is performed. Pre-dated entries, post-dated entries, and batch entries covering multiple days without supervisory authorization are prohibited. All hours worked must be recorded — including hours beyond the standard schedule (uncompensated overtime for exempt employees) — and allocated to the correct charge code corresponding to the contract or indirect activity performed.

3. WORK DESCRIPTIONS
Every time entry requires a written description of work performed (minimum 10 characters). Descriptions must meaningfully identify the nature of the work on the specified contract or indirect activity; generic labels such as "work" or "miscellaneous" are not acceptable. At the same time, descriptions must be kept general and must NOT contain Controlled Unclassified Information (CUI), classified information (Confidential, Secret, or Top Secret), or any other proprietary or sensitive information. This timekeeping system does not store CUI or classified data.

4. WEEKLY SUBMISSION DEADLINE
Completed timesheets must be certified and submitted no later than 11:59 PM on Friday of the applicable work week. Late submissions require written supervisory approval and a written justification for the delay.

5. FALSE CLAIMS ACT NOTICE
By certifying a timesheet, the employee makes a legal attestation that all entries are true, accurate, and complete to the best of their knowledge. Deliberate falsification of timesheets or intentional mischarging of labor to incorrect contracts may constitute a violation of the False Claims Act (31 U.S.C. §§ 3729-3733), punishable by civil penalties plus treble damages, and potential criminal prosecution.

6. CORRECTIONS AND ADJUSTMENTS
All corrections to previously submitted timesheets require a written justification and supervisory review. The original entry, the correction, the reason, and the approving supervisor are permanently maintained in the immutable audit trail. No retroactive changes may be made to certified timesheets without documented authorization.

7. PROXY ENTRIES
In cases of employee absence due to travel, illness, or other approved circumstances, a supervisor may enter time on behalf of an employee. All proxy entries must be documented with a written justification of at least 50 characters and must be acknowledged by the employee upon return.

8. RECORD RETENTION
All timekeeping records, including electronic records, audit trails, and policy acknowledgments, are maintained for a minimum of seven (7) years per FAR 4.703 and applicable contract requirements.

9. POLICY ACKNOWLEDGMENT REQUIREMENT
All employees must acknowledge this policy upon hire and annually thereafter. Failure to acknowledge within 7 calendar days of hire or within 7 days of a policy update will be flagged as a compliance anomaly in the organization's audit system.

10. VIOLATIONS
Intentional mischarging, falsification of timekeeping records, or failure to comply with this policy is grounds for disciplinary action up to and including termination of employment, and may result in civil or criminal prosecution under applicable federal law.`
