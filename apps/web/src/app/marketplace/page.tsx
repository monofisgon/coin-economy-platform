'use client'

import { useEffect, useState, type FormEvent } from 'react'
import Link from 'next/link'
import { api, type Offer } from '../../lib/api'
import { useAuth } from '../../lib/auth-context'
import { Plus, Lock, ShoppingCart, X, Filter, AlertCircle } from 'lucide-react'

export default function MarketplacePage() {
  const { user, token } = useAuth()
  const [offers, setOffers] = useState<Offer[]>([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [formError, setFormError] = useState('')
  const [actionMsg, setActionMsg] = useState('')
  const [actionError, setActionError] = useState('')

  // Filters
  const [minCoins, setMinCoins] = useState('')
  const [maxCoins, setMaxCoins] = useState('')
  const [maxPrice, setMaxPrice] = useState('')

  function loadOffers() {
    if (!token) return
    setLoading(true)
    api.listOffers(token)
      .then(({ offers }) => setOffers(offers))
      .catch(() => {})
      .finally(() => setLoading(false))
  }

  useEffect(() => { loadOffers() }, [token]) // eslint-disable-line react-hooks/exhaustive-deps

  async function handleCreate(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!token) return
    setFormError('')
    setCreating(true)
    const form = new FormData(e.currentTarget)
    try {
      await api.createOffer(
        {
          coinAmount: Number(form.get('coinAmount')),
          diamondPricePerCoin: Number(form.get('diamondPricePerCoin')),
          visibility: form.get('visibility') as 'PUBLICA' | 'PRIVADA',
        },
        token,
      )
      setShowForm(false)
      setActionMsg('Oferta publicada exitosamente.')
      setActionError('')
      loadOffers()
    } catch (err: unknown) {
      const e = err as { message?: string }
      setFormError(e.message ?? 'Error al crear oferta')
    } finally {
      setCreating(false)
    }
  }

  async function handleAccept(offer: Offer) {
    if (!token) return
    let accessCode: string | undefined
    if (offer.visibility === 'PRIVADA') {
      const code = prompt('Esta oferta es privada. Ingresa el código de acceso:')
      if (!code) return
      accessCode = code
    }
    try {
      await api.acceptOffer(offer.id, accessCode ? { accessCode } : {}, token)
      setActionMsg('¡Oferta aceptada! Los Coins han sido transferidos.')
      setActionError('')
      loadOffers()
    } catch (err: unknown) {
      const e = err as { message?: string }
      setActionError(e.message ?? 'Error al aceptar oferta')
      setActionMsg('')
    }
  }

  async function handleCancel(offerId: string) {
    if (!token) return
    try {
      await api.cancelOffer(offerId, token)
      setActionMsg('Oferta cancelada. Los Coins han sido devueltos.')
      setActionError('')
      loadOffers()
    } catch (err: unknown) {
      const e = err as { message?: string }
      setActionError(e.message ?? 'Error al cancelar')
      setActionMsg('')
    }
  }

  // Apply filters
  const filtered = offers.filter((o) => {
    if (minCoins && o.coinAmount < Number(minCoins)) return false
    if (maxCoins && o.coinAmount > Number(maxCoins)) return false
    if (maxPrice && o.diamondPricePerCoin > Number(maxPrice)) return false
    return true
  })

  return (
    <div className="max-w-3xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Marketplace</h1>
          <p className="text-gray-500 text-sm mt-0.5">Compra y vende Coins con Diamonds</p>
        </div>
        {token && user?.role === 'USER' && (
          <button
            onClick={() => setShowForm((v) => !v)}
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition-colors font-medium"
          >
            {showForm ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
            {showForm ? 'Cancelar' : 'Publicar oferta'}
          </button>
        )}
      </div>

      {/* Create offer form */}
      {showForm && (
        <div className="bg-white rounded-xl border border-gray-200 p-5 mb-5">
          <h2 className="font-semibold text-gray-900 mb-4">Nueva oferta</h2>
          <form onSubmit={handleCreate} className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Cantidad de Coins</label>
                <input name="coinAmount" type="number" min={1} placeholder="100" required
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Precio (Diamonds/Coin)</label>
                <input name="diamondPricePerCoin" type="number" min={0.01} step={0.01} placeholder="1.5" required
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Visibilidad</label>
              <select name="visibility"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                <option value="PUBLICA">Pública</option>
                <option value="PRIVADA">Privada (con código de acceso)</option>
              </select>
            </div>
            {formError && (
              <div className="flex items-center gap-2 text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-sm">
                <AlertCircle className="w-4 h-4 shrink-0" />
                {formError}
              </div>
            )}
            <button type="submit" disabled={creating}
              className="w-full py-2.5 bg-blue-600 text-white rounded-lg font-medium text-sm hover:bg-blue-700 disabled:opacity-60 transition-colors">
              {creating ? 'Publicando...' : 'Publicar oferta'}
            </button>
          </form>
        </div>
      )}

      {/* Filters */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 mb-4">
        <div className="flex items-center gap-2 mb-3">
          <Filter className="w-4 h-4 text-gray-400" />
          <span className="text-sm font-medium text-gray-700">Filtros</span>
        </div>
        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className="block text-xs text-gray-500 mb-1">Coins mínimo</label>
            <input type="number" value={minCoins} onChange={(e) => setMinCoins(e.target.value)} placeholder="0"
              className="w-full px-2.5 py-1.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Coins máximo</label>
            <input type="number" value={maxCoins} onChange={(e) => setMaxCoins(e.target.value)} placeholder="∞"
              className="w-full px-2.5 py-1.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Precio máx. (D/C)</label>
            <input type="number" value={maxPrice} onChange={(e) => setMaxPrice(e.target.value)} placeholder="∞"
              className="w-full px-2.5 py-1.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
        </div>
      </div>

      {actionMsg && (
        <div className="mb-4 px-4 py-2.5 bg-green-50 border border-green-200 text-green-700 rounded-lg text-sm">
          {actionMsg}
        </div>
      )}
      {actionError && (
        <div className="mb-4 flex items-center gap-2 px-4 py-2.5 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">
          <AlertCircle className="w-4 h-4 shrink-0" />
          {actionError}
        </div>
      )}

      {/* Offers list */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 text-gray-400 text-sm">No hay ofertas disponibles.</div>
      ) : (
        <div className="space-y-3">
          {filtered.map((offer) => {
            const isOwn = user && offer.sellerId === user.id
            const isPrivate = offer.visibility === 'PRIVADA'

            return (
              <div key={offer.id} className="bg-white rounded-xl border border-gray-200 p-4 flex items-center justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    {isPrivate && <Lock className="w-3.5 h-3.5 text-gray-400 shrink-0" />}
                    {isPrivate ? (
                      <span className="text-gray-400 text-sm italic">Oferta privada</span>
                    ) : (
                      <>
                        <span className="font-semibold text-gray-900">{offer.coinAmount} Coins</span>
                        <span className="text-gray-500 text-sm">a {offer.diamondPricePerCoin} Diamonds/Coin</span>
                      </>
                    )}
                  </div>
                  {offer.seller && (
                    <div className="text-xs text-gray-400 mt-1">
                      Vendedor:{' '}
                      <Link href={`/profile/${offer.seller.username}`} className="text-blue-600 hover:underline">
                        {offer.seller.username}
                      </Link>
                    </div>
                  )}
                  <div className="text-xs text-gray-300 mt-0.5">
                    {new Date(offer.createdAt).toLocaleDateString('es-CO')}
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  {!isPrivate && (
                    <div className="text-right">
                      <div className="text-xs text-gray-400">Total</div>
                      <div className="font-bold text-purple-600 text-sm">
                        {(offer.coinAmount * offer.diamondPricePerCoin).toFixed(2)} D
                      </div>
                    </div>
                  )}
                  {isOwn ? (
                    <button onClick={() => handleCancel(offer.id)}
                      className="inline-flex items-center gap-1 px-3 py-1.5 bg-red-50 text-red-600 border border-red-200 text-sm rounded-lg hover:bg-red-100 transition-colors">
                      <X className="w-3.5 h-3.5" /> Cancelar
                    </button>
                  ) : token ? (
                    <button onClick={() => handleAccept(offer)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition-colors">
                      <ShoppingCart className="w-3.5 h-3.5" /> Comprar
                    </button>
                  ) : null}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
