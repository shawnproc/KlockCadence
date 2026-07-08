'use client'

import { motion } from 'framer-motion'
import { CheckCircle2, AlertCircle, Clock, Zap, ExternalLink } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import type { IntegrationType } from '@/types'
import { INTEGRATION_META } from './meta'
import { formatRelativeTime } from '@/lib/utils'

interface IntegrationCardProps {
  type: IntegrationType
  status: 'connected' | 'disconnected' | 'error' | 'coming_soon'
  lastSyncAt: string | null
  lastSyncStatus: string | null
  lastError: string | null
  syncing?: boolean
  onConfigure: () => void
  onSyncNow: () => void
  onConnect: () => void
}

export function IntegrationCard({
  type,
  status,
  lastSyncAt,
  lastSyncStatus,
  lastError,
  syncing,
  onConfigure,
  onSyncNow,
  onConnect,
}: IntegrationCardProps) {
  const meta = INTEGRATION_META[type]
  const isConnected = status === 'connected'
  const isError = status === 'error'
  const isComingSoon = status === 'coming_soon'

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
    >
      <Card className="card-elevated h-full">
        <CardContent className="pt-5 flex flex-col h-full">
          {/* Header */}
          <div className="flex items-start justify-between gap-3 mb-4">
            <div className="flex items-center gap-3">
              <div
                className="h-10 w-10 rounded-lg flex items-center justify-center text-white font-bold text-sm shrink-0"
                style={{ backgroundColor: meta.color }}
              >
                {meta.initials}
              </div>
              <div>
                <div className="font-semibold text-sm leading-tight">{meta.name}</div>
                <div className="text-xs text-muted-foreground mt-0.5">{meta.description}</div>
              </div>
            </div>
            <StatusBadge status={status} />
          </div>

          {/* Last sync info */}
          {isConnected && (
            <div className="mb-3 text-xs text-muted-foreground space-y-1">
              {lastSyncAt ? (
                <div className="flex items-center gap-1.5">
                  <Clock className="h-3 w-3" />
                  Last sync: {formatRelativeTime(lastSyncAt)}
                  {lastSyncStatus === 'error' && (
                    <span className="text-red-500 font-medium ml-1">failed</span>
                  )}
                  {lastSyncStatus === 'partial' && (
                    <span className="text-orange-500 font-medium ml-1">partial</span>
                  )}
                </div>
              ) : (
                <div className="flex items-center gap-1.5 text-muted-foreground">
                  <Clock className="h-3 w-3" />
                  Never synced
                </div>
              )}
            </div>
          )}

          {/* Error banner */}
          {(isError || (isConnected && lastSyncStatus === 'error')) && lastError && (
            <div className="mb-3 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2">
              <AlertCircle className="h-3.5 w-3.5 text-red-500 shrink-0 mt-0.5" />
              <p className="text-xs text-red-700 line-clamp-2">{lastError}</p>
            </div>
          )}

          {/* Actions */}
          <div className="mt-auto flex flex-wrap gap-2 pt-3">
            {isComingSoon ? (
              <span className="text-xs text-muted-foreground italic">Coming soon</span>
            ) : isConnected || isError ? (
              <>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={onSyncNow}
                  disabled={syncing}
                  className="h-7 text-xs gap-1.5"
                >
                  <Zap className="h-3 w-3" />
                  {syncing ? 'Syncing…' : 'Sync Now'}
                </Button>
                <Button
                  size="sm"
                  onClick={onConfigure}
                  className="h-7 text-xs"
                  style={{ backgroundColor: '#1B2A4A' }}
                >
                  Configure
                </Button>
              </>
            ) : (
              <Button
                size="sm"
                onClick={onConnect}
                className="h-7 text-xs gap-1.5"
                style={{ backgroundColor: '#1B2A4A' }}
              >
                <ExternalLink className="h-3 w-3" />
                Connect
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </motion.div>
  )
}

function StatusBadge({ status }: { status: string }) {
  if (status === 'connected') {
    return (
      <Badge variant="outline" className="text-green-700 border-green-300 bg-green-50 text-[10px] shrink-0 gap-1">
        <CheckCircle2 className="h-2.5 w-2.5" />
        Connected
      </Badge>
    )
  }
  if (status === 'error') {
    return (
      <Badge variant="outline" className="text-red-700 border-red-300 bg-red-50 text-[10px] shrink-0 gap-1">
        <AlertCircle className="h-2.5 w-2.5" />
        Error
      </Badge>
    )
  }
  if (status === 'coming_soon') {
    return (
      <Badge variant="outline" className="text-muted-foreground border-border text-[10px] shrink-0">
        Coming Soon
      </Badge>
    )
  }
  return (
    <Badge variant="outline" className="text-muted-foreground border-border text-[10px] shrink-0">
      Available
    </Badge>
  )
}
