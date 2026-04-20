'use client'

import { AuthProvider } from '../lib/auth-context'
import Nav from './nav'

export default function ClientLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <Nav />
      <main className="max-w-5xl mx-auto px-4 py-6">{children}</main>
    </AuthProvider>
  )
}
