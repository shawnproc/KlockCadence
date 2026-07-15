'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Papa from 'papaparse'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { toast } from 'sonner'
import { Upload, FileText, X } from 'lucide-react'

interface ImportResult {
  created: number
  skipped: number
  errored: number
  details?: {
    skipped: { email: string; reason: string }[]
    errors: { row: number; reason: string }[]
  }
}

export function CsvImport() {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [rows, setRows] = useState<Record<string, unknown>[]>([])
  const [fileName, setFileName] = useState('')
  const [importing, setImporting] = useState(false)
  const [result, setResult] = useState<ImportResult | null>(null)

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setResult(null)
    setFileName(file.name)
    Papa.parse<Record<string, unknown>>(file, {
      header: true,
      skipEmptyLines: true,
      complete: (res) => {
        setRows(res.data)
        toast.success(`Parsed ${res.data.length} row${res.data.length === 1 ? '' : 's'}.`)
      },
      error: () => toast.error('Could not parse that CSV.'),
    })
  }

  async function handleImport() {
    if (rows.length === 0) { toast.error('Choose a CSV first.'); return }
    setImporting(true)
    setResult(null)
    try {
      const res = await fetch('/api/admin/bulk-import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ employees: rows }),
      })
      const data = await res.json() as ImportResult & { error?: string }
      if (!res.ok) throw new Error(data.error ?? 'Import failed.')
      setResult(data)
      toast.success(`Imported ${data.created}. Skipped ${data.skipped}. Errors ${data.errored}.`)
      setRows([])
      setFileName('')
      router.refresh()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Import failed.')
    } finally {
      setImporting(false)
    }
  }

  if (!open) {
    return (
      <div className="flex justify-end">
        <Button variant="outline" size="sm" onClick={() => setOpen(true)} className="gap-1.5">
          <Upload className="h-4 w-4" />
          Import CSV
        </Button>
      </div>
    )
  }

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <CardTitle className="text-base">Import Employees from CSV</CardTitle>
        <button onClick={() => { setOpen(false); setRows([]); setFileName(''); setResult(null) }} className="text-muted-foreground hover:text-foreground">
          <X className="h-4 w-4" />
        </button>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-xs text-muted-foreground">
          Columns: <code>full_name, email, role, department, hire_date</code>. Each new employee is emailed a
          secure link to set their own password. Existing emails are skipped; <code>role</code> defaults to
          employee and <code>hire_date</code> to today if blank.
        </p>

        <input type="file" accept=".csv" onChange={handleFile} className="text-sm" />
        {fileName && (
          <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
            <FileText className="h-3.5 w-3.5" />
            {fileName} — {rows.length} row{rows.length === 1 ? '' : 's'} ready
          </p>
        )}

        <Button onClick={handleImport} disabled={importing || rows.length === 0} size="sm">
          {importing ? 'Importing…' : `Import ${rows.length || ''} employee${rows.length === 1 ? '' : 's'}`}
        </Button>

        {result && (
          <div className="rounded-md border bg-muted/30 p-3 text-xs space-y-1">
            <p><span className="font-medium text-green-700">{result.created}</span> created · <span className="font-medium">{result.skipped}</span> skipped · <span className={result.errored > 0 ? 'font-medium text-red-600' : 'font-medium'}>{result.errored}</span> errored</p>
            {result.details?.errors?.slice(0, 8).map((err, i) => (
              <p key={i} className="text-red-600">Row {err.row}: {err.reason}</p>
            ))}
            {result.details?.skipped?.slice(0, 8).map((s, i) => (
              <p key={i} className="text-muted-foreground">Skipped {s.email}: {s.reason}</p>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
