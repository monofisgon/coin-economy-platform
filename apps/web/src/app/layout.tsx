import type { Metadata } from 'next'
import { AuthProvider } from '../lib/auth-context'
import Nav from './nav'
import './globals.css'

export const metadata: Metadata = {
  title: 'Coin Economy Platform',
  description: 'Plataforma de economía de monedas virtuales',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body className="bg-gray-50 min-h-screen text-gray-900">
        <AuthProvider>
          <Nav />
          <main className="max-w-5xl mx-auto px-4 py-6">{children}</main>
        </AuthProvider>
      </body>
    </html>
  )
}
