'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

const R = 40
const CIRC = 2 * Math.PI * R

function strokeColor(score: number) {
  if (score >= 80) return '#22c55e'
  if (score >= 60) return '#eab308'
  return '#ef4444'
}

export interface ComplianceBreakdownItem {
  label: string
  pts: number
  max: number
  zeroLabel?: string  // shown in red when pts === 0
}

interface ComplianceScoreProps {
  score: number
  breakdown: ComplianceBreakdownItem[]
}

export function ComplianceScore({ score, breakdown }: ComplianceScoreProps) {
  const offset = CIRC - (score / 100) * CIRC
  const color = strokeColor(score)
  const label = score >= 80 ? 'Compliant' : score >= 60 ? 'At Risk' : 'Non-Compliant'

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">DCAA Compliance Score</CardTitle>
        <p className="text-xs text-muted-foreground">Updated in real time</p>
      </CardHeader>
      <CardContent>
        <div className="flex items-center gap-6">
          <div className="relative shrink-0">
            <svg width="96" height="96" viewBox="0 0 100 100">
              <circle cx="50" cy="50" r={R} fill="none" stroke="#e5e7eb" strokeWidth="10" />
              <circle
                cx="50" cy="50" r={R}
                fill="none"
                stroke={color}
                strokeWidth="10"
                strokeDasharray={CIRC}
                strokeDashoffset={offset}
                strokeLinecap="round"
                style={{ transform: 'rotate(-90deg)', transformOrigin: '50px 50px', transition: 'stroke-dashoffset 0.6s ease' }}
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-xl font-bold leading-none" style={{ color }}>{score}</span>
              <span className="text-[9px] text-muted-foreground mt-0.5">{label}</span>
            </div>
          </div>

          <div className="flex-1 space-y-2.5">
            {breakdown.map(({ label, pts, max, zeroLabel }) => {
              const isZero = pts === 0
              const isFull = pts === max
              return (
                <div key={label} className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">{label}</span>
                  <span className={
                    isFull
                      ? 'text-green-600 font-semibold'
                      : isZero && zeroLabel
                        ? 'text-red-600 font-semibold'
                        : 'text-orange-500 font-semibold'
                  }>
                    {isZero && zeroLabel ? zeroLabel : `${pts}/${max}`}
                  </span>
                </div>
              )
            })}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
