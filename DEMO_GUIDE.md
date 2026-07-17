# KlockCadence — Demo & Usage Guide

DCAA-compliant timekeeping & PTO for federal contractors. This guide walks your
team through the product and gives you a clean demo script.

Production: **https://www.klockcadence.com**

---

## The 60-second pitch

KlockCadence is timekeeping built for a DCAA audit. Every employee records time
against contract charge codes, certifies it with a False Claims Act attestation,
and a supervisor approves it. The system continuously watches for the exact
things auditors look for — missing timesheets, hours that don't add up,
unauthorized leave-balance changes, time edited after certification — and records
every action in an **immutable audit log**. Leave/PTO is enforced automatically
against accrued balances.

---

## Roles (what each person sees)

| Role | Can do |
|---|---|
| **Employee** | Enter/submit/certify their own timesheet; request leave; view their balances and history |
| **Manager** | Everything an employee can, plus: approve/reject timesheets, proxy time entry, view anomalies |
| **Finance** | View anomalies, DCAA reports, labor distribution |
| **Admin** | Everything: manage users (invite, import, promote, deactivate), charge codes, leave policies, org settings, audit log |

---

## Getting people into the system

There are three ways, all self-service and email-free:

1. **Create a company (first admin):** on the login page → **Create an account →
   "Create a company"** → set your name/password → onboarding creates your org
   and makes you its **admin**, and shows you a **Company Code**.
2. **Employees self-join:** share the **Company Code** (Org Settings shows it).
   They go to **Create an account → "Join a company"**, enter the code, and join
   as a **regular employee**.
3. **Bulk import (admin):** Admin → Users → **Import CSV** with columns
   `full_name, email, role, department, hire_date`. Each person gets a temporary
   password (shown once — download the CSV) and is forced to set their own on
   first login.

**Making someone an admin/manager:** Admin → Users → change their **Role**. This
is the only way to grant elevated access, and it's written to the audit log
(there's no shared "admin password").

---

## Demo script (~10 minutes)

Sign in as **Marcus D. Hayes** (admin) to show the full picture, then switch to
an employee to show the daily flow.

**1. Dashboard (admin).** Point out the DCAA Compliance Score gauge, Pending
Approval count, open anomalies, recent activity, and team presence.

**2. Enter time (employee → e.g. James O'Keefe).**
   - Go to **Timesheets**. Add hours per day against a charge code (e.g. a Navy
     contract code + G&A overhead).
   - Enter a work description (10+ chars — DCAA requires it; try submitting
     without one to show the block).
   - Click **Submit** → the **certification modal** appears. Type your full legal
     name to sign (False Claims Act language). This is now enforced server-side.

**3. Approve time (manager/admin).**
   - Go to **Approvals**. Open the submitted timesheet, review the entries, and
     **Approve** (or **Reject** with a reason — the employee can fix and
     re-certify). You can't approve your own timesheet.

**4. Leave / PTO (employee).**
   - Go to **Leave**. Show balances. Request annual leave for fewer hours than
     available → **instantly approved** and deducted. Request more than available
     → **rejected** on the spot. No manager step — the system is the approver.

**5. Anomalies (admin/finance).** Go to **Anomalies**. Each card shows the
   severity color, a distinct type, and — on **View details** — "what it means /
   why it matters / recommended action." Show the CRITICAL *Unauthorized Balance
   Edit* example. Mention you can Resolve or Delete (deletions are themselves
   audited).

**6. Reports (admin/finance).**
   - **DCAA Reports** → generate the one-click audit package (PDF) for a date
     range.
   - **Labor Distribution** → monthly hours by employee/charge code, exportable
     to CSV for GL/QuickBooks.

**7. Audit Log (admin).** Show the immutable trail — who did what, when, from
   what IP. Nothing can be edited or deleted here.

**8. Offboarding (admin).** Admin → Users → **Deactivate** someone. They're
   instantly blocked from logging in and vanish from active rosters, but all
   their historical records stay (DCAA retention). Reversible via Reactivate.

---

## Talking points for skeptics

- **Security:** row-level isolation per company on every table; the immutable
  audit log; server-enforced certification; automatic detection of balance
  tampering and post-certification edits; least-privilege access.
- **Reliability:** leave balances deduct atomically (no double-spend);
  total-time accounting is timezone-safe; the audit trail fails loud (never
  silently drops a record).
- **Auditor-ready by design:** the features map directly to what DCAA tests —
  contemporaneous entry, certification, supervisor approval, total-time
  accounting, and a tamper-evident trail.

---

## Seed accounts (demo org: Red Drum Holdings LLC)

Password for all: `KlockCadence2025!`

| Role | Email |
|---|---|
| Admin | marcus.hayes@reddrumholdingsllc.com |
| Finance | sara.whitfield@reddrumholdingsllc.com |
| Manager | devonte.rivers@reddrumholdingsllc.com |
| Employee | james.okeefe@reddrumholdingsllc.com |

> Tip: log in as the employee in a private/incognito window and the admin in a
> normal window, so you can show both sides live without re-logging-in.
