'use client'

import { useState } from 'react'
import { DCAA_CERTIFICATION_TEXT, validateCertificationName } from '@/lib/dcaa/validators'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { AlertTriangle } from 'lucide-react'

interface CertificationModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  fullName: string
  weekRange: string
  onConfirm: (typedName: string) => Promise<void>
}

export function CertificationModal({
  open,
  onOpenChange,
  fullName,
  weekRange,
  onConfirm,
}: CertificationModalProps) {
  const [typedName, setTypedName] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit() {
    const result = validateCertificationName(typedName, fullName)
    if (!result.valid) {
      setError(result.errors[0] ?? 'Name does not match.')
      return
    }

    setSubmitting(true)
    setError(null)
    try {
      await onConfirm(typedName)
      onOpenChange(false)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Submission failed.')
    } finally {
      setSubmitting(false)
    }
  }

  function handleClose() {
    if (!submitting) {
      setTypedName('')
      setError(null)
      onOpenChange(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-lg" onClose={handleClose}>
        <DialogHeader>
          <div className="flex items-center gap-2 mb-1">
            <AlertTriangle className="h-5 w-5 text-amber-500" />
            <DialogTitle>Employee Certification</DialogTitle>
          </div>
          <DialogDescription>
            Timesheet week: <strong>{weekRange}</strong>
          </DialogDescription>
        </DialogHeader>

        <div className="rounded-md border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 leading-relaxed">
          {DCAA_CERTIFICATION_TEXT}
        </div>

        <div className="space-y-3 mt-2">
          <Label htmlFor="cert-name">
            Type your full legal name to certify:{' '}
            <span className="text-muted-foreground font-normal">({fullName})</span>
          </Label>
          <Input
            id="cert-name"
            value={typedName}
            onChange={(e) => {
              setTypedName(e.target.value)
              setError(null)
            }}
            placeholder="Type your full legal name"
            autoComplete="off"
            autoFocus
          />
          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={submitting}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={submitting || typedName.trim() === ''}>
            {submitting ? 'Certifying…' : 'Certify & Submit'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
