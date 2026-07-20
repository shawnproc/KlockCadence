# KlockCadence — Project Status & Resume Handoff

_Last updated: 2026-07-19_

A living status doc so work can be picked up cleanly at any time.

## What / where
- **Product:** DCAA-compliant timekeeping & PTO SaaS (multi-tenant), Next.js 14 + Supabase + Vercel.
- **Repo:** `github.com/shawnproc/KlockCadence` (branch `main`) — pushes to `main` auto-deploy.
- **Local:** `C:\Users\rasha\OneDrive\Desktop\KlockCadence\klock-cadence`
- **Production:** https://www.klockcadence.com
- **Supabase project:** `wpbewxfasklzsuyhxkyq`

## Security remediation (from a 4-agent audit): COMPLETE
Shipped across Batches 1–5:
- RLS self-privilege-escalation fixed; cross-tenant labor-RPC leak fixed; admin-password-hash removed; forged audit/anomaly inserts blocked.
- Server-side certification; atomic leave-balance deduction; fail-loud audit logging.
- `is_active` enforced in middleware for all API routes; open-redirect hardened; UTC-consistent week/date math.
- **Admin model redesign:** join a company by code as an **employee**; admins are promoted only by an existing admin via an **audited** action — no shared admin password.
- Rate limiting on `/api/auth/join` and `/api/auth/signup` (fail-open, DB-backed).

## DCAA timekeeping: met at the software level
Daily-entry reminder; reason-for-change on corrections (audited, before/after preserved); record-all-hours (weekend entry enabled, uncompensated OT); per-employee reconciliation framing in labor distribution; **no-CUI guidance** on work-description + proxy-reason fields and in the policy template. Certification, supervisor approval, total-time accounting, immutable audit trail, role-based access, policy acknowledgment, retention — all in place.

## Pending actions (owner: you)
1. **Apply migration 022** (`auth_rate_limits` table) in the Supabase SQL Editor — the rate limiter is inactive-but-harmless (fails open) until applied.
2. **Publish the Red Drum policy update** via Admin → Policy Manager (adds the CUI clause + triggers re-acknowledgment). New orgs already get the updated policy automatically.
3. _Optional / low priority:_ redeploy the anomaly edge function — `supabase functions deploy detect-anomalies` — for its `verify_jwt` pinning. Not required (app uses `lib/anomaly/detector.ts`).

## Known boundaries / won't-fix
- `My Biz LLC` org cannot be deleted — its creation wrote an immutable `audit_log` row (`ON DELETE RESTRICT`). Working as designed.
- Protected files (do not modify): `lib/dcaa/validators.ts`, `components/timesheets/certification-modal.tsx`.
- **FedRAMP / NIST 800-171 / CMMC / CUI hosting** is contract-dependent and an infrastructure + company-program matter — not a code change. Only relevant if a contract invokes DFARS 252.204-7012 / CMMC or the data is CUI. The app's no-CUI field guidance + policy keep timekeeping data non-sensitive by design.

## Artifacts & demo
- `DEMO_GUIDE.md` — roles, onboarding, ~10-min demo script, talking points, seed accounts.
- Seed accounts (org: Red Drum Holdings LLC), password `KlockCadence2025!`:
  admin `marcus.hayes@reddrumholdingsllc.com` · finance `sara.whitfield@reddrumholdingsllc.com` · manager `devonte.rivers@reddrumholdingsllc.com` · employee `james.okeefe@reddrumholdingsllc.com`.

## Possible next step (offered, not yet built)
A **control-mapping document**: each DCAA criterion → the exact file/route that enforces it, with the FedRAMP/CUI dependency flagged. The artifact a DCAA consultant or contracting officer will ask for.

## Resume prompt
> Resume KlockCadence. Read STATUS.md, then [pick one]: build the DCAA control-mapping document / help me apply migration 022 / publish the Red Drum policy update / start new work: ‹describe›.
