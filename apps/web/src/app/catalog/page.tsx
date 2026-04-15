'use client'

import { useState, type FormEvent } from 'react'
import Link from 'next/link'
import { api, type Product } from '../../lib/api'
import { useAuth } from '../../lib/auth-context'
import { Search, MapPin, Building2, Coins } from 'lucide-react'

export default function CatalogPage() {
  const { token } = useAuth()
  const [location, setLocation] = useState('')
  const [submitted, setSubmitted] = useState(false)
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleSearch(e: FormEvent) {
    e.preventDefault()
    if (!location.trim()) return
    setLoading(true)
    setError('')
    setSubmitted(true)
    try {
      const { products } = await api.getCatalog(location.trim(), token ?? undefined)
      setProducts(products)
    } catch (err: unknown) {
      const e = err as { message?: string }
      setError(e.message ?? 'Error al cargar catálogo')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-3xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Catálogo</h1>
        <p className="text-gray-500 text-sm mt-1">Encuentra productos de negocios cerca de ti</p>
      </div>

      {/* Location search */}
      <div className="bg-white rounded-xl border border-gray-200 p-5 mb-6">
        <div className="flex items-center gap-2 mb-3">
          <MapPin className="w-4 h-4 text-blue-600" />
          <span className="text-sm font-medium text-gray-700">Selecciona tu ubicación</span>
        </div>
        <form onSubmit={handleSearch} className="flex gap-2">
          <input
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            placeholder="Ciudad o área (ej: Bogotá, Medellín...)"
            required
            className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
          <button
            type="submit"
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition-colors font-medium"
          >
            <Search className="w-4 h-4" />
            Buscar
          </button>
        </form>
      </div>

      {loading && (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
        </div>
      )}

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 text-sm mb-4">
          {error}
        </div>
      )}

      {submitted && !loading && !error && products.length === 0 && (
        <div className="text-center py-12">
          <Building2 className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500">No hay productos disponibles en <strong>{location}</strong>.</p>
          <p className="text-gray-400 text-sm mt-1">Intenta con otra ciudad o área.</p>
        </div>
      )}

      {products.length > 0 && (
        <>
          <p className="text-sm text-gray-500 mb-3">
            {products.length} producto{products.length !== 1 ? 's' : ''} en <strong>{location}</strong>
          </p>
          <div className="space-y-3">
            {products.map((p) => (
              <div key={p.id} className="bg-white rounded-xl border border-gray-200 p-4 flex items-center gap-4 hover:border-blue-200 transition-colors">
                {p.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={p.imageUrl} alt={p.name} className="w-16 h-16 rounded-lg object-cover shrink-0" />
                ) : (
                  <div className="w-16 h-16 rounded-lg bg-gray-100 flex items-center justify-center shrink-0">
                    <Coins className="w-6 h-6 text-gray-400" />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-gray-900">{p.name}</div>
                  <div className="text-gray-500 text-sm truncate">{p.description}</div>
                  {p.business && (
                    <div className="mt-1 text-xs text-gray-400">
                      Negocio:{' '}
                      <Link href={`/businesses/${p.business.id}`} className="text-blue-600 hover:underline font-medium">
                        {p.business.name}
                      </Link>
                    </div>
                  )}
                </div>
                <div className="shrink-0 text-right">
                  <span className="font-bold text-blue-600 text-lg">{p.coinPrice}</span>
                  <div className="text-xs text-gray-400">Coins</div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
