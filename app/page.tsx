import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { Shield, Clock, FileText, AlertTriangle, Lock, CheckCircle2 } from 'lucide-react'

export const metadata = {
  title: 'KlockCadence — DCAA Compliant Timekeeping for Federal Contractors',
  description:
    'Automated DCAA compliance monitoring, immutable audit trails, and one-click audit packages for small federal contractors.',
  alternates: { canonical: 'https://www.klockcadence.com' },
}

export default async function LandingPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (user) redirect('/dashboard')

  return (
    <div className="min-h-screen bg-white text-gray-900" style={{ fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" }}>

      {/* ── Nav ──────────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-50 bg-white border-b border-gray-100 shadow-sm">
        <div className="max-w-6xl mx-auto px-6 h-14 flex items-center justify-between">
          <span className="font-bold text-lg tracking-tight" style={{ color: '#1B2A4A' }}>
            KlockCadence
          </span>
          <Link
            href="/login"
            className="px-4 py-1.5 rounded-md text-sm font-medium text-white"
            style={{ backgroundColor: '#1B2A4A' }}
          >
            Sign In
          </Link>
        </div>
      </header>

      {/* ── Hero ─────────────────────────────────────────────────────── */}
      <section style={{ backgroundColor: '#1B2A4A' }} className="text-white py-20 px-6">
        <div className="max-w-4xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 text-xs font-medium tracking-widest uppercase mb-6 opacity-70 border border-white/20 rounded-full px-4 py-1.5">
            <Shield className="h-3 w-3" />
            DCAA Compliant · Federal Contractors · FAR 31.201-2
          </div>
          <h1 className="text-4xl sm:text-5xl font-bold leading-tight mb-6">
            Timekeeping That Catches Issues<br />Before Auditors Do
          </h1>
          <p className="text-lg opacity-80 max-w-2xl mx-auto mb-10 leading-relaxed">
            KlockCadence automatically flags compliance anomalies, maintains a tamper-proof
            audit trail, and generates DCAA packages in one click — built for small
            businesses contracting with the federal government.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link
              href="/login"
              className="px-8 py-3 rounded-md font-semibold text-sm bg-white text-[#1B2A4A] hover:bg-gray-100 transition-colors"
            >
              Sign In to Your Account
            </Link>
            <a
              href="#features"
              className="px-8 py-3 rounded-md font-semibold text-sm border border-white/30 hover:bg-white/10 transition-colors"
            >
              See How It Works ↓
            </a>
          </div>
        </div>
      </section>

      {/* ── Stats strip ──────────────────────────────────────────────── */}
      <section className="bg-gray-50 border-y border-gray-100 py-10 px-6">
        <div className="max-w-4xl mx-auto grid grid-cols-3 gap-6 text-center">
          {[
            { value: '9', label: 'DCAA anomaly rules', sub: 'automated continuously' },
            { value: '100%', label: 'immutable audit trail', sub: 'every action logged' },
            { value: '1-click', label: 'DCAA audit package', sub: 'any date range, instant PDF' },
          ].map(({ value, label, sub }) => (
            <div key={label}>
              <p className="text-3xl font-bold" style={{ color: '#1B2A4A' }}>{value}</p>
              <p className="text-sm font-medium mt-1">{label}</p>
              <p className="text-xs text-gray-500 mt-0.5">{sub}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Features ─────────────────────────────────────────────────── */}
      <section id="features" className="py-20 px-6">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-2xl font-bold text-center mb-12" style={{ color: '#1B2A4A' }}>
            Everything a DCAA auditor expects — automated
          </h2>
          <div className="grid sm:grid-cols-2 gap-6">
            {[
              {
                icon: AlertTriangle,
                iconColor: '#dc2626',
                title: 'Automated Anomaly Detection',
                desc: '9 DCAA compliance rules run continuously. Unauthorized balance edits, missing timesheets, hours shortages, rubber-stamp approvals, and late entry patterns — all flagged in real time before they become findings.',
              },
              {
                icon: Lock,
                iconColor: '#1B2A4A',
                title: 'Immutable Audit Trail',
                desc: 'Every action is logged permanently with who, what, when, and from which IP. Tamper-proof by design. Your written record of compliance exists before the auditor requests it.',
              },
              {
                icon: FileText,
                iconColor: '#1B2A4A',
                title: 'One-Click DCAA Package',
                desc: 'Generate a complete PDF audit package for any date range — every timesheet with approval chains, employee certifications, anomaly log, late entry documentation, and the full audit trail.',
              },
              {
                icon: Shield,
                iconColor: '#22c55e',
                title: 'False Claims Act Certification',
                desc: 'Employees certify timesheets by typing their full legal name with FCA language (31 U.S.C. §§ 3729-3733). No paper forms, no ambiguity. Timestamps and certification names stored permanently.',
              },
            ].map(({ icon: Icon, iconColor, title, desc }) => (
              <div key={title} className="rounded-xl border border-gray-200 p-6 hover:border-gray-300 transition-colors">
                <Icon className="h-6 w-6 mb-4" style={{ color: iconColor }} />
                <h3 className="font-semibold text-base mb-2">{title}</h3>
                <p className="text-sm text-gray-600 leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Origin story ─────────────────────────────────────────────── */}
      <section className="bg-gray-50 py-16 px-6 border-y border-gray-100">
        <div className="max-w-3xl mx-auto text-center">
          <div className="inline-flex items-center justify-center h-12 w-12 rounded-full bg-red-50 border border-red-100 mb-6">
            <Clock className="h-5 w-5 text-red-600" />
          </div>
          <h2 className="text-xl font-bold mb-4" style={{ color: '#1B2A4A' }}>Why KlockCadence exists</h2>
          <p className="text-gray-600 leading-relaxed text-base mb-4">
            KlockCadence was built after a finance user reduced an employee&rsquo;s annual leave
            balance by 8 hours without an approved leave request — and no system caught it.
            The employee noticed weeks later. The correction required manual reconciliation and
            raised questions with program management.
          </p>
          <p className="text-gray-600 leading-relaxed text-base">
            We built the system that would have flagged it immediately, logged it immutably,
            and surfaced it to the right person before it became a problem.
          </p>
          <div className="mt-8 inline-flex items-center gap-2 text-sm text-gray-500">
            <CheckCircle2 className="h-4 w-4 text-green-500" />
            That specific scenario is rule #1 in the anomaly detection engine
          </div>
        </div>
      </section>

      {/* ── Final CTA ────────────────────────────────────────────────── */}
      <section style={{ backgroundColor: '#1B2A4A' }} className="text-white py-16 px-6 text-center">
        <h2 className="text-2xl font-bold mb-3">Is your organization audit ready?</h2>
        <p className="opacity-70 mb-8 text-sm">
          Get your team on KlockCadence and stop leaving compliance to chance.
        </p>
        <Link
          href="/login"
          className="inline-block px-8 py-3 rounded-md font-semibold text-sm bg-white text-[#1B2A4A] hover:bg-gray-100 transition-colors"
        >
          Sign In to Your Account
        </Link>
      </section>

      {/* ── Footer ───────────────────────────────────────────────────── */}
      <footer className="bg-gray-900 text-gray-400 py-8 px-6 text-center text-xs">
        <p className="font-medium text-gray-200 mb-1">KlockCadence</p>
        <p>klockcadence.com · A product of Keystone Operations Group LLC</p>
        <p className="mt-2 opacity-60">Built for federal contractors · DCAA compliant · FAR 31.201-2</p>
      </footer>

    </div>
  )
}
