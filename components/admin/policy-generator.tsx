'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { AlertTriangle, Download, FileText, CheckCircle2, RefreshCw } from 'lucide-react'
import { formatDate, formatDateTime } from '@/lib/utils'

interface PolicyVersion {
  id: string
  version: string
  effective_date: string
  storage_path: string
  created_at: string
  created_by_name: string
}

interface PolicyGeneratorProps {
  orgName: string
  currentVersion: string
  currentVersionUpdatedAt: string
  currentPolicyText: string
  versions: PolicyVersion[]
}

export function PolicyGenerator({
  orgName,
  currentVersion,
  currentVersionUpdatedAt,
  currentPolicyText,
  versions: initialVersions,
}: PolicyGeneratorProps) {
  const [policyText, setPolicyText] = useState(currentPolicyText)
  const [effectiveDate, setEffectiveDate] = useState(() => new Date().toISOString().split('T')[0]!)
  const [confirming, setConfirming] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [versions, setVersions] = useState(initialVersions)
  const [latestVersion, setLatestVersion] = useState(currentVersion)
  const [downloading, setDownloading] = useState<string | null>(null)

  const nextVersion = bumpVersion(latestVersion)
  const hasChanges = policyText.trim() !== currentPolicyText.trim()

  function bumpVersion(v: string) {
    const major = parseInt(v.split('.')[0] ?? '1', 10)
    return `${major + 1}.0`
  }

  async function handleGenerate() {
    setGenerating(true)
    try {
      const res = await fetch('/api/policy/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ policy_text: policyText, effective_date: effectiveDate }),
      })

      if (!res.ok) {
        const data = await res.json() as { error?: string }
        throw new Error(data.error ?? 'Generation failed.')
      }

      const { version, version_id, storage_path } = await res.json() as {
        version: string
        version_id: string
        storage_path: string
      }

      setLatestVersion(version)
      setVersions((prev) => [
        {
          id: version_id,
          version,
          effective_date: effectiveDate,
          storage_path,
          created_at: new Date().toISOString(),
          created_by_name: 'You',
        },
        ...prev,
      ])
      setConfirming(false)
      toast.success(`Policy Version ${version} published. All employees will be required to re-acknowledge.`)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to generate policy.')
    } finally {
      setGenerating(false)
    }
  }

  async function handleDownload(versionId: string) {
    setDownloading(versionId)
    try {
      const res = await fetch(`/api/policy/versions/${versionId}/download`)
      if (!res.ok) {
        const data = await res.json() as { error?: string }
        throw new Error(data.error ?? 'Download failed.')
      }
      // The route redirects to a signed URL — open in new tab
      window.open(`/api/policy/versions/${versionId}/download`, '_blank')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Download failed.')
    } finally {
      setDownloading(null)
    }
  }

  return (
    <div className="space-y-6">
      {/* Current version status */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-5">
            <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Current Version</p>
            <div className="flex items-center gap-2 mt-2">
              <span className="text-2xl font-bold">v{latestVersion}</span>
              <Badge variant="outline" className="text-green-700 border-green-300 bg-green-50">Active</Badge>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5">
            <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Last Updated</p>
            <p className="text-sm font-semibold mt-2">{formatDateTime(currentVersionUpdatedAt)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5">
            <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Versions Published</p>
            <p className="text-2xl font-bold mt-2">{versions.length}</p>
          </CardContent>
        </Card>
      </div>

      {/* Policy editor */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <FileText className="h-4 w-4" />
            Policy Text Editor
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3">
            <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
            <p className="text-xs text-amber-800">
              <strong>Publishing a new version will require ALL employees to re-acknowledge</strong> before accessing
              the system. This action is recorded in the immutable audit trail and cannot be undone.
            </p>
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium">
              Effective Date <span className="text-red-500">*</span>
            </label>
            <input
              type="date"
              value={effectiveDate}
              onChange={(e) => setEffectiveDate(e.target.value)}
              className="border rounded-lg px-3 py-2 text-sm bg-background focus:ring-2 focus:ring-ring focus:outline-none w-48"
            />
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium">
                Policy Text <span className="text-red-500">*</span>
              </label>
              <span className="text-xs text-muted-foreground tabular-nums">
                {policyText.trim().length} characters
              </span>
            </div>
            <textarea
              value={policyText}
              onChange={(e) => setPolicyText(e.target.value)}
              rows={28}
              className="w-full border rounded-lg px-3 py-2 text-xs bg-background font-mono resize-none focus:ring-2 focus:ring-ring focus:outline-none leading-relaxed"
              placeholder="Enter policy text…"
            />
            <p className="text-xs text-muted-foreground">
              The policy text shown here is what employees see in the acknowledgment modal and what is rendered in the generated PDF.
            </p>
          </div>

          {/* Confirmation gate */}
          {confirming ? (
            <div className="rounded-lg border-2 border-red-300 bg-red-50 p-4 space-y-3">
              <div className="flex items-start gap-2">
                <AlertTriangle className="h-5 w-5 text-red-600 shrink-0" />
                <div>
                  <p className="font-semibold text-red-800 text-sm">Confirm: Publish Version {nextVersion}</p>
                  <p className="text-xs text-red-700 mt-1">
                    Organization: <strong>{orgName}</strong><br />
                    Effective Date: <strong>{effectiveDate ? formatDate(effectiveDate) : '—'}</strong><br />
                    This will immediately invalidate all existing employee acknowledgments.
                    Every employee must re-acknowledge on their next login before accessing any part of the system.
                  </p>
                </div>
              </div>
              <div className="flex gap-3">
                <Button
                  onClick={handleGenerate}
                  disabled={generating}
                  className="gap-1.5"
                  style={{ backgroundColor: '#DC2626' }}
                >
                  <RefreshCw className={`h-3.5 w-3.5 ${generating ? 'animate-spin' : ''}`} />
                  {generating ? 'Publishing…' : `Publish Version ${nextVersion}`}
                </Button>
                <Button variant="outline" onClick={() => setConfirming(false)} disabled={generating}>
                  Cancel
                </Button>
              </div>
            </div>
          ) : (
            <Button
              onClick={() => setConfirming(true)}
              disabled={policyText.trim().length < 100 || !effectiveDate}
              style={{ backgroundColor: '#1B2A4A' }}
              className="gap-1.5"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              Generate &amp; Publish Version {nextVersion}
              {hasChanges && <span className="ml-1 text-xs opacity-75">(with edits)</span>}
            </Button>
          )}
        </CardContent>
      </Card>

      {/* Version history */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4" />
            Version History
          </CardTitle>
        </CardHeader>
        <CardContent>
          {versions.length === 0 ? (
            <p className="text-sm text-muted-foreground">No versions yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left pb-2 font-medium text-xs text-muted-foreground uppercase tracking-wide">Version</th>
                    <th className="text-left pb-2 font-medium text-xs text-muted-foreground uppercase tracking-wide">Effective Date</th>
                    <th className="text-left pb-2 font-medium text-xs text-muted-foreground uppercase tracking-wide">Published</th>
                    <th className="text-left pb-2 font-medium text-xs text-muted-foreground uppercase tracking-wide">Published By</th>
                    <th className="w-24" />
                  </tr>
                </thead>
                <tbody>
                  {versions.map((v, i) => (
                    <tr key={v.id} className="border-t">
                      <td className="py-2.5 pr-4">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold">v{v.version}</span>
                          {i === 0 && (
                            <Badge variant="outline" className="text-green-700 border-green-300 bg-green-50 text-[10px]">
                              Current
                            </Badge>
                          )}
                        </div>
                      </td>
                      <td className="py-2.5 pr-4 text-sm">{v.effective_date ? formatDate(v.effective_date) : '—'}</td>
                      <td className="py-2.5 pr-4 text-sm text-muted-foreground">{formatDateTime(v.created_at)}</td>
                      <td className="py-2.5 pr-4 text-sm text-muted-foreground">{v.created_by_name}</td>
                      <td className="py-2.5">
                        {v.storage_path ? (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleDownload(v.id)}
                            disabled={downloading === v.id}
                            className="h-7 text-xs gap-1"
                          >
                            <Download className="h-3 w-3" />
                            {downloading === v.id ? 'Opening…' : 'PDF'}
                          </Button>
                        ) : (
                          <span className="text-xs text-muted-foreground">No PDF</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
