'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { Shield, AlertTriangle } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface PolicyAcknowledgmentModalProps {
  policyText: string
  policyVersion: string
  orgName: string
  isRenewal?: boolean
}

const REQUIRED_PHRASE = 'i acknowledge'

export function PolicyAcknowledgmentModal({
  policyText,
  policyVersion,
  orgName,
  isRenewal = false,
}: PolicyAcknowledgmentModalProps) {
  const [inputValue, setInputValue] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [dismissed, setDismissed] = useState(false)

  if (dismissed) return null

  const inputMatches = inputValue.trim().toLowerCase() === REQUIRED_PHRASE

  async function handleAcknowledge() {
    if (!inputMatches) return
    setSubmitting(true)
    try {
      const res = await fetch('/api/policy/acknowledge', { method: 'POST' })
      if (!res.ok) {
        const data = await res.json() as { error?: string }
        throw new Error(data.error ?? 'Acknowledgment failed.')
      }
      toast.success('Policy acknowledged. Thank you.')
      setDismissed(true)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Acknowledgment failed. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ backgroundColor: 'rgba(0,0,0,0.75)' }}
    >
      <div
        className="relative mx-4 w-full max-w-2xl rounded-xl border bg-white shadow-2xl flex flex-col"
        style={{ maxHeight: '90vh' }}
      >
        {/* Header */}
        <div className="flex items-start gap-3 border-b px-6 py-5" style={{ backgroundColor: '#1B2A4A' }}>
          <Shield className="h-6 w-6 text-white shrink-0 mt-0.5" />
          <div>
            <h2 className="text-lg font-semibold text-white">
              {isRenewal ? 'Annual Policy Re-Acknowledgment Required' : 'Policy Acknowledgment Required'}
            </h2>
            <p className="text-sm text-white/70 mt-0.5">
              {orgName} · Policy Version {policyVersion}
            </p>
          </div>
        </div>

        {/* Policy notice */}
        <div className="flex items-start gap-2 bg-amber-50 border-b border-amber-100 px-6 py-3">
          <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
          <p className="text-xs text-amber-800">
            {isRenewal
              ? 'Your annual policy acknowledgment has expired. You must re-acknowledge this policy before accessing the system. This is required under DCAA compliance regulations.'
              : 'You must read and acknowledge the timekeeping policy before accessing KlockCadence. This acknowledgment is recorded in the immutable audit log as required by DCAA regulations.'}
          </p>
        </div>

        {/* Scrollable policy text */}
        <div className="flex-1 overflow-y-auto px-6 py-4 min-h-0">
          <div className="rounded-lg border bg-gray-50 p-4">
            <pre
              className="text-xs text-gray-700 whitespace-pre-wrap font-sans leading-relaxed"
              style={{ fontFamily: 'inherit' }}
            >
              {policyText}
            </pre>
          </div>
        </div>

        {/* Acknowledgment input */}
        <div className="border-t px-6 py-5 bg-white rounded-b-xl space-y-3">
          <p className="text-sm text-gray-700">
            I have read and understand the timekeeping policy above. Type{' '}
            <strong className="font-mono bg-gray-100 px-1 rounded text-xs">I ACKNOWLEDGE</strong>{' '}
            below to confirm.
          </p>
          <input
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && inputMatches) handleAcknowledge() }}
            placeholder="Type I ACKNOWLEDGE to continue"
            disabled={submitting}
            className={`w-full border rounded-lg px-3 py-2.5 text-sm font-mono focus:ring-2 focus:outline-none transition-colors ${
              inputValue.trim() && !inputMatches
                ? 'border-red-300 focus:ring-red-200'
                : inputMatches
                ? 'border-green-400 focus:ring-green-200'
                : 'border-gray-300 focus:ring-blue-200'
            }`}
          />
          <div className="flex items-center justify-between">
            <p className="text-xs text-gray-500">
              This acknowledgment is timestamped and recorded in your permanent DCAA audit trail.
            </p>
            <Button
              onClick={handleAcknowledge}
              disabled={!inputMatches || submitting}
              className="ml-4 shrink-0"
              style={{ backgroundColor: inputMatches ? '#1B2A4A' : undefined }}
            >
              {submitting ? 'Recording…' : 'I Acknowledge'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
