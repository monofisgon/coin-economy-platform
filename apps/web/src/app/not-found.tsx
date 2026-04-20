import Link from 'next/link'

export default function NotFound() {
  return (
    <html lang="es">
      <body className="bg-gray-50 min-h-screen flex items-center justify-center text-gray-900">
        <div className="text-center">
          <h1 className="text-6xl font-bold text-gray-300 mb-4">404</h1>
          <p className="text-xl text-gray-600 mb-6">Página no encontrada</p>
          <Link
            href="/"
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Volver al inicio
          </Link>
        </div>
      </body>
    </html>
  )
}
