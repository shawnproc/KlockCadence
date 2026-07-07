import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  metadataBase: new URL('https://www.klockcadence.com'),
  title: 'KlockCadence — DCAA Compliant Timekeeping',
  description:
    'DCAA compliant workforce timekeeping and PTO management for federal contractors. Built by Keystone Operations Group LLC.',
  openGraph: {
    title: 'KlockCadence — DCAA Compliant Timekeeping',
    description: 'Automated compliance monitoring, immutable audit trails, and one-click DCAA packages for federal contractors.',
    url: 'https://www.klockcadence.com',
    siteName: 'KlockCadence',
    type: 'website',
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  )
}
