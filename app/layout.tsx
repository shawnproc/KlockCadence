import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'KlockCadence — DCAA Compliant Timekeeping',
  description:
    'DCAA compliant workforce timekeeping and PTO management for federal contractors. Built by Keystone Operations Group LLC.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  )
}
