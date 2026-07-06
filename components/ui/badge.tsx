import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

const badgeVariants = cva(
  'inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors',
  {
    variants: {
      variant: {
        default: 'border-transparent bg-primary text-primary-foreground',
        secondary: 'border-transparent bg-secondary text-secondary-foreground',
        destructive: 'border-transparent bg-destructive text-destructive-foreground',
        outline: 'text-foreground',
        draft: 'border-gray-200 bg-gray-100 text-gray-700',
        submitted: 'border-blue-200 bg-blue-100 text-blue-700',
        approved: 'border-green-200 bg-green-100 text-green-700',
        rejected: 'border-red-200 bg-red-100 text-red-700',
        pending: 'border-yellow-200 bg-yellow-100 text-yellow-700',
        cancelled: 'border-gray-200 bg-gray-100 text-gray-500',
        denied: 'border-red-200 bg-red-100 text-red-700',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  }
)

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />
}

export { Badge, badgeVariants }
