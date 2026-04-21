import type { Metadata } from 'next'
import ClientLayout from './client-layout'
import './globals.css'

export const metadata: Metadata = {
  title: 'Krowdco',
  description: 'Plataforma de economía de monedas virtuales',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body className="bg-gray-50 min-h-screen text-gray-900">
        <ClientLayout>{children}</ClientLayout>
      </body>
    </html>
  )
}
